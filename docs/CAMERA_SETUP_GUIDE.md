# Camera Integration & Hardware Setup Guide

The **SmartClassroom AI Attendance System** connects seamlessly to:
1. **Integrated Laptop Webcams & USB Webcams** (Recommended for immediate testing and personal teacher laptops).
2. **Enterprise RTSP IP Cameras** (For permanent classroom ceiling / whiteboard installations).
3. **Local Video Recordings** (For offline evaluation and demonstrations).
4. **Synthetic Classroom Simulation** (For zero-hardware pipeline testing).

---

## 1. Laptop Built-in Webcam & USB Cameras (Primary Mode)

### Overview
- Uses **OpenCV VideoCapture** with the Windows **DirectShow (`CAP_DSHOW`)** backend for ultra-low latency hardware capture.
- Runs an isolated worker thread so UI and AI inference loops never suffer from frame-buffer lag.
- Default resolution: **1280x720 HD** (configurable up to 1080p).
- Default device index: `0` (Integrated laptop webcam).

### Connecting Your Laptop Webcam
1. Open the dashboard (Desktop app or `http://localhost:5173`).
2. Navigate to **Camera Settings** in the sidebar.
3. The **Laptop Webcam** tab is selected by default.
4. Click **Scan Devices** to auto-detect attached webcams.
5. Choose your capture resolution:
   - **1280 x 720 (HD)**: Optimal balance of recognition accuracy and CPU performance.
   - **640 x 480 (SD)**: Battery saver / lower CPU usage.
   - **1920 x 1080 (Full HD)**: High-detail classroom wide capture.
6. Click **Test Camera** to verify the optical sensor.
7. Click **Connect Laptop Webcam** to activate the live stream.
8. To release the hardware at any time, click **Disconnect Camera**.

### Windows Permissions & Troubleshooting
- **Windows Camera Privacy**: Go to Windows Settings -> **Privacy & Security** -> **Camera**. Ensure "Let apps access your camera" is **On**.
- **Device Busy / In Use**: If another app (Teams, Zoom, Google Meet, or browser tab) is holding the webcam handle, close that app and click **Connect Laptop Webcam** again.
- **Multiple Cameras**: If you have an external USB webcam connected alongside your built-in camera, click **Scan Devices** and choose Camera `1` from the dropdown.

---

## 2. Enterprise IP Cameras (RTSP)

- **Protocols**: RTSP (`rtsp://`), ONVIF Profile S.
- **Recommended Placement**: Mount camera 2.2m – 2.8m high on the front ceiling or above the whiteboard angled at 15° – 25° downwards.

### Common RTSP URL Formats
- **Hikvision**: `rtsp://<username>:<password>@<ip_address>:554/Streaming/Channels/102` (Sub Stream)
- **Dahua**: `rtsp://<username>:<password>@<ip_address>:554/cam/realmonitor?channel=1&subtype=1`
- **Reolink**: `rtsp://<username>:<password>@<ip_address>:554/h264Preview_01_main`
- **TP-Link Tapo**: `rtsp://<username>:<password>@<ip_address>:554/stream2`

---

## 3. Privacy & Biometric Security
- **Local Video Processing**: All camera frames are processed exclusively in local RAM and discarded immediately.
- **No Video Uploads**: Video frames and webcam snapshots are **never** uploaded to Firebase Realtime Database or any external server.
- **Biometric Templates**: Encrypted locally with AES-GCM (Fernet) in `storage/templates/*.enc`.
