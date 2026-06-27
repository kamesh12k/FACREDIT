from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from app.database import get_db
from app.core.security import decode_token
from app.models.user import User, Role, AdminLevel

bearer_scheme = HTTPBearer()


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    token = credentials.credentials
    payload = decode_token(token)

    user_id: int | None = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    user = db.query(User).filter(User.id == int(user_id)).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")

    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Account disabled")

    return user


def require_credentials_set(current_user: User = Depends(get_current_user)) -> User:
    """Blocks access to every protected route except the first-login-setup
    endpoint (which depends on get_current_user directly) until an admin
    bootstrapped on default credentials has set a real username/password."""
    if current_user.must_change_credentials:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="MUST_CHANGE_CREDENTIALS",
        )
    return current_user


def require_admin(current_user: User = Depends(require_credentials_set)) -> User:
    if current_user.role != Role.admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    return current_user


def require_super_admin(current_user: User = Depends(require_credentials_set)) -> User:
    if current_user.role != Role.admin or current_user.admin_level != AdminLevel.super_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Super Admin access required")
    return current_user


def require_teacher(current_user: User = Depends(require_credentials_set)) -> User:
    if current_user.role != Role.teacher:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Teacher access required")
    return current_user
