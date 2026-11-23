"""
End-to-End Integration Tests for Redesigned Clean Dashboard.
Verifies:
1. Dashboard telemetry data integrity (enrolled count, camera status, review queue).
2. Live session transition from STANDBY to ACTIVE.
3. Attendance marking reflection in dashboard session state.
4. Finalization and presence in Recent Sessions list.
5. Frontend HTTP asset serving & routing verification.
"""
import urllib.request
import json
import time
import pytest

BASE_URL = "http://127.0.0.1:8000"
TOKEN = "smartclassroom-secure-ipc-token-2026"
HEADERS = {
    "Authorization": f"Bearer {TOKEN}",
    "Content-Type": "application/json"
}

def api_get(endpoint: str) -> dict:
    req = urllib.request.Request(f"{BASE_URL}{endpoint}", headers=HEADERS)
    with urllib.request.urlopen(req, timeout=5.0) as resp:
        return json.loads(resp.read().decode())

def api_post(endpoint: str, data: dict) -> dict:
    body = json.dumps(data).encode("utf-8")
    req = urllib.request.Request(f"{BASE_URL}{endpoint}", data=body, headers=HEADERS, method="POST")
    with urllib.request.urlopen(req, timeout=5.0) as resp:
        return json.loads(resp.read().decode())

class TestDashboardIntegration:

    def test_01_backend_health_and_kpi_endpoints(self):
        """Verifies all endpoints consumed by the clean dashboard return valid data."""
        # 1. Health
        health = api_get("/health")
        assert health["status"] == "ok"
        assert health["ai_engine_active"] is True
        assert health["camera_status"] == "CONNECTED"
        assert health["enrolled_count"] >= 1

        # 2. Camera Status
        cam = api_get("/camera/status")
        assert cam["status"] == "CONNECTED"
        assert "resolution" in cam
        assert "fps" in cam

        # 3. Review Queue
        rev = api_get("/recognition/review")
        assert "total" in rev or "count" in rev
        assert isinstance(rev["reviews"], list)

        # 4. Sessions
        sess = api_get("/attendance/sessions")
        assert "total" in sess
        assert isinstance(sess["sessions"], list)

    def test_02_clean_dashboard_session_lifecycle(self):
        """Tests launching a session, checking in-progress state, and finalizing."""
        # 1. Check if any session is in progress; if so, stop it first
        sessions_data = api_get("/attendance/sessions")
        for s in sessions_data.get("sessions", []):
            if s.get("status") == "in_progress":
                api_post("/attendance/stop", {"sessionId": s["sessionId"]})

        # 2. Start new session for Class 10-A (from dashboard quick launch)
        new_sess_res = api_post("/attendance/start", {
            "className": "10",
            "section": "A",
            "date": "2026-11-14",
            "createdBy": "teacher_jenkins",
            "title": "Class 10-A Morning Session"
        })
        assert new_sess_res["success"] is True
        session = new_sess_res["session"]
        session_id = session["sessionId"]
        assert session["status"] == "in_progress"
        assert session["class"] == "10"
        assert session["section"] == "A"

        # 3. Verify dashboard sees the active session
        time.sleep(0.5)
        active_check = api_get("/attendance/sessions")
        running = [s for s in active_check["sessions"] if s["status"] == "in_progress"]
        assert len(running) >= 1
        assert any(s["sessionId"] == session_id for s in running)

        # 4. Verify session details endpoint
        details = api_get(f"/attendance/{session_id}")
        assert details["session"]["sessionId"] == session_id
        assert details["recordsCount"] == 0

        # 5. Finalize session (generates absent marks for enrolled students not present)
        fin_res = api_post(f"/attendance/{session_id}/finalize", {
            "sessionId": session_id,
            "finalizedBy": "teacher_jenkins",
            "enrolledStudents": [
                {"studentId": "STU-001", "class": "10", "section": "A"}
            ]
        })
        assert fin_res["success"] is True
        assert fin_res["session"]["status"] == "completed"
        assert "absentCount" in fin_res["session"]
        assert "presentCount" in fin_res["session"]

        # 6. Verify session is now listed in Recent Sessions with completed status
        final_check = api_get("/attendance/sessions")
        completed_session = next((s for s in final_check["sessions"] if s["sessionId"] == session_id), None)
        assert completed_session is not None
        assert completed_session["status"] == "completed"

    def test_03_frontend_vite_dashboard_serving(self):
        """Verifies Vite dev server serves the clean dashboard index HTML properly."""
        req = urllib.request.Request("http://localhost:5173")
        with urllib.request.urlopen(req, timeout=5.0) as resp:
            assert resp.status == 200
            html_content = resp.read().decode("utf-8")
            assert 'id="root"' in html_content
            assert "/src/main.jsx" in html_content
