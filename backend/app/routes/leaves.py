import logging

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.core.dependencies import require_admin, require_teacher, get_current_user
from app.models.user import User
from app.models.leave import AssignmentType
from app.schemas.leave import (
    LeaveCreate, LeaveBatchCreate, LeaveOut, BulkLeaveAction,
    AlterAssignmentCreate, AlterAssignmentOut, FreeTeacherOut,
    OverrideSubstituteRequest, LockAssignmentRequest,
    AdminCancelRequest, CancelImpactOut,
)
from app.schemas.substitution import RecommendationOut
from app.services import leave_service, substitution_service

router = APIRouter(prefix="/leaves", tags=["Leaves"])
logger = logging.getLogger(__name__)


@router.post("/", response_model=LeaveOut, status_code=201)
def apply_leave(
    data: LeaveCreate,
    current_user: User = Depends(require_teacher),
    db: Session = Depends(get_db),
):
    return leave_service.submit_leave(current_user.id, data, db)


@router.post("/batch", response_model=list[LeaveOut], status_code=201)
def apply_leave_batch(
    data: LeaveBatchCreate,
    current_user: User = Depends(require_teacher),
    db: Session = Depends(get_db),
):
    """Submit a batch leave request (multiple periods or whole-day) for the
    authenticated teacher. Returns 400 with a descriptive message for bad
    input (non-working day, no periods scheduled, etc.). Never returns 500
    for anticipated failures — any unexpected error is logged and surfaces
    as a descriptive 500 with no internal detail leaked to the client."""
    try:
        return leave_service.submit_leave_batch(current_user.id, data, db)
    except HTTPException:
        raise
    except Exception:
        logger.exception(
            "POST /leaves/batch unhandled exception: teacher_id=%s date=%s",
            current_user.id, data.date,
        )
        raise HTTPException(
            status_code=500,
            detail="An unexpected error occurred while submitting the leave request. Please try again.",
        )


@router.get("/", response_model=list[LeaveOut])
def list_all_leaves(
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    return leave_service.get_all_leaves(db)


@router.get("/my", response_model=list[LeaveOut])
def my_leaves(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return leave_service.get_teacher_leaves(current_user.id, db)


@router.patch("/{leave_id}/approve")
def approve_leave(
    leave_id: int,
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    leave, free_teachers = leave_service.approve_leave(leave_id, db)
    return {
        "leave": LeaveOut.model_validate(leave),
        "free_teachers": free_teachers,
    }


@router.patch("/{leave_id}/reject", response_model=LeaveOut)
def reject_leave(
    leave_id: int,
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    return leave_service.reject_leave(leave_id, db)


@router.post("/bulk-approve", response_model=list[LeaveOut])
def bulk_approve(
    data: BulkLeaveAction,
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    return leave_service.bulk_approve(data.leave_ids, db)


@router.post("/bulk-reject", response_model=list[LeaveOut])
def bulk_reject(
    data: BulkLeaveAction,
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    return leave_service.bulk_reject(data.leave_ids, db)


@router.post("/{leave_id}/assign", response_model=AlterAssignmentOut, status_code=201)
def assign_substitute(
    leave_id: int,
    data: AlterAssignmentCreate,
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Manual admin pick — not from the ranked recommendation list. If the
    admin instead approved a ranked suggestion, the frontend should call
    this with the same substitute_teacher_id; the assignment_type still
    records as admin_assigned because *this endpoint* doesn't know which
    list the id came from. Use /recommendations to show the ranked list."""
    return leave_service.assign_substitute(leave_id, data.substitute_teacher_id, db)


@router.get("/{leave_id}/recommendations", response_model=list[RecommendationOut])
def get_recommendations(
    leave_id: int,
    limit: int = 5,
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Ranked, scored substitute candidates — powers the Assisted-mode
    recommendation panel. Each entry shows the compatibility score and
    the specific reasons behind it (same subject, same department,
    workload, fairness) so the admin isn't approving a black-box number."""
    return substitution_service.get_ranked_recommendations(db, leave_id, limit)


@router.post("/{leave_id}/assign-recommended", response_model=AlterAssignmentOut, status_code=201)
def assign_recommended_substitute(
    leave_id: int,
    data: AlterAssignmentCreate,
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Same effect as /assign, but records assignment_type=
    faculty_recommended with the score that was shown when the admin
    clicked Approve — use this when the admin picked from the ranked
    list returned by /recommendations, so the dashboard can later show
    "this was a recommended pick" vs "this was assigned from scratch"."""
    recs = substitution_service.get_ranked_recommendations(db, leave_id, limit=50)
    matched = next((r for r in recs if r.teacher.id == data.substitute_teacher_id), None)
    score = matched.score if matched else None
    return leave_service.assign_substitute(
        leave_id, data.substitute_teacher_id, db,
        assignment_type=AssignmentType.faculty_recommended, compatibility_score=score,
    )


@router.post("/{leave_id}/override", response_model=AlterAssignmentOut)
def override_substitute(
    leave_id: int,
    data: OverrideSubstituteRequest,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Replaces an existing substitute assignment with a different
    teacher — for correcting an auto-assignment or a prior manual pick."""
    return leave_service.override_substitute(leave_id, data.new_substitute_teacher_id, admin, db)


@router.post("/{leave_id}/undo-assignment", response_model=LeaveOut)
def undo_assignment(
    leave_id: int,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Removes the current substitute assignment entirely (reversing
    credits), leaving the leave approved but unassigned again."""
    return leave_service.undo_assignment(leave_id, admin, db)


@router.post("/{leave_id}/lock", response_model=AlterAssignmentOut)
def set_assignment_lock(
    leave_id: int,
    data: LockAssignmentRequest,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Locked assignments are skipped by the autonomous engine's auto-swap
    and self-healing logic — use for labs, exams, or anything that must
    never be silently re-routed. An admin can still override a locked
    assignment directly; only the autonomous engine is restrained."""
    return leave_service.set_assignment_lock(leave_id, data.locked, admin, db)


@router.get("/{leave_id}/free-teachers", response_model=list[FreeTeacherOut])
def free_teachers(
    leave_id: int,
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    from app.models.leave import LeaveRequest
    leave = db.query(LeaveRequest).filter(LeaveRequest.id == leave_id).first()
    if not leave:
        raise HTTPException(404, "Leave not found")
    return leave_service.detect_free_teachers(leave.day_order, leave.period_number, leave.teacher_id, db)
@router.get("/debug-batch-test")
def debug_batch_test(
    current_user: User = Depends(require_teacher),
    db: Session = Depends(get_db),
):
    import traceback
    from datetime import date as date_type
    from app.schemas.leave import LeaveBatchCreate
    try:
        data = LeaveBatchCreate(date=date_type(2026, 6, 28), whole_day=True, reason="test")
        result = leave_service.submit_leave_batch(current_user.id, data, db)
        return {"ok": True, "count": len(result), "ids": [r.id for r in result]}
    except Exception as e:
        return {"ok": False, "error": str(e), "trace": traceback.format_exc()}


@router.post("/{leave_id}/cancel", response_model=LeaveOut)
def cancel_leave(
    leave_id: int,
    current_user: User = Depends(require_teacher),
    db: Session = Depends(get_db),
):
    """Teacher cancels their own leave. Future leaves are always
    cancellable. Same-day leaves may only be cancelled before 10:00 AM.
    Past leaves cannot be cancelled."""
    return leave_service.cancel_leave_by_teacher(leave_id, current_user.id, db)


@router.post("/{leave_id}/admin-cancel", response_model=LeaveOut)
def admin_cancel_leave(
    leave_id: int,
    data: AdminCancelRequest,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Admin cancels any leave at any time. A reason is required for
    the audit trail."""
    return leave_service.cancel_leave_by_admin(leave_id, admin, data.reason, db)


@router.get("/{leave_id}/cancel-impact", response_model=CancelImpactOut)
def cancel_impact(
    leave_id: int,
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Preview what substitute assignments and timetable entries will be
    affected if this leave is cancelled."""
    return leave_service.get_cancel_impact(leave_id, db)