import logging
import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import Base, engine, SessionLocal
import app.models  # ensure all models are registered with Base before create_all

from app.routes import (
    auth, teachers, timetable, leaves, credits, notifications,
    departments, subjects, classes, rooms, day_order, admin, academic_calendar,
    campus_operations,
)
from app.services.admin_service import bootstrap_default_super_admin

logging.basicConfig(level=logging.INFO)

# Create tables on startup (use Alembic migrations in production)
if not os.environ.get("SKIP_DB_INIT"):
    Base.metadata.create_all(bind=engine)

# Bootstrap: if no Super Admin exists yet (fresh install, or right after a
# Factory Reset performed via the offline CLI script with zero remaining
# users), create username=admin / password=admin with a forced credential
# change. No-op if a Super Admin already exists.
if not os.environ.get("SKIP_DB_INIT"):
    with SessionLocal() as _bootstrap_db:
        bootstrap_default_super_admin(_bootstrap_db)

app = FastAPI(
    title=settings.APP_NAME,
    version="3.0.0",
    description="Manage teacher leave requests, substitute assignments, credit workload balancing, timetables, and the academic calendar (Day Order rotation + holiday management).",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_ORIGIN],  # set FRONTEND_ORIGIN in .env for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(admin.router)
app.include_router(teachers.router)
app.include_router(timetable.router)
app.include_router(leaves.router)
app.include_router(credits.router)
app.include_router(notifications.router)
app.include_router(departments.router)
app.include_router(subjects.router)
app.include_router(classes.router)
app.include_router(rooms.router)
app.include_router(day_order.router)
app.include_router(academic_calendar.router)
app.include_router(campus_operations.router)


@app.get("/health", tags=["Health"])
def health():
    return {"status": "ok"}


@app.get("/settings/public", tags=["Settings"])
def public_settings():
    """Branding values the frontend reads on load — no auth required since
    this only exposes display customization (app name, accent color),
    nothing sensitive. Lets an institution rebrand the app via .env alone,
    without touching frontend code or rebuilding."""
    return {
        "app_name": settings.APP_NAME,
        "primary_color": settings.PRIMARY_COLOR,
        "periods_per_day": settings.PERIODS_PER_DAY,
        "day_order_max": settings.DAY_ORDER_MAX,
    }
