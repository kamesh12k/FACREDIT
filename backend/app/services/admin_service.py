import logging
from sqlalchemy.orm import Session
from sqlalchemy import select
from fastapi import HTTPException

from app.config import settings
from app.models.user import User, Role, AdminLevel
from app.models.audit_log import AuditLog
from app.core.security import hash_password, create_access_token
from app.schemas.admin import FirstLoginSetupRequest, SecondaryAdminCreate

logger = logging.getLogger(__name__)

MAX_SECONDARY_ADMINS = settings.MAX_SECONDARY_ADMINS


def log_audit_event(
    db: Session,
    actor_user_id: int | None,
    action: str,
    target_type: str | None = None,
    target_id: int | None = None,
    details: dict | None = None,
) -> AuditLog:
    """Adds + flushes (does not commit) so callers can keep the audit
    entry in the same transaction as the action it records."""
    entry = AuditLog(
        actor_user_id=actor_user_id,
        action=action,
        target_type=target_type,
        target_id=target_id,
        details=details,
    )
    db.add(entry)
    db.flush()
    return entry


def bootstrap_default_super_admin(db: Session) -> None:
    """Called once at app startup. If no Super Admin exists yet (fresh
    install, or right after a Factory Reset that hasn't recreated one for
    some reason), creates username=admin / password=admin and forces a
    credential change before any dashboard access is allowed."""
    existing = db.query(User).filter(User.admin_level == AdminLevel.super_admin).first()
    if existing:
        return

    admin = User(
        name="System Administrator",
        username="admin",
        email=None,
        password_hash=hash_password("admin"),
        role=Role.admin,
        admin_level=AdminLevel.super_admin,
        must_change_credentials=True,
        is_active=True,
    )
    db.add(admin)
    db.commit()
    logger.warning(
        "Bootstrap: created default Super Admin (username='admin', password='admin'). "
        "Log in immediately and set real credentials — the dashboard is locked until you do."
    )


def complete_first_login_setup(current_user: User, data: FirstLoginSetupRequest, db: Session) -> dict:
    if not current_user.must_change_credentials:
        raise HTTPException(status_code=400, detail="Credentials have already been set for this account")

    existing = db.query(User).filter(User.username == data.new_username, User.id != current_user.id).first()
    if existing:
        raise HTTPException(status_code=400, detail="That username is already taken")

    current_user.username = data.new_username
    current_user.password_hash = hash_password(data.new_password)
    current_user.must_change_credentials = False

    log_audit_event(db, current_user.id, "credentials.first_login_setup", "user", current_user.id)
    db.commit()
    db.refresh(current_user)

    token = create_access_token({"sub": str(current_user.id), "role": current_user.role})
    return {"access_token": token, "token_type": "bearer", "user": current_user}


def list_admins(db: Session) -> list[User]:
    return db.query(User).filter(User.role == Role.admin).order_by(User.admin_level.desc(), User.created_at).all()


def create_secondary_admin(data: SecondaryAdminCreate, requesting_admin: User, db: Session) -> User:
    active_count = (
        db.query(User)
        .filter(
            User.role == Role.admin,
            User.admin_level == AdminLevel.secondary_admin,
            User.is_active == True,  # noqa: E712
        )
        .count()
    )
    if active_count >= MAX_SECONDARY_ADMINS:
        raise HTTPException(
            status_code=400,
            detail=f"Maximum of {MAX_SECONDARY_ADMINS} active Secondary Admins reached. Disable one before adding another.",
        )

    if db.query(User).filter(User.username == data.username).first():
        raise HTTPException(status_code=400, detail="That username is already taken")

    admin = User(
        name=data.name,
        username=data.username,
        email=None,
        password_hash=hash_password(data.password),
        role=Role.admin,
        admin_level=AdminLevel.secondary_admin,
        # Secondary admins also get a forced rotation on first login, so a
        # Super Admin handing out a temp password never leaves a long-lived
        # credential the creator still knows.
        must_change_credentials=True,
        is_active=True,
        created_by_admin_id=requesting_admin.id,
    )
    db.add(admin)
    db.flush()

    log_audit_event(
        db, requesting_admin.id, "secondary_admin.create", "user", admin.id,
        {"name": admin.name, "username": admin.username},
    )
    db.commit()
    db.refresh(admin)
    return admin


def set_secondary_admin_active(admin_id: int, active: bool, requesting_admin: User, db: Session) -> User:
    target = db.query(User).filter(User.id == admin_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="Admin account not found")

    # Structural enforcement: only Super Admin can even reach this function
    # (gated by require_super_admin on the route), and it only ever
    # operates on secondary_admin accounts — a Super Admin can never be
    # disabled through this endpoint, by construction.
    if target.admin_level != AdminLevel.secondary_admin:
        raise HTTPException(status_code=400, detail="Only Secondary Admin accounts can be enabled/disabled here")

    if active:
        active_count = (
            db.query(User)
            .filter(
                User.role == Role.admin,
                User.admin_level == AdminLevel.secondary_admin,
                User.is_active == True,  # noqa: E712
                User.id != target.id,
            )
            .count()
        )
        if active_count >= MAX_SECONDARY_ADMINS:
            raise HTTPException(status_code=400, detail=f"Maximum of {MAX_SECONDARY_ADMINS} active Secondary Admins reached")

    target.is_active = active
    log_audit_event(
        db, requesting_admin.id,
        "secondary_admin.enable" if active else "secondary_admin.disable",
        "user", target.id,
    )
    db.commit()
    db.refresh(target)
    return target


def list_audit_logs(db: Session, limit: int = 200) -> list[AuditLog]:
    return db.query(AuditLog).order_by(AuditLog.created_at.desc()).limit(limit).all()
