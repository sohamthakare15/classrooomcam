"""
FastAPI Endpoints Tests.
"""
import pytest
from fastapi.testclient import TestClient
from ai_engine.api.main import app

@pytest.fixture
def client():
    return TestClient(app)

def test_api_health(client):
    res = client.get("/health")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "ok"
    assert data["ai_engine_active"] is True
    assert "camera_status" in data

def test_api_camera_status_and_connect(client):
    res = client.get("/camera/status")
    assert res.status_code == 200
    data = res.json()
    assert "type" in data

    # Test connect to mock camera
    conn_res = client.post("/camera/connect", json={
        "cameraType": "MOCK",
        "name": "Test Classroom Sim",
        "width": 640,
        "height": 480
    })
    assert conn_res.status_code == 200
    assert conn_res.json()["success"] is True

def test_api_attendance_workflow(client):
    # 1. Start session
    start_res = client.post("/attendance/start", json={
        "class": "12",
        "section": "Science-A",
        "date": "2026-11-10",
        "createdBy": "teacher_test"
    })
    assert start_res.status_code == 200
    sess = start_res.json()["session"]
    sess_id = sess["sessionId"]

    # 2. Manual attendance
    man_res = client.post("/attendance/manual", json={
        "sessionId": sess_id,
        "studentId": "STU_99",
        "status": "present",
        "userId": "teacher_test",
        "reason": "Verified manually via photo roll"
    })
    assert man_res.status_code == 200
    assert man_res.json()["record"]["status"] == "present"

    # 3. Get session details
    det_res = client.get(f"/attendance/{sess_id}")
    assert det_res.status_code == 200
    assert det_res.json()["recordsCount"] >= 1

    # 4. Stop session
    stop_res = client.post("/attendance/stop", json={"sessionId": sess_id})
    assert stop_res.status_code == 200

def test_api_reviews(client):
    rev_res = client.get("/recognition/review")
    assert rev_res.status_code == 200
    assert "reviews" in rev_res.json()

