from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.core.dependencies import require_admin, get_current_user
from app.models.user import User
from app.schemas.credit import CreditTransactionOut, CreditReportEntry
from app.services.credit_service import get_transactions, get_all_transactions, get_credit_report

router = APIRouter(prefix="/credits", tags=["Credits"])


@router.get("/my/transactions", response_model=list[CreditTransactionOut])
def my_transactions(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return get_transactions(current_user.id, db)


@router.get("/transactions", response_model=list[CreditTransactionOut])
def all_transactions(
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    return get_all_transactions(db)


@router.get("/report", response_model=list[CreditReportEntry])
def credit_report(
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    return get_credit_report(db)
