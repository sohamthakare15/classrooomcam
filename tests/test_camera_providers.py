"""
Camera Abstraction Tests.
"""
import pytest
import numpy as np
from ai_engine.camera.mock_camera import MockCamera
from ai_engine.camera.rtsp_camera import RTSPCamera
from ai_engine.camera.video_camera import VideoFileCamera
from ai_engine.camera.manager import CameraManager

def test_mock_camera_lifecycle():
    cam = MockCamera(width=640, height=480, fps=30.0)
    assert cam.start() is True
    info = cam.get_info()
    assert info["is_simulation"] is True
    assert info["status"] == "CONNECTED"

    ret, frame = cam.get_frame()
    assert ret is True
    assert frame is not None
    assert frame.shape == (480, 640, 3)

    cam.stop()
    assert cam.get_info()["status"] == "DISCONNECTED"

def test_rtsp_camera_credential_masking():
    cam = RTSPCamera(
        rtsp_url="rtsp://192.168.1.100:554/live",
        username="teacher_user",
        password="SuperSecretPassword123"
    )
    # Masked URL must never expose password
    masked = cam.get_masked_url()
    assert "SuperSecretPassword123" not in masked
    info = cam.get_info()
    assert "SuperSecretPassword123" not in str(info)
    assert info["type"] == "RTSP"

def test_camera_manager_switch():
    manager = CameraManager()
    res = manager.switch_camera("MOCK", {"width": 800, "height": 600})
    assert res["success"] is True
    assert res["type"] == "MOCK"

    status = manager.get_status()
    assert status["status"] == "CONNECTED"

def test_webcam_device_discovery():
    from ai_engine.camera.webcam_camera import WebcamCamera
    devices = WebcamCamera.list_available_devices(max_to_test=2)
    assert isinstance(devices, list)
    assert len(devices) > 0
    assert "index" in devices[0]

def test_webcam_lifecycle_and_clean_release():
    from ai_engine.camera.webcam_camera import WebcamCamera
    import cv2

    cam = WebcamCamera(device_index=0, width=1280, height=720)
    started = cam.start()
    if started:
        assert cam.status.value == "CONNECTED"
        ret, frame = cam.get_frame()
        assert ret is True
        assert frame is not None
        assert len(frame.shape) == 3
        # Check resolution is non-zero
        assert frame.shape[0] > 0 and frame.shape[1] > 0
        info = cam.get_info()
        assert info["type"] == "WEBCAM"
        assert info["device_index"] == 0

        # Disconnection & release
        cam.stop()
        assert cam.status.value == "DISCONNECTED"
        assert cam.cap is None

        # Reconnection
        reconnected = cam.start()
        assert reconnected is True
        cam.stop()
        assert cam.status.value == "DISCONNECTED"


