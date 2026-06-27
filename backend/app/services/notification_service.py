import re
from sqlalchemy.orm import Session
from datetime import date, timedelta

from app.models.notification import Notification
from app.models.day_order_calendar import CalendarDay, DayType

HOLIDAY_REMINDER_LOOKAHEAD_DAYS = 3
_REMINDER_DATE_RE = re.compile(r"on (\d{4}-\d{2}-\d{2}) \(")


def create_notification(db: Session, user_id: int, title: str, body: str, event_type: str, related_leave_id: int | None = None) -> Notification:
    note = Notification(user_id=user_id, title=title, body=body, event_type=event_type, related_leave_id=related_leave_id)
    db.add(note)
    db.flush()
    return note


def list_notifications(db: Session, user_id: int, unread_only: bool = False) -> list[Notification]:
    q = db.query(Notification).filter(Notification.user_id == user_id)
    if unread_only:
        q = q.filter(Notification.is_read == False)  # noqa: E712
    return q.order_by(Notification.created_at.desc()).all()


def unread_count(db: Session, user_id: int) -> int:
    return db.query(Notification).filter(Notification.user_id == user_id, Notification.is_read == False).count()  # noqa: E712


def mark_read(db: Session, user_id: int, notification_id: int) -> None:
    note = db.query(Notification).filter(Notification.id == notification_id, Notification.user_id == user_id).first()
    if note:
        note.is_read = True
        db.commit()


def mark_all_read(db: Session, user_id: int) -> None:
    db.query(Notification).filter(Notification.user_id == user_id, Notification.is_read == False).update({"is_read": True})  # noqa: E712
    db.commit()


def generate_holiday_reminders(db: Session, user_id: int, today: date) -> None:
    """Lazy reminder generation: called on login rather than via a
    background scheduler (this app has no cron/worker process). Looks at
    every non-working calendar day within HOLIDAY_REMINDER_LOOKAHEAD_DAYS
    and creates a notification for `user_id` if one doesn't already exist
    for that specific date, so a teacher who logs in daily sees the
    reminder exactly once rather than once per login.

    Dedupe works by parsing the ISO date back out of previously-created
    reminder bodies (see _REMINDER_DATE_RE) rather than repurposing
    related_leave_id — that column has a real FK to leave_requests, so
    storing a calendar_days id there would either violate the constraint
    or silently collide with an unrelated leave request."""
    upcoming = (
        db.query(CalendarDay)
        .filter(
            CalendarDay.date >= today,
            CalendarDay.date <= today + timedelta(days=HOLIDAY_REMINDER_LOOKAHEAD_DAYS),
            CalendarDay.day_type != DayType.working,
        )
        .order_by(CalendarDay.date)
        .all()
    )
    if not upcoming:
        return

    existing = db.query(Notification).filter(
        Notification.user_id == user_id, Notification.event_type == "holiday_reminder"
    ).all()
    already_reminded_dates = set()
    for n in existing:
        m = _REMINDER_DATE_RE.search(n.body)
        if m:
            already_reminded_dates.add(m.group(1))

    for day in upcoming:
        iso = day.date.isoformat()
        if iso in already_reminded_dates:
            continue
        label = day.label or day.day_type.value.replace("_", " ").title()
        days_away = (day.date - today).days
        when = "today" if days_away == 0 else ("tomorrow" if days_away == 1 else f"in {days_away} days")
        create_notification(
            db, user_id,
            title="Upcoming holiday",
            body=f"{label} on {iso} ({when}).",
            event_type="holiday_reminder",
        )
    db.commit()
