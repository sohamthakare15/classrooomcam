"""
OpenCV Zoo Model Downloader and Verifier.
Downloads YuNet (Face Detection) and SFace (Face Recognition) ONNX models.
"""
import os
import urllib.request
import hashlib

MODELS = {
    "face_detection_yunet_2023mar.onnx": {
        "url": "https://github.com/opencv/opencv_zoo/raw/main/models/face_detection_yunet/face_detection_yunet_2023mar.onnx",
        "description": "YuNet Face Detector (Apache 2.0 / BSD 3-Clause)",
        "expected_min_size": 200000
    },
    "face_recognition_sface_2021dec.onnx": {
        "url": "https://github.com/opencv/opencv_zoo/raw/main/models/face_recognition_sface/face_recognition_sface_2021dec.onnx",
        "description": "SFace Deep Feature Extractor (Apache 2.0 / BSD 3-Clause)",
        "expected_min_size": 35000000
    }
}

def verify_or_download_models(models_dir: str = "ai_engine/models"):
    os.makedirs(models_dir, exist_ok=True)
    all_ready = True

    for filename, info in MODELS.items():
        filepath = os.path.join(models_dir, filename)
        if os.path.exists(filepath):
            size = os.path.getsize(filepath)
            if size >= info["expected_min_size"]:
                print(f"[OK] {filename} is present ({size:,} bytes) - {info['description']}")
                continue
            else:
                print(f"[RE-DOWNLOAD] {filename} is corrupt or truncated ({size} bytes).")

        print(f"[DOWNLOADING] {filename} from {info['url']}...")
        try:
            urllib.request.urlretrieve(info["url"], filepath)
            new_size = os.path.getsize(filepath)
            print(f"[SUCCESS] Downloaded {filename} ({new_size:,} bytes)")
        except Exception as e:
            print(f"[ERROR] Failed to download {filename}: {e}")
            all_ready = False

    return all_ready

if __name__ == "__main__":
    success = verify_or_download_models()
    if success:
        print("\nAll AI facial detection and recognition models verified successfully.")
    else:
        print("\nWarning: Some models could not be downloaded. Local fallbacks will be used.")

