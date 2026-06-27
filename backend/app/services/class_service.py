from sqlalchemy.orm import Session
from fastapi import HTTPException

from app.models.class_ import Class
from app.models.timetable import TimetableSlot
from app.schemas.class_ import ClassCreate, ClassUpdate


def list_classes(db: Session) -> list[Class]:
    return db.query(Class).order_by(Class.name, Class.section).all()


def create_class(data: ClassCreate, db: Session) -> Class:
    exists = db.query(Class).filter(Class.name == data.name, Class.section == data.section).first()
    if exists:
        raise HTTPException(status_code=400, detail="A class with that name and section already exists")
    cls = Class(**data.model_dump())
    db.add(cls)
    db.commit()
    db.refresh(cls)
    return cls


def update_class(class_id: int, data: ClassUpdate, db: Session) -> Class:
    cls = db.query(Class).filter(Class.id == class_id).first()
    if not cls:
        raise HTTPException(status_code=404, detail="Class not found")
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(cls, key, value)
    db.commit()
    db.refresh(cls)
    return cls


def delete_class(class_id: int, db: Session) -> None:
    cls = db.query(Class).filter(Class.id == class_id).first()
    if not cls:
        raise HTTPException(status_code=404, detail="Class not found")
    in_use = db.query(TimetableSlot).filter(TimetableSlot.class_id == class_id).first()
    if in_use:
        raise HTTPException(status_code=400, detail="Cannot delete a class that has timetable slots")
    db.delete(cls)
    db.commit()
