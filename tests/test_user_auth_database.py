"""
Tests for Permanent Admin Account and SQLite Database Teacher Management.
Verifies real database persistence, PBKDF2 password hashing, permanent admin protection,
and API authentication endpoints.
"""
import os
import pytest
from fastapi.testclient import TestClient
from ai_engine.attendance.offline_queue import OfflineSyncQueue, _hash_password, _verify_password
from ai_engine.api.main import app

@pytest.fixture
def queue(tmp_path):
    test_db = str(tmp_path / "test_auth_queue.db")
    q = OfflineSyncQueue(db_path=test_db)
    return q

def test_permanent_admin_seeded(queue):
    admin = queue.get_user_by_identifier("admin@school.edu")
    assert admin is not None
    assert admin["role"] == "admin"
    assert admin["is_permanent"] == 1
    
    # Shorthand username also resolves
    admin_by_short = queue.get_user_by_identifier("admin")
    assert admin_by_short is not None
    assert admin_by_short["uid"] == admin["uid"]

def test_admin_authentication_and_password_hashing(queue):
    # Valid login
    user = queue.authenticate_user("admin", "admin123")
    assert user is not None
    assert user["role"] == "admin"
    assert user["isPermanent"] is True

    # Bad password
    invalid = queue.authenticate_user("admin", "wrongpassword999")
    assert invalid is None

def test_create_and_authenticate_new_teacher(queue):
    new_user = queue.create_user(
        email="alan.turing@school.edu",
        password="EnigmaSecurePass2026!",
        full_name="Prof. Alan Turing",
        role="teacher",
        department="Computer Science"
    )
    assert new_user["email"] == "alan.turing@school.edu"
    assert new_user["role"] == "teacher"
    assert new_user["isPermanent"] is False

    # Authenticate by full email
    auth_email = queue.authenticate_user("alan.turing@school.edu", "EnigmaSecurePass2026!")
    assert auth_email is not None
    assert auth_email["displayName"] == "Prof. Alan Turing"

    # Authenticate by shorthand username prefix
    auth_short = queue.authenticate_user("alan.turing", "EnigmaSecurePass2026!")
    assert auth_short is not None
    assert auth_short["uid"] == new_user["uid"]

    # Reject incorrect password
    assert queue.authenticate_user("alan.turing", "WrongPass") is None

def test_permanent_admin_cannot_be_deleted(queue):
    admin = queue.get_user_by_identifier("admin")
    assert admin is not None
    
    with pytest.raises(ValueError, match="Cannot delete permanent administrator account"):
        queue.delete_user(admin["uid"])

def test_delete_teacher_account(queue):
    teacher = queue.create_user(
        email="delete.me@school.edu",
        password="temppassword123",
        full_name="Temp Teacher"
    )
    uid = teacher["uid"]
    assert queue.get_user_by_identifier("delete.me@school.edu") is not None

    deleted = queue.delete_user(uid)
    assert deleted is True
    assert queue.get_user_by_identifier("delete.me@school.edu") is None

def test_auth_api_routes():
    client = TestClient(app)
    
    # 1. Login with permanent admin
    resp = client.post("/auth/login", json={"identifier": "admin", "password": "admin123"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["success"] is True
    assert data["user"]["role"] == "admin"
    assert data["user"]["isPermanent"] is True

    # 2. List all users (at least permanent admin)
    users_resp = client.get("/auth/users")
    assert users_resp.status_code == 200
    users_data = users_resp.json()
    assert users_data["total"] >= 1
    emails = [u["email"] for u in users_data["users"]]
    assert "admin@school.edu" in emails

    # 3. Create a new teacher via API
    create_resp = client.post("/auth/users", json={
        "email": "ada.lovelace@school.edu",
        "password": "analyticalengine",
        "fullName": "Countess Ada Lovelace",
        "department": "Mechanical & Computational Sciences"
    })
    assert create_resp.status_code == 200
    created = create_resp.json()["user"]
    assert created["displayName"] == "Countess Ada Lovelace"

    # 4. Login with newly created teacher
    login_resp = client.post("/auth/login", json={
        "identifier": "ada.lovelace@school.edu",
        "password": "analyticalengine"
    })
    assert login_resp.status_code == 200
    assert login_resp.json()["user"]["fullName"] == "Countess Ada Lovelace"

    # 5. Clean up created user
    del_resp = client.delete(f"/auth/users/{created['uid']}")
    assert del_resp.status_code == 200

