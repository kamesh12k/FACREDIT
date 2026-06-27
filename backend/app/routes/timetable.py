from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.core.dependencies import require_admin, get_current_user
from app.models.user import User
from app.schemas.timetable import TimetableSlotCreate, TimetableSlotOut, BulkTimetableCreate
from app.services import timetable_service

router = APIRouter(prefix="/timetable", tags=["Timetable"])


@router.post("/slot", response_model=TimetableSlotOut, status_code=201)
def create_slot(
    data: TimetableSlotCreate,
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    return timetable_service.create_slot(data, db)


@router.post("/", response_model=list[TimetableSlotOut], status_code=201)
def upload_timetable(
    data: BulkTimetableCreate,
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    return timetable_service.bulk_upload(data.slots, db)


@router.get("/teacher/{teacher_id}", response_model=list[TimetableSlotOut])
def get_timetable_by_teacher(
    teacher_id: int,
    _user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return timetable_service.get_by_teacher(teacher_id, db)


@router.get("/class/{class_id}", response_model=list[TimetableSlotOut])
def get_timetable_by_class(
    class_id: int,
    _user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return timetable_service.get_by_class(class_id, db)


@router.delete("/{slot_id}", status_code=204)
def delete_slot(
    slot_id: int,
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    timetable_service.delete_slot(slot_id, db)
