import pytest
import os
import json
from fastapi.testclient import TestClient
from ai_engine.api.main import app
from ai_engine.attendance.offline_queue import OfflineSyncQueue

client = TestClient(app)
AUTH_HEADERS = {"X-App-Token": "smartclassroom-secure-ipc-token-2026"}

def test_attendance_records_endpoint_all():
    """Verify GET /attendance/records returns all local records."""
    response = client.get("/attendance/records", headers=AUTH_HEADERS)
    assert response.status_code == 200
    data = response.json()
    assert "total" in data
    assert "records" in data
    assert isinstance(data["records"], list)
    assert data["total"] == len(data["records"])

def test_attendance_records_endpoint_filtering():
    """Verify GET /attendance/records filtering by session_id and student_id."""
    # First get all records to find a sample session_id and student_id
    response = client.get("/attendance/records", headers=AUTH_HEADERS)
    assert response.status_code == 200
    records = response.json().get("records", [])

    if records:
        sample = records[0]
        sess_id = sample.get("sessionId")
        stu_id = sample.get("studentId")

        if sess_id:
            filtered_sess = client.get(f"/attendance/records?session_id={sess_id}", headers=AUTH_HEADERS)
            assert filtered_sess.status_code == 200
            sess_data = filtered_sess.json()
            for r in sess_data["records"]:
                assert r["sessionId"] == sess_id

        if stu_id:
            filtered_stu = client.get(f"/attendance/records?student_id={stu_id}", headers=AUTH_HEADERS)
            assert filtered_stu.status_code == 200
            stu_data = filtered_stu.json()
            for r in stu_data["records"]:
                assert r["studentId"] == stu_id

def test_offline_queue_get_all_records():
    """Verify OfflineSyncQueue.get_all_local_records() method returns records from SQLite."""
    queue = OfflineSyncQueue()
    all_records = queue.get_all_local_records()
    assert isinstance(all_records, list)

def test_print_styles_configured():
    """Verify index.css has @media print configuration with required directives."""
    css_path = os.path.join("desktop", "frontend", "src", "index.css")
    assert os.path.exists(css_path)
    with open(css_path, "r", encoding="utf-8") as f:
        content = f.read()
    assert "@media print" in content
    assert "aside" in content
    assert "header" in content
    assert "#printable-register" in content
    assert "print-color-adjust" in content

def test_printable_register_component_exists():
    """Verify PrintableRegister.jsx exists and has both session and monthly mode handling."""
    comp_path = os.path.join("desktop", "frontend", "src", "components", "PrintableRegister.jsx")
    assert os.path.exists(comp_path)
    with open(comp_path, "r", encoding="utf-8") as f:
        content = f.read()
    assert "mode === 'session'" in content
    assert "window.print()" in content
    assert "handleExportCSV" in content
    assert "REG-SESS-" in content
    assert "Institutional Regulatory Certification" in content

