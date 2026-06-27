from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.core.dependencies import get_current_user, require_admin, require_super_admin
from app.core.security import verify_password
from app.models.user import User
from app.schemas.user import UserOut, Token
from app.schemas.admin import (
    FirstLoginSetupRequest, SecondaryAdminCreate, FactoryResetRequest,
    FactoryResetResponse, AuditLogOut,
)
from app.services import admin_service, factory_reset_service

router = APIRouter(prefix="/admin", tags=["Admin"])


@router.post("/first-login/setup", response_model=Token)
def first_login_setup(
    data: FirstLoginSetupRequest,
    # Intentionally depends on get_current_user, NOT require_credentials_set —
    # this is the one endpoint that must remain reachable while the
    # must_change_credentials gate is blocking everything else.
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return admin_service.complete_first_login_setup(current_user, data, db)


@router.get("/secondary-admins", response_model=list[UserOut])
def list_secondary_admins(
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    return admin_service.list_admins(db)


@router.post("/secondary-admins", response_model=UserOut, status_code=201)
def create_secondary_admin(
    data: SecondaryAdminCreate,
    super_admin: User = Depends(require_super_admin),
    db: Session = Depends(get_db),
):
    return admin_service.create_secondary_admin(data, super_admin, db)


@router.patch("/secondary-admins/{admin_id}/enable", response_model=UserOut)
def enable_secondary_admin(
    admin_id: int,
    super_admin: User = Depends(require_super_admin),
    db: Session = Depends(get_db),
):
    return admin_service.set_secondary_admin_active(admin_id, True, super_admin, db)


@router.patch("/secondary-admins/{admin_id}/disable", response_model=UserOut)
def disable_secondary_admin(
    admin_id: int,
    super_admin: User = Depends(require_super_admin),
    db: Session = Depends(get_db),
):
    return admin_service.set_secondary_admin_active(admin_id, False, super_admin, db)


@router.get("/audit-logs", response_model=list[AuditLogOut])
def get_audit_logs(
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    logs = admin_service.list_audit_logs(db)
    actor_ids = {log.actor_user_id for log in logs if log.actor_user_id}
    actors = {u.id: u.name for u in db.query(User).filter(User.id.in_(actor_ids)).all()} if actor_ids else {}
    return [
        AuditLogOut(
            id=log.id, actor_user_id=log.actor_user_id, actor_name=actors.get(log.actor_user_id),
            action=log.action, target_type=log.target_type, target_id=log.target_id,
            details=log.details, created_at=log.created_at,
        )
        for log in logs
    ]


@router.post("/factory-reset", response_model=FactoryResetResponse)
def factory_reset(
    data: FactoryResetRequest,
    super_admin: User = Depends(require_super_admin),
    db: Session = Depends(get_db),
):
    """Destructive, irreversible (beyond the automatic backup). Requires
    the Super Admin's current password AND the literal typed phrase
    "RESET EVERYTHING" (validated by the request schema)."""
    if not verify_password(data.password, super_admin.password_hash):
        raise HTTPException(status_code=401, detail="Incorrect password")

    result = factory_reset_service.perform_factory_reset(db, super_admin)
    return FactoryResetResponse(**result)
