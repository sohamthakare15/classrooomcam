"""
Unit tests for data cleanup and removing unwanted items:
- Deleting an individual attendance session and its snapshots from SQLite
- Clearing all test attendance sessions
- Clearing pending recognition reviews
"""
import pytest
from fastapi.testclient import TestClient
from ai_engine.api.main import app
from ai_engine.attendance.offline_queue import OfflineSyncQueue

def test_delete_individual_session(tmp_path):
    test_db = str(tmp_path / "test_cleanup.db")
    queue = OfflineSyncQueue(db_path=test_db)
    
    # Insert dummy session
    session_data = {
        "sessionId": "sess_test_123",
        "class": "10",
        "section": "A",
        "date": "2026-11-14",
        "status": "completed",
        "presentCount": 1,
        "absentCount": 0
    }
    queue.enqueue_operation("attendance_sessions", "sess_test_123", "SET", session_data, attempt_immediate_sync=False)
    assert queue.get_local_session("sess_test_123") is not None

    # Insert a dummy record
    record_data = {
        "recordId": "rec_test_123",
        "sessionId": "sess_test_123",
        "studentId": "STU-001",
        "status": "present"
    }
    queue.enqueue_operation("attendance_records", "rec_test_123", "SET", record_data, attempt_immediate_sync=False)
    assert len(queue.get_local_records_for_session("sess_test_123")) == 1

    # Delete session
    deleted = queue.delete_local_session("sess_test_123")
    assert deleted is True
    assert queue.get_local_session("sess_test_123") is None
    assert len(queue.get_local_records_for_session("sess_test_123")) == 0

def test_clear_all_sessions(tmp_path):
    test_db = str(tmp_path / "test_cleanup_all.db")
    queue = OfflineSyncQueue(db_path=test_db)

    queue.enqueue_operation("attendance_sessions", "s1", "SET", {"sessionId": "s1", "status": "completed"}, attempt_immediate_sync=False)
    queue.enqueue_operation("attendance_sessions", "s2", "SET", {"sessionId": "s2", "status": "completed"}, attempt_immediate_sync=False)
    assert len(queue.get_local_sessions()) == 2

    count = queue.clear_all_sessions()
    assert count == 2
    assert len(queue.get_local_sessions()) == 0

def test_api_cleanup_endpoints():
    client = TestClient(app)
    
    # 1. Clear reviews
    resp = client.delete("/recognition/review")
    assert resp.status_code == 200
    assert resp.json()["success"] is True

    # 2. Clear sessions
    resp2 = client.delete("/attendance/sessions")
    assert resp2.status_code == 200
    assert resp2.json()["success"] is True
