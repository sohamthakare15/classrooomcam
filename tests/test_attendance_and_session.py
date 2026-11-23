"""
Attendance Engine and Session Management Tests.
"""
import pytest
import os
import shutil
import numpy as np
from ai_engine.attendance.offline_queue import OfflineSyncQueue
from ai_engine.attendance.engine import AttendanceEngine
from ai_engine.attendance.session_manager import SessionManager, AttendanceStatus, SessionStatus
from ai_engine.enrollment.manager import EnrollmentManager

TEST_STORAGE = "storage_test_env"

@pytest.fixture(autouse=True)
def cleanup_test_dir():
    if os.path.exists(TEST_STORAGE):
        shutil.rmtree(TEST_STORAGE, ignore_errors=True)
    yield
    if os.path.exists(TEST_STORAGE):
        shutil.rmtree(TEST_STORAGE, ignore_errors=True)

def test_session_lifecycle_and_duplicate_prevention():
    sync_queue = OfflineSyncQueue(os.path.join(TEST_STORAGE, "test_queue.db"))
    enrollment_mgr = EnrollmentManager(storage_dir=TEST_STORAGE)
    engine = AttendanceEngine(enrollment_manager=enrollment_mgr, storage_dir=TEST_STORAGE)
    session_mgr = SessionManager(engine=engine, sync_queue=sync_queue)

    # 1. Create Session
    session = session_mgr.create_session(
        class_name="10",
        section="A",
        session_date="2026-11-10",
        created_by="teacher_001"
    )
    session_id = session["sessionId"]
    assert session["status"] == SessionStatus.IN_PROGRESS
    assert session["presentCount"] == 0

    # 2. Simulate AI attendance mark for Student S101
    engine.on_attendance_marked({
        "sessionId": session_id,
        "studentId": "S101",
        "confidence": 0.94,
        "timestamp": 123456789.0,
        "method": "ai"
    })

    records = sync_queue.get_local_records_for_session(session_id)
    assert len(records) == 1
    assert records[0]["studentId"] == "S101"
    assert records[0]["status"] == AttendanceStatus.PRESENT
    assert records[0]["recordId"] == f"session_{session_id}_student_S101"

    # 3. Simulate another AI attendance mark for the SAME student in the same session
    # Should NOT create duplicate record (deterministic ID overwrite/update)
    engine.on_attendance_marked({
        "sessionId": session_id,
        "studentId": "S101",
        "confidence": 0.95,
        "timestamp": 123456799.0,
        "method": "ai"
    })
    records2 = sync_queue.get_local_records_for_session(session_id)
    assert len(records2) == 1

    # 4. Finalize session with student roster [S101, S102, S103]
    roster = [
        {"studentId": "S101", "class": "10", "section": "A", "fullName": "Alice Smith"},
        {"studentId": "S102", "class": "10", "section": "A", "fullName": "Bob Jones"},
        {"studentId": "S103", "class": "10", "section": "A", "fullName": "Charlie Brown"}
    ]
    finalized = session_mgr.finalize_session(session_id, "teacher_001", roster)
    assert finalized["status"] == SessionStatus.COMPLETED
    assert finalized["presentCount"] == 1
    assert finalized["absentCount"] == 2
    assert finalized["totalStudents"] == 3
    assert finalized["attendancePercentage"] == 33.3

    final_records = sync_queue.get_local_records_for_session(session_id)
    assert len(final_records) == 3
    statuses = {r["studentId"]: r["status"] for r in final_records}
    assert statuses["S101"] == AttendanceStatus.PRESENT
    assert statuses["S102"] == AttendanceStatus.ABSENT
    assert statuses["S103"] == AttendanceStatus.ABSENT

def test_manual_correction_and_audit_logging():
    sync_queue = OfflineSyncQueue(os.path.join(TEST_STORAGE, "test_queue.db"))
    enrollment_mgr = EnrollmentManager(storage_dir=TEST_STORAGE)
    engine = AttendanceEngine(enrollment_manager=enrollment_mgr, storage_dir=TEST_STORAGE)
    session_mgr = SessionManager(engine=engine, sync_queue=sync_queue)

    session = session_mgr.create_session("10", "B", "2026-11-10", "teacher_001")
    sess_id = session["sessionId"]

    # Teacher manually marks student as late with reason
    rec = session_mgr.manual_mark(
        session_id=sess_id,
        student_id="S201",
        status=AttendanceStatus.LATE,
        user_id="teacher_001",
        reason="Arrived 15 minutes late with permission note"
    )
    assert rec["status"] == AttendanceStatus.LATE
    assert rec["method"] == "manual"

    # Verify audit log in queue
    pending = sync_queue.get_pending_sync_items(50)
    audit_logs = [item for item in pending if item["collection"] == "attendance_audit_logs"]
    assert len(audit_logs) == 1
    audit_payload = audit_logs[0]["payload"]
    assert audit_payload["studentId"] == "S201"
    assert audit_payload["newStatus"] == AttendanceStatus.LATE
    assert "permission note" in audit_payload["reason"]

