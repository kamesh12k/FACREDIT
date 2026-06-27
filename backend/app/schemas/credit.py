from pydantic import BaseModel
from datetime import datetime


class CreditBalanceOut(BaseModel):
    teacher_id: int
    balance: int

    model_config = {"from_attributes": True}


class CreditTransactionOut(BaseModel):
    id: int
    teacher_id: int
    change: int
    reason: str
    related_leave_id: int | None
    created_at: datetime

    model_config = {"from_attributes": True}


class CreditReportEntry(BaseModel):
    teacher_id: int
    name: str
    department: str | None
    balance: int
