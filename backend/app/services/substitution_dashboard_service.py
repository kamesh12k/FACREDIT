from datetime import date
from sqlalchemy.orm import Session
from app.models.leave import LeaveRequest, LeaveStatus, AlterAssignment
from app.models.user import User
from app.models.timetable import TimetableSlot
from app.models.day_order_calendar import CalendarDay
from app.models.class_ import Class

def get_today_substitutions(db: Session, target_date: date) -> dict:
    # 1. Resolve Day Order calendar entry
    cal_day = db.query(CalendarDay).filter(CalendarDay.date == target_date).first()
    day_type_str = cal_day.day_type.value if cal_day else "holiday"
    day_order_str = f"DO{cal_day.day_order}" if cal_day and cal_day.day_order else None

    # 2. Query approved leaves for the date
    leaves = (
        db.query(LeaveRequest)
        .filter(LeaveRequest.date == target_date, LeaveRequest.status == LeaveStatus.approved)
        .order_by(LeaveRequest.period_number)
        .all()
    )

    total_leaves = len(leaves)
    total_substitutions = 0
    substitutions_list = []

    for leave in leaves:
        # Resolve class from original teacher's timetable slot
        slot = None
        if cal_day and cal_day.day_order:
            slot = (
                db.query(TimetableSlot)
                .filter(
                    TimetableSlot.teacher_id == leave.teacher_id,
                    TimetableSlot.day_order == cal_day.day_order,
                    TimetableSlot.period_number == leave.period_number
                )
                .first()
            )

        class_name = "General Duty"
        if slot:
            cls = db.query(Class).filter(Class.id == slot.class_id).first()
            if cls:
                class_name = f"{cls.name} - {cls.section}"

        alter = leave.alter_assignment
        substitute_name = "Unassigned"
        substitute_id = None
        assignment_type = None
        is_locked = False

        if alter:
            total_substitutions += 1
            substitute_name = alter.substitute.name
            substitute_id = alter.substitute_teacher_id
            assignment_type = alter.assignment_type.value
            is_locked = alter.is_locked

        substitutions_list.append({
            "leave_id": leave.id,
            "period_number": leave.period_number,
            "class_name": class_name,
            "original_teacher": {
                "id": leave.teacher.id,
                "name": leave.teacher.name,
                "department": leave.teacher.department
            },
            "substitute_teacher": {
                "id": substitute_id,
                "name": substitute_name
            } if substitute_id else None,
            "assignment_type": assignment_type,
            "is_locked": is_locked,
            "reason": leave.reason,
            "is_emergency": leave.is_emergency
        })

    unassigned_periods = total_leaves - total_substitutions
    coverage_percentage = (
        round((total_substitutions / total_leaves) * 100, 1)
        if total_leaves > 0
        else 100.0
    )

    return {
        "date": target_date.isoformat(),
        "day_order": day_order_str,
        "day_type": day_type_str,
        "summary": {
            "total_leaves": total_leaves,
            "total_substitutions": total_substitutions,
            "unassigned_periods": unassigned_periods,
            "coverage_percentage": coverage_percentage
        },
        "substitutions": substitutions_list
    }
