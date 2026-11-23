"""
Local AI Attendance Engine.
Performs real-time face detection, tracking, alignment, embedding extraction,
similarity matching, duplicate prevention, and review queuing.
"""
import time
import os
import uuid
import threading
from typing import Dict, Any, List, Optional, Callable
import cv2
import numpy as np

from ai_engine.vision.detector import FaceDetector, DetectedFace
from ai_engine.vision.recognizer import FaceRecognizer
from ai_engine.vision.tracker import FaceTracker
from ai_engine.vision.quality import QualityValidator
from ai_engine.enrollment.manager import EnrollmentManager
from ai_engine.camera.manager import CameraManager

class AttendanceEngine:
    def __init__(
        self,
        camera_manager: Optional[CameraManager] = None,
        enrollment_manager: Optional[EnrollmentManager] = None,
        detector: Optional[FaceDetector] = None,
        recognizer: Optional[FaceRecognizer] = None,
        storage_dir: str = "storage"
    ):
        self.camera_manager = camera_manager or CameraManager()
        self.enrollment_manager = enrollment_manager or EnrollmentManager(storage_dir=storage_dir)
        self.detector = detector or FaceDetector()
        self.recognizer = recognizer or FaceRecognizer()
        self.tracker = FaceTracker()
        self.quality = QualityValidator()

        self.storage_dir = storage_dir
        self.review_crops_dir = os.path.join(storage_dir, "review_crops")
        os.makedirs(self.review_crops_dir, exist_ok=True)

        self.active_session_id: Optional[str] = None
        self.active_session_info: Optional[Dict[str, Any]] = None
        self.marked_student_ids: set[str] = set()

        # Review items awaiting teacher confirmation
        self.pending_reviews: Dict[str, Dict[str, Any]] = {}
        self._reviews_lock = threading.Lock()

        # Callbacks for attendance events
        self.on_attendance_marked: Optional[Callable[[Dict[str, Any]], None]] = None

        self.is_running = False
        self._thread: Optional[threading.Thread] = None
        self._stop_event = threading.Event()
        self.fps_metric = 0.0

    def set_active_session(self, session_id: str, session_info: Dict[str, Any], already_marked_ids: Optional[List[str]] = None):
        self.active_session_id = session_id
        self.active_session_info = session_info
        self.marked_student_ids = set(already_marked_ids or [])
        print(f"[AttendanceEngine] Session active: {session_id} (Already marked: {len(self.marked_student_ids)})")

    def clear_active_session(self):
        self.active_session_id = None
        self.active_session_info = None
        self.marked_student_ids.clear()
        print("[AttendanceEngine] Active session cleared.")

    def start(self):
        if self.is_running:
            return
        self.is_running = True
        self._stop_event.clear()
        self._thread = threading.Thread(target=self._worker_loop, daemon=True)
        self._thread.start()
        print("[AttendanceEngine] Recognition worker loop started.")

    def stop(self):
        self.is_running = False
        self._stop_event.set()
        if self._thread and self._thread.is_alive():
            self._thread.join(timeout=2.0)
        print("[AttendanceEngine] Recognition worker loop stopped.")

    def _worker_loop(self):
        last_time = time.time()
        frame_interval = 0.065 # Target ~15 FPS AI inferences for smooth CPU usage

        while not self._stop_event.is_set():
            t0 = time.time()
            success, frame = self.camera_manager.get_frame()

            if not success or frame is None:
                time.sleep(0.05)
                continue

            # Process frame through AI pipeline
            annotated_frame = self.process_single_frame(frame)
            self.camera_manager.last_processed_frame = annotated_frame

            elapsed = time.time() - t0
            dt = time.time() - last_time
            last_time = time.time()
            if dt > 0:
                self.fps_metric = 0.9 * self.fps_metric + 0.1 * (1.0 / dt)

            sleep_time = max(0.001, frame_interval - elapsed)
            time.sleep(sleep_time)

    def process_single_frame(self, frame: np.ndarray) -> np.ndarray:
        """Runs detector, tracker, alignment, and recognizer on a single frame."""
        display_frame = frame.copy()
        h, w = frame.shape[:2]

        # 1. Detection
        detected_faces = self.detector.detect(frame)

        # 2. Tracking
        tracked_faces = self.tracker.update(detected_faces)

        # 3. For each face, recognize
        templates = self.enrollment_manager.enrolled_cache
        num_detected = len(detected_faces)

        for face in detected_faces:
            x, y, fw, fh = face.bbox

            # Draw subtle facial landmark points if provided by YuNet
            if hasattr(face, 'landmarks') and face.landmarks is not None and len(face.landmarks) > 0:
                for lm in face.landmarks:
                    try:
                        lx, ly = int(lm[0]), int(lm[1])
                        cv2.circle(display_frame, (lx, ly), 2, (0, 255, 255), -1, cv2.LINE_AA)
                    except Exception:
                        pass

            aligned = self.recognizer.align_and_crop(frame, face.raw_face)
            feat = self.recognizer.extract_embedding(aligned)

            # Match against enrolled gallery
            best_id: Optional[str] = None
            best_cosine = -1.0
            best_confidence = 0.0

            for stu_id, enrolled_feat in templates.items():
                cosine = self.recognizer.compute_similarity(feat, enrolled_feat)
                if cosine > best_cosine:
                    best_cosine = cosine
                    best_id = stu_id

            match_res = self.recognizer.evaluate_match(feat, templates.get(best_id, feat)) if best_id else {"status": "UNKNOWN", "confidence": 0.0}
            status = match_res["status"]
            confidence = match_res["confidence"]

            # Visual Annotation styles
            if status == "CONFIRMED" and best_id:
                color = (0, 200, 100) # Green
                label = f"ID: {best_id} ({int(confidence * 100)}%) - VERIFIED"

                # Check and register attendance
                if self.active_session_id and best_id not in self.marked_student_ids:
                    self.marked_student_ids.add(best_id)
                    event_data = {
                        "sessionId": self.active_session_id,
                        "studentId": best_id,
                        "confidence": confidence,
                        "cosineScore": match_res["cosine_score"],
                        "timestamp": time.time(),
                        "status": "present",
                        "method": "ai",
                        "faceCrop": aligned
                    }
                    if self.on_attendance_marked:
                        self.on_attendance_marked(event_data)
                    print(f"[AttendanceEngine] Marked present: {best_id} ({confidence:.2f})")

            elif status == "NEEDS_REVIEW" and best_id:
                color = (0, 165, 255) # Orange / Amber
                label = f"REVIEW: {best_id} ({int(confidence * 100)}%)"

                # Register review item (cooldown per student ~10s)
                self._register_review_item(best_id, confidence, aligned, face.bbox)

            else:
                color = (120, 120, 140) # Slate gray / Unknown
                label = "UNREGISTERED FACE"

            # Draw box & banner
            cv2.rectangle(display_frame, (x, y), (x + fw, y + fh), color, 2)
            lbl_size, _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.52, 2)
            cv2.rectangle(display_frame, (x, max(0, y - 24)), (x + lbl_size[0] + 10, y), color, -1)
            cv2.putText(display_frame, label, (x + 5, max(14, y - 7)),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.52, (255, 255, 255), 2, cv2.LINE_AA)

        # Telemetry HUD on frame
        cam_name = self.camera_manager.active_camera.name if self.camera_manager.active_camera else "DISCONNECTED"
        cam_type = self.camera_manager.camera_type
        session_text = f"SESSION: {self.active_session_id or 'IDLE'}"
        marked_text = f"MARKED PRESENT: {len(self.marked_student_ids)}"
        faces_text = f"FACES DETECTED: {num_detected}"
        fps_text = f"AI FPS: {self.fps_metric:.1f} | CAM: {cam_type} ({w}x{h})"

        cv2.rectangle(display_frame, (10, 10), (420, 105), (15, 23, 42), -1)
        cv2.rectangle(display_frame, (10, 10), (420, 105), (51, 65, 85), 1)

        cv2.putText(display_frame, session_text, (20, 32),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.55, (0, 220, 200), 1, cv2.LINE_AA)
        cv2.putText(display_frame, marked_text, (20, 55),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.55, (255, 255, 255), 1, cv2.LINE_AA)
        cv2.putText(display_frame, faces_text, (20, 77),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.55, (0, 255, 128) if num_detected > 0 else (180, 190, 200), 1, cv2.LINE_AA)
        cv2.putText(display_frame, fps_text, (20, 97),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.48, (148, 163, 184), 1, cv2.LINE_AA)

        return display_frame

        return display_frame

    def _register_review_item(self, candidate_id: str, confidence: float, face_crop: np.ndarray, bbox: Any):
        with self._reviews_lock:
            # Check if this student already has a pending review in last 15 seconds
            now = time.time()
            for r in self.pending_reviews.values():
                if r["candidateStudentId"] == candidate_id and (now - r["timestamp"]) < 15.0:
                    return

            review_id = f"rev_{uuid.uuid4().hex[:10]}"
            crop_path = os.path.join(self.review_crops_dir, f"{review_id}.jpg")
            cv2.imwrite(crop_path, face_crop)

            self.pending_reviews[review_id] = {
                "reviewId": review_id,
                "sessionId": self.active_session_id,
                "candidateStudentId": candidate_id,
                "confidenceScore": round(confidence, 3),
                "timestamp": now,
                "cameraSource": self.camera_manager.camera_type,
                "cropPath": crop_path,
                "status": "pending" # 'pending', 'confirmed', 'rejected', 'dismissed'
            }
            print(f"[AttendanceEngine] Ambiguous detection added to review queue: {candidate_id} (ID: {review_id})")

    def get_pending_reviews(self) -> List[Dict[str, Any]]:
        with self._reviews_lock:
            return sorted(
                [r for r in self.pending_reviews.values() if r["status"] == "pending"],
                key=lambda x: x["timestamp"],
                reverse=True
            )

    def resolve_review(self, review_id: str, action: str, assigned_student_id: Optional[str] = None) -> Optional[Dict[str, Any]]:
        """
        Actions: 'CONFIRM' (accepts candidate), 'REJECT' (declares not student),
        'MANUAL_SELECT' (binds to assigned_student_id), 'DISMISS' (ignores false detection)
        """
        with self._reviews_lock:
            if review_id not in self.pending_reviews:
                return None

            item = self.pending_reviews[review_id]
            final_student_id = assigned_student_id or item["candidateStudentId"]

            if action == "CONFIRM" or action == "MANUAL_SELECT":
                item["status"] = "confirmed"
                item["resolvedStudentId"] = final_student_id
                # Mark attendance if in active session
                if self.active_session_id and final_student_id not in self.marked_student_ids:
                    self.marked_student_ids.add(final_student_id)
                    event_data = {
                        "sessionId": self.active_session_id,
                        "studentId": final_student_id,
                        "confidence": item["confidenceScore"],
                        "timestamp": time.time(),
                        "status": "present",
                        "method": "teacher_review"
                    }
                    if self.on_attendance_marked:
                        self.on_attendance_marked(event_data)
            elif action == "REJECT":
                item["status"] = "rejected"
            elif action == "DISMISS":
                item["status"] = "dismissed"

            return item

    def clear_all_reviews(self) -> int:
        """Dismisses and cleans up all pending review items and their crops."""
        with self._reviews_lock:
            count = 0
            for r in list(self.pending_reviews.values()):
                if r.get("status") == "pending":
                    r["status"] = "dismissed"
                    count += 1
                crop_path = r.get("cropPath")
                if crop_path and os.path.exists(crop_path):
                    try:
                        os.remove(crop_path)
                    except Exception:
                        pass
            self.pending_reviews.clear()
            # Also clean up any loose crop files in the directory
            if os.path.exists(self.review_crops_dir):
                for f in os.listdir(self.review_crops_dir):
                    try:
                        os.remove(os.path.join(self.review_crops_dir, f))
                    except Exception:
                        pass
            return count


