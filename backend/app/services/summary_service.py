from datetime import date, timedelta
from sqlalchemy.orm import Session

from app.models.leave import LeaveRequest, LeaveStatus
from app.models.user import User
from app.models.day_order_calendar import CalendarDay, DayType
from app.schemas.academic_calendar import (
    TodaySummary, TeacherOnLeaveToday, UpcomingNonWorkingDay, TeacherTodaySummary,
)
from app.services import day_order_service

UPCOMING_LOOKAHEAD_DAYS = 14


def get_today_summary(db: Session, today: date) -> TodaySummary:
    """Backs the admin Home screen's single 'Today' card: what kind of day
    it is, which teachers are on approved leave today (and whether a
    substitute has been assigned), how many leave requests are still
    pending review, and any holiday/exam/etc. coming up in the next two
    weeks — the 'upcoming holiday' reminder."""
    calendar_day = day_order_service.resolve_by_date(db, today)
    day_type = calendar_day.day_type if calendar_day else DayType.non_working
    day_order = calendar_day.day_order if calendar_day else None
    blocks = calendar_day.blocks_operations if calendar_day else True

    teachers_on_leave: list[TeacherOnLeaveToday] = []
    if not blocks:
        leaves_today = (
            db.query(LeaveRequest)
            .filter(LeaveRequest.date == today, LeaveRequest.status == LeaveStatus.approved)
            .all()
        )
        for leave in leaves_today:
            teacher = db.query(User).filter(User.id == leave.teacher_id).first()
            sub_name = None
            if leave.alter_assignment:
                sub = db.query(User).filter(User.id == leave.alter_assignment.substitute_teacher_id).first()
                sub_name = sub.name if sub else None
            teachers_on_leave.append(
                TeacherOnLeaveToday(
                    teacher_id=leave.teacher_id,
                    name=teacher.name if teacher else "Unknown",
                    department=teacher.department if teacher else None,
                    period_number=leave.period_number,
                    has_substitute=leave.alter_assignment is not None,
                    substitute_name=sub_name,
                )
            )

    pending_count = db.query(LeaveRequest).filter(LeaveRequest.status == LeaveStatus.pending).count()

    upcoming_rows = (
        db.query(CalendarDay)
        .filter(
            CalendarDay.date > today,
            CalendarDay.date <= today + timedelta(days=UPCOMING_LOOKAHEAD_DAYS),
            CalendarDay.day_type != DayType.working,
        )
        .order_by(CalendarDay.date)
        .all()
    )
    upcoming = [
        UpcomingNonWorkingDay(
            date=row.date, day_type=row.day_type, label=row.label,
            days_away=(row.date - today).days,
        )
        for row in upcoming_rows
    ]

    return TodaySummary(
        date=today,
        day_type=day_type,
        day_order=day_order,
        blocks_operations=blocks,
        teachers_on_leave=teachers_on_leave,
        pending_leave_count=pending_count,
        upcoming_non_working_days=upcoming,
    )


def get_teacher_today_summary(db: Session, teacher_id: int, today: date) -> TeacherTodaySummary:
    """Teacher-scoped Home card: same day info as the admin version, but
    only this teacher's own leave status — never another teacher's
    details, since a teacher has no business reason to see who else is
    out (that's an admin-only view)."""
    calendar_day = day_order_service.resolve_by_date(db, today)
    day_type = calendar_day.day_type if calendar_day else DayType.non_working
    day_order = calendar_day.day_order if calendar_day else None
    blocks = calendar_day.blocks_operations if calendar_day else True

    is_on_leave_today = False
    periods_today = 0
    if not blocks:
        own_leaves_today = (
            db.query(LeaveRequest)
            .filter(
                LeaveRequest.teacher_id == teacher_id,
                LeaveRequest.date == today,
                LeaveRequest.status == LeaveStatus.approved,
            )
            .count()
        )
        is_on_leave_today = own_leaves_today > 0

        from app.models.timetable import TimetableSlot
        if day_order is not None:
            periods_today = (
                db.query(TimetableSlot)
                .filter(TimetableSlot.teacher_id == teacher_id, TimetableSlot.day_order == day_order)
                .count()
            )

    upcoming_rows = (
        db.query(CalendarDay)
        .filter(
            CalendarDay.date > today,
            CalendarDay.date <= today + timedelta(days=UPCOMING_LOOKAHEAD_DAYS),
            CalendarDay.day_type != DayType.working,
        )
        .order_by(CalendarDay.date)
        .all()
    )
    upcoming = [
        UpcomingNonWorkingDay(date=row.date, day_type=row.day_type, label=row.label, days_away=(row.date - today).days)
        for row in upcoming_rows
    ]

    return TeacherTodaySummary(
        date=today,
        day_type=day_type,
        day_order=day_order,
        blocks_operations=blocks,
        is_on_leave_today=is_on_leave_today,
        periods_today=periods_today,
        upcoming_non_working_days=upcoming,
    )
