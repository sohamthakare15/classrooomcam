"""
Comprehensive Integration Test Suite for External Wi-Fi IP Camera (RTSP / ONVIF).
Verifies:
1. Live RTSP connection and frame decoding via OpenCV.
2. Safe URL credential masking (no password exposure).
3. Offline IP handling and quick socket timeout.
4. CameraManager switching between Laptop Webcam and External RTSP IP Camera.
5. Reconnection loop and clean resource release.
6. ONVIF WS-Discovery probe.
7. AI YuNet face detection & SFace recognition on RTSP frames.
8. Attendance marking workflow from RTSP source.
"""
import time
import os
import cv2
import numpy as np
import pytest

from ai_engine.camera.base import CameraStatus
from ai_engine.camera.rtsp_camera import RTSPCamera
from ai_engine.camera.manager import CameraManager
from ai_engine.camera.onvif_discovery import ONVIFDiscovery
from ai_engine.vision.detector import FaceDetector
from ai_engine.vision.recognizer import FaceRecognizer
from ai_engine.enrollment.manager import EnrollmentManager
from ai_engine.attendance.engine import AttendanceEngine
from ai_engine.attendance.session_manager import SessionManager
from ai_engine.attendance.offline_queue import OfflineSyncQueue

LIVE_RTSP_URL = "rtsp://127.0.0.1:8554/classroom"

def wait_for_camera_connected(camera_obj, timeout_sec: float = 5.0) -> bool:
    t0 = time.time()
    while time.time() - t0 < timeout_sec:
        if getattr(camera_obj, "status", None) == CameraStatus.CONNECTED:
            return True
        time.sleep(0.1)
    return False

def wait_for_frame(manager_or_camera, timeout_sec: float = 5.0):
    t0 = time.time()
    while time.time() - t0 < timeout_sec:
        success, frame = manager_or_camera.get_frame()
        if success and frame is not None:
            return True, frame
        time.sleep(0.1)
    return False, None

class TestRTSPCameraIntegration:

    def test_01_rtsp_live_connection_and_streaming(self):
        """Tests connecting to live RTSP server and streaming video frames."""
        cam = RTSPCamera(
            rtsp_url=LIVE_RTSP_URL,
            name="Classroom Test IP Cam",
            transport="tcp",
            timeout_sec=5.0
        )
        assert cam.start() is True
        assert wait_for_camera_connected(cam, timeout_sec=5.0) is True

        success, frame = wait_for_frame(cam, timeout_sec=3.0)
        assert success is True
        assert frame is not None
        assert frame.shape[0] == 1080 and frame.shape[1] == 1920

        info = cam.get_info()
        assert info["type"] == "RTSP"
        assert info["status"] == "CONNECTED"
        assert info["frame_count"] > 0
        assert cam.width == 1920 and cam.height == 1080
        cam.stop()
        assert cam.status == CameraStatus.DISCONNECTED

    def test_02_credential_masking_security(self):
        """Verifies RTSP passwords are strictly masked in logs, objects, and URLs."""
        cam = RTSPCamera(
            ip="192.168.1.120",
            port=554,
            stream_path="/live/ch0",
            username="admin",
            password="SuperSecretPassword123!",
            name="Secure Cam"
        )
        masked = cam.get_masked_url()
        assert "SuperSecretPassword123!" not in masked
        assert "***:***@" in masked

        info = cam.get_info()
        assert "password" not in info
        assert "SuperSecretPassword123!" not in str(info)
        assert info["url"] == masked

    def test_03_camera_offline_and_invalid_connection(self):
        """Verifies non-invasive test probe handles offline/unreachable IP cleanly without hanging."""
        t0 = time.time()
        res = RTSPCamera.test_connection({
            "ip": "127.0.0.1",
            "port": 9999,
            "streamPath": "/nonexistent"
        }, timeout_sec=2.5)
        elapsed = time.time() - t0

        assert res["success"] is False
        assert elapsed < 3.5 # Failed fast via socket check without hanging
        assert "offline or unreachable" in res["error"]

    def test_04_test_connection_probe_success(self):
        """Verifies test_connection probe on active RTSP stream."""
        res = RTSPCamera.test_connection({
            "ip": "127.0.0.1",
            "port": 8554,
            "streamPath": "/classroom"
        }, timeout_sec=5.0)
        assert res["success"] is True
        assert "verified successfully" in res["message"].lower()
        assert "1920x1080" in res["resolution"]

    def test_05_camera_manager_switching(self):
        """Verifies switching from Laptop Webcam to External IP Camera and back cleanly."""
        manager = CameraManager()

        # 1. Switch to RTSP
        res_rtsp = manager.switch_camera("RTSP", {
            "name": "Classroom Ceiling Wi-Fi IP Camera",
            "rtspUrl": LIVE_RTSP_URL,
            "transport": "tcp"
        })
        assert res_rtsp["success"] is True
        assert manager.camera_type == "RTSP"
        
        success, frame = wait_for_frame(manager, timeout_sec=4.0)
        assert success is True
        assert frame is not None

        # 2. Switch back to Webcam
        res_webcam = manager.switch_camera("WEBCAM", {
            "deviceIndex": 0,
            "width": 1280,
            "height": 720
        })
        assert res_webcam["success"] is True
        assert manager.camera_type == "WEBCAM"

        # 3. Clean disconnect
        disc = manager.disconnect_camera()
        assert disc["success"] is True
        assert manager.camera_type == "DISCONNECTED"

    def test_06_onvif_discovery_probe(self):
        """Verifies ONVIF WS-Discovery probe runs and returns a valid list."""
        cameras = ONVIFDiscovery.discover_cameras(timeout_sec=1.0)
        assert isinstance(cameras, list)

        # Test socket port probe against active backend port
        open_res = ONVIFDiscovery.probe_rtsp_port("127.0.0.1", 8000, timeout=1.0)
        assert open_res is True

        closed_res = ONVIFDiscovery.probe_rtsp_port("127.0.0.1", 9999, timeout=0.5)
        assert closed_res is False

    def test_07_ai_face_detection_and_recognition_on_rtsp(self):
        """Verifies YuNet detector and SFace recognizer execute correctly on RTSP video frames."""
        manager = CameraManager()
        manager.switch_camera("RTSP", {"rtspUrl": LIVE_RTSP_URL})

        success, frame = wait_for_frame(manager, timeout_sec=4.0)
        assert success is True
        assert frame is not None

        detector = FaceDetector()
        recognizer = FaceRecognizer()

        # Run face detection on the live RTSP frame
        faces = detector.detect(frame)
        assert isinstance(faces, list)

        # Inject enrolled photo of student onto the RTSP frame to test end-to-end recognition pipeline
        photo_path = os.path.join("storage", "photos", "STU-001.jpg")
        if os.path.exists(photo_path):
            stu_img = cv2.imread(photo_path)
            sh, sw = stu_img.shape[:2]
            # Overlay onto RTSP frame
            frame[50:50+sh, 50:50+sw] = stu_img

            detected_faces = detector.detect(frame)
            assert len(detected_faces) >= 1

            target_face = detected_faces[0]
            aligned = recognizer.align_and_crop(frame, target_face.raw_face)
            feat = recognizer.extract_embedding(aligned)
            assert feat is not None
            assert len(feat) == 128

        manager.disconnect_camera()

    def test_08_attendance_marking_workflow_with_rtsp(self):
        """Verifies full session attendance marking using an active RTSP camera."""
        manager = CameraManager()
        manager.switch_camera("RTSP", {"rtspUrl": LIVE_RTSP_URL})

        enrollment = EnrollmentManager()
        sync_q = OfflineSyncQueue()
        engine = AttendanceEngine(manager, enrollment)
        sess_mgr = SessionManager(engine, sync_q)

        # Create session
        session = sess_mgr.create_session("10", "A", "2026-11-10", "teacher_001", "RTSP Attendance Verification")
        sess_id = session["sessionId"]
        assert engine.active_session_id == sess_id

        # Overlay enrolled face onto current RTSP frame
        success, frame = wait_for_frame(manager, timeout_sec=4.0)
        assert success is True
        photo_path = os.path.join("storage", "photos", "STU-001.jpg")
        if os.path.exists(photo_path):
            stu_img = cv2.imread(photo_path)
            sh, sw = stu_img.shape[:2]
            frame[100:100+sh, 100:100+sw] = stu_img

            # Process single frame through attendance engine
            annotated = engine.process_single_frame(frame)
            assert annotated is not None

            # Verify marked present
            assert "STU-001" in engine.marked_student_ids
            records = sync_q.get_local_records_for_session(sess_id)
            assert len(records) >= 1
            assert records[0]["studentId"] == "STU-001"
            assert records[0]["status"] == "present"

        # Finalize session
        sess_mgr.finalize_session(sess_id, "teacher_001", [{"studentId": "STU-001", "class": "10", "section": "A"}])
        manager.disconnect_camera()
