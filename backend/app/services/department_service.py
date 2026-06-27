from sqlalchemy.orm import Session
from fastapi import HTTPException

from app.models.department import Department
from app.schemas.department import DepartmentCreate


def list_departments(db: Session) -> list[Department]:
    return db.query(Department).order_by(Department.name).all()


def create_department(data: DepartmentCreate, db: Session) -> Department:
    if db.query(Department).filter(Department.name == data.name).first():
        raise HTTPException(status_code=400, detail="A department with that name already exists")
    dept = Department(**data.model_dump())
    db.add(dept)
    db.commit()
    db.refresh(dept)
    return dept
