"""Tests for app.services.substitution_service."""
import pytest
from datetime import datetime, timedelta, timezone, date
from fastapi import HTTPException

from app.services.substitution_service import (
    get_mode, set_mode, get_emergency_window_hours,
    get_or_create_preferences, update_preferences,
    count_recent_substitutions, fairness_score,
    list_eligible_candidates, score_candidate,
    get_ranked_recommendations, create_assignment,
    auto_process_approved_leave, mark_emergency_if_applicable,
)
from app.models.system_setting import SystemSetting
from app.models.leave import LeaveRequest, LeaveStatus, AlterAssignment, AssignmentType
from app.models.timetable import TimetableSlot
from app.models.credit import TeacherCredit
from tests.conftest import (
    _make_user, create_department, create_subject, create_class,
    create_timetable_slot, create_calendar_day, create_leave_request,
    create_teacher_credit,
)
from app.models.day_order_calendar import DayType


class TestMode:
    def test_get_default(self, db_session):
        assert get_mode(db_session) == "manual"


    def test_set_and_get(self, db_session, test_super_admin):
        set_mode(db_session, "autonomous", test_super_admin)
        assert get_mode(db_session) == "autonomous"

    def test_invalid_mode(self, db_session, test_super_admin):
        with pytest.raises(HTTPException):
            set_mode(db_session, "invalid", test_super_admin)


class TestEmergencyWindow:
    def test_default(self, db_session):
        assert get_emergency_window_hours(db_session) == 2

    def test_custom(self, db_session):
        db_session.add(SystemSetting(key="emergency_window_hours", value="5"))
        db_session.commit()
        assert get_emergency_window_hours(db_session) == 5


class TestPreferences:
    def test_get_or_create(self, db_session, test_teacher):
        pref = get_or_create_preferences(db_session, test_teacher.id)
        assert pref.accept_auto_assignments is True

    def test_update(self, db_session, test_teacher):
        pref = update_preferences(db_session, test_teacher.id, accept_auto_assignments=False)
        assert pref.accept_auto_assignments is False


class TestFairness:
    def test_no_assignments(self, db_session, test_teacher):
        assert fairness_score(db_session, test_teacher.id) == 100.0


class TestEligibility:
    def _setup_leave(self, db_session):
        teacher = _make_user(db_session, email="leaver@test.com")
        create_calendar_day(db_session, date(2026, 7, 1), DayType.working, day_order=1)
        leave = create_leave_request(
            db_session, teacher.id, date(2026, 7, 1),
            day_order=1, period_number=1, status=LeaveStatus.approved,
        )
        return teacher, leave

    def test_excludes_self(self, db_session):
        teacher, leave = self._setup_leave(db_session)
        eligible = list_eligible_candidates(db_session, leave)
        assert teacher.id not in [t.id for t in eligible]

    def test_includes_free_teacher(self, db_session):
        _, leave = self._setup_leave(db_session)
        free = _make_user(db_session, email="free@test.com")
        eligible = list_eligible_candidates(db_session, leave)
        assert free.id in [t.id for t in eligible]

    def test_excludes_busy_teacher(self, db_session):
        _, leave = self._setup_leave(db_session)
        busy = _make_user(db_session, email="busy@test.com")
        dept = create_department(db_session)
        subj = create_subject(db_session, department_id=dept.id)
        cls = create_class(db_session, department_id=dept.id)
        create_timetable_slot(db_session, busy.id, subj.id, cls.id, day_order=1, period_number=1)
        eligible = list_eligible_candidates(db_session, leave)
        assert busy.id not in [t.id for t in eligible]


class TestMarkEmergency:
    def test_same_day_is_emergency(self, db_session):
        leave = LeaveRequest(
            teacher_id=1, date=datetime.now(timezone.utc).date(),
            day_order=1, period_number=1, reason="test",
            status=LeaveStatus.pending,
        )
        mark_emergency_if_applicable(db_session, leave)
        assert leave.is_emergency is True

    def test_far_future_not_emergency(self, db_session):
        leave = LeaveRequest(
            teacher_id=1, date=(datetime.now(timezone.utc) + timedelta(days=30)).date(),
            day_order=1, period_number=1, reason="test",
            status=LeaveStatus.pending,
        )
        mark_emergency_if_applicable(db_session, leave)
        assert leave.is_emergency is False
