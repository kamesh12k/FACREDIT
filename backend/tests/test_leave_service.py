"""Tests for app.services.leave_service."""
import pytest
from datetime import date
from fastapi import HTTPException
from unittest.mock import patch

from app.services.leave_service import (
    submit_leave, get_all_leaves, get_teacher_leaves,
    approve_leave, reject_leave, detect_free_teachers,
    assign_substitute, override_substitute, undo_assignment,
    set_assignment_lock,
)
from app.schemas.leave import LeaveCreate
from app.models.leave import LeaveRequest, LeaveStatus, AlterAssignment, AssignmentType
from app.models.credit import TeacherCredit
from tests.conftest import (
    _make_user, create_calendar_day, create_leave_request,
    create_teacher_credit, create_department, create_subject,
    create_class, create_timetable_slot,
)
from app.models.day_order_calendar import DayType


class TestSubmitLeave:
    def test_success(self, db_session, test_teacher):
        create_calendar_day(db_session, date(2026, 7, 1), DayType.working, day_order=1)
        data = LeaveCreate(date=date(2026, 7, 1), period_number=1, reason="Sick")
        leave = submit_leave(test_teacher.id, data, db_session)
        assert leave.status == LeaveStatus.pending
        assert leave.day_order == 1

    def test_non_working_day_rejected(self, db_session, test_teacher):
        create_calendar_day(db_session, date(2026, 7, 1), DayType.holiday, day_order=None)
        data = LeaveCreate(date=date(2026, 7, 1), period_number=1, reason="Sick")
        with pytest.raises(HTTPException) as exc:
            submit_leave(test_teacher.id, data, db_session)
        assert exc.value.status_code == 400

    def test_no_calendar_entry(self, db_session, test_teacher):
        data = LeaveCreate(date=date(2026, 7, 1), period_number=1, reason="Sick")
        with pytest.raises(HTTPException) as exc:
            submit_leave(test_teacher.id, data, db_session)
        assert exc.value.status_code == 400


class TestGetLeaves:
    def test_all(self, db_session, test_teacher):
        create_leave_request(db_session, test_teacher.id)
        assert len(get_all_leaves(db_session)) == 1

    def test_by_teacher(self, db_session, test_teacher, test_teacher2):
        create_leave_request(db_session, test_teacher.id)
        create_leave_request(db_session, test_teacher2.id, the_date=date(2026, 7, 2))
        assert len(get_teacher_leaves(test_teacher.id, db_session)) == 1


class TestApproveReject:
    def test_approve(self, db_session, test_teacher):
        create_calendar_day(db_session, date(2026, 7, 1), DayType.working, day_order=1)
        leave = create_leave_request(db_session, test_teacher.id)
        result, free = approve_leave(leave.id, db_session)
        assert result.status == LeaveStatus.approved

    def test_approve_already_approved(self, db_session, test_teacher):
        create_calendar_day(db_session, date(2026, 7, 1), DayType.working, day_order=1)
        leave = create_leave_request(db_session, test_teacher.id, status=LeaveStatus.approved)
        with pytest.raises(HTTPException) as exc:
            approve_leave(leave.id, db_session)
        assert exc.value.status_code == 400

    def test_reject(self, db_session, test_teacher):
        leave = create_leave_request(db_session, test_teacher.id)
        result = reject_leave(leave.id, db_session)
        assert result.status == LeaveStatus.rejected

    def test_reject_already_rejected(self, db_session, test_teacher):
        leave = create_leave_request(db_session, test_teacher.id, status=LeaveStatus.rejected)
        with pytest.raises(HTTPException) as exc:
            reject_leave(leave.id, db_session)
        assert exc.value.status_code == 400

    def test_not_found(self, db_session):
        with pytest.raises(HTTPException) as exc:
            approve_leave(999, db_session)
        assert exc.value.status_code == 404


class TestDetectFreeTeachers:
    def test_detects_free(self, db_session, test_teacher, test_teacher2):
        free = detect_free_teachers(1, 1, test_teacher.id, db_session)
        ids = [t.id for t in free]
        assert test_teacher2.id in ids
        assert test_teacher.id not in ids

    def test_busy_excluded(self, db_session, test_teacher, test_teacher2):
        dept = create_department(db_session)
        subj = create_subject(db_session, department_id=dept.id)
        cls = create_class(db_session, department_id=dept.id)
        create_timetable_slot(db_session, test_teacher2.id, subj.id, cls.id)
        free = detect_free_teachers(1, 1, test_teacher.id, db_session)
        ids = [t.id for t in free]
        assert test_teacher2.id not in ids


class TestAssignSubstitute:
    def _setup(self, db_session):
        teacher = _make_user(db_session, email="lt@test.com")
        sub = _make_user(db_session, email="sub@test.com")
        create_calendar_day(db_session, date(2026, 7, 1), DayType.working, day_order=1)
        leave = create_leave_request(
            db_session, teacher.id, status=LeaveStatus.approved,
        )
        create_teacher_credit(db_session, teacher.id)
        create_teacher_credit(db_session, sub.id)
        return teacher, sub, leave

    def test_success(self, db_session):
        teacher, sub, leave = self._setup(db_session)
        assignment = assign_substitute(leave.id, sub.id, db_session)
        assert assignment.substitute_teacher_id == sub.id

    def test_not_approved(self, db_session):
        teacher = _make_user(db_session, email="na@test.com")
        sub = _make_user(db_session, email="nas@test.com")
        leave = create_leave_request(db_session, teacher.id, status=LeaveStatus.pending)
        with pytest.raises(HTTPException) as exc:
            assign_substitute(leave.id, sub.id, db_session)
        assert exc.value.status_code == 400

    def test_self_assign(self, db_session):
        teacher = _make_user(db_session, email="self@test.com")
        create_calendar_day(db_session, date(2026, 7, 1), DayType.working, day_order=1)
        leave = create_leave_request(db_session, teacher.id, status=LeaveStatus.approved)
        with pytest.raises(HTTPException) as exc:
            assign_substitute(leave.id, teacher.id, db_session)
        assert exc.value.status_code == 400

    def test_teacher_not_found(self, db_session):
        teacher = _make_user(db_session, email="tnf@test.com")
        create_calendar_day(db_session, date(2026, 7, 1), DayType.working, day_order=1)
        leave = create_leave_request(db_session, teacher.id, status=LeaveStatus.approved)
        with pytest.raises(HTTPException) as exc:
            assign_substitute(leave.id, 9999, db_session)
        assert exc.value.status_code == 404
