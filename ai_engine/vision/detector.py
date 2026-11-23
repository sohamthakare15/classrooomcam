"""
Face Detection Module using OpenCV YuNet (with robust fallback).
Supports multi-face detection, bounding box normalization, and 5-point landmarks.
"""
import os
import threading
from typing import List, Dict, Any, Tuple, Optional
from dataclasses import dataclass
import cv2
import numpy as np

@dataclass
class DetectedFace:
    bbox: Tuple[int, int, int, int]  # (x, y, w, h)
    score: float
    landmarks: List[Tuple[float, float]] # 5 points: re, le, nose, rm, lm
    raw_face: np.ndarray # 15-float array for SFace alignCrop

class FaceDetector:
    def __init__(
        self,
        model_path: str = "ai_engine/models/face_detection_yunet_2023mar.onnx",
        conf_threshold: float = 0.6,
        nms_threshold: float = 0.3,
        top_k: int = 50
    ):
        self.model_path = model_path
        self.conf_threshold = conf_threshold
        self.nms_threshold = nms_threshold
        self.top_k = top_k
        self.detector = None
        self._lock = threading.Lock()
        self._init_detector()

    def _init_detector(self):
        if os.path.exists(self.model_path):
            try:
                self.detector = cv2.FaceDetectorYN.create(
                    self.model_path,
                    "",
                    (320, 320),
                    score_threshold=self.conf_threshold,
                    nms_threshold=self.nms_threshold,
                    top_k=self.top_k
                )
            except Exception as e:
                print(f"[FaceDetector] Warning: Could not initialize YuNet ({e}). Fallback mode enabled.")
                self.detector = None
        else:
            print(f"[FaceDetector] Notice: Model not found at {self.model_path}. Fallback mode active.")

    def detect(self, image: np.ndarray) -> List[DetectedFace]:
        """Detects faces in BGR image. Returns list of DetectedFace objects (thread-safe)."""
        if image is None or image.size == 0:
            return []

        h, w = image.shape[:2]
        results: List[DetectedFace] = []

        with self._lock:
            if self.detector is not None:
                try:
                    self.detector.setInputSize((w, h))
                    _, faces = self.detector.detect(image)
                    if faces is not None:
                        for face in faces:
                            score = float(face[14])
                            if score < self.conf_threshold:
                                continue
                            x = max(0, int(face[0]))
                            y = max(0, int(face[1]))
                            fw = min(w - x, int(face[2]))
                            fh = min(h - y, int(face[3]))
                            if fw <= 5 or fh <= 5:
                                continue

                            # 5 landmarks
                            landmarks = [
                                (float(face[4]), float(face[5])),   # Right eye
                                (float(face[6]), float(face[7])),   # Left eye
                                (float(face[8]), float(face[9])),   # Nose tip
                                (float(face[10]), float(face[11])), # Right mouth
                                (float(face[12]), float(face[13]))  # Left mouth
                            ]

                            results.append(DetectedFace(
                                bbox=(x, y, fw, fh),
                                score=score,
                                landmarks=landmarks,
                                raw_face=face.copy()
                            ))
                        return results
                except Exception as ex:
                    # In case of any unexpected internal OpenCV DNN error, fall through to fallback
                    pass

            # Fallback detector using Haar or simple contour
            gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY) if len(image.shape) == 3 else image
            cascade_path = cv2.data.haarcascades + 'haarcascade_frontalface_default.xml'
            cascade = cv2.CascadeClassifier(cascade_path) if os.path.exists(cascade_path) else None
            
            if cascade and not cascade.empty():
                boxes = cascade.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=5, minSize=(30, 30))
                for (x, y, fw, fh) in boxes:
                    # Construct approximate landmarks for alignment compatibility
                    re = (x + fw * 0.3, y + fh * 0.35)
                    le = (x + fw * 0.7, y + fh * 0.35)
                    nose = (x + fw * 0.5, y + fh * 0.55)
                    rm = (x + fw * 0.35, y + fh * 0.75)
                    lm = (x + fw * 0.65, y + fh * 0.75)
                    
                    raw = np.array([x, y, fw, fh, re[0], re[1], le[0], le[1], nose[0], nose[1], rm[0], rm[1], lm[0], lm[1], 0.85], dtype=np.float32)
                    results.append(DetectedFace(
                        bbox=(int(x), int(y), int(fw), int(fh)),
                        score=0.85,
                        landmarks=[re, le, nose, rm, lm],
                        raw_face=raw
                    ))

        return results

