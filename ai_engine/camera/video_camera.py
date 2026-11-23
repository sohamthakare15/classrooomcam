"""
Video File Camera Provider.
Streams frames from local video files (MP4, AVI, MKV) with looping and pause controls.
"""
import os
import time
from typing import Tuple, Optional, Dict, Any
import cv2
import numpy as np
from ai_engine.camera.base import BaseCamera, CameraStatus

class VideoFileCamera(BaseCamera):
    def __init__(
        self,
        file_path: str,
        name: str = "Video File Provider",
        loop: bool = True
    ):
        super().__init__(name)
        self.file_path = file_path
        self.loop = loop
        self.cap: Optional[cv2.VideoCapture] = None
        self.is_paused = False
        self.is_running = False
        self.total_frames = 0
        self.current_pos = 0

    def start(self) -> bool:
        if not os.path.exists(self.file_path):
            self.status = CameraStatus.ERROR
            self.last_error = f"Video file not found at: {self.file_path}"
            return False

        try:
            self.cap = cv2.VideoCapture(self.file_path)
            if not self.cap.isOpened():
                self.status = CameraStatus.ERROR
                self.last_error = f"Failed to open video file: {self.file_path}"
                return False

            self.width = int(self.cap.get(cv2.CAP_PROP_FRAME_WIDTH)) or 1280
            self.height = int(self.cap.get(cv2.CAP_PROP_FRAME_HEIGHT)) or 720
            self.fps = float(self.cap.get(cv2.CAP_PROP_FPS)) or 30.0
            self.total_frames = int(self.cap.get(cv2.CAP_PROP_FRAME_COUNT))
            self.status = CameraStatus.CONNECTED
            self.is_running = True
            self.is_paused = False
            self.frame_count = 0
            return True
        except Exception as e:
            self.status = CameraStatus.ERROR
            self.last_error = str(e)
            return False

    def pause(self):
        self.is_paused = True

    def resume(self):
        self.is_paused = False

    def stop(self):
        self.is_running = False
        if self.cap is not None:
            self.cap.release()
            self.cap = None
        self.status = CameraStatus.DISCONNECTED

    def get_frame(self) -> Tuple[bool, Optional[np.ndarray]]:
        if not self.is_running or self.cap is None or not self.cap.isOpened():
            return False, None

        if self.is_paused:
            time.sleep(0.05)
            return True, None

        ret, frame = self.cap.read()
        if not ret:
            if self.loop:
                self.cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
                ret, frame = self.cap.read()
                if not ret:
                    self.status = CameraStatus.ERROR
                    return False, None
            else:
                self.status = CameraStatus.DISCONNECTED
                return False, None

        self.frame_count += 1
        self.current_pos = int(self.cap.get(cv2.CAP_PROP_POS_FRAMES))

        # Enforce FPS timing
        time.sleep(max(0.001, 1.0 / self.fps - 0.005))
        return True, frame

    def get_info(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            "type": "VIDEO_FILE",
            "file_path": self.file_path,
            "status": self.status.value,
            "resolution": f"{self.width}x{self.height}",
            "fps": self.fps,
            "frame_count": self.frame_count,
            "current_frame": self.current_pos,
            "total_frames": self.total_frames,
            "is_paused": self.is_paused,
            "last_error": self.last_error
        }

