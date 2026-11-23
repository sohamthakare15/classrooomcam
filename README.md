# SmartClassroom AI Attendance System

An enterprise-grade educational desktop application for automated classroom attendance using local AI facial recognition. Designed for classrooms of approximately 30 students, supporting simulated camera feeds, local video file replays, and RTSP IP cameras.

Built with **Electron**, **React 19**, **Vite**, **Tailwind CSS**, **FastAPI**, **OpenCV**, and **Firebase Realtime Database (RTDB)**.

> [!NOTE]
> **Database & Architecture Note**: Configured to use **Firebase Realtime Database (RTDB) only** for cloud persistence. Does not use Firebase Authentication or Cloud Firestore. Biometric face templates are stored strictly in local AES-GCM encrypted storage.

---

## Key Features

1. **Local AI Facial Recognition Engine**:
   - **YuNet** (`face_detection_yunet_2023mar.onnx`): High-speed, multi-face detector with 5-point facial landmark prediction.
   - **SFace** (`face_recognition_sface_2021dec.onnx`): 128-dimensional deep metric face recognition embedding model.
   - **Laplacian & Photometric Quality Checks**: Rejects blurry, dark, or overexposed images.
   - **IoU & Centroid Face Tracking**: Temporal identity tracking across frames to avoid redundant processing.
   - **Human-in-the-Loop Review Queue**: Detections with confidence between 45% and 75% are held for teacher approval before attendance is recorded.

2. **Camera Abstraction Layer**:
   - **External Wi-Fi IP Camera (RTSP / ONVIF)**:
     - Connects over local Wi-Fi / LAN to IP cameras via RTSP with reliable TCP transport.
     - **ONVIF WS-Discovery**: Broadcasts WS-Discovery multicast probes (`239.255.255.250:3702`) to auto-detect IP cameras on the local subnet (e.g. CP-Plus, Hikvision, Dahua, Reolink, Tapo).
     - **Non-Invasive Connection Testing**: Rapid socket probe and single-frame verification without blocking the main application.
     - **Zero-Latency Background Thread**: Continuous buffer grabber loop prevents stale frame latency and memory accumulation.
     - **Auto-Reconnection**: Exponential backoff reconnects automatically if network drops or Wi-Fi flickers.
     - **Strict Credential Security**: Masked URL formats (`rtsp://***:***@ip:port/path`) ensure passwords are never exposed in UI telemetry, logs, or cloud databases.
   - **Laptop Integrated Webcam**: DirectShow driver support for integrated laptop webcams (`cv2.CAP_DSHOW`, 1280x720 HD @ 30 FPS).
   - **VideoFileCamera**: Loops or replays local MP4/AVI classroom recordings.
   - **MockCamera**: Realistic synthetic classroom with student motion simulation and prominent `[SIMULATION MODE]` watermark.

3. **Biometric Privacy & Security**:
   - Biometric face templates are encrypted locally using AES-GCM (Fernet) in `storage/templates/*.enc`.
   - **Biometric templates are never uploaded to Firebase RTDB.**
   - Photo enrollment never automatically marks a student present.
   - Permanent enrollment wiping (Right to Erasure).

4. **Attendance Management**:
   - Class and section selection with session creation.
   - Deterministic record IDs (`session_{sessionId}_student_{studentId}`) preventing duplicate marks.
   - Students are not marked absent while a session is running.
   - **Finalization Engine**: Generates absent records only when the teacher finalizes the session.
   - Complete manual correction interface with an immutable audit log.

5. **Cloud Persistence with Firebase Realtime Database (RTDB)**:
   - Stores students, attendance sessions, attendance records, review queue and audit logs in RTDB.
   - Endpoints: `https://classroomcam-1b81d-default-rtdb.asia-southeast1.firebasedatabase.app`
   - Hardened validation rules in `firebase/database.rules.json` that reject any biometric data uploads.
   - Durable SQLite offline queue (`storage/offline_queue.db`) syncing seamlessly on connection.

6. **Reports & Analytics**:
   - Student-wise and class-wise attendance rates.
   - Real-time Chart.js weekly and distribution graphs.
   - CSV export and printable official school reports.

---

## Project Structure

```
SmartClassroomAttendance/
├── desktop/
│   ├── electron/
│   │   ├── main.js                  # Electron main process & backend supervisor
│   │   └── preload.js               # ContextBridge secure IPC
│   └── frontend/
│       ├── src/
│       │   ├── components/          # Reusable UI (Sidebar, Navbar, DataTable, Modal, CameraFeed)
│       │   ├── context/             # AuthContext (Local faculty session persistence)
│       │   ├── pages/               # Dashboard, Students, Enrollment, Attendance, Review, Reports, Camera, Settings
│       │   ├── services/            # apiService, rtdbService, storageService
│       │   ├── App.jsx              # Main routing & layout
│       │   └── index.css            # Arctic light enterprise theme & Tailwind styles
│       ├── package.json
│       └── vite.config.js
├── ai_engine/
│   ├── api/
│   │   ├── main.py                  # FastAPI server entry point
│   │   ├── routes.py                # REST endpoints (/health, /students, /attendance, /camera, /review, /sync)
│   │   └── schemas.py               # Pydantic V2 schemas
│   ├── vision/
│   │   ├── detector.py              # YuNet ONNX face detector + fallback
│   │   ├── recognizer.py            # SFace 128D embedding extractor
│   │   ├── aligner.py               # 5-point similarity transformation alignment
│   │   ├── tracker.py               # IoU + Centroid multi-face tracker
│   │   └── quality.py               # Laplacian blur, brightness & contrast validator
│   ├── camera/
│   │   ├── base.py                  # BaseCamera abstract class
│   │   ├── mock_camera.py           # Simulation camera with watermark
│   │   ├── video_camera.py          # Local video file camera
│   │   ├── rtsp_camera.py           # Multi-threaded RTSP camera with reconnection
│   │   ├── webcam_camera.py         # USB/integrated webcam
│   │   └── manager.py               # CameraManager singleton & MJPEG stream
│   ├── enrollment/
│   │   ├── crypto_util.py           # AES-GCM Fernet template encryption
│   │   └── manager.py               # Photo validation & multi-photo template creation
│   ├── attendance/
│   │   ├── engine.py                # Real-time recognition worker thread
│   │   ├── session_manager.py       # Session lifecycle, deterministic IDs, finalization
│   │   └── offline_queue.py         # SQLite durable offline queue & RTDB REST sync
│   └── models/                      # YuNet & SFace ONNX weight files
├── firebase/
│   └── database.rules.json          # Hardened Realtime Database schema validation rules
├── storage/                         # Encrypted templates, face crops & SQLite queue
├── tests/                           # Complete automated Pytest test suite (20 tests)
│   ├── test_rtdb_sync.py            # Live RTDB read, write, update, delete tests
│   ├── test_api_endpoints.py
│   ├── test_attendance_and_session.py
│   ├── test_camera_providers.py
│   ├── test_vision_and_models.py
│   └── test_vision_quality.py
├── scripts/
│   ├── download_models.py           # Model downloader
│   ├── start_ai_backend.bat         # Windows backend launcher
│   ├── start_desktop.bat            # Windows desktop launcher
│   ├── run_all.bat                  # One-click launcher for both services
│   └── setup_environment.bat        # Automated dependency setup
├── requirements.txt                 # Python dependencies
├── package.json                     # Root npm orchestration
└── README.md
```

---

## Windows Installation & Quickstart

### Prerequisites
- Python 3.10+ (Verified on Python 3.13)
- Node.js 18+ (Verified on Node v22.20)
- Windows 10 or Windows 11

### Step 1: Install Dependencies & Download Models

Run the automated setup script:
```powershell
.\scripts\setup_environment.bat
```

Or manually:
```powershell
# 1. Python packages
python -m pip install -r requirements.txt

# 2. Download AI models (YuNet and SFace)
python scripts\download_models.py

# 3. Root and frontend npm packages
npm install
npm --prefix desktop/frontend install

# 4. Build frontend assets
npm --prefix desktop/frontend run build
```

---

## Running the Application

Three flexible launch and access methods are provided for Windows 10/11:

### Method A — Desktop Application (Primary Electron App)
Double-click `START_SMARTCLASSROOM.bat` in the project root:
```powershell
.\START_SMARTCLASSROOM.bat
```
- Automatically resets `ELECTRON_RUN_AS_NODE` to avoid execution bugs.
- Checks and verifies the frontend build in `dist/`.
- Spawns the Python AI backend on `http://127.0.0.1:8000`.
- Polls `http://127.0.0.1:8000/health` with automatic retries until healthy.
- Launches the native Electron desktop application with ContextBridge IPC security.

### Method B — Local Browser Dashboard (Fast Web Access)
Double-click `START_BROWSER_DASHBOARD.bat` in the project root:
```powershell
.\START_BROWSER_DASHBOARD.bat
```
- Starts the FastAPI AI engine on port `8000`.
- Waits for health verification.
- Starts the Vite development server on `http://localhost:5173`.
- Automatically launches your default web browser (Edge, Chrome, Brave, etc.) to `http://localhost:5173`.
- Ideal for quick browser-based administrative use without launching Electron.

### Method C — Backend API & Health Check Endpoint
To inspect the backend status and interactive OpenAPI documentation directly:
- **Backend Health Check**: [http://127.0.0.1:8000/health](http://127.0.0.1:8000/health)
- **Interactive Swagger Docs**: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)
- **Live MJPEG Video Stream**: [http://127.0.0.1:8000/camera/feed](http://127.0.0.1:8000/camera/feed)

### Clean Shutdown Tool
To cleanly stop all background processes and free ports 8000 and 5173:
```powershell
.\STOP_SMARTCLASSROOM.bat
```

---

## Default Login Credentials

| Role | Email | Password | Permissions |
|---|---|---|---|
| **Faculty / Teacher** | `teacher@school.edu` | `password123` | Start/stop sessions, enroll students, review queue, reports |
| **System Administrator** | `admin@school.edu` | `password123` | Full access including camera hardware and system settings |

> [!NOTE]
> Authentication is managed locally through client session tokens (`AuthContext.jsx`). In compliance with privacy guidelines, no user accounts are sent to external cloud authentication services. See [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md) for details.

---

## Automated Test Suite

Run the automated test suite covering vision quality, detection, recognition, camera abstraction, duplicate prevention, API endpoints, and live RTDB operations:

```powershell
python -m pytest tests/ -v
```

### Actual Test Results (20 Passed)
```
============================= test session starts =============================
platform win32 -- Python 3.13.7, pytest-9.2.0, pluggy-1.7.0
rootdir: C:\classroom_cam
collected 20 items

tests\test_api_endpoints.py::test_api_health PASSED                      [  5%]
tests\test_api_endpoints.py::test_api_camera_status_and_connect PASSED   [ 10%]
tests\test_api_endpoints.py::test_api_attendance_workflow PASSED         [ 15%]
tests\test_api_endpoints.py::test_api_reviews PASSED                     [ 20%]
tests\test_attendance_and_session.py::test_session_lifecycle_and_duplicate_prevention PASSED [ 25%]
tests\test_attendance_and_session.py::test_manual_correction_and_audit_logging PASSED [ 30%]
tests\test_camera_providers.py::test_mock_camera_lifecycle PASSED        [ 35%]
tests\test_camera_providers.py::test_rtsp_camera_credential_masking PASSED [ 40%]
tests\test_camera_providers.py::test_camera_manager_switch PASSED       [ 45%]
tests\test_rtdb_sync.py::test_rtdb_connectivity PASSED                   [ 50%]
tests\test_rtdb_sync.py::test_rtdb_student_crud PASSED                   [ 55%]
tests\test_rtdb_sync.py::test_rtdb_deterministic_attendance_record PASSED [ 60%]
tests\test_rtdb_sync.py::test_rtdb_audit_log_and_review_queue PASSED    [ 65%]
tests\test_rtdb_sync.py::test_biometric_template_privacy_filter PASSED   [ 70%]
tests\test_vision_and_models.py::test_face_detector_initialization PASSED [ 75%]
tests\test_vision_and_models.py::test_face_recognizer_embedding_and_similarity PASSED [ 80%]
tests\test_vision_and_models.py::test_face_tracker PASSED                [ 85%]
tests\test_vision_quality.py::test_quality_validator_sharpness PASSED   [ 90%]
tests\test_vision_quality.py::test_quality_validator_lighting PASSED    [ 95%]
tests\test_vision_quality.py::test_quality_validator_dimensions PASSED  [100%]

======================= 20 passed in 6.34s ========================
```

---

## Deploying Firebase Realtime Database Rules

To deploy the schema validation rules to project `classroomcam-1b81d`:

```powershell
npx firebase login
npx firebase deploy --only database
```

See [docs/RTDB_SECURITY.md](docs/RTDB_SECURITY.md) for the complete security evaluation and schema definitions.
