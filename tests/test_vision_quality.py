"""
Vision Quality and Validation Tests.
"""
import pytest
import numpy as np
import cv2
from ai_engine.vision.quality import QualityValidator

def test_quality_validator_sharpness():
    validator = QualityValidator(blur_threshold=50.0)
    # Sharp image: high contrast checkerboard
    sharp = np.zeros((200, 200), dtype=np.uint8)
    sharp[::20, :] = 255
    sharp[:, ::20] = 255
    is_sharp, score = validator.check_blur(sharp)
    assert is_sharp is True
    assert score > 50.0

    # Blurry image: heavily blurred
    blurry = cv2.GaussianBlur(sharp, (31, 31), 0)
    is_blurry_sharp, blur_score = validator.check_blur(blurry)
    assert is_blurry_sharp is False
    assert blur_score < 50.0

def test_quality_validator_lighting():
    validator = QualityValidator(min_brightness=40.0, max_brightness=220.0, min_contrast=20.0)
    # Pitch black
    black = np.zeros((150, 150), dtype=np.uint8)
    is_good, b, c = validator.check_lighting(black)
    assert is_good is False
    assert b == 0.0

    # Well balanced gray with contrast
    balanced = np.full((150, 150), 128, dtype=np.uint8)
    balanced[50:100, 50:100] = 200
    balanced[0:50, 0:50] = 50
    is_good, b, c = validator.check_lighting(balanced)
    assert is_good is True
    assert 40.0 <= b <= 220.0
    assert c >= 20.0

def test_quality_validator_dimensions():
    validator = QualityValidator(min_width=120, min_height=120)
    small = np.zeros((80, 80), dtype=np.uint8)
    valid, w, h = validator.check_dimensions(small)
    assert valid is False

    ok_img = np.zeros((150, 200), dtype=np.uint8)
    valid, w, h = validator.check_dimensions(ok_img)
    assert valid is True
    assert w == 200 and h == 150

