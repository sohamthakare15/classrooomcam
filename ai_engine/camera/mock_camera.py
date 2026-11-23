"""
Simulated Classroom Camera Provider.
Generates synthetic frames for testing camera pipelines, UI layouts, and attendance logic.
Explicitly stamps [SIMULATION MODE] on all generated frames.
"""
import time
import os
import math
from typing import Tuple, Optional, Dict, Any, List
import cv2
import numpy as np
from ai_engine.camera.base import BaseCamera, CameraStatus

class MockCamera(BaseCamera):
    def __init__(
        self,
        name: str = "Classroom Camera Simulator",
        width: int = 1280,
        height: int = 720,
        fps: float = 30.0,
        sample_faces_dir: str = "storage/sample_faces"
    ):
        super().__init__(name)
        self.width = width
        self.height = height
        self.fps = fps
        self.sample_faces_dir = sample_faces_dir
        self.is_running = False
        self.start_time = 0.0
        self.face_images: List[np.ndarray] = []
        self._load_sample_faces()

    def _load_sample_faces(self):
        self.face_images = []
        if os.path.exists(self.sample_faces_dir):
            for fname in sorted(os.listdir(self.sample_faces_dir)):
                if fname.lower().endswith(('.jpg', '.jpeg', '.png')):
                    path = os.path.join(self.sample_faces_dir, fname)
                    img = cv2.imread(path)
                    if img is not None:
                        self.face_images.append(img)

    def start(self) -> bool:
        self.is_running = True
        self.status = CameraStatus.CONNECTED
        self.start_time = time.time()
        self.frame_count = 0
        self._load_sample_faces()
        return True

    def stop(self):
        self.is_running = False
        self.status = CameraStatus.DISCONNECTED

    def get_frame(self) -> Tuple[bool, Optional[np.ndarray]]:
        if not self.is_running:
            return False, None

        self.frame_count += 1
        t = time.time() - self.start_time

        # Create classroom background (Arctic / off-white interior)
        frame = np.full((self.height, self.width, 3), (242, 245, 248), dtype=np.uint8)

        # Whiteboard / classroom wall header
        cv2.rectangle(frame, (100, 40), (self.width - 100, 200), (225, 230, 235), -1)
        cv2.rectangle(frame, (100, 40), (self.width - 100, 200), (180, 190, 200), 2)
        cv2.putText(frame, "SMART CLASSROOM - ROOM 302", (130, 90),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.9, (15, 60, 60), 2, cv2.LINE_AA)
        cv2.putText(frame, "AI Facial Recognition Attendance Active", (130, 140),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.65, (70, 90, 100), 1, cv2.LINE_AA)

        # Desks layout
        desk_rows = [(250, 420), (450, 620)]
        for r_idx, (y_start, y_end) in enumerate(desk_rows):
            for c_idx in range(3):
                x_center = int(self.width * (0.22 + c_idx * 0.28))
                x1 = x_center - 130
                x2 = x_center + 130
                cv2.rectangle(frame, (x1, y_start + 80), (x2, y_end), (200, 210, 220), -1)
                cv2.rectangle(frame, (x1, y_start + 80), (x2, y_end), (160, 175, 190), 2)
                cv2.putText(frame, f"Desk {r_idx * 3 + c_idx + 1}", (x1 + 10, y_start + 110),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.5, (90, 100, 110), 1, cv2.LINE_AA)

                # If sample faces available, place them at the desks
                face_idx = (r_idx * 3 + c_idx) % len(self.face_images) if self.face_images else -1
                if face_idx >= 0 and self.face_images:
                    face_img = self.face_images[face_idx]
                    fw, fh = 100, 100
                    # Slight head sway motion
                    sway_x = int(5 * math.sin(t * 1.5 + c_idx))
                    sway_y = int(3 * math.cos(t * 1.2 + r_idx))
                    fx = x_center - fw // 2 + sway_x
                    fy = y_start - 30 + sway_y

                    if 0 <= fx and fx + fw < self.width and 0 <= fy and fy + fh < self.height:
                        face_resized = cv2.resize(face_img, (fw, fh))
                        frame[fy:fy+fh, fx:fx+fw] = face_resized
                        cv2.rectangle(frame, (fx, fy), (fx + fw, fy + fh), (0, 160, 120), 1)

        # Simulation Mode prominent banner overlay (Top center)
        banner_w = 460
        banner_h = 42
        bx1 = (self.width - banner_w) // 2
        by1 = 15
        cv2.rectangle(frame, (bx1, by1), (bx1 + banner_w, by1 + banner_h), (25, 25, 180), -1)
        cv2.rectangle(frame, (bx1, by1), (bx1 + banner_w, by1 + banner_h), (255, 255, 255), 2)
        cv2.putText(frame, "SIMULATION MODE - TEST CAMERA", (bx1 + 25, by1 + 28),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.72, (255, 255, 255), 2, cv2.LINE_AA)

        # Bottom telemetry bar
        bar_y = self.height - 35
        cv2.rectangle(frame, (0, bar_y), (self.width, self.height), (20, 30, 40), -1)
        timestamp_str = time.strftime("%Y-%m-%d %H:%M:%S")
        info_str = f"SOURCE: MockCamera | FPS: {self.fps:.0f} | FRAME: {self.frame_count} | TIME: {timestamp_str}"
        cv2.putText(frame, info_str, (20, self.height - 12),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.52, (200, 220, 230), 1, cv2.LINE_AA)

        # Rate limiter to simulate realistic FPS
        time.sleep(max(0.001, 1.0 / self.fps - 0.005))

        return True, frame

    def get_info(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            "type": "MOCK",
            "status": self.status.value,
            "is_simulation": True,
            "resolution": f"{self.width}x{self.height}",
            "fps": self.fps,
            "frame_count": self.frame_count,
            "sample_faces_count": len(self.face_images),
            "last_error": self.last_error
        }

