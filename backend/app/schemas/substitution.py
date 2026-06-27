from pydantic import BaseModel, field_validator
from app.schemas.user import UserOut
from app.models.system_setting import CAMPUS_OPERATIONS_MODES as VALID_MODES


class RecommendationOut(BaseModel):
    """One ranked candidate from get_ranked_recommendations — the score
    breakdown is shown to the admin so the number isn't a black box."""
    teacher: UserOut
    score: float
    reasons: list[str]
    same_subject: bool
    same_department: bool
    workload_count: int
    fairness: float

    model_config = {"from_attributes": True}


class CampusOperationsModeOut(BaseModel):
    mode: str


class CampusOperationsModeSet(BaseModel):
    mode: str

    @field_validator("mode")
    @classmethod
    def validate_mode(cls, v: str) -> str:
        if v not in VALID_MODES:
            raise ValueError(f"mode must be one of {sorted(VALID_MODES)}")
        return v


class SubstitutionPreferenceOut(BaseModel):
    teacher_id: int
    accept_auto_assignments: bool
    allow_emergency_assignments: bool
    max_weekly_substitutions: int | None
    prefer_morning_classes: bool
    prefer_same_department: bool

    model_config = {"from_attributes": True}


class SubstitutionPreferenceUpdate(BaseModel):
    accept_auto_assignments: bool | None = None
    allow_emergency_assignments: bool | None = None
    max_weekly_substitutions: int | None = None
    prefer_morning_classes: bool | None = None
    prefer_same_department: bool | None = None

    @field_validator("max_weekly_substitutions")
    @classmethod
    def validate_cap(cls, v: int | None) -> int | None:
        if v is not None and v < 0:
            raise ValueError("max_weekly_substitutions cannot be negative")
        return v
