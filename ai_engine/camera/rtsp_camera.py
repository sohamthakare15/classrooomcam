"""
RTSP IP Camera Provider.
Connects to hardware IP cameras over local Wi-Fi / LAN via RTSP with thread-buffered
zero-latency reading, automatic reconnection on network drop, TCP transport,
and strictly masked credential security.
"""
import os
import time
import socket
import threading
import urllib.parse
from typing import Tuple, Optional, Dict, Any
import cv2
import numpy as np
from ai_engine.camera.base import BaseCamera, CameraStatus

class RTSPCamera(BaseCamera):
    def __init__(
        self,
        rtsp_url: Optional[str] = None,
        ip: Optional[str] = None,
        port: int = 554,
        stream_path: str = "/h264Preview_01_main",
        name: str = "External IP Camera",
        username: Optional[str] = None,
        password: Optional[str] = None,
        transport: str = "tcp",
        reconnect_interval_sec: float = 2.0,
        timeout_sec: float = 5.0
    ):
        super().__init__(name)
        self.ip = ip.strip() if ip else None
        self.port = int(port) if port else 554
        self.stream_path = ("/" + stream_path.lstrip("/")) if stream_path else "/h264Preview_01_main"
        self.username = username.strip() if username else None
        self.password = password.strip() if password else None
        self.transport = transport.lower() if transport in ["tcp", "udp"] else "tcp"
        self.reconnect_interval = reconnect_interval_sec
        self.timeout_sec = timeout_sec

        # URL composition
        if rtsp_url and rtsp_url.strip():
            self.raw_rtsp_url = rtsp_url.strip()
            # Try to extract IP and port if not supplied
            try:
                parsed = urllib.parse.urlsplit(self.raw_rtsp_url)
                if parsed.hostname and not self.ip:
                    self.ip = parsed.hostname
                if parsed.port and self.port == 554:
                    self.port = parsed.port
            except Exception:
                pass
        elif self.ip:
            self.raw_rtsp_url = f"rtsp://{self.ip}:{self.port}{self.stream_path}"
        else:
            self.raw_rtsp_url = "rtsp://127.0.0.1:554/live"

        self._stop_event = threading.Event()
        self._thread: Optional[threading.Thread] = None
        self._lock = threading.Lock()
        self._latest_frame: Optional[np.ndarray] = None
        self._last_frame_time = 0.0
        self._current_reconnect_delay = self.reconnect_interval

    def _build_authenticated_url(self) -> str:
        """Constructs full RTSP URL with URL-encoded credentials if present."""
        url = self.raw_rtsp_url.strip()
        if self.username and self.password and "@" not in url:
            if url.startswith("rtsp://"):
                user_enc = urllib.parse.quote(self.username, safe="")
                pass_enc = urllib.parse.quote(self.password, safe="")
                url = f"rtsp://{user_enc}:{pass_enc}@{url[7:]}"
        return url

    def get_masked_url(self) -> str:
        """Returns sanitized RTSP URL safe for logging, telemetry and UI rendering."""
        url = self.raw_rtsp_url
        if "@" in url:
            prefix, rest = url.split("@", 1)
            scheme = prefix.split("://")[0]
            return f"{scheme}://***:***@{rest}"
        elif self.username:
            if url.startswith("rtsp://"):
                return f"rtsp://***:***@{url[7:]}"
        return url

    def start(self) -> bool:
        if self.status == CameraStatus.CONNECTED or (self._thread and self._thread.is_alive()):
            return True

        self._stop_event.clear()
        self.status = CameraStatus.CONNECTING
        self._thread = threading.Thread(target=self._capture_loop, daemon=True)
        self._thread.start()
        print(f"[RTSPCamera] Starting background capture thread for {self.get_masked_url()} (Transport: {self.transport})")
        return True

    def stop(self):
        self._stop_event.set()
        if self._thread and self._thread.is_alive():
            self._thread.join(timeout=2.5)
        self.status = CameraStatus.DISCONNECTED
        with self._lock:
            self._latest_frame = None
        print(f"[RTSPCamera] Stopped RTSP camera {self.name} and released stream.")

    def _capture_loop(self):
        """Dedicated background thread to consume frames, manage buffer, and auto-reconnect."""
        full_url = self._build_authenticated_url()

        # Configure OpenCV FFmpeg environment options for robust TCP RTSP streaming
        os.environ["OPENCV_FFMPEG_CAPTURE_OPTIONS"] = f"rtsp_transport;{self.transport}|stimeout;5000000"

        while not self._stop_event.is_set():
            try:
                self.status = CameraStatus.CONNECTING
                cap = cv2.VideoCapture(full_url, cv2.CAP_FFMPEG)
                cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)

                if not cap.isOpened():
                    self.status = CameraStatus.RECONNECTING
                    self.last_error = f"Cannot connect to RTSP camera at {self.get_masked_url()}. Check IP, port, and credentials."
                    cap.release()
                    self._wait_with_backoff()
                    continue

                # Test reading the first frame
                ret, frame = cap.read()
                if not ret or frame is None:
                    self.status = CameraStatus.RECONNECTING
                    self.last_error = "Connected to RTSP endpoint but failed to read initial frame."
                    cap.release()
                    self._wait_with_backoff()
                    continue

                # Successfully connected and confirmed stream
                self.status = CameraStatus.CONNECTED
                self._current_reconnect_delay = self.reconnect_interval
                self.last_error = None
                self.width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH)) or frame.shape[1]
                self.height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT)) or frame.shape[0]
                self.fps = float(cap.get(cv2.CAP_PROP_FPS)) or 25.0
                if self.fps <= 0 or self.fps > 120:
                    self.fps = 25.0

                with self._lock:
                    self._latest_frame = frame
                    self._last_frame_time = time.time()
                    self.frame_count += 1

                print(f"[RTSPCamera] Stream CONNECTED: {self.name} ({self.width}x{self.height} @ {self.fps:.1f} FPS)")

                # Continuous low-latency frame grabber loop
                while not self._stop_event.is_set():
                    # grab() immediately dumps stale decoded buffer
                    if not cap.grab():
                        self.status = CameraStatus.RECONNECTING
                        self.last_error = "RTSP frame stream dropped by remote camera"
                        break

                    ret, frame = cap.retrieve()
                    if not ret or frame is None:
                        self.status = CameraStatus.RECONNECTING
                        self.last_error = "Frame decode failed from RTSP stream"
                        break

                    with self._lock:
                        self._latest_frame = frame
                        self._last_frame_time = time.time()
                        self.frame_count += 1

                cap.release()

            except Exception as e:
                self.status = CameraStatus.ERROR
                self.last_error = f"RTSP network error: {str(e)}"
                self._wait_with_backoff()

        self.status = CameraStatus.DISCONNECTED

    def _wait_with_backoff(self):
        """Sleeps with exponential backoff up to a 10s ceiling, interruptible by stop event."""
        sleep_target = self._current_reconnect_delay
        step = 0.2
        elapsed = 0.0
        while elapsed < sleep_target and not self._stop_event.is_set():
            time.sleep(step)
            elapsed += step
        # Increase backoff for next attempt
        self._current_reconnect_delay = min(10.0, self._current_reconnect_delay * 1.5)

    def get_frame(self) -> Tuple[bool, Optional[np.ndarray]]:
        with self._lock:
            if self._latest_frame is not None:
                # Detect frozen stream (> timeout_sec seconds since last packet)
                if time.time() - self._last_frame_time > self.timeout_sec:
                    self.status = CameraStatus.RECONNECTING
                    return False, None
                return True, self._latest_frame.copy()
            return False, None

    def get_info(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            "type": "RTSP",
            "ip": self.ip,
            "port": self.port,
            "stream_path": self.stream_path,
            "url": self.get_masked_url(),
            "transport": self.transport,
            "status": self.status.value,
            "resolution": f"{self.width}x{self.height}",
            "fps": self.fps,
            "frame_count": self.frame_count,
            "last_error": self.last_error
        }

    @classmethod
    def test_connection(cls, config: Dict[str, Any], timeout_sec: float = 4.0) -> Dict[str, Any]:
        """
        Non-invasive connection test.
        First checks socket reachability, then attempts a brief single-frame fetch in a worker thread.
        Never blocks indefinitely.
        """
        ip = config.get("ip")
        port = int(config.get("port", 554))
        raw_url = config.get("rtspUrl", config.get("rtsp_url", ""))
        username = config.get("username")
        password = config.get("password")
        stream_path = config.get("streamPath", config.get("stream_path", "/h264Preview_01_main"))

        # If IP is provided, test TCP socket reachability first
        target_ip = ip
        target_port = port
        if not target_ip and raw_url:
            try:
                parsed = urllib.parse.urlsplit(raw_url)
                target_ip = parsed.hostname
                if parsed.port:
                    target_port = parsed.port
            except Exception:
                pass

        if target_ip:
            try:
                sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
                sock.settimeout(2.0)
                res = sock.connect_ex((target_ip, target_port))
                sock.close()
                if res != 0:
                    return {
                        "success": False,
                        "error": f"Camera host at {target_ip}:{target_port} is offline or unreachable on your local network."
                    }
            except Exception as e:
                return {
                    "success": False,
                    "error": f"Socket connection failed to {target_ip}:{target_port}: {str(e)}"
                }

        # Build full URL
        if not raw_url and target_ip:
            path = ("/" + stream_path.lstrip("/")) if stream_path else ""
            raw_url = f"rtsp://{target_ip}:{target_port}{path}"

        if not raw_url:
            return {"success": False, "error": "RTSP URL or Camera IP must be specified."}

        full_url = raw_url
        if username and password and "@" not in full_url:
            if full_url.startswith("rtsp://"):
                user_enc = urllib.parse.quote(username, safe="")
                pass_enc = urllib.parse.quote(password, safe="")
                full_url = f"rtsp://{user_enc}:{pass_enc}@{full_url[7:]}"

        result = {"success": False, "error": "Connection timed out."}
        probe_event = threading.Event()

        def _probe_worker():
            nonlocal result
            os.environ["OPENCV_FFMPEG_CAPTURE_OPTIONS"] = "rtsp_transport;tcp|stimeout;3000000"
            cap = None
            try:
                cap = cv2.VideoCapture(full_url, cv2.CAP_FFMPEG)
                if not cap.isOpened():
                    result = {
                        "success": False,
                        "error": "Failed to open RTSP stream. Verify stream path, username, and password."
                    }
                    return

                ret, frame = cap.read()
                if ret and frame is not None:
                    h, w = frame.shape[:2]
                    fps = cap.get(cv2.CAP_PROP_FPS) or 25.0
                    result = {
                        "success": True,
                        "message": f"RTSP Stream verified successfully! Resolution: {w}x{h}, FPS: {fps:.1f}",
                        "resolution": f"{w}x{h}",
                        "fps": round(fps, 1)
                    }
                else:
                    result = {
                        "success": False,
                        "error": "Stream opened, but remote camera did not send any video frames."
                    }
            except Exception as ex:
                result = {"success": False, "error": f"Stream capture test error: {str(ex)}"}
            finally:
                if cap is not None:
                    cap.release()
                probe_event.set()

        t = threading.Thread(target=_probe_worker, daemon=True)
        t.start()
        probe_event.wait(timeout=timeout_sec)

        return result
