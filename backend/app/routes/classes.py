from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.core.dependencies import require_admin, get_current_user
from app.models.user import User
from app.schemas.class_ import ClassCreate, ClassUpdate, ClassOut
from app.services import class_service

router = APIRouter(prefix="/classes", tags=["Classes"])


@router.get("/", response_model=list[ClassOut])
def list_classes(_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return class_service.list_classes(db)


@router.post("/", response_model=ClassOut, status_code=201)
def create_class(
    data: ClassCreate,
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    return class_service.create_class(data, db)


@router.patch("/{class_id}", response_model=ClassOut)
def update_class(
    class_id: int,
    data: ClassUpdate,
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    return class_service.update_class(class_id, data, db)


@router.delete("/{class_id}", status_code=204)
def delete_class(
    class_id: int,
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    class_service.delete_class(class_id, db)
