from sqlalchemy import Column, String, Text, DateTime, func

from app.database import Base

# Single source of truth for valid campus_operations_mode values — both
# app/services/substitution_service.py and app/schemas/substitution.py
# import this rather than each declaring their own copy, so the two can
# never drift out of sync.
CAMPUS_OPERATIONS_MODES = {"manual", "assisted", "autonomous"}


class SystemSetting(Base):
    """Small key/value store for settings that Factory Reset restores to
    defaults. Most configuration lives in .env (untouched by reset);
    this table is only for runtime-editable defaults."""
    __tablename__ = "system_settings"

    key = Column(String(100), primary_key=True)
    value = Column(Text, nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


DEFAULT_SYSTEM_SETTINGS = {
    "app_name": "Credits",
    "push_notifications_enabled": "true",
    "max_secondary_admins": "3",
    "periods_per_day": "5",
    "day_order_max": "6",
    # Campus Operations Mode: "manual" | "assisted" | "autonomous" — see
    # substitution_service.py for what each mode actually does. Defaults
    # to "assisted" rather than "autonomous": a fresh install should not
    # start auto-executing substitute assignments before an admin has
    # deliberately turned that on.
    "campus_operations_mode": "assisted",
    "emergency_window_hours": "2",
}
