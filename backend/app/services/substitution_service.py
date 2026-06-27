"""
Autonomous Substitution Engine.

Three things live here:
  1. Hard eligibility — who CAN be assigned at all (never violated,
     regardless of mode or score).
  2. The recommendation/compatibility scorer — ranks eligible candidates
     so a human (Assisted mode) or the system itself (Autonomous mode)
     can pick the best one.
  3. Mode-aware execution — what actually happens after a leave is
     approved, driven by the campus_operations_mode setting.

Design note on "fairness": rather than a separate running-counter table
that could drift out of sync with reality, fairness is computed on demand
directly from alter_assignments — the substitution record IS the source
of truth, so there's only ever one place that can disagree with itself.
This trades a small amount of query cost for never needing a
reconciliation job.
"""
from datetime import datetime, timedelta, timezone
from dataclasses import dataclass, field

from sqlalchemy import func
from sqlalchemy.orm import Session
from fastapi import HTTPException

from app.models.user import User, Role
from app.models.leave import LeaveRequest, LeaveStatus, AlterAssignment, AssignmentType
from app.models.timetable import TimetableSlot
from app.models.subject import Subject
from app.models.department import Department
from app.models.substitution_preference import SubstitutionPreference
from app.models.system_setting import SystemSetting, CAMPUS_OPERATIONS_MODES
from app.services.credit_service import apply_credit_change
from app.services import notification_service
from app.services.admin_service import log_audit_event

FAIRNESS_WINDOW_DAYS = 30  # "monthly substitutions" window for fairness scoring


# ---------- Campus Operations Mode ----------

VALID_MODES = CAMPUS_OPERATIONS_MODES


def get_mode(db: Session) -> str:
    row = db.query(SystemSetting).filter(SystemSetting.key == "campus_operations_mode").first()
    return row.value if row and row.value in VALID_MODES else "manual"


def set_mode(db: Session, mode: str, actor: User) -> str:
    if mode not in VALID_MODES:
        raise HTTPException(status_code=400, detail=f"mode must be one of {sorted(VALID_MODES)}")
    row = db.query(SystemSetting).filter(SystemSetting.key == "campus_operations_mode").first()
    if not row:
        row = SystemSetting(key="campus_operations_mode", value=mode)
        db.add(row)
    else:
        row.value = mode
    log_audit_event(db, actor.id, "campus_operations.mode_change", "system_setting", None, {"mode": mode})
    db.commit()
    return mode


def get_emergency_window_hours(db: Session) -> int:
    row = db.query(SystemSetting).filter(SystemSetting.key == "emergency_window_hours").first()
    try:
        return int(row.value) if row else 2
    except (ValueError, TypeError):
        return 2


# ---------- Preferences ----------

def get_or_create_preferences(db: Session, teacher_id: int) -> SubstitutionPreference:
    pref = db.query(SubstitutionPreference).filter(SubstitutionPreference.teacher_id == teacher_id).first()
    if not pref:
        pref = SubstitutionPreference(teacher_id=teacher_id)
        db.add(pref)
        db.flush()
    return pref


def update_preferences(db: Session, teacher_id: int, **fields) -> SubstitutionPreference:
    pref = get_or_create_preferences(db, teacher_id)
    for key, value in fields.items():
        if value is not None and hasattr(pref, key):
            setattr(pref, key, value)
    db.commit()
    db.refresh(pref)
    return pref


# ---------- Fairness ----------

def count_recent_substitutions(db: Session, teacher_id: int, since: datetime) -> int:
    return (
        db.query(AlterAssignment)
        .filter(AlterAssignment.substitute_teacher_id == teacher_id, AlterAssignment.assigned_at >= since)
        .count()
    )


def fairness_score(db: Session, teacher_id: int) -> float:
    """0-100, higher = fairer to assign this teacher right now (i.e. they
    have done relatively few substitutions lately). Computed purely
    against this institution's own substitution counts in the fairness
    window — there is no fixed "good" number of substitutions in the
    abstract, only relative load across the current pool of teachers, so
    a teacher with zero recent substitutions and a small institution
    still scores sensibly relative to their peers rather than against an
    arbitrary global constant."""
    now = datetime.now(timezone.utc)
    since = now - timedelta(days=FAIRNESS_WINDOW_DAYS)

    counts = (
        db.query(AlterAssignment.substitute_teacher_id, func.count(AlterAssignment.id))
        .filter(AlterAssignment.assigned_at >= since)
        .group_by(AlterAssignment.substitute_teacher_id)
        .all()
    )
    count_map = {tid: c for tid, c in counts}
    this_count = count_map.get(teacher_id, 0)

    if not count_map:
        return 100.0  # nobody has substituted recently; everyone starts equal

    max_count = max(count_map.values())
    if max_count == 0:
        return 100.0
    # Linear inverse: 0 substitutions -> 100, max_count substitutions -> 0
    return round(100.0 * (1 - (this_count / max_count)), 1)


# ---------- Hard eligibility ----------

@dataclass
class Candidate:
    teacher: User
    score: float = 0.0
    reasons: list[str] = field(default_factory=list)
    same_subject: bool = False
    same_department: bool = False
    workload_count: int = 0
    fairness: float = 0.0


def _is_hard_eligible(
    db: Session, candidate: User, leave: LeaveRequest, *, require_auto_opt_in: bool,
) -> tuple[bool, str | None]:
    """The rules that NEVER bend, regardless of score or mode. Returns
    (eligible, reason_if_not). require_auto_opt_in is True for
    Autonomous-mode execution and False for the Assisted-mode ranked
    list, where a teacher who hasn't opted into auto-assignment should
    still be visible as a manually-pickable option — only the system's
    own unattended execution path needs to respect that opt-out."""
    if candidate.id == leave.teacher_id:
        return False, "is the teacher requesting leave"

    if not candidate.is_active:
        return False, "account is disabled"

    busy = (
        db.query(TimetableSlot)
        .filter(TimetableSlot.teacher_id == candidate.id, TimetableSlot.day_order == leave.day_order,
                TimetableSlot.period_number == leave.period_number)
        .first()
    )
    if busy:
        return False, "already teaching this period"

    own_leave = (
        db.query(LeaveRequest)
        .filter(LeaveRequest.teacher_id == candidate.id, LeaveRequest.date == leave.date,
                LeaveRequest.period_number == leave.period_number, LeaveRequest.status == LeaveStatus.approved)
        .first()
    )
    if own_leave:
        return False, "on approved leave for this period"

    already_subbing = (
        db.query(AlterAssignment)
        .join(LeaveRequest, AlterAssignment.leave_request_id == LeaveRequest.id)
        .filter(AlterAssignment.substitute_teacher_id == candidate.id, LeaveRequest.date == leave.date,
                LeaveRequest.period_number == leave.period_number)
        .first()
    )
    if already_subbing:
        return False, "already substituting another class this period"

    pref = get_or_create_preferences(db, candidate.id)

    if require_auto_opt_in and not pref.accept_auto_assignments:
        return False, "has opted out of automatic assignment"

    if leave.is_emergency and require_auto_opt_in and not pref.allow_emergency_assignments:
        return False, "has opted out of emergency assignments"

    if pref.max_weekly_substitutions is not None:
        since = datetime.now(timezone.utc) - timedelta(days=7)
        recent = count_recent_substitutions(db, candidate.id, since)
        if recent >= pref.max_weekly_substitutions:
            return False, f"at weekly substitution cap ({pref.max_weekly_substitutions})"

    return True, None


def list_eligible_candidates(
    db: Session, leave: LeaveRequest, *, require_auto_opt_in: bool = False,
) -> list[User]:
    """Every teacher who structurally CAN cover this leave, full stop —
    before any scoring or ranking. This is the set Autonomous mode is
    allowed to choose from; Assisted mode scores this same set for the
    ranked list a human picks from."""
    all_teachers = db.query(User).filter(User.role == Role.teacher, User.is_active == True).all()  # noqa: E712
    eligible = []
    for t in all_teachers:
        ok, _ = _is_hard_eligible(db, t, leave, require_auto_opt_in=require_auto_opt_in)
        if ok:
            eligible.append(t)
    return eligible


# ---------- Recommendation scoring ----------

def _subject_and_department_for_leave(db: Session, leave: LeaveRequest) -> tuple[Subject | None, str | None]:
    slot = (
        db.query(TimetableSlot)
        .filter(TimetableSlot.teacher_id == leave.teacher_id, TimetableSlot.day_order == leave.day_order,
                TimetableSlot.period_number == leave.period_number)
        .first()
    )
    if not slot:
        return None, None
    subject = db.query(Subject).filter(Subject.id == slot.subject_id).first()
    dept_name = None
    if subject and subject.department_id:
        dept = db.query(Department).filter(Department.id == subject.department_id).first()
        dept_name = dept.name if dept else None
    return subject, dept_name


def score_candidate(db: Session, candidate: User, leave: LeaveRequest, subject: Subject | None, dept_name: str | None) -> Candidate:
    """Weighted compatibility score, 0-100. Weights are deliberately
    simple and additive (not ML-derived) so an admin can look at the
    breakdown and understand exactly why a number is what it is — that
    matters more here than squeezing out marginal ranking accuracy."""
    result = Candidate(teacher=candidate)

    if subject:
        teaches_same_subject = (
            db.query(TimetableSlot)
            .filter(TimetableSlot.teacher_id == candidate.id, TimetableSlot.subject_id == subject.id)
            .first()
        )
        if teaches_same_subject:
            result.same_subject = True
            result.score += 35
            result.reasons.append("Teaches this subject elsewhere")

    # Department match: candidate.department (free text) vs the
    # subject's department name. Approximate, not a real foreign-key
    # join — User.department has no FK to departments in this schema.
    if dept_name and candidate.department and candidate.department.strip().lower() == dept_name.strip().lower():
        result.same_department = True
        result.score += 20
        result.reasons.append("Same department")

    period_count = db.query(TimetableSlot).filter(TimetableSlot.teacher_id == candidate.id).count()
    result.workload_count = period_count
    workload_component = max(0.0, 20 * (1 - min(period_count, 30) / 30))
    result.score += workload_component
    if period_count <= 10:
        result.reasons.append("Low overall workload")

    fscore = fairness_score(db, candidate.id)
    result.fairness = fscore
    result.score += 0.20 * fscore
    if fscore >= 80:
        result.reasons.append("Hasn't substituted recently")

    pref = get_or_create_preferences(db, candidate.id)
    if pref.prefer_same_department and result.same_department:
        result.score += 5
    if pref.prefer_morning_classes and leave.period_number <= 2:
        result.score += 5

    result.score = round(min(result.score, 100.0), 1)
    return result


def get_ranked_recommendations(db: Session, leave_id: int, limit: int = 5) -> list[Candidate]:
    leave = _get_leave_or_404(db, leave_id)
    subject, dept_name = _subject_and_department_for_leave(db, leave)
    eligible = list_eligible_candidates(db, leave, require_auto_opt_in=False)

    scored = [score_candidate(db, c, leave, subject, dept_name) for c in eligible]
    scored.sort(key=lambda c: c.score, reverse=True)
    return scored[:limit]


# ---------- Execution ----------

def create_assignment(
    db: Session, leave: LeaveRequest, substitute: User, assignment_type: AssignmentType,
    score: float | None, actor_id: int | None,
) -> AlterAssignment:
    assignment = AlterAssignment(
        leave_request_id=leave.id,
        substitute_teacher_id=substitute.id,
        assignment_type=assignment_type,
        compatibility_score=score,
    )
    db.add(assignment)

    apply_credit_change(
        teacher_id=leave.teacher_id, change=-1,
        reason=f"Leave on {leave.date} (Day Order {leave.day_order}) period {leave.period_number}",
        leave_id=leave.id, db=db,
    )
    apply_credit_change(
        teacher_id=substitute.id, change=+1,
        reason=f"Substitute for teacher {leave.teacher_id} on {leave.date} (Day Order {leave.day_order}) period {leave.period_number}",
        leave_id=leave.id, db=db,
    )

    log_audit_event(
        db, actor_id, f"substitution.{assignment_type.value}", "leave_request", leave.id,
        {"substitute_teacher_id": substitute.id, "compatibility_score": score},
    )

    notification_service.create_notification(
        db, substitute.id, title="You've been assigned a substitute class",
        body=f"Cover {leave.date} (Day Order {leave.day_order}, period {leave.period_number}) for a colleague's approved leave.",
        event_type="substitute_assigned", related_leave_id=leave.id,
    )
    notification_service.create_notification(
        db, leave.teacher_id, title="Substitute assigned",
        body=f"{substitute.name} will cover your leave on {leave.date} (Day Order {leave.day_order}, period {leave.period_number}).",
        event_type="substitute_assigned", related_leave_id=leave.id,
    )
    return assignment


def auto_process_approved_leave(db: Session, leave: LeaveRequest) -> AlterAssignment | None:
    """Called right after a leave is approved. Behavior depends on
    campus_operations_mode:
      - manual:     does nothing; admin assigns via the normal flow.
      - assisted:   does nothing here either — the ranked recommendation
                    list is generated on-demand when the admin opens the
                    assign-substitute panel (get_ranked_recommendations),
                    not pushed proactively. Kept simple: one fewer thing
                    that can race against an admin already mid-assignment.
      - autonomous: picks the top-ranked HARD-ELIGIBLE candidate (opted
                    in, under their cap) and assigns immediately, no
                    approval step.
    Returns the created assignment, or None if no eligible candidate
    exists / mode doesn't auto-execute."""
    mode = get_mode(db)
    if mode != "autonomous":
        return None

    subject, dept_name = _subject_and_department_for_leave(db, leave)
    eligible = list_eligible_candidates(db, leave, require_auto_opt_in=True)
    if not eligible:
        log_audit_event(db, None, "substitution.autonomous_no_candidate", "leave_request", leave.id, {})
        db.commit()
        return None

    scored = [score_candidate(db, c, leave, subject, dept_name) for c in eligible]
    scored.sort(key=lambda c: c.score, reverse=True)
    best = scored[0]

    assignment_type = AssignmentType.emergency if leave.is_emergency else AssignmentType.auto_assigned
    assignment = create_assignment(db, leave, best.teacher, assignment_type, best.score, actor_id=None)
    db.commit()
    db.refresh(assignment)
    return assignment


def mark_emergency_if_applicable(db: Session, leave: LeaveRequest) -> None:
    """Sets is_emergency=True if the leave's date falls inside the
    emergency window measured from submission time right now. Called once
    at submission (see leave_service.submit_leave) — the flag is a
    point-in-time judgment, not re-evaluated later. Approximates "how far
    away is this period" using the calendar date at midnight, since
    periods don't have wall-clock times in this schema; a same-day leave
    is always emergency regardless of the configured window."""
    hours_until = (datetime.combine(leave.date, datetime.min.time(), tzinfo=timezone.utc) - datetime.now(timezone.utc)).total_seconds() / 3600
    window = get_emergency_window_hours(db)
    leave.is_emergency = hours_until <= window


def _get_leave_or_404(db: Session, leave_id: int) -> LeaveRequest:
    leave = db.query(LeaveRequest).filter(LeaveRequest.id == leave_id).first()
    if not leave:
        raise HTTPException(status_code=404, detail="Leave request not found")
    return leave
