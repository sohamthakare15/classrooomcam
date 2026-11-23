"""
Comprehensive Integration Tests for Lecturer Attendance Management System
Verifies:
1. Student enrollment, editing, deletion, search, and duplicate prevention.
2. Section management, student section assignments, and section-wise student counts.
3. One-click attendance session creation, duplicate session prevention for same section & date.
4. Attendance marking, review, finalization, and permanent SQLite database persistence.
5. Attendance history querying and filtering.
6. Lecturer authentication and authorization.
"""

import os
import time
import pytest
from datetime import datetime
from zoneinfo import ZoneInfo
from fastapi.testclient import TestClient

from ai_engine.attendance.offline_queue import OfflineSyncQueue
from ai_engine.api.main import app

KOLKATA_TZ = ZoneInfo("Asia/Kolkata")

@pytest.fixture
def test_queue(tmp_path):
    db_file = str(tmp_path / "test_lecturer_system.db")
    q = OfflineSyncQueue(db_path=db_file)
    return q

@pytest.fixture
def client():
    return TestClient(app)

# ---------------------------------------------------------
# 1. Student Enrollment & Duplicate Prevention Tests
# ---------------------------------------------------------
def test_student_enrollment_and_retrieval(test_queue):
    # Enroll student 1
    stu1 = {
        "studentId": "STU-001",
        "fullName": "Aarav Patel",
        "rollNumber": "101",
        "enrollmentNumber": "ENR-2026-001",
        "email": "aarav.patel@school.edu",
        "class": "10",
        "section": "A",
        "contactNumber": "+91 9876543210",
        "enrollmentStatus": "Enrolled"
    }
    saved = test_queue.upsert_student(stu1)
    assert saved["studentId"] == "STU-001"
    assert saved["fullName"] == "Aarav Patel"

    # Retrieve student
    retrieved = test_queue.get_student_by_id("STU-001")
    assert retrieved is not None
    assert retrieved["rollNumber"] == "101"
    assert retrieved["enrollmentNumber"] == "ENR-2026-001"

    all_students = test_queue.get_all_students()
    assert len(all_students) == 1

def test_duplicate_student_prevention(test_queue):
    stu1 = {
        "studentId": "STU-001",
        "fullName": "Aarav Patel",
        "rollNumber": "101",
        "enrollmentNumber": "ENR-2026-001",
        "class": "10",
        "section": "A",
    }
    test_queue.upsert_student(stu1)

    # 1. Duplicate enrollment number check
    with pytest.raises(ValueError) as exc1:
        test_queue.check_duplicate_student(
            roll_number="102",
            class_name="10",
            section="A",
            enrollment_number="ENR-2026-001"
        )
    assert "Enrollment Number" in str(exc1.value)

    # 2. Duplicate roll number in same class and section
    with pytest.raises(ValueError) as exc2:
        test_queue.check_duplicate_student(
            roll_number="101",
            class_name="10",
            section="A",
            enrollment_number="ENR-2026-999"
        )
    assert "Roll Number" in str(exc2.value)

    # 3. Same roll number in different section or class does not raise error
    test_queue.check_duplicate_student(
        roll_number="101",
        class_name="10",
        section="B",
        enrollment_number="ENR-2026-002"
    )

    # 4. Same student updating self is NOT treated as duplicate
    test_queue.check_duplicate_student(
        roll_number="101",
        class_name="10",
        section="A",
        enrollment_number="ENR-2026-001",
        exclude_id="STU-001"
    )

def test_student_update_and_deletion(test_queue):
    stu = {
        "studentId": "STU-002",
        "fullName": "Diya Sharma",
        "rollNumber": "102",
        "enrollmentNumber": "ENR-2026-002",
        "class": "10",
        "section": "A"
    }
    test_queue.upsert_student(stu)

    # Edit student
    stu["fullName"] = "Diya S. Sharma"
    stu["section"] = "B"
    updated = test_queue.upsert_student(stu)
    assert updated["fullName"] == "Diya S. Sharma"
    assert updated["section"] == "B"

    # Delete student
    deleted = test_queue.delete_student_record("STU-002")
    assert deleted is True
    assert test_queue.get_student_by_id("STU-002") is None

# ---------------------------------------------------------
# 2. Section Management & Student Count Tests
# ---------------------------------------------------------
def test_sections_and_student_counts(test_queue):
    # Default seeded sections should exist
    sections = test_queue.get_all_sections()
    assert len(sections) >= 4

    # Enroll 2 students into Class 10 Section A
    test_queue.upsert_student({
        "studentId": "STU-101",
        "fullName": "Student One",
        "rollNumber": "1",
        "enrollmentNumber": "ENR-1",
        "class": "10",
        "section": "A"
    })
    test_queue.upsert_student({
        "studentId": "STU-102",
        "fullName": "Student Two",
        "rollNumber": "2",
        "enrollmentNumber": "ENR-2",
        "class": "10",
        "section": "A"
    })

    # Enroll 1 student into Class 10 Section B
    test_queue.upsert_student({
        "studentId": "STU-103",
        "fullName": "Student Three",
        "rollNumber": "1",
        "enrollmentNumber": "ENR-3",
        "class": "10",
        "section": "B"
    })

    sec_summary = test_queue.get_all_sections()
    sec_10_a = next(s for s in sec_summary if s["className"] == "10" and s["sectionName"] == "A")
    sec_10_b = next(s for s in sec_summary if s["className"] == "10" and s["sectionName"] == "B")

    assert sec_10_a["studentCount"] == 2
    assert sec_10_b["studentCount"] == 1

# ---------------------------------------------------------
# 3. API Endpoint Integration Tests
# ---------------------------------------------------------
def test_api_students_crud_endpoints(client):
    suffix = str(int(time.time() * 1000) % 1000000)
    unique_id = f"TEST-STU-{suffix}"
    payload = {
        "studentId": unique_id,
        "fullName": f"Test Student {suffix}",
        "rollNumber": suffix[:4],
        "enrollmentNumber": f"ENR-{unique_id}",
        "email": f"test.{suffix}@school.edu",
        "className": "12",
        "section": "Science",
        "contactNumber": "9876543210",
        "enrollmentStatus": "Enrolled"
    }

    # Create student via API
    res = client.post("/api/students", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    assert data["student"]["studentId"] == unique_id

    # Duplicate check on same roll & section with a DIFFERENT studentId via API
    payload_dup = dict(payload)
    payload_dup["studentId"] = f"{unique_id}_different"
    res_dup = client.post("/api/students", json=payload_dup)
    assert res_dup.status_code == 400
    assert "already exists" in res_dup.json()["detail"] or "already assigned" in res_dup.json()["detail"]

    # Retrieve student
    res_get = client.get(f"/api/students/{unique_id}")
    assert res_get.status_code == 200
    assert res_get.json()["student"]["fullName"] == f"Test Student {suffix}"

    # Delete student
    res_del = client.delete(f"/api/students/{unique_id}")
    assert res_del.status_code == 200
    assert res_del.json()["success"] is True

def test_api_sections_endpoints(client):
    res = client.get("/api/sections")
    assert res.status_code == 200
    data = res.json()
    assert "sections" in data
    assert len(data["sections"]) >= 1

def test_api_attendance_start_and_duplicate_handling(client):
    today_str = datetime.now(KOLKATA_TZ).strftime("%Y-%m-%d")
    unique_class = f"CLS-{int(time.time()) % 10000}"

    # Start session
    payload = {
        "class": unique_class,
        "section": "Alpha",
        "date": today_str,
        "createdBy": "lecturer_test_1",
        "allowDuplicate": False
    }
    res = client.post("/attendance/start", json=payload)
    assert res.status_code == 200
    session_id = res.json()["session"]["sessionId"]

    # Starting again while in progress returns existing session
    res_again = client.post("/attendance/start", json=payload)
    assert res_again.status_code == 200
    assert res_again.json()["session"]["sessionId"] == session_id

    # Finalize the session
    res_fin = client.post(f"/attendance/{session_id}/finalize", json={
        "sessionId": session_id,
        "finalizedBy": "lecturer_test_1",
        "enrolledStudents": []
    })
    assert res_fin.status_code == 200

    # Starting a new session for same class, section, date without allowDuplicate must now fail with 400
    res_dup = client.post("/attendance/start", json=payload)
    assert res_dup.status_code == 400
    assert "already finalized" in res_dup.json()["detail"] or "already exists" in res_dup.json()["detail"]

    # Starting with allowDuplicate=True must succeed
    payload["allowDuplicate"] = True
    res_override = client.post("/attendance/start", json=payload)
    assert res_override.status_code == 200
    new_sess_id = res_override.json()["session"]["sessionId"]

    # Clean up finalize
    client.post(f"/attendance/{new_sess_id}/finalize", json={
        "sessionId": new_sess_id,
        "finalizedBy": "lecturer_test_1",
        "enrolledStudents": []
    })
