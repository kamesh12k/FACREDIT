from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.core.dependencies import require_admin, require_super_admin, require_teacher, get_current_user
from app.models.user import User
from app.schemas.substitution import (
    CampusOperationsModeOut, CampusOperationsModeSet,
    SubstitutionPreferenceOut, SubstitutionPreferenceUpdate,
)
from app.services import substitution_service

router = APIRouter(prefix="/campus-operations", tags=["Campus Operations"])


@router.get("/mode", response_model=CampusOperationsModeOut)
def get_mode(
    _user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return CampusOperationsModeOut(mode=substitution_service.get_mode(db))


@router.put("/mode", response_model=CampusOperationsModeOut)
def set_mode(
    data: CampusOperationsModeSet,
    super_admin: User = Depends(require_super_admin),
    db: Session = Depends(get_db),
):
    """Switching to 'autonomous' takes effect immediately for the next
    leave approval — Super Admin only, since this changes whether the
    system can move real class assignments without a human clicking
    anything."""
    mode = substitution_service.set_mode(db, data.mode, super_admin)
    return CampusOperationsModeOut(mode=mode)


@router.get("/preferences/me", response_model=SubstitutionPreferenceOut)
def get_my_preferences(
    teacher: User = Depends(require_teacher),
    db: Session = Depends(get_db),
):
    return substitution_service.get_or_create_preferences(db, teacher.id)


@router.put("/preferences/me", response_model=SubstitutionPreferenceOut)
def update_my_preferences(
    data: SubstitutionPreferenceUpdate,
    teacher: User = Depends(require_teacher),
    db: Session = Depends(get_db),
):
    return substitution_service.update_preferences(db, teacher.id, **data.model_dump(exclude_unset=True))


@router.get("/preferences/{teacher_id}", response_model=SubstitutionPreferenceOut)
def get_teacher_preferences(
    teacher_id: int,
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Admin view of any teacher's preferences — read-only; a teacher's
    own preferences belong to them, admins can see but not edit them
    here. Disabling/adjusting a teacher's auto-assignment eligibility as
    an admin action goes through the Teachers screen, not this endpoint."""
    return substitution_service.get_or_create_preferences(db, teacher_id)
