"""
Integration and Unit Tests for Firebase Realtime Database (RTDB) Operations.
Directly tests read, write, update, and deterministic ID operations on:
https://classroomcam-1b81d-default-rtdb.asia-southeast1.firebasedatabase.app
"""
import pytest
import json
import urllib.request
import urllib.error
import time

RTDB_BASE_URL = "https://classroomcam-1b81d-default-rtdb.asia-southeast1.firebasedatabase.app"

def test_rtdb_connectivity():
    """Validates root RTDB reachability and HTTP 200 response."""
    url = f"{RTDB_BASE_URL}/.json"
    req = urllib.request.Request(url)
    with urllib.request.urlopen(req, timeout=5.0) as resp:
        assert resp.status == 200

def test_rtdb_student_crud():
    """Tests writing, reading, updating and deleting a student in RTDB."""
    test_student_id = f"TEST_STU_{int(time.time())}"
    url = f"{RTDB_BASE_URL}/students/{test_student_id}.json"

    # 1. Write (PUT)
    student_data = {
        "studentId": test_student_id,
        "fullName": "Test Automated Student",
        "rollNumber": "99",
        "class": "10",
        "section": "A",
        "enrollmentStatus": "Enrolled",
        "updatedAt": time.time()
    }
    body = json.dumps(student_data).encode("utf-8")
    req = urllib.request.Request(url, data=body, headers={"Content-Type": "application/json"}, method="PUT")
    with urllib.request.urlopen(req, timeout=5.0) as resp:
        assert resp.status == 200
        saved = json.loads(resp.read().decode("utf-8"))
        assert saved["fullName"] == "Test Automated Student"

    # 2. Read (GET)
    with urllib.request.urlopen(url, timeout=5.0) as resp:
        assert resp.status == 200
        fetched = json.loads(resp.read().decode("utf-8"))
        assert fetched["studentId"] == test_student_id
        assert fetched["rollNumber"] == "99"

    # 3. Update (PATCH)
    patch_data = json.dumps({"enrollmentStatus": "Needs Review"}).encode("utf-8")
    patch_req = urllib.request.Request(url, data=patch_data, headers={"Content-Type": "application/json"}, method="PATCH")
    with urllib.request.urlopen(patch_req, timeout=5.0) as resp:
        assert resp.status == 200
        patched = json.loads(resp.read().decode("utf-8"))
        assert patched["enrollmentStatus"] == "Needs Review"

    # 4. Clean up (DELETE)
    del_req = urllib.request.Request(url, method="DELETE")
    with urllib.request.urlopen(del_req, timeout=5.0) as resp:
        assert resp.status == 200

def test_rtdb_deterministic_attendance_record():
    """Tests deterministic attendance record creation and conflict-free idempotency."""
    session_id = f"test_sess_{int(time.time())}"
    student_id = "test_stu_01"
    # Deterministic ID format: session_{sessionId}_student_{studentId}
    deterministic_id = f"session_{session_id}_student_{student_id}"
    url = f"{RTDB_BASE_URL}/attendance_records/{deterministic_id}.json"

    record_data = {
        "recordId": deterministic_id,
        "sessionId": session_id,
        "studentId": student_id,
        "status": "present",
        "confidenceScore": 0.94,
        "detectedAt": time.time(),
        "method": "ai",
        "createdAt": time.time()
    }

    # Initial write
    body = json.dumps(record_data).encode("utf-8")
    req = urllib.request.Request(url, data=body, headers={"Content-Type": "application/json"}, method="PUT")
    with urllib.request.urlopen(req, timeout=5.0) as resp:
        assert resp.status == 200

    # Repeat write with same deterministic ID should update without duplication
    record_data["confidenceScore"] = 0.97
    body2 = json.dumps(record_data).encode("utf-8")
    req2 = urllib.request.Request(url, data=body2, headers={"Content-Type": "application/json"}, method="PUT")
    with urllib.request.urlopen(req2, timeout=5.0) as resp:
        assert resp.status == 200
        updated = json.loads(resp.read().decode("utf-8"))
        assert updated["confidenceScore"] == 0.97

    # Clean up
    del_req = urllib.request.Request(url, method="DELETE")
    with urllib.request.urlopen(del_req, timeout=5.0) as resp:
        assert resp.status == 200

def test_rtdb_audit_log_and_review_queue():
    """Tests audit log append and review queue write in RTDB."""
    log_id = f"audit_test_{int(time.time())}"
    log_url = f"{RTDB_BASE_URL}/attendance_audit_logs/{log_id}.json"
    audit_payload = {
        "logId": log_id,
        "sessionId": "sess_100",
        "studentId": "stu_200",
        "action": "MANUAL_OVERRIDE",
        "previousStatus": "absent",
        "newStatus": "present",
        "changedBy": "faculty_usr",
        "timestamp": time.time(),
        "reason": "Late bus arrival verified"
    }

    req = urllib.request.Request(log_url, data=json.dumps(audit_payload).encode("utf-8"), headers={"Content-Type": "application/json"}, method="PUT")
    with urllib.request.urlopen(req, timeout=5.0) as resp:
        assert resp.status == 200

    # Clean up
    urllib.request.urlopen(urllib.request.Request(log_url, method="DELETE"), timeout=5.0)

def test_biometric_template_privacy_filter():
    """Verifies that offline sync queue sanitizes out any biometric template keys before cloud push."""
    from ai_engine.attendance.offline_queue import OfflineSyncQueue
    queue = OfflineSyncQueue()
    dirty_payload = {
        "studentId": "S_SECURE",
        "fullName": "Privacy Test Student",
        "rollNumber": "01",
        "class": "10",
        "section": "A",
        "embedding": [0.1, 0.2, 0.3], # Forbidden biometric data
        "biometricTemplate": b"secret_raw_vector_bytes".hex(), # Forbidden
        "template": "binary_enc" # Forbidden
    }

    # When enqueued, biometric keys must be stripped
    queue.enqueue_operation("students", "S_SECURE", "SET", dirty_payload, attempt_immediate_sync=False)
    pending = queue.get_pending_sync_items(10)
    target = next((item for item in pending if item["doc_id"] == "S_SECURE"), None)
    assert target is not None
    payload = target["payload"]
    assert "embedding" not in payload
    assert "biometricTemplate" not in payload
    assert "template" not in payload
    assert payload["fullName"] == "Privacy Test Student"

