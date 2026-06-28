"""Integration tests for FastAPI routes/endpoints."""
import pytest
from datetime import date
from fastapi.testclient import TestClient

from app.models.user import Role, AdminLevel
from app.models.day_order_calendar import DayType
from tests.conftest import (
    create_department, create_subject, create_class, create_room,
    create_calendar_day, create_leave_request,
)


class TestAuthRoutes:
    def test_register_teacher(self, client):
        payload = {
            "name": "Register Route Teacher",
            "email": "route_teacher@test.com",
            "password": "Password123",
            "department": "CS",
        }
        response = client.post("/auth/register", json=payload)
        assert response.status_code == 201
        data = response.json()
        assert "access_token" in data
        assert data["user"]["email"] == "route_teacher@test.com"

    def test_login(self, client, test_teacher):
        payload = {
            "identifier": "teacher@test.com",
            "password": "Testpass1",
        }
        response = client.post("/auth/login", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data


class TestAdminRoutes:
    def test_list_secondary_admins(self, client, auth_headers_admin):
        response = client.get("/admin/secondary-admins", headers=auth_headers_admin)
        assert response.status_code == 200
        assert isinstance(response.json(), list)

    def test_create_secondary_admin(self, client, auth_headers_super_admin):
        payload = {
            "name": "Sec Admin",
            "username": "newsecadmin",
            "password": "Password123",
        }
        response = client.post("/admin/secondary-admins", json=payload, headers=auth_headers_super_admin)
        assert response.status_code == 201
        assert response.json()["username"] == "newsecadmin"

    def test_toggle_secondary_admin(self, client, auth_headers_super_admin, test_secondary_admin):
        response = client.patch(
            f"/admin/secondary-admins/{test_secondary_admin.id}/disable",
            headers=auth_headers_super_admin,
        )
        assert response.status_code == 200
        assert response.json()["is_active"] is False


class TestLeavesRoutes:
    def test_apply_leave(self, client, auth_headers_teacher, db_session):
        create_calendar_day(db_session, date(2026, 7, 1), DayType.working, day_order=1)
        payload = {
            "date": "2026-07-01",
            "period_number": 2,
            "reason": "Appointment",
        }
        response = client.post("/leaves/", json=payload, headers=auth_headers_teacher)
        assert response.status_code == 201
        assert response.json()["period_number"] == 2

    def test_list_all_leaves(self, client, auth_headers_admin, test_teacher, db_session):
        create_leave_request(db_session, test_teacher.id)
        response = client.get("/leaves/", headers=auth_headers_admin)
        assert response.status_code == 200
        assert len(response.json()) == 1


class TestTimetableRoutes:
    def test_create_timetable_slot(self, client, auth_headers_admin, test_teacher, db_session):
        dept = create_department(db_session)
        subj = create_subject(db_session, department_id=dept.id)
        cls = create_class(db_session, department_id=dept.id)
        room = create_room(db_session)

        payload = {
            "teacher_id": test_teacher.id,
            "subject_id": subj.id,
            "class_id": cls.id,
            "room_id": room.id,
            "day_order": 1,
            "period_number": 1,
        }
        response = client.post("/timetable/slot", json=payload, headers=auth_headers_admin)
        assert response.status_code == 201
        assert response.json()["period_number"] == 1
