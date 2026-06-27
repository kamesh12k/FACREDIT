from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.core.dependencies import require_admin, get_current_user
from app.models.user import User
from app.schemas.department import DepartmentCreate, DepartmentOut
from app.services import department_service

router = APIRouter(prefix="/departments", tags=["Departments"])


@router.get("/", response_model=list[DepartmentOut])
def list_departments(_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return department_service.list_departments(db)


@router.post("/", response_model=DepartmentOut, status_code=201)
def create_department(
    data: DepartmentCreate,
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    return department_service.create_department(data, db)
