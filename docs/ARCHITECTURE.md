# System Architecture: SmartClassroom AI Attendance

The **SmartClassroom AI Attendance System** is an enterprise desktop solution engineered for institutional classrooms of approximately 30 students. It pairs locally-executed deep computer vision with a modern Electron/React interface and dual-mode data persistence (local durable SQLite queue + Firebase Firestore).

```
+-------------------------------------------------------------------------+
|                  SmartClassroom AI Desktop Environment                  |
+-------------------------------------------------------------------------+
|                                                                         |
|  [ Electron Shell ] (Node.js Main Process)                              |
|       |                                                                 |
|       +--> [ React 19 Frontend + Tailwind CSS + Lucide Icons ]          |
|       |      - Dashboard, Student Directory, Photo Enrollment           |
|       |      - Attendance Session Console, Review Panel, Reports        |
|       |      - Real-time MJPEG Stream Consumer (/camera/stream)         |
|       |                                                                 |
|       +--> Secure IPC & Token Authorization (X-App-Token)                |
|                                                                         |
|  [ Local Python 3.13 AI Engine ] (FastAPI + Uvicorn on 127.0.0.1:8000)   |
|       |                                                                 |
|       +--> [ Camera Abstraction Layer ]                                 |
|       |      - MockCamera (Simulated classroom, marked [SIMULATION])    |
|       |      - VideoFileCamera (Local MP4/AVI playback with looping)    |
|       |      - RTSPCamera (Multi-threaded OpenCV VideoCapture)          |
|       |      - WebcamCamera (DirectShow USB camera devices)             |
|       |                                                                 |
|       +--> [ Vision Pipeline ]                                          |
|       |      - QualityValidator (Laplacian blur, lighting & contrast)   |
|       |      - FaceDetector (YuNet ONNX detector with landmarks)        |
|       |      - FaceTracker (IoU + Centroid temporal smoothing)          |
|       |      - FaceRecognizer (SFace 128D deep embedding generator)     |
|       |                                                                 |
|       +--> [ Attendance & Session Manager ]                             |
|       |      - Deterministic IDs: session_{sessionId}_student_{studentId}|
|       |      - Duplicate prevention & cooldown thresholds               |
|       |      - Human-in-the-Loop Teacher Review Queue (< 75% conf)      |
|       |      - Finalization: absent marks generated only at close       |
|       |                                                                 |
|       +--> [ Storage & Security Vault ]                                 |
|              - Local AES-GCM Encrypted Face Templates (storage/templates) |
|              - Durable SQLite Sync Queue (storage/offline_queue.db)     |
|              - Firestore Rules & Indexes (No raw biometrics in cloud)   |
+-------------------------------------------------------------------------+
```

## Computer Vision Pipeline

1. **Frame Quality Validation**: Each incoming frame is checked for motion blur via Laplacian variance (threshold $\ge 80$), brightness (mean $35 \le \mu \le 230$), and contrast ($\sigma \ge 22$).
2. **Face Detection**: Uses OpenCV Zoo `YuNet` (`face_detection_yunet_2023mar.onnx`, Apache 2.0 / BSD 3-Clause). Returns bounding boxes, detection score, and 5 facial landmarks (right eye, left eye, nose, right mouth, left mouth).
3. **Face Tracking**: Centroid & Intersection-over-Union (IoU) tracker keeps identity stability across consecutive frames.
4. **Alignment & Crop**: `SFace` 5-point similarity transformation projects the face into a canonical $112 \times 112$ pose.
5. **Embedding Extraction**: `SFace` produces a normalized $128$-dimensional floating-point vector.
6. **Matching & Confidence Calibration**:
   - Cosine similarity: $S_c(u, v) = \frac{u \cdot v}{\|u\| \|v\|}$.
   - **High Match** ($S_c \ge 0.363 \approx 75\%+$): Automatically confirms identity.
   - **Ambiguous Match** ($0.260 \le S_c < 0.363 \approx 45\% - 75\%$): Enters the **Teacher Review Queue** with a face crop. Attendance is **not** recorded until approved by the teacher.
   - **Unknown** ($S_c < 0.260$): Classified as unrecognized.

## Data Boundaries

- **Biometric Templates**: Stored **only on the local machine** inside `storage/templates/*.enc` encrypted using Fernet (AES-128-CBC + HMAC-SHA256). Biometric vectors are **never** uploaded to Firebase.
- **Firebase Firestore**: Stores only institutional metadata (students, classes, attendance records, audit logs, system settings).

