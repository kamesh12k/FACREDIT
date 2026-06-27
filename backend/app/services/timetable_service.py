from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from fastapi import HTTPException

from app.models.timetable import TimetableSlot
from app.schemas.timetable import TimetableSlotCreate


def _check_conflicts(db: Session, slot: TimetableSlotCreate, exclude_id: int | None = None) -> None:
    """Mirrors the three DB-level UNIQUE constraints with a friendly,
    specific 409 message identifying exactly which resource conflicts —
    the DB constraint alone would just raise a generic IntegrityError."""
    q = db.query(TimetableSlot).filter(
        TimetableSlot.day_order == slot.day_order,
        TimetableSlot.period_number == slot.period_number,
    )
    if exclude_id:
        q = q.filter(TimetableSlot.id != exclude_id)

    teacher_conflict = q.filter(TimetableSlot.teacher_id == slot.teacher_id).first()
    if teacher_conflict:
        raise HTTPException(
            status_code=409,
            detail=f"Teacher is already scheduled for Day Order {slot.day_order}, Period {slot.period_number}",
        )

    class_conflict = q.filter(TimetableSlot.class_id == slot.class_id).first()
    if class_conflict:
        raise HTTPException(
            status_code=409,
            detail=f"Class already has a session for Day Order {slot.day_order}, Period {slot.period_number}",
        )

    if slot.room_id is not None:
        room_conflict = q.filter(TimetableSlot.room_id == slot.room_id).first()
        if room_conflict:
            raise HTTPException(
                status_code=409,
                detail=f"Room is already booked for Day Order {slot.day_order}, Period {slot.period_number}",
            )


def create_slot(data: TimetableSlotCreate, db: Session) -> TimetableSlot:
    _check_conflicts(db, data)
    slot = TimetableSlot(**data.model_dump())
    db.add(slot)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Conflicting timetable slot (teacher, class, or room already booked)")
    db.refresh(slot)
    return slot


def bulk_upload(slots_data: list[TimetableSlotCreate], db: Session) -> list[TimetableSlot]:
    """All-or-nothing: validates every slot for conflicts (against both
    the DB and each other within the same batch) before inserting any of
    them."""
    seen_teacher_keys = set()
    seen_class_keys = set()
    seen_room_keys = set()

    for slot in slots_data:
        _check_conflicts(db, slot)

        t_key = (slot.teacher_id, slot.day_order, slot.period_number)
        c_key = (slot.class_id, slot.day_order, slot.period_number)
        r_key = (slot.room_id, slot.day_order, slot.period_number) if slot.room_id else None

        if t_key in seen_teacher_keys:
            raise HTTPException(status_code=409, detail=f"Duplicate teacher booking within this upload for Day Order {slot.day_order}, Period {slot.period_number}")
        if c_key in seen_class_keys:
            raise HTTPException(status_code=409, detail=f"Duplicate class booking within this upload for Day Order {slot.day_order}, Period {slot.period_number}")
        if r_key and r_key in seen_room_keys:
            raise HTTPException(status_code=409, detail=f"Duplicate room booking within this upload for Day Order {slot.day_order}, Period {slot.period_number}")

        seen_teacher_keys.add(t_key)
        seen_class_keys.add(c_key)
        if r_key:
            seen_room_keys.add(r_key)

    slots = [TimetableSlot(**s.model_dump()) for s in slots_data]
    db.add_all(slots)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Conflicting timetable slot detected during save — no slots were saved")
    for s in slots:
        db.refresh(s)
    return slots


def get_by_teacher(teacher_id: int, db: Session) -> list[TimetableSlot]:
    return db.query(TimetableSlot).filter(TimetableSlot.teacher_id == teacher_id).order_by(TimetableSlot.day_order, TimetableSlot.period_number).all()


def get_by_class(class_id: int, db: Session) -> list[TimetableSlot]:
    return db.query(TimetableSlot).filter(TimetableSlot.class_id == class_id).order_by(TimetableSlot.day_order, TimetableSlot.period_number).all()


def delete_slot(slot_id: int, db: Session) -> None:
    slot = db.query(TimetableSlot).filter(TimetableSlot.id == slot_id).first()
    if slot:
        db.delete(slot)
        db.commit()
