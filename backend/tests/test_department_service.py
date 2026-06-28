"""Tests for app.services.department_service."""
import pytest
from fastapi import HTTPException

from app.services.department_service import list_departments, create_department
from app.schemas.department import DepartmentCreate
from tests.conftest import create_department as factory_department


class TestDepartmentService:
    def test_list_empty(self, db_session):
        assert list_departments(db_session) == []

    def test_create_and_list(self, db_session):
        data = DepartmentCreate(name="CS", code="CS")
        dept = create_department(data, db_session)
        assert dept.name == "CS"
        result = list_departments(db_session)
        assert len(result) == 1

    def test_duplicate_name(self, db_session):
        factory_department(db_session, name="CS")
        data = DepartmentCreate(name="CS")
        with pytest.raises(HTTPException) as exc:
            create_department(data, db_session)
        assert exc.value.status_code == 400
