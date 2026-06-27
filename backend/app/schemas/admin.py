from pydantic import BaseModel, field_validator, model_validator
from datetime import datetime
from typing import Any

from app.core.security import validate_password_strength, MIN_PASSWORD_LENGTH


class FirstLoginSetupRequest(BaseModel):
    """Clears must_change_credentials for an admin still on bootstrap/reset
    defaults. new_username lets them replace the literal "admin" username
    so it can't be guessed/reused afterwards."""
    new_username: str
    new_password: str
    confirm_password: str

    @field_validator("new_username")
    @classmethod
    def validate_username(cls, v: str) -> str:
        v = v.strip()
        if len(v) < 3:
            raise ValueError("Username must be at least 3 characters long")
        if v.lower() == "admin":
            raise ValueError('Username cannot remain the default value ("admin")')
        return v

    @model_validator(mode="after")
    def validate_passwords(self):
        if self.new_password != self.confirm_password:
            raise ValueError("Passwords do not match")
        try:
            validate_password_strength(self.new_password, forbid_default=True)
        except ValueError as e:
            raise ValueError(str(e))
        return self


class SecondaryAdminCreate(BaseModel):
    name: str
    username: str
    password: str

    @field_validator("username")
    @classmethod
    def validate_username(cls, v: str) -> str:
        v = v.strip()
        if len(v) < 3:
            raise ValueError("Username must be at least 3 characters long")
        return v

    @field_validator("password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        validate_password_strength(v)
        return v


class AdminActiveToggle(BaseModel):
    is_active: bool


class FactoryResetRequest(BaseModel):
    password: str
    confirmation_text: str

    @field_validator("confirmation_text")
    @classmethod
    def validate_confirmation(cls, v: str) -> str:
        if v != "RESET EVERYTHING":
            raise ValueError('Type exactly "RESET EVERYTHING" to confirm')
        return v


class FactoryResetResponse(BaseModel):
    message: str
    backup_file: str
    reset_at: datetime


class AuditLogOut(BaseModel):
    id: int
    actor_user_id: int | None
    actor_name: str | None = None
    action: str
    target_type: str | None
    target_id: int | None
    details: dict[str, Any] | None
    created_at: datetime

    model_config = {"from_attributes": True}
