"""
Pure-Python Lightweight RTSP Test Server.
Implements RFC 2326 (RTSP 1.0) and RFC 2435 (RTP/JPEG video streaming)
over interleaved TCP for 100% reliable local RTSP stream simulation without external dependencies.
"""
import socket
import threading
import time
import re
import cv2
import numpy as np

class RTSPTestServer:
    def __init__(self, host: str = "127.0.0.1", port: int = 8554, stream_path: str = "/live"):
        self.host = host
        self.port = port
        self.stream_path = ("/" + stream_path.lstrip("/")).split("?")[0]
        self._server_sock = None
        self._stop_event = threading.Event()
        self._thread = None
        self.client_count = 0
        self.frames_sent = 0
        self.custom_frame = None

    def start(self) -> bool:
        try:
            self._server_sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            self._server_sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            self._server_sock.bind((self.host, self.port))
            self._server_sock.listen(5)
            self._server_sock.settimeout(1.0)
            self._stop_event.clear()
            self._thread = threading.Thread(target=self._accept_loop, daemon=True)
            self._thread.start()
            print(f"[RTSPTestServer] Serving RTSP on rtsp://{self.host}:{self.port}{self.stream_path}")
            return True
        except Exception as e:
            print(f"[RTSPTestServer] Failed to bind to {self.host}:{self.port}: {e}")
            return False

    def stop(self):
        self._stop_event.set()
        if self._server_sock:
            try:
                self._server_sock.close()
            except Exception:
                pass
        if self._thread and self._thread.is_alive():
            self._thread.join(timeout=2.0)
        print("[RTSPTestServer] Stopped.")

    def _accept_loop(self):
        while not self._stop_event.is_set():
            try:
                client_sock, addr = self._server_sock.accept()
                self.client_count += 1
                t = threading.Thread(target=self._handle_client, args=(client_sock, addr), daemon=True)
                t.start()
            except socket.timeout:
                continue
            except Exception:
                break

    def set_frame(self, frame: np.ndarray):
        """Allows injecting an image/frame with faces for recognition testing."""
        self.custom_frame = frame.copy()

    def _generate_test_frame(self, counter: int) -> bytes:
        if self.custom_frame is not None:
            f = self.custom_frame.copy()
        else:
            f = np.zeros((720, 1280, 3), dtype=np.uint8)
            # Draw synthetic test classroom pattern
            f[:] = (30, 25, 20)
            cv2.rectangle(f, (100, 100), (1180, 620), (50, 45, 40), -1)
            cv2.rectangle(f, (100, 100), (1180, 620), (80, 120, 200), 2)
            cv2.putText(f, f"RTSP IP CAMERA TEST FEED #{counter}", (140, 220),
                        cv2.FONT_HERSHEY_SIMPLEX, 1.2, (0, 255, 200), 3)
            cv2.putText(f, time.strftime("Timestamp: %Y-%m-%d %H:%M:%S"), (140, 300),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.9, (255, 255, 255), 2)

        # Compress to JPEG
        ret, buf = cv2.imencode(".jpg", f, [cv2.IMWRITE_JPEG_QUALITY, 75])
        return buf.tobytes() if ret else b""

    def _handle_client(self, client_sock: socket.socket, addr):
        client_sock.settimeout(4.0)
        session_id = "98765432"
        interleaved_channel = 0
        is_playing = False
        seq_num = 1
        timestamp = 0

        try:
            while not self._stop_event.is_set():
                if not is_playing:
                    data = client_sock.recv(4096)
                    if not data:
                        break
                    request = data.decode("utf-8", errors="ignore")
                    lines = request.splitlines()
                    if not lines:
                        continue

                    req_line = lines[0]
                    parts = req_line.split()
                    if len(parts) < 2:
                        continue
                    method, url = parts[0], parts[1]

                    cseq_match = re.search(r"CSeq:\s*(\d+)", request, re.IGNORECASE)
                    cseq = cseq_match.group(1) if cseq_match else "1"

                    if method == "OPTIONS":
                        resp = (
                            f"RTSP/1.0 200 OK\r\n"
                            f"CSeq: {cseq}\r\n"
                            f"Public: OPTIONS, DESCRIBE, SETUP, TEARDOWN, PLAY\r\n\r\n"
                        )
                        client_sock.sendall(resp.encode())

                    elif method == "DESCRIBE":
                        sdp = (
                            "v=0\r\n"
                            f"o=- 0 0 IN IP4 {self.host}\r\n"
                            "s=SmartClassroom RTSP Stream\r\n"
                            f"c=IN IP4 {self.host}\r\n"
                            "t=0 0\r\n"
                            "m=video 0 RTP/AVP 26\r\n"
                            "a=control:track0\r\n"
                            "a=rtpmap:26 JPEG/90000\r\n"
                        )
                        resp = (
                            f"RTSP/1.0 200 OK\r\n"
                            f"CSeq: {cseq}\r\n"
                            f"Content-Type: application/sdp\r\n"
                            f"Content-Base: rtsp://{self.host}:{self.port}{self.stream_path}/\r\n"
                            f"Content-Length: {len(sdp)}\r\n\r\n"
                            f"{sdp}"
                        )
                        client_sock.sendall(resp.encode())

                    elif method == "SETUP":
                        # Parse transport
                        trans_match = re.search(r"interleaved=(\d+)-(\d+)", request)
                        if trans_match:
                            interleaved_channel = int(trans_match.group(1))

                        resp = (
                            f"RTSP/1.0 200 OK\r\n"
                            f"CSeq: {cseq}\r\n"
                            f"Transport: RTP/AVP/TCP;unicast;interleaved={interleaved_channel}-{interleaved_channel+1}\r\n"
                            f"Session: {session_id}\r\n\r\n"
                        )
                        client_sock.sendall(resp.encode())

                    elif method == "PLAY":
                        resp = (
                            f"RTSP/1.0 200 OK\r\n"
                            f"CSeq: {cseq}\r\n"
                            f"Session: {session_id}\r\n"
                            f"RTP-Info: url=rtsp://{self.host}:{self.port}{self.stream_path}/track0;seq=1;rtptime=0\r\n\r\n"
                        )
                        client_sock.sendall(resp.encode())
                        is_playing = True
                        client_sock.settimeout(0.01)

                    elif method == "TEARDOWN":
                        resp = f"RTSP/1.0 200 OK\r\nCSeq: {cseq}\r\n\r\n"
                        client_sock.sendall(resp.encode())
                        break

                else:
                    # Stream frames continuously
                    # Check if client sent any command (e.g. TEARDOWN)
                    try:
                        cmd = client_sock.recv(1024)
                        if cmd and b"TEARDOWN" in cmd:
                            break
                    except socket.timeout:
                        pass
                    except BlockingIOError:
                        pass

                    frame_bytes = self._generate_test_frame(self.frames_sent)
                    if not frame_bytes:
                        time.sleep(0.05)
                        continue

                    # Send JPEG over RTP (RFC 2435) in chunks <= 1400 bytes
                    max_payload = 1350
                    offset = 0
                    total_len = len(frame_bytes)

                    while offset < total_len and not self._stop_event.is_set():
                        chunk_len = min(max_payload, total_len - offset)
                        is_last = (offset + chunk_len) >= total_len

                        # 12-byte RTP header
                        marker = 1 if is_last else 0
                        rtp_hdr = bytearray(12)
                        rtp_hdr[0] = 0x80 # V=2
                        rtp_hdr[1] = (marker << 7) | 26 # Marker + PT=26 (JPEG)
                        rtp_hdr[2:4] = seq_num.to_bytes(2, "big")
                        rtp_hdr[4:8] = timestamp.to_bytes(4, "big")
                        rtp_hdr[8:12] = (12345678).to_bytes(4, "big")

                        # 8-byte RFC 2435 JPEG header
                        jpeg_hdr = bytearray(8)
                        jpeg_hdr[0] = 0 # Type-specific
                        jpeg_hdr[1:4] = offset.to_bytes(3, "big") # Fragment Offset
                        jpeg_hdr[4] = 1 # Type: 1 (4:2:0)
                        jpeg_hdr[5] = 255 # Q: 255 (Dynamic table)
                        jpeg_hdr[6] = 160 # Width / 8 (1280 / 8 = 160)
                        jpeg_hdr[7] = 90  # Height / 8 (720 / 8 = 90)

                        chunk_data = frame_bytes[offset:offset + chunk_len]
                        rtp_packet = bytes(rtp_hdr) + bytes(jpeg_hdr) + chunk_data

                        # Interleaved TCP encapsulation: $ + channel + len(2 bytes) + packet
                        interleaved_hdr = b"$" + bytes([interleaved_channel]) + len(rtp_packet).to_bytes(2, "big")

                        try:
                            client_sock.sendall(interleaved_hdr + rtp_packet)
                        except Exception:
                            is_playing = False
                            break

                        seq_num = (seq_num + 1) & 0xFFFF
                        offset += chunk_len

                    timestamp = (timestamp + 3600) & 0xFFFFFFFF # 25 FPS (90000 / 25 = 3600)
                    self.frames_sent += 1
                    time.sleep(0.04) # ~25 FPS

        except Exception as e:
            pass
        finally:
            try:
                client_sock.close()
            except Exception:
                pass
