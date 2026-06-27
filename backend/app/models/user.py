from sqlalchemy import Column, Integer, String, Enum, Boolean, ForeignKey, DateTime, func
from sqlalchemy.orm import relationship
import enum

from app.database import Base


class Role(str, enum.Enum):
    admin = "admin"
    teacher = "teacher"


class AdminLevel(str, enum.Enum):
    super_admin = "super_admin"
    secondary_admin = "secondary_admin"


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)

    # Teachers authenticate with email; admins authenticate with username.
    # Exactly one of the two is required (enforced by chk_user_identity at
    # the DB layer, mirrored by validation in the service layer).
    email = Column(String(150), unique=True, nullable=True, index=True)
    username = Column(String(50), unique=True, nullable=True, index=True)

    password_hash = Column(String(255), nullable=False)
    role = Column(Enum(Role), default=Role.teacher, nullable=False)
    admin_level = Column(Enum(AdminLevel), nullable=True)
    department = Column(String(100), nullable=True)

    # First-login security: set True whenever an admin account's credentials
    # are still at a default/bootstrap value. Backend blocks all routes
    # except the first-login-setup endpoint until this is cleared.
    must_change_credentials = Column(Boolean, default=False, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    created_by_admin_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    timetable_slots = relationship("TimetableSlot", back_populates="teacher")
    leave_requests = relationship("LeaveRequest", back_populates="teacher", foreign_keys="LeaveRequest.teacher_id")
    alter_assignments = relationship("AlterAssignment", back_populates="substitute", foreign_keys="AlterAssignment.substitute_teacher_id")
    credit_transactions = relationship("CreditTransaction", back_populates="teacher")
    credit_balance = relationship("TeacherCredit", back_populates="teacher", uselist=False)

    @property
    def is_super_admin(self) -> bool:
        return self.role == Role.admin and self.admin_level == AdminLevel.super_admin

    @property
    def is_secondary_admin(self) -> bool:
        return self.role == Role.admin and self.admin_level == AdminLevel.secondary_admin
