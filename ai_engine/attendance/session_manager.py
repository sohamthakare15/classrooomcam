"""
Attendance Session Management Module.
Handles session creation, real-time AI event absorption, manual corrections,
deterministic record IDs, immutable audit logging, and finalization absent marks.
"""
import time
import uuid
from typing import Dict, Any, List, Optional
import cv2
import numpy as np
from ai_engine.attendance.offline_queue import OfflineSyncQueue
from ai_engine.attendance.engine import AttendanceEngine

class AttendanceStatus:
    PRESENT = "present"
    ABSENT = "absent"
    LATE = "late"
    MANUALLY_ADDED = "manually_added"
    NEEDS_REVIEW = "needs_review"

class SessionStatus:
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    CANCELLED = "cancelled"

class SessionManager:
    def __init__(
        self,
        engine: AttendanceEngine,
        sync_queue: Optional[OfflineSyncQueue] = None
    ):
        self.engine = engine
        self.sync_queue = sync_queue or OfflineSyncQueue()
        self.active_session: Optional[Dict[str, Any]] = None

        # Wire up engine's event callback
        self.engine.on_attendance_marked = self._handle_engine_attendance_event

        # Ensure any abandoned sessions from prior server processes are paused
        self.cleanup_stale_sessions()

    def cleanup_stale_sessions(self):
        """Marks any leftover in_progress sessions from prior crashes or restarts as paused."""
        try:
            sessions = self.sync_queue.get_local_sessions()
            for s in sessions:
                if s.get("status") == SessionStatus.IN_PROGRESS:
                    s["status"] = "paused"
                    s["updatedAt"] = time.time()
                    self.sync_queue.enqueue_operation("attendance_sessions", s["sessionId"], "UPDATE", s)
        except Exception as e:
            print(f"[SessionManager] Warning during stale session cleanup: {e}")

    def _generate_record_id(self, session_id: str, student_id: str) -> str:
        """Deterministic record ID preventing duplicates."""
        return f"session_{session_id}_student_{student_id}"

    def create_session(
        self,
        class_name: str,
        section: str,
        session_date: str,
        created_by: str,
        title: Optional[str] = None,
        allow_duplicate: bool = False
    ) -> Dict[str, Any]:
        # Prevent duplicate attendance sessions for the same section, date, and subject/title unless explicitly allowed
        if not allow_duplicate:
            req_title = (title or f"{class_name}-{section} Attendance").strip().lower()
            existing_sessions = self.sync_queue.get_local_sessions()
            for s in existing_sessions:
                s_title = str(s.get("title") or "").strip().lower()
                if (str(s.get("class")).strip() == str(class_name).strip() and 
                    str(s.get("section")).strip().lower() == str(section).strip().lower() and 
                    str(s.get("date")).strip() == str(session_date).strip() and
                    (not title or s_title == req_title)):
                    if s.get("status") == SessionStatus.IN_PROGRESS:
                        self.active_session = s
                        self.engine.set_active_session(s["sessionId"], s)
                        return s
                    elif s.get("status") == SessionStatus.COMPLETED:
                        raise ValueError(f"Attendance session for {class_name}-{section} ({title or session_date}) is already finalized. Please review in Attendance History.")

        session_id = f"sess_{int(time.time())}_{uuid.uuid4().hex[:6]}"
        now = time.time()

        session_data = {
            "sessionId": session_id,
            "title": title or f"Class {class_name}-{section} Attendance",
            "class": class_name,
            "section": section,
            "date": session_date,
            "startTime": now,
            "endTime": None,
            "status": SessionStatus.IN_PROGRESS,
            "createdBy": created_by,
            "finalizedBy": None,
            "totalStudents": 0,
            "presentCount": 0,
            "absentCount": 0,
            "manualCount": 0,
            "createdAt": now,
            "updatedAt": now
        }

        self.active_session = session_data
        self.sync_queue.enqueue_operation("attendance_sessions", session_id, "SET", session_data)

        # Notify engine of active session
        self.engine.set_active_session(session_id, session_data)
        return session_data

    def _handle_engine_attendance_event(self, event: Dict[str, Any]):
        """Triggered automatically when the AI engine detects and confirms an identity."""
        if not self.active_session or self.active_session["sessionId"] != event["sessionId"]:
            return

        session_id = event["sessionId"]
        student_id = event["studentId"]
        record_id = self._generate_record_id(session_id, student_id)
        now = time.time()

        record_data = {
            "recordId": record_id,
            "sessionId": session_id,
            "studentId": student_id,
            "status": AttendanceStatus.PRESENT,
            "confidenceScore": event.get("confidence", 1.0),
            "detectedAt": event.get("timestamp", now),
            "markedBy": "AI_ENGINE",
            "method": event.get("method", "ai"),
            "notes": "Automated facial recognition verification",
            "createdAt": now,
            "updatedAt": now
        }

        # Persist visual audit snapshot image data directly to SQLite database
        face_crop = event.get("faceCrop")
        if face_crop is not None and isinstance(face_crop, np.ndarray) and face_crop.size > 0:
            try:
                ret, snap_bytes = cv2.imencode('.jpg', face_crop, [int(cv2.IMWRITE_JPEG_QUALITY), 90])
                if ret:
                    self.sync_queue.save_attendance_snapshot(
                        record_id=record_id,
                        session_id=session_id,
                        student_id=student_id,
                        snapshot_bytes=snap_bytes.tobytes(),
                        confidence=event.get("confidence", 1.0)
                    )
                    record_data["hasSnapshot"] = True
            except Exception as e:
                print(f"[SessionManager] Snapshot persistence warning: {e}")

        self.sync_queue.enqueue_operation("attendance_records", record_id, "SET", record_data)

        # Update session counters
        self.active_session["presentCount"] += 1
        self.active_session["updatedAt"] = now
        self.sync_queue.enqueue_operation(
            "attendance_sessions",
            session_id,
            "UPDATE",
            self.active_session
        )

    def manual_mark(
        self,
        session_id: str,
        student_id: str,
        status: str,
        user_id: str,
        reason: str
    ) -> Dict[str, Any]:
        """Manually mark or correct student attendance with full audit trail."""
        record_id = self._generate_record_id(session_id, student_id)
        now = time.time()

        # Check existing record
        existing = None
        local_records = self.sync_queue.get_local_records_for_session(session_id)
        for r in local_records:
            if r.get("recordId") == record_id:
                existing = r
                break

        prev_status = existing.get("status") if existing else "none"

        record_data = {
            "recordId": record_id,
            "sessionId": session_id,
            "studentId": student_id,
            "status": status,
            "confidenceScore": 1.0,
            "detectedAt": now,
            "markedBy": user_id,
            "method": "manual",
            "notes": reason,
            "createdAt": existing.get("createdAt", now) if existing else now,
            "updatedAt": now
        }

        self.sync_queue.enqueue_operation("attendance_records", record_id, "SET", record_data)

        # Record immutable audit log
        log_id = f"audit_{int(now)}_{uuid.uuid4().hex[:6]}"
        audit_entry = {
            "logId": log_id,
            "sessionId": session_id,
            "studentId": student_id,
            "action": "MANUAL_CORRECTION",
            "previousStatus": prev_status,
            "newStatus": status,
            "changedBy": user_id,
            "reason": reason,
            "timestamp": now
        }
        self.sync_queue.enqueue_operation("attendance_audit_logs", log_id, "SET", audit_entry)

        # If active session, update present count and register ID
        if self.active_session and self.active_session["sessionId"] == session_id:
            if status in [AttendanceStatus.PRESENT, AttendanceStatus.MANUALLY_ADDED, AttendanceStatus.LATE]:
                self.engine.marked_student_ids.add(student_id)
            elif status == AttendanceStatus.ABSENT and student_id in self.engine.marked_student_ids:
                self.engine.marked_student_ids.remove(student_id)

        return record_data

    def stop_session(self, session_id: str) -> Optional[Dict[str, Any]]:
        """Stops active camera scanning for this session without generating absent marks yet."""
        if self.active_session and self.active_session["sessionId"] == session_id:
            self.engine.clear_active_session()
            self.active_session["status"] = "paused"
            self.active_session["updatedAt"] = time.time()
            self.sync_queue.enqueue_operation(
                "attendance_sessions",
                session_id,
                "UPDATE",
                self.active_session
            )
            saved = self.active_session
            self.active_session = None
            return saved
        return None

    def finalize_session(
        self,
        session_id: str,
        finalized_by: str,
        enrolled_students: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        Finalizes the session. Generates ABSENT records for students in this class/section
        who were not recognized or manually marked present.
        """
        session = self.sync_queue.get_local_session(session_id)
        if not session:
            if self.active_session and self.active_session["sessionId"] == session_id:
                session = self.active_session
            else:
                raise ValueError(f"Session {session_id} not found.")

        # Detach engine if running
        if self.active_session and self.active_session["sessionId"] == session_id:
            self.engine.clear_active_session()
            self.active_session = None

        existing_records = {
            r["studentId"]: r
            for r in self.sync_queue.get_local_records_for_session(session_id)
        }

        now = time.time()
        absent_count = 0
        present_count = 0

        # Filter students by class and section
        target_class = session.get("class")
        target_section = session.get("section")

        relevant_students = [
            s for s in enrolled_students
            if s.get("class") == target_class and s.get("section") == target_section
        ]
        if not relevant_students:
            relevant_students = enrolled_students # Fallback to all enrolled if unassigned

        for student in relevant_students:
            s_id = student.get("studentId")
            if s_id in existing_records:
                rec_status = existing_records[s_id].get("status")
                if rec_status in [AttendanceStatus.PRESENT, AttendanceStatus.MANUALLY_ADDED, AttendanceStatus.LATE]:
                    present_count += 1
                elif rec_status == AttendanceStatus.ABSENT:
                    absent_count += 1
            else:
                # Generate absent record
                rec_id = self._generate_record_id(session_id, s_id)
                absent_rec = {
                    "recordId": rec_id,
                    "sessionId": session_id,
                    "studentId": s_id,
                    "status": AttendanceStatus.ABSENT,
                    "confidenceScore": 0.0,
                    "detectedAt": None,
                    "markedBy": finalized_by,
                    "method": "finalization",
                    "notes": "Unrecognized during active session; marked absent at finalization",
                    "createdAt": now,
                    "updatedAt": now
                }
                self.sync_queue.enqueue_operation("attendance_records", rec_id, "SET", absent_rec)
                absent_count += 1

        total_count = present_count + absent_count
        attendance_pct = round((present_count / total_count * 100), 1) if total_count > 0 else 0.0

        session["status"] = SessionStatus.COMPLETED
        session["endTime"] = now
        session["finalizedBy"] = finalized_by
        session["totalStudents"] = total_count
        session["presentCount"] = present_count
        session["absentCount"] = absent_count
        session["attendancePercentage"] = attendance_pct
        session["updatedAt"] = now

        self.sync_queue.enqueue_operation("attendance_sessions", session_id, "UPDATE", session)
        return session

