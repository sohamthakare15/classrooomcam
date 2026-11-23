"""
Tests for Face Detector, Recognizer, and Tracker.
"""
import pytest
import numpy as np
from ai_engine.vision.detector import FaceDetector
from ai_engine.vision.recognizer import FaceRecognizer
from ai_engine.vision.tracker import FaceTracker, TrackedFace

def test_face_detector_initialization():
    detector = FaceDetector()
    assert detector is not None
    # Blank image returns empty list
    blank = np.zeros((320, 320, 3), dtype=np.uint8)
    faces = detector.detect(blank)
    assert isinstance(faces, list)
    assert len(faces) == 0

def test_face_recognizer_embedding_and_similarity():
    recognizer = FaceRecognizer()
    assert recognizer is not None

    # Test dummy 112x112 aligned face
    dummy_face1 = np.full((112, 112, 3), 120, dtype=np.uint8)
    dummy_face1[30:50, 30:50] = 50
    dummy_face2 = dummy_face1.copy()

    emb1 = recognizer.extract_embedding(dummy_face1)
    emb2 = recognizer.extract_embedding(dummy_face2)

    assert isinstance(emb1, np.ndarray)
    assert len(emb1.shape) == 1
    # Cosine similarity of identical embeddings should be ~1.0
    sim_self = recognizer.compute_similarity(emb1, emb2)
    assert sim_self > 0.95

    # Evaluation should give confirmed status for identical
    eval_res = recognizer.evaluate_match(emb1, emb2)
    assert eval_res["status"] == "CONFIRMED"
    assert eval_res["confidence"] > 0.70

def test_face_tracker():
    tracker = FaceTracker(iou_threshold=0.3)
    from ai_engine.vision.detector import DetectedFace

    face1 = DetectedFace(bbox=(50, 50, 100, 100), score=0.9, landmarks=[], raw_face=np.zeros(15, dtype=np.float32))
    tracks = tracker.update([face1])
    assert len(tracks) == 1
    track_id = tracks[0].track_id

    # Second frame with slight shift
    face2 = DetectedFace(bbox=(53, 51, 100, 100), score=0.92, landmarks=[], raw_face=np.zeros(15, dtype=np.float32))
    tracks2 = tracker.update([face2])
    assert len(tracks2) == 1
    # Track ID should be maintained
    assert tracks2[0].track_id == track_id
    assert tracks2[0].hits == 2

