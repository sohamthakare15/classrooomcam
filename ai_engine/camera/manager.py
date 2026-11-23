"""
Camera Manager Singleton.
Controls active camera provider (Mock, VideoFile, RTSP, Webcam)
and yields MJPEG streaming frames for frontend rendering.
"""
import threading
import time
from typing import Optional, Dict, Any, Generator, List
import cv2
import numpy as np

from ai_engine.camera.base import BaseCamera, CameraStatus
from ai_engine.camera.mock_camera import MockCamera
from ai_engine.camera.video_camera import VideoFileCamera
from ai_engine.camera.rtsp_camera import RTSPCamera
from ai_engine.camera.webcam_camera import WebcamCamera
from ai_engine.camera.browser_camera import BrowserIngestCamera
from ai_engine.camera.onvif_discovery import ONVIFDiscovery

class CameraManager:
    _instance: Optional['CameraManager'] = None
    _lock = threading.Lock()

    def __new__(cls, *args, **kwargs):
        with cls._lock:
            if cls._instance is None:
                cls._instance = super(CameraManager, cls).__new__(cls)
                cls._instance._initialized = False
            return cls._instance

    def __init__(self):
        if self._initialized:
            return
        self._initialized = True
        self.active_camera: Optional[BaseCamera] = None
        self.camera_type: str = "WEBCAM"

        # Try initializing with the Laptop Webcam by default, with automatic fallback to MockCamera
        laptop_cam = WebcamCamera(device_index=0, name="Laptop Integrated Webcam", width=1280, height=720)
        if laptop_cam.start():
            self.active_camera = laptop_cam
            self.camera_type = "WEBCAM"
            print("[CameraManager] Initialized with Laptop Webcam on device index 0.")
        else:
            print("[CameraManager] Laptop webcam not immediately accessible; initializing with MockCamera.")
            self.active_camera = MockCamera()
            self.camera_type = "MOCK"
            self.active_camera.start()

        self._manager_lock = threading.Lock()
        self.last_frame: Optional[np.ndarray] = None
        self.last_processed_frame: Optional[np.ndarray] = None

    def switch_camera(self, camera_type: str, config: Dict[str, Any]) -> Dict[str, Any]:
        """Switches the active camera provider safely."""
        with self._manager_lock:
            if self.active_camera is not None:
                self.active_camera.stop()

            c_type = camera_type.upper()
            if c_type == "MOCK":
                self.active_camera = MockCamera(
                    name=config.get("name", "Classroom Simulator"),
                    width=config.get("width", 1280),
                    height=config.get("height", 720),
                    fps=config.get("fps", 30.0)
                )
            elif c_type == "VIDEO_FILE":
                self.active_camera = VideoFileCamera(
                    file_path=config.get("file_path", config.get("filePath", "")),
                    name=config.get("name", "Video File Player"),
                    loop=config.get("loop", True)
                )
            elif c_type == "RTSP":
                self.active_camera = RTSPCamera(
                    rtsp_url=config.get("rtsp_url", config.get("rtspUrl", "")),
                    ip=config.get("ip"),
                    port=int(config.get("port", 554)),
                    stream_path=config.get("stream_path", config.get("streamPath", "/h264Preview_01_main")),
                    name=config.get("name", "External IP Camera"),
                    username=config.get("username"),
                    password=config.get("password"),
                    transport=config.get("transport", "tcp")
                )
            elif c_type in ["WEBCAM", "BROWSER"]:
                # Try physical webcam first
                webcam = WebcamCamera(
                    device_index=int(config.get("device_index", config.get("deviceIndex", 0))),
                    name=config.get("name", "Laptop Integrated Webcam"),
                    width=int(config.get("width", 1280)),
                    height=int(config.get("height", 720)),
                    fps=float(config.get("fps", 30.0))
                )
                if webcam.start():
                    self.active_camera = webcam
                    self.camera_type = "WEBCAM"
                    success = True
                else:
                    # Cloud fallback (e.g. Render/Docker): enable Browser Ingest mode
                    print("[CameraManager] Host webcam not directly attached; switching to Browser Ingest mode.")
                    browser_cam = BrowserIngestCamera(name="Browser Web Camera")
                    browser_cam.start()
                    self.active_camera = browser_cam
                    self.camera_type = "BROWSER"
                    success = True
            else:
                raise ValueError(f"Unsupported camera type: {camera_type}")

            if c_type not in ["WEBCAM", "BROWSER"]:
                self.camera_type = c_type
                success = self.active_camera.start()
            return {
                "success": success,
                "type": self.camera_type,
                "info": self.active_camera.get_info()
            }

    def disconnect_camera(self) -> Dict[str, Any]:
        """Releases the active camera and marks status as DISCONNECTED."""
        with self._manager_lock:
            if self.active_camera is not None:
                self.active_camera.stop()
            self.camera_type = "DISCONNECTED"
            self.last_frame = None
            self.last_processed_frame = None
            return {
                "success": True,
                "status": "DISCONNECTED",
                "message": "Camera hardware has been released."
            }

    def get_available_webcams(self) -> List[Dict[str, Any]]:
        """Returns physical webcams detected on the host machine without interrupting active streams."""
        active_idx = None
        if self.active_camera is not None and isinstance(self.active_camera, WebcamCamera):
            active_idx = self.active_camera.device_index
        return WebcamCamera.list_available_devices(currently_active_index=active_idx)

    def discover_onvif_cameras(self, timeout_sec: float = 2.5) -> List[Dict[str, Any]]:
        """Discovers ONVIF IP cameras on the local Wi-Fi / LAN."""
        return ONVIFDiscovery.discover_cameras(timeout_sec=timeout_sec)

    def ingest_browser_frame(self, frame_bgr: np.ndarray) -> bool:
        """Ingests a video frame sent from the client's web browser."""
        with self._manager_lock:
            if not isinstance(self.active_camera, BrowserIngestCamera):
                browser_cam = BrowserIngestCamera(name="Browser Web Camera")
                browser_cam.start()
                self.active_camera = browser_cam
                self.camera_type = "BROWSER"
            self.last_frame = frame_bgr
            return self.active_camera.ingest_frame(frame_bgr)

    def get_frame(self) -> tuple[bool, Optional[np.ndarray]]:
        if self.active_camera is None:
            return False, None
        success, frame = self.active_camera.get_frame()
        if success and frame is not None:
            self.last_frame = frame
        return success, frame

    def get_status(self) -> Dict[str, Any]:
        if self.active_camera is None:
            return {"status": CameraStatus.DISCONNECTED.value, "type": "NONE", "manager_type": "NONE"}
        info = self.active_camera.get_info()
        info["manager_type"] = self.camera_type
        return info

    def generate_mjpeg_stream(self, overlay_annotations: bool = True) -> Generator[bytes, None, None]:
        """Yields multipart JPEG frames for browser <img> or Electron display."""
        while True:
            frame_to_send = None
            if overlay_annotations and self.last_processed_frame is not None:
                frame_to_send = self.last_processed_frame
            elif self.last_frame is not None:
                frame_to_send = self.last_frame
            else:
                # Black blank frame with friendly status
                frame_to_send = np.zeros((480, 640, 3), dtype=np.uint8)
                cv2.putText(
                    frame_to_send,
                    "CAMERA DISCONNECTED / IDLE",
                    (140, 220),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.65,
                    (200, 200, 200),
                    2
                )
                cv2.putText(
                    frame_to_send,
                    "Select and Connect Camera in Settings",
                    (110, 260),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.55,
                    (100, 150, 220),
                    1
                )

            # Encode as JPEG
            ret, jpeg = cv2.imencode('.jpg', frame_to_send, [int(cv2.IMWRITE_JPEG_QUALITY), 80])
            if ret:
                yield (b'--frame\r\n'
                       b'Content-Type: image/jpeg\r\n\r\n' + jpeg.tobytes() + b'\r\n')
            time.sleep(0.035)  # ~28 FPS
