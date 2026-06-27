from sqlalchemy.orm import Session
from fastapi import HTTPException

from app.models.subject import Subject
from app.schemas.subject import SubjectCreate, SubjectUpdate


def list_subjects(db: Session, include_archived: bool = False) -> list[Subject]:
    q = db.query(Subject)
    if not include_archived:
        q = q.filter(Subject.is_archived == False)  # noqa: E712
    return q.order_by(Subject.code).all()


def create_subject(data: SubjectCreate, db: Session) -> Subject:
    if db.query(Subject).filter(Subject.code == data.code).first():
        raise HTTPException(status_code=400, detail="A subject with that code already exists")
    subject = Subject(**data.model_dump())
    db.add(subject)
    db.commit()
    db.refresh(subject)
    return subject


def update_subject(subject_id: int, data: SubjectUpdate, db: Session) -> Subject:
    subject = db.query(Subject).filter(Subject.id == subject_id).first()
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(subject, key, value)
    db.commit()
    db.refresh(subject)
    return subject


def set_archived(subject_id: int, archived: bool, db: Session) -> Subject:
    subject = db.query(Subject).filter(Subject.id == subject_id).first()
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")
    subject.is_archived = archived
    db.commit()
    db.refresh(subject)
    return subject
