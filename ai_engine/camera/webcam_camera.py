"""
USB / Laptop Webcam Camera Provider.
Accesses the laptop's built-in webcam or external USB camera using OpenCV VideoCapture.
Includes configurable resolution (1280x720 HD), multi-device probing, and
low-latency threaded frame capture.
"""
import threading
import time
from typing import Tuple, Optional, Dict, Any, List
import cv2
import numpy as np

from ai_engine.camera.base import BaseCamera, CameraStatus


class WebcamCamera(BaseCamera):
    def __init__(
        self,
        device_index: int = 0,
        name: str = "Laptop Integrated Webcam",
        width: int = 1280,
        height: int = 720,
        fps: float = 30.0
    ):
        super().__init__(name)
        self.device_index = int(device_index)
        self.width = int(width)
        self.height = int(height)
        self.fps = float(fps)
        self.cap: Optional[cv2.VideoCapture] = None
        self._current_frame: Optional[np.ndarray] = None
        self._lock = threading.Lock()
        self._running = False
        self._thread: Optional[threading.Thread] = None

    def start(self) -> bool:
        """Initializes the webcam device, applies resolution, and starts the capture thread."""
        with self._lock:
            if self._running and self.cap is not None and self.cap.isOpened():
                return True

            try:
                # 1. Attempt opening with DirectShow backend for Windows low-latency access
                self.cap = cv2.VideoCapture(self.device_index, cv2.CAP_DSHOW)
                if not self.cap.isOpened():
                    # Fallback to default backend
                    self.cap = cv2.VideoCapture(self.device_index)

                if not self.cap.isOpened():
                    self.status = CameraStatus.ERROR
                    self.last_error = (
                        f"Webcam (Device Index {self.device_index}) could not be opened. "
                        "The device may be disconnected, disabled in Windows Privacy Settings, "
                        "or currently locked by another application (e.g., Zoom, Teams, or Chrome)."
                    )
                    self.cap = None
                    return False

                # 2. Configure resolution and properties
                self.cap.set(cv2.CAP_PROP_FRAME_WIDTH, self.width)
                self.cap.set(cv2.CAP_PROP_FRAME_HEIGHT, self.height)
                if self.fps > 0:
                    self.cap.set(cv2.CAP_PROP_FPS, self.fps)

                # 3. Read first frame to verify physical sensor stream
                ret, frame = self.cap.read()
                if not ret or frame is None:
                    self.status = CameraStatus.ERROR
                    self.last_error = (
                        f"Webcam at index {self.device_index} opened, but failed to return frames. "
                        "Ensure camera lens cover is open and permissions are granted."
                    )
                    self.cap.release()
                    self.cap = None
                    return False

                # 4. Measure actual hardware parameters
                actual_w = int(self.cap.get(cv2.CAP_PROP_FRAME_WIDTH)) or frame.shape[1]
                actual_h = int(self.cap.get(cv2.CAP_PROP_FRAME_HEIGHT)) or frame.shape[0]
                actual_fps = float(self.cap.get(cv2.CAP_PROP_FPS))
                self.width = actual_w
                self.height = actual_h
                self.fps = actual_fps if actual_fps > 0 else 30.0

                self._current_frame = frame
                self.status = CameraStatus.CONNECTED
                self.frame_count = 1
                self.last_error = None
                self._running = True

                # 5. Start threaded grabber to avoid OpenCV frame buffer accumulation
                self._thread = threading.Thread(target=self._capture_worker, daemon=True)
                self._thread.start()

                print(
                    f"[WebcamCamera] Started webcam device {self.device_index} ('{self.name}') "
                    f"at {self.width}x{self.height} @ {self.fps:.1f} FPS"
                )
                return True

            except Exception as e:
                self.status = CameraStatus.ERROR
                self.last_error = f"Exception opening webcam index {self.device_index}: {str(e)}"
                if self.cap is not None:
                    try:
                        self.cap.release()
                    except Exception:
                        pass
                    self.cap = None
                return False

    def _capture_worker(self):
        """Continuously reads frames to keep latency at 0ms and auto-recovers from transient interruptions."""
        consecutive_failures = 0
        while self._running:
            if self.cap is None or not self.cap.isOpened():
                # Attempt to re-open if unexpectedly closed
                try:
                    time.sleep(0.3)
                    new_cap = cv2.VideoCapture(self.device_index, cv2.CAP_DSHOW)
                    if not new_cap.isOpened():
                        new_cap = cv2.VideoCapture(self.device_index)
                    if new_cap.isOpened():
                        new_cap.set(cv2.CAP_PROP_FRAME_WIDTH, self.width)
                        new_cap.set(cv2.CAP_PROP_FRAME_HEIGHT, self.height)
                        self.cap = new_cap
                        consecutive_failures = 0
                    else:
                        time.sleep(0.5)
                        continue
                except Exception:
                    time.sleep(0.5)
                    continue

            try:
                ret, frame = self.cap.read()
                if ret and frame is not None:
                    with self._lock:
                        self._current_frame = frame
                        self.frame_count += 1
                        self.status = CameraStatus.CONNECTED
                    consecutive_failures = 0
                else:
                    consecutive_failures += 1
                    if consecutive_failures >= 45:
                        # Auto-recover: device handle was stolen, corrupted, or locked
                        with self._lock:
                            self.status = CameraStatus.RECONNECTING
                        try:
                            self.cap.release()
                        except Exception:
                            pass
                        self.cap = None
                        time.sleep(0.4)
                    else:
                        time.sleep(0.015)
            except Exception:
                consecutive_failures += 1
                time.sleep(0.03)
            time.sleep(0.005)

    def stop(self):
        """Stops the capture thread and releases the OpenCV VideoCapture handle cleanly."""
        self._running = False
        if self._thread and self._thread.is_alive():
            self._thread.join(timeout=1.0)
            self._thread = None

        with self._lock:
            if self.cap is not None:
                try:
                    self.cap.release()
                except Exception as e:
                    print(f"[WebcamCamera] Warning during release: {e}")
                self.cap = None
            self._current_frame = None
            self.status = CameraStatus.DISCONNECTED
            print(f"[WebcamCamera] Stopped and released webcam device {self.device_index}")

    def get_frame(self) -> Tuple[bool, Optional[np.ndarray]]:
        """Returns the most recent frame captured by the worker thread."""
        with self._lock:
            if self._current_frame is not None and self.status == CameraStatus.CONNECTED:
                return True, self._current_frame.copy()
            return False, None

    def get_info(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            "type": "WEBCAM",
            "device_index": self.device_index,
            "status": self.status.value,
            "resolution": f"{self.width}x{self.height}",
            "fps": round(self.fps, 1),
            "frame_count": self.frame_count,
            "last_error": self.last_error
        }

    @classmethod
    def list_available_devices(cls, max_to_test: int = 2, currently_active_index: Optional[int] = None) -> List[Dict[str, Any]]:
        """
        Returns detected physical webcams.
        Safely avoids disrupting currently streaming webcam device handles.
        """
        devices = []
        if currently_active_index is not None:
            devices.append({
                "index": currently_active_index,
                "name": f"Integrated Laptop Webcam (Index {currently_active_index} - Active)",
                "available": True,
                "is_active": True,
                "default_resolution": "1280x720",
                "status": "Currently Active & Streaming"
            })
            return devices

        for idx in range(min(max_to_test, 2)):
            try:
                cap = cv2.VideoCapture(idx, cv2.CAP_DSHOW)
                if not cap.isOpened():
                    cap = cv2.VideoCapture(idx)

                if cap.isOpened():
                    ret, frame = cap.read()
                    if ret and frame is not None:
                        w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH)) or frame.shape[1]
                        h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT)) or frame.shape[0]
                        label = (
                            f"Integrated Laptop Webcam (Camera {idx})"
                            if idx == 0
                            else f"USB / External Camera {idx}"
                        )
                        devices.append({
                            "index": idx,
                            "name": label,
                            "available": True,
                            "is_active": False,
                            "default_resolution": f"{w}x{h}",
                            "status": "Ready"
                        })
                    cap.release()
            except Exception:
                pass

        if not devices:
            devices.append({
                "index": 0,
                "name": "Integrated Laptop Webcam (Index 0)",
                "available": True,
                "is_active": True,
                "default_resolution": "1280x720",
                "status": "Ready"
            })
        return devices

    @classmethod
    def test_device(cls, device_index: int = 0, width: int = 1280, height: int = 720) -> Dict[str, Any]:
        """Performs a non-invasive test of a webcam device."""
        try:
            cap = cv2.VideoCapture(device_index, cv2.CAP_DSHOW)
            if not cap.isOpened():
                cap = cv2.VideoCapture(device_index)

            if not cap.isOpened():
                return {
                    "success": False,
                    "error": (
                        f"Device index {device_index} is unavailable. "
                        "Verify camera privacy permissions in Windows Settings or close any app using the camera."
                    )
                }

            cap.set(cv2.CAP_PROP_FRAME_WIDTH, width)
            cap.set(cv2.CAP_PROP_FRAME_HEIGHT, height)
            ret, frame = cap.read()
            actual_w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH)) or (frame.shape[1] if ret else 0)
            actual_h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT)) or (frame.shape[0] if ret else 0)
            cap.release()

            if ret and frame is not None:
                return {
                    "success": True,
                    "message": f"Webcam index {device_index} accessible and verified ({actual_w}x{actual_h} resolution)",
                    "resolution": f"{actual_w}x{actual_h}"
                }
            return {
                "success": False,
                "error": f"Camera index {device_index} opened but returned a blank/empty frame."
            }
        except Exception as e:
            return {"success": False, "error": str(e)}
