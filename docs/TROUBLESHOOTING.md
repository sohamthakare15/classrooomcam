# SmartClassroom AI Attendance — Troubleshooting Guide

This guide covers common diagnostic issues, environment conflicts, and troubleshooting steps for the SmartClassroom AI Attendance application on Windows 10/11.

---

## 1. Quick Emergency Cleanup

If any process hangs, ports remain occupied, or an instance fails to close properly, run:

```powershell
.\STOP_SMARTCLASSROOM.bat
```

This script cleanly:
- Terminates any process listening on port **8000** (FastAPI backend).
- Terminates any process listening on port **5173** (Vite frontend server).
- Terminates orphaned `electron.exe` processes.

---

## 2. Electron Startup: "ELECTRON_RUN_AS_NODE" Issue

### Symptom:
Electron exits immediately or prints `TypeError: Cannot read properties of undefined (reading 'handle')` or runs in Node mode instead of rendering the GUI window.

### Root Cause:
Windows terminals, VS Code, or parent Node processes may set the environment variable `ELECTRON_RUN_AS_NODE=1`. When this variable is present, Electron's binary executes as regular `node.exe` rather than the Electron runtime, causing `require('electron')` to resolve to the path of the executable string rather than the Electron API module.

### Solution:
1. **Pre-configured in launch scripts**: Both `START_SMARTCLASSROOM.bat` and `START_BROWSER_DASHBOARD.bat` automatically execute:
   ```cmd
   set ELECTRON_RUN_AS_NODE=
   ```
2. **Defensive runtime self-healing**: `desktop/electron/main.js` detects if `require('electron')` is a string, strips `ELECTRON_RUN_AS_NODE` from `process.env`, and respawns cleanly.
3. If running manually in PowerShell:
   ```powershell
   Remove-Item Env:\ELECTRON_RUN_AS_NODE -ErrorAction SilentlyContinue
   npx electron desktop/electron/main.js
   ```

---

## 3. Port Conflicts (Ports 8000 & 5173)

### Symptom:
- FastAPI backend fails with `[Errno 10048] error while attempting to bind on address ('127.0.0.1', 8000): only one usage of each socket address is normally permitted`.
- Vite dev server starts on `http://localhost:5174` instead of `5173`.

### Diagnostic:
Check what is occupying port 8000 or 5173:
```powershell
netstat -ano | findstr :8000
netstat -ano | findstr :5173
```

### Solution:
Run `.\STOP_SMARTCLASSROOM.bat` or manually terminate the PID:
```powershell
Stop-Process -Id <PID> -Force
```

---

## 4. AI Vision Models Not Found

### Symptom:
FastAPI log warns:
```
[AI VISION] WARNING: YuNet/SFace ONNX weights not found.
```
Or face recognition returns synthetic/dummy detections.

### Diagnostic:
Verify that the model files exist in `ai_engine/models/`:
- `ai_engine/models/face_detection_yunet_2023mar.onnx` (~337 KB)
- `ai_engine/models/face_recognition_sface_2021dec.onnx` (~1.27 MB)

### Solution:
Re-run the automated model downloader:
```powershell
python scripts\download_models.py
```
If downloading behind a corporate proxy or firewall:
1. Manually download `face_detection_yunet_2023mar.onnx` and `face_recognition_sface_2021dec.onnx` from the official OpenCV Zoo repository.
2. Place both `.onnx` files directly into `C:\classroom_cam\ai_engine\models\`.

---

## 5. Camera Feed Issues

### A. Laptop Webcam Not Opening
- **Symptom**: Black screen or `[WEBCAM] DirectShow index 0 failed to open`.
- **Cause**: Windows Camera privacy settings or another app (Zoom, Teams, Chrome) is holding an exclusive handle to the webcam.
- **Fix**:
  1. Open Windows Settings -> **Privacy & Security** -> **Camera**. Ensure "Let apps access your camera" is **On**.
  2. Close any apps currently using the webcam.
  3. In `Camera Settings` in the dashboard, switch provider to **Webcam (USB/Integrated)** and test index `0` or `1`.

### B. RTSP IP Camera Disconnects or Latency
- **Symptom**: Stream buffer lag or frequent disconnect warnings.
- **Cause**: Unstable Wi-Fi or RTSP sub-stream misconfiguration.
- **Fix**:
  1. For IP cameras, always use the **sub-stream** RTSP URL (e.g., 720p/1080p @ 15fps) rather than full 4K stream to preserve local CPU for face recognition.
  2. The system has built-in exponential backoff auto-reconnect (`ai_engine/camera/rtsp_camera.py`).

### C. Testing Without Any Physical Hardware
- Open **Camera Settings** in the dashboard and select **Mock Camera (Simulation)**.
- The mock camera renders a high-contrast simulated classroom feed with animated faces and a prominent `[SIMULATION MODE]` banner for testing all attendance flows.

---

## 6. Firebase Realtime Database (RTDB) Issues

### A. Sync Status Shows "Offline" or Sync Requests Fail
- **Status is Expected Offline**: The application has an embedded durable SQLite queue (`storage/offline_queue.db`). When offline, all student registrations, attendance sessions, and attendance marks are safely committed to local SQLite first.
- **Syncing to RTDB**: Once internet connectivity is available, the teacher can click **Sync with Cloud** on the dashboard, which calls `/sync/rtdb/push`.

### B. "Permission Denied" on RTDB
- Ensure the rules in `firebase/database.rules.json` are deployed to project `classroomcam-1b81d`:
  ```powershell
  npx firebase deploy --only database
  ```
- Note: Biometric face templates are **strictly blocked** by the database validation rules (`!newData.hasChildren(['embedding', 'biometricTemplate'])`). This is a security and privacy safeguard.

---

## 7. Login and Faculty Credentials

- Default Teacher: `teacher@school.edu` / `password123`
- Default Administrator: `admin@school.edu` / `password123`
- Session persistence uses local browser storage in `AuthContext.jsx`. Clearing browser cache / localStorage resets the session to the login screen.

