"""
Face Tracking Module using IoU (Intersection-over-Union) and Centroid distance.
Maintains stable identity tracks across frames to avoid redundant processing.
"""
import time
from typing import List, Dict, Tuple, Optional
import numpy as np
from ai_engine.vision.detector import DetectedFace

class TrackedFace:
    def __init__(self, track_id: int, detected_face: DetectedFace):
        self.track_id = track_id
        self.bbox = detected_face.bbox
        self.landmarks = detected_face.landmarks
        self.raw_face = detected_face.raw_face
        self.score = detected_face.score
        self.last_seen = time.time()
        self.first_seen = time.time()
        self.hits = 1
        self.matched_student_id: Optional[str] = None
        self.matched_confidence: float = 0.0
        self.attendance_marked: bool = False

    def update(self, detected_face: DetectedFace):
        self.bbox = detected_face.bbox
        self.landmarks = detected_face.landmarks
        self.raw_face = detected_face.raw_face
        self.score = detected_face.score
        self.last_seen = time.time()
        self.hits += 1

class FaceTracker:
    def __init__(self, max_disappeared_seconds: float = 2.0, iou_threshold: float = 0.3):
        self.max_disappeared = max_disappeared_seconds
        self.iou_threshold = iou_threshold
        self.next_id = 1
        self.tracks: Dict[int, TrackedFace] = {}

    @staticmethod
    def _compute_iou(boxA: Tuple[int, int, int, int], boxB: Tuple[int, int, int, int]) -> float:
        xA = max(boxA[0], boxB[0])
        yA = max(boxA[1], boxB[1])
        xB = min(boxA[0] + boxA[2], boxB[0] + boxB[2])
        yB = min(boxA[1] + boxA[3], boxB[1] + boxB[3])

        interW = max(0, xB - xA)
        interH = max(0, yB - yA)
        interArea = interW * interH

        boxAArea = boxA[2] * boxA[3]
        boxBArea = boxB[2] * boxB[3]
        unionArea = float(boxAArea + boxBArea - interArea)

        if unionArea <= 0:
            return 0.0
        return interArea / unionArea

    def update(self, detected_faces: List[DetectedFace]) -> List[TrackedFace]:
        now = time.time()
        # Clean up stale tracks
        stale_ids = [tid for tid, track in self.tracks.items() if (now - track.last_seen) > self.max_disappeared]
        for tid in stale_ids:
            del self.tracks[tid]

        if not detected_faces:
            return list(self.tracks.values())

        if not self.tracks:
            # Initialize tracks for all current detections
            for face in detected_faces:
                t = TrackedFace(self.next_id, face)
                self.tracks[self.next_id] = t
                self.next_id += 1
            return list(self.tracks.values())

        # Match existing tracks with detections via IoU matrix
        track_ids = list(self.tracks.keys())
        cost_matrix = np.zeros((len(track_ids), len(detected_faces)), dtype=np.float32)

        for i, tid in enumerate(track_ids):
            for j, det in enumerate(detected_faces):
                cost_matrix[i, j] = self._compute_iou(self.tracks[tid].bbox, det.bbox)

        matched_tracks = set()
        matched_dets = set()

        # Greedy match by highest IoU
        while True:
            max_idx = np.unravel_index(np.argmax(cost_matrix), cost_matrix.shape)
            max_val = cost_matrix[max_idx]
            if max_val < self.iou_threshold:
                break
            i, j = max_idx
            cost_matrix[i, :] = -1
            cost_matrix[:, j] = -1

            tid = track_ids[i]
            self.tracks[tid].update(detected_faces[j])
            matched_tracks.add(tid)
            matched_dets.add(j)

        # Unmatched detections become new tracks
        for j, det in enumerate(detected_faces):
            if j not in matched_dets:
                t = TrackedFace(self.next_id, det)
                self.tracks[self.next_id] = t
                self.next_id += 1

        return list(self.tracks.values())

