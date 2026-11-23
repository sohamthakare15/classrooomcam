"""
Browser Ingest Camera Provider.
Enables web browsers (Chrome, Edge, Safari, Mobile) to stream camera frames
directly to the cloud AI engine via WebRTC/HTML5 Canvas ingest.
"""
import threading
import time
from typing import Tuple, Optional, Dict, Any
import numpy as np
from ai_engine.camera.base import BaseCamera, CameraStatus

class BrowserIngestCamera(BaseCamera):
    def __init__(self, name: str = "Browser Web Camera (HTML5)"):
        super().__init__(name)
        self.status = CameraStatus.CONNECTED
        self._current_frame: Optional[np.ndarray] = None
        self._lock = threading.Lock()
        self.last_ingest_time = time.time()
        self.width = 1280
        self.height = 720
        self.fps = 15.0

    def start(self) -> bool:
        self.status = CameraStatus.CONNECTED
        return True

    def stop(self):
        with self._lock:
            self.status = CameraStatus.DISCONNECTED
            self._current_frame = None

    def ingest_frame(self, frame_bgr: np.ndarray) -> bool:
        with self._lock:
            if frame_bgr is None or frame_bgr.size == 0:
                return False
            self._current_frame = frame_bgr
            self.frame_count += 1
            self.last_ingest_time = time.time()
            self.height, self.width = frame_bgr.shape[:2]
            self.status = CameraStatus.CONNECTED
            return True

    def get_frame(self) -> Tuple[bool, Optional[np.ndarray]]:
        with self._lock:
            if self._current_frame is not None:
                return True, self._current_frame.copy()
            return False, None

    def get_info(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            "type": "BROWSER",
            "status": self.status.value,
            "is_simulation": False,
            "resolution": f"{self.width}x{self.height}",
            "fps": self.fps,
            "frame_count": self.frame_count,
            "last_error": self.last_error
        }
