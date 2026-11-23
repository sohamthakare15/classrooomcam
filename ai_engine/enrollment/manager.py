"""
Student Photo Enrollment & Biometric Template Management.
Validates photos, extracts normalized embeddings, and persists encrypted templates locally.
"""
import os
import json
from typing import List, Dict, Any, Tuple, Optional
import cv2
import numpy as np

from ai_engine.vision.quality import QualityValidator
from ai_engine.vision.detector import FaceDetector, DetectedFace
from ai_engine.vision.recognizer import FaceRecognizer
from ai_engine.enrollment.crypto_util import BiometricVault
from ai_engine.attendance.offline_queue import OfflineSyncQueue

class EnrollmentStatus:
    NOT_ENROLLED = "Not Enrolled"
    UPLOADING = "Uploading"
    VALIDATING = "Validating"
    PROCESSING = "Processing"
    ENROLLED = "Enrolled"
    NEEDS_REVIEW = "Needs Review"
    FAILED = "Enrollment Failed"
    DEACTIVATED = "Deactivated"

class EnrollmentManager:
    def __init__(
        self,
        storage_dir: str = "storage",
        detector: Optional[FaceDetector] = None,
        recognizer: Optional[FaceRecognizer] = None,
        sync_queue: Optional[OfflineSyncQueue] = None
    ):
        self.storage_dir = storage_dir
        self.templates_dir = os.path.join(storage_dir, "templates")
        self.photos_dir = os.path.join(storage_dir, "photos")
        self.meta_dir = os.path.join(storage_dir, "metadata")

        os.makedirs(self.templates_dir, exist_ok=True)
        os.makedirs(self.photos_dir, exist_ok=True)
        os.makedirs(self.meta_dir, exist_ok=True)

        self.quality = QualityValidator()
        self.detector = detector or FaceDetector()
        self.recognizer = recognizer or FaceRecognizer()
        self.vault = BiometricVault(os.path.join(storage_dir, ".secrets", "vault.key"))
        self.sync_queue = sync_queue or OfflineSyncQueue()

        # In-memory template cache: { student_id: np.ndarray (128-D) }
        self.enrolled_cache: Dict[str, np.ndarray] = {}
        self.load_all_templates()

    def validate_photo_bytes(self, image_bytes: bytes) -> Dict[str, Any]:
        """Validates photo format, size, blur, lighting, and face count with low-light tolerance."""
        if len(image_bytes) > 10 * 1024 * 1024:
            return {"valid": False, "reason": "File size exceeds 10MB limit"}

        nparr = np.frombuffer(image_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if img is None:
            return {"valid": False, "reason": "Failed to decode image. Supported formats: JPG, JPEG, PNG"}

        dim_ok, w, h = self.quality.check_dimensions(img)
        if not dim_ok:
            return {
                "valid": False,
                "reason": f"Image dimensions {w}x{h} below minimum required {self.quality.min_width}x{self.quality.min_height}",
                "metrics": {"width": w, "height": h}
            }

        # 1. Face detection check (YuNet + low-light enhanced fallback)
        detected_faces = self.detector.detect(img)
        if not detected_faces:
            # Try CLAHE / illumination equalization for dark environments
            try:
                lab = cv2.cvtColor(img, cv2.COLOR_BGR2LAB)
                l, a, b = cv2.split(lab)
                clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8, 8))
                cl = clahe.apply(l)
                enhanced = cv2.cvtColor(cv2.merge((cl, a, b)), cv2.COLOR_LAB2BGR)
                detected_faces = self.detector.detect(enhanced)
            except Exception:
                pass

        face_count = len(detected_faces)
        if face_count == 0:
            return {
                "valid": False,
                "reason": "No face detected in the photo. Please sit upright, look directly at the laptop camera, and ensure sufficient light on your face.",
                "face_count": 0,
                "metrics": {}
            }
        elif face_count > 1:
            return {
                "valid": False,
                "reason": f"Multiple faces detected ({face_count}). Enrollment requires exactly one student face in frame.",
                "face_count": face_count,
                "metrics": {}
            }

        # 2. Quality checks on the detected face region
        face = detected_faces[0]
        fx, fy, fw, fh = face.bbox
        face_crop = img[max(0, fy):min(h, fy + fh), max(0, fx):min(w, fx + fw)]
        eval_target = face_crop if face_crop.size > 0 else img

        sharp, blur_score = self.quality.check_blur(eval_target)
        light_ok, brightness, contrast = self.quality.check_lighting(eval_target)

        metrics = {
            "width": w,
            "height": h,
            "blur_score": round(blur_score, 2),
            "brightness": round(brightness, 2),
            "contrast": round(contrast, 2),
            "is_sharp": sharp,
            "is_lighting_good": light_ok
        }

        # Relaxed warnings for webcam real-world usage (accept down to 6.0 sharpness and 10.0 brightness)
        reasons = []
        if blur_score < 6.0:
            reasons.append(f"Image is too blurry (sharpness: {blur_score:.1f}, min: 6.0). Please hold still.")
        if brightness < 10.0:
            reasons.append(f"Face is too dark (brightness: {brightness:.1f}, min: 10.0). Please face toward a light source.")
        elif brightness > 250.0:
            reasons.append("Face is overexposed to harsh direct glare.")

        if reasons:
            return {
                "valid": False,
                "reason": "; ".join(reasons),
                "metrics": metrics
            }

        return {
            "valid": True,
            "reason": "Image passed quality and single-face verification",
            "face_count": 1,
            "detection_score": round(face.score, 3),
            "bbox": face.bbox,
            "metrics": metrics
        }

    def enroll_student(self, student_id: str, photos_bytes_list: List[bytes]) -> Dict[str, Any]:
        """
        Enrolls a student from one or more validated photos.
        Extracts embeddings, averages them, encrypts, and writes to local disk.
        """
        if not photos_bytes_list:
            return {"success": False, "error": "No photos provided for enrollment"}

        embeddings: List[np.ndarray] = []
        validation_results = []
        best_aligned_crop = None
        best_score = -1.0

        for idx, img_bytes in enumerate(photos_bytes_list):
            val = self.validate_photo_bytes(img_bytes)
            validation_results.append(val)
            if not val["valid"]:
                return {
                    "success": False,
                    "error": f"Photo {idx + 1} failed validation: {val['reason']}",
                    "details": validation_results,
                    "status": EnrollmentStatus.FAILED
                }

            # Decode and process
            nparr = np.frombuffer(img_bytes, np.uint8)
            img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            faces = self.detector.detect(img)
            face = faces[0]

            aligned = self.recognizer.align_and_crop(img, face.raw_face)
            emb = self.recognizer.extract_embedding(aligned)
            embeddings.append(emb)

            if face.score > best_score:
                best_score = face.score
                best_aligned_crop = aligned

        # Average embeddings across photos and re-normalize
        avg_embedding = np.mean(embeddings, axis=0)
        norm = np.linalg.norm(avg_embedding)
        if norm > 1e-6:
            avg_embedding = (avg_embedding / norm).astype(np.float32)

        # Encrypt and save template locally
        encrypted_bytes = self.vault.encrypt_embedding(avg_embedding)
        template_file = os.path.join(self.templates_dir, f"{student_id}.enc")
        with open(template_file, "wb") as f:
            f.write(encrypted_bytes)

        # Save profile photo thumbnail and persist to SQLite database
        if best_aligned_crop is not None:
            photo_file = os.path.join(self.photos_dir, f"{student_id}.jpg")
            cv2.imwrite(photo_file, best_aligned_crop)

            ret, jpeg_bytes = cv2.imencode('.jpg', best_aligned_crop, [int(cv2.IMWRITE_JPEG_QUALITY), 95])
            if ret:
                self.sync_queue.save_student_photo(
                    student_id=student_id,
                    photo_bytes=jpeg_bytes.tobytes(),
                    mime_type="image/jpeg",
                    width=best_aligned_crop.shape[1],
                    height=best_aligned_crop.shape[0]
                )
        elif photos_bytes_list:
            self.sync_queue.save_student_photo(
                student_id=student_id,
                photo_bytes=photos_bytes_list[0],
                mime_type="image/jpeg"
            )

        # Update in-memory cache
        self.enrolled_cache[student_id] = avg_embedding

        # Save local enrollment metadata
        meta = {
            "student_id": student_id,
            "status": EnrollmentStatus.ENROLLED,
            "photos_count": len(photos_bytes_list),
            "template_path": template_file,
            "has_thumbnail": best_aligned_crop is not None
        }
        with open(os.path.join(self.meta_dir, f"{student_id}.json"), "w") as f:
            json.dump(meta, f)

        return {
            "success": True,
            "status": EnrollmentStatus.ENROLLED,
            "student_id": student_id,
            "photos_processed": len(photos_bytes_list),
            "message": "Student successfully enrolled with encrypted local template."
        }

    def delete_enrollment(self, student_id: str) -> bool:
        """Securely removes encrypted templates, photos, and cached embeddings."""
        template_file = os.path.join(self.templates_dir, f"{student_id}.enc")
        photo_file = os.path.join(self.photos_dir, f"{student_id}.jpg")
        meta_file = os.path.join(self.meta_dir, f"{student_id}.json")

        for fpath in [template_file, photo_file, meta_file]:
            if os.path.exists(fpath):
                try:
                    os.remove(fpath)
                except Exception as e:
                    print(f"Error removing {fpath}: {e}")

        if student_id in self.enrolled_cache:
            del self.enrolled_cache[student_id]

        # Delete photo from SQLite database
        self.sync_queue.delete_student_photo(student_id)

        return True

    def load_all_templates(self):
        """Decrypts and loads all local templates into in-memory dictionary."""
        self.enrolled_cache.clear()
        if not os.path.exists(self.templates_dir):
            return

        for fname in os.listdir(self.templates_dir):
            if fname.endswith(".enc"):
                student_id = fname[:-4]
                path = os.path.join(self.templates_dir, fname)
                try:
                    with open(path, "rb") as f:
                        enc_data = f.read()
                    embedding = self.vault.decrypt_embedding(enc_data)
                    self.enrolled_cache[student_id] = embedding
                except Exception as e:
                    print(f"Failed to decrypt template for {student_id}: {e}")

        print(f"[EnrollmentManager] Loaded {len(self.enrolled_cache)} enrolled face templates into memory.")

    def get_enrolled_count(self) -> int:
        return len(self.enrolled_cache)

    def is_enrolled(self, student_id: str) -> bool:
        return student_id in self.enrolled_cache

