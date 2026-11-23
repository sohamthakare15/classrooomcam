"""
Image Quality and Validation Module for Face Enrollment and Detection.
Evaluates blur, brightness, contrast, dimensions, and face count.
"""
from typing import Dict, Any, Tuple, Optional
import cv2
import numpy as np

class QualityValidator:
    def __init__(
        self,
        min_width: int = 100,
        min_height: int = 100,
        blur_threshold: float = 8.0,      # Forgiving for typical laptop webcams (8-25 score)
        min_brightness: float = 12.0,     # Accommodates low-light evening / classroom indoor lighting
        max_brightness: float = 245.0,
        min_contrast: float = 10.0
    ):
        self.min_width = min_width
        self.min_height = min_height
        self.blur_threshold = blur_threshold
        self.min_brightness = min_brightness
        self.max_brightness = max_brightness
        self.min_contrast = min_contrast

    def check_blur(self, image: np.ndarray) -> Tuple[bool, float]:
        """Calculates blur via Laplacian variance. Higher value means sharper image."""
        if len(image.shape) == 3:
            gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        else:
            gray = image
        score = float(cv2.Laplacian(gray, cv2.CV_64F).var())
        is_sharp = score >= self.blur_threshold
        return is_sharp, score

    def check_lighting(self, image: np.ndarray) -> Tuple[bool, float, float]:
        """Checks brightness (mean intensity) and contrast (std deviation)."""
        if len(image.shape) == 3:
            gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        else:
            gray = image
        mean_brightness = float(np.mean(gray))
        contrast = float(np.std(gray))

        is_good = (
            (self.min_brightness <= mean_brightness <= self.max_brightness) and
            (contrast >= self.min_contrast)
        )
        return is_good, mean_brightness, contrast

    def check_dimensions(self, image: np.ndarray) -> Tuple[bool, int, int]:
        """Validates minimum image resolution."""
        h, w = image.shape[:2]
        is_valid = (w >= self.min_width) and (h >= self.min_height)
        return is_valid, w, h

    def validate_image_full(self, image: np.ndarray) -> Dict[str, Any]:
        """Runs complete suite of image checks and returns structured results."""
        if image is None or image.size == 0:
            return {
                "valid": False,
                "reason": "Image array is empty or corrupt",
                "metrics": {}
            }

        dim_ok, w, h = self.check_dimensions(image)
        if not dim_ok:
            return {
                "valid": False,
                "reason": f"Image dimensions {w}x{h} below minimum required {self.min_width}x{self.min_height}",
                "metrics": {"width": w, "height": h}
            }

        sharp, blur_score = self.check_blur(image)
        light_ok, brightness, contrast = self.check_lighting(image)

        metrics = {
            "width": w,
            "height": h,
            "blur_score": round(blur_score, 2),
            "brightness": round(brightness, 2),
            "contrast": round(contrast, 2),
            "is_sharp": sharp,
            "is_lighting_good": light_ok
        }

        reasons = []
        if not sharp:
            reasons.append(f"Image is too blurry (sharpness: {blur_score:.1f}, required >= {self.blur_threshold})")
        if brightness < self.min_brightness:
            reasons.append(f"Image is too dark (brightness: {brightness:.1f}, min: {self.min_brightness})")
        elif brightness > self.max_brightness:
            reasons.append(f"Image is overexposed (brightness: {brightness:.1f}, max: {self.max_brightness})")
        if contrast < self.min_contrast:
            reasons.append(f"Image has insufficient contrast (contrast: {contrast:.1f}, min: {self.min_contrast})")

        return {
            "valid": len(reasons) == 0,
            "reason": "; ".join(reasons) if reasons else "Quality standards met",
            "metrics": metrics
        }

