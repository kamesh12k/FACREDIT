from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.core.dependencies import require_admin, get_current_user
from app.models.user import User, Role
from app.schemas.user import UserOut, UserCreate
from app.schemas.credit import CreditBalanceOut
from app.services import auth_service
from app.services.credit_service import get_balance

router = APIRouter(prefix="/teachers", tags=["Teachers"])


@router.get("/", response_model=list[UserOut])
def list_teachers(
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    return db.query(User).filter(User.role == Role.teacher).order_by(User.name).all()


@router.post("/", response_model=UserOut, status_code=201)
def create_teacher(
    data: UserCreate,
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    return auth_service.create_user_by_admin(data, db)


@router.get("/me", response_model=UserOut)
def get_me(current_user: User = Depends(get_current_user)):
    return current_user


@router.get("/{teacher_id}/credits", response_model=CreditBalanceOut)
def get_teacher_credits(
    teacher_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    balance = get_balance(teacher_id, db)
    return CreditBalanceOut(teacher_id=teacher_id, balance=balance)
