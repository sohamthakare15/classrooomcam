import React, { useState, useEffect, useRef } from 'react';
import { apiService } from '../services/apiService';
import { Video, RefreshCw, ShieldAlert, Camera, SwitchCamera } from 'lucide-react';

export default function CameraFeed({
  isBrowserCamera = false,
  height = "420px"
}) {
  const [streamError, setStreamError] = useState(false);
  const [key, setKey] = useState(0);
  const [facingMode, setFacingMode] = useState('user'); // 'user' (Front) | 'environment' (Back)
  const [browserPermissionError, setBrowserPermissionError] = useState(null);
  const [isCapturing, setIsCapturing] = useState(false);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const overlayCanvasRef = useRef(null);
  const streamRef = useRef(null);

  const streamUrl = `${apiService.getCameraStreamUrl()}?t=${key}`;

  // Handle in-browser local webcam stream via getUserMedia
  useEffect(() => {
    let intervalId = null;

    if (isBrowserCamera) {
      setBrowserPermissionError(null);
      navigator.mediaDevices
        ?.getUserMedia({
          video: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            facingMode: { ideal: facingMode }
          },
          audio: false
        })
        .then((mediaStream) => {
          streamRef.current = mediaStream;
          if (videoRef.current) {
            videoRef.current.srcObject = mediaStream;
          }
          setIsCapturing(true);

          // Ingest frames into AI engine every 350ms and render returned green boxes
          intervalId = setInterval(async () => {
            if (!videoRef.current || !canvasRef.current) return;
            const video = videoRef.current;
            const canvas = canvasRef.current;
            const overlay = overlayCanvasRef.current;
            if (video.videoWidth === 0 || video.videoHeight === 0) return;

            // Frame extraction for AI
            const scale = Math.min(1.0, 640 / video.videoWidth);
            canvas.width = Math.round(video.videoWidth * scale);
            canvas.height = Math.round(video.videoHeight * scale);
            const ctx = canvas.getContext('2d');
            if (!ctx) return;

            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const dataUrl = canvas.toDataURL('image/jpeg', 0.82);

            try {
              const res = await apiService.ingestCameraFrame(dataUrl);

              // Render YOLO/OpenCV-style Green Bounding Boxes on Overlay Canvas
              if (overlay) {
                overlay.width = video.clientWidth || video.videoWidth;
                overlay.height = video.clientHeight || video.videoHeight;
                const oCtx = overlay.getContext('2d');
                if (oCtx) {
                  oCtx.clearRect(0, 0, overlay.width, overlay.height);

                  if (res && res.faces && res.faces.length > 0) {
                    const scaleX = overlay.width / canvas.width;
                    const scaleY = overlay.height / canvas.height;

                    res.faces.forEach((face) => {
                      const [bx, by, bw, bh] = face.bbox;
                      const x = bx * scaleX;
                      const y = by * scaleY;
                      const w = bw * scaleX;
                      const h = bh * scaleY;

                      // 1. Vibrant Green Bounding Box
                      oCtx.strokeStyle = '#00FF66';
                      oCtx.lineWidth = 2.5;
                      oCtx.strokeRect(x, y, w, h);

                      // 2. High-Tech YOLO Corner Brackets
                      const cLen = Math.max(10, Math.min(w, h) * 0.25);
                      oCtx.strokeStyle = '#00FF00';
                      oCtx.lineWidth = 4;
                      oCtx.beginPath();
                      // Top-Left
                      oCtx.moveTo(x, y + cLen);
                      oCtx.lineTo(x, y);
                      oCtx.lineTo(x + cLen, y);
                      // Top-Right
                      oCtx.moveTo(x + w - cLen, y);
                      oCtx.lineTo(x + w, y);
                      oCtx.lineTo(x + w, y + cLen);
                      // Bottom-Left
                      oCtx.moveTo(x, y + h - cLen);
                      oCtx.lineTo(x, y + h);
                      oCtx.lineTo(x + cLen, y + h);
                      // Bottom-Right
                      oCtx.moveTo(x + w - cLen, y + h);
                      oCtx.lineTo(x + w, y + h);
                      oCtx.lineTo(x + w, y + h - cLen);
                      oCtx.stroke();

                      // 3. Label Tag above box
                      const label = face.label || 'STUDENT FACE';
                      oCtx.font = 'bold 12px "JetBrains Mono", monospace';
                      const textWidth = oCtx.measureText(label).width;
                      const tagHeight = 22;
                      const tagY = Math.max(0, y - tagHeight);

                      // Background badge
                      oCtx.fillStyle = 'rgba(15, 23, 42, 0.9)';
                      oCtx.fillRect(x, tagY, textWidth + 12, tagHeight);
                      oCtx.strokeStyle = '#00FF66';
                      oCtx.lineWidth = 1;
                      oCtx.strokeRect(x, tagY, textWidth + 12, tagHeight);

                      // Text
                      oCtx.fillStyle = '#00FF66';
                      oCtx.fillText(label, x + 6, tagY + 15);
                    });
                  }
                }
              }
            } catch (_) {}
          }, 350);
        })
        .catch((err) => {
          console.warn("Browser camera access denied or unavailable:", err);
          setBrowserPermissionError(err.message || 'Camera permission denied in browser.');
          setIsCapturing(false);
        });
    } else {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
      setIsCapturing(false);
      if (overlayCanvasRef.current) {
        const oCtx = overlayCanvasRef.current.getContext('2d');
        if (oCtx) oCtx.clearRect(0, 0, overlayCanvasRef.current.width, overlayCanvasRef.current.height);
      }
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
    };
  }, [isBrowserCamera, facingMode, key]);

  const handleToggleFacingMode = () => {
    setFacingMode((prev) => (prev === 'user' ? 'environment' : 'user'));
  };

  const handleReload = () => {
    setStreamError(false);
    setKey((prev) => prev + 1);
  };

  return (
    <div className="enterprise-card overflow-hidden flex flex-col bg-slate-950 text-white select-none">
      {/* Hidden canvas for background frame ingestion */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Top Stream Header */}
      <div className="px-4 py-2.5 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-300">
            {isBrowserCamera ? 'Live Web Camera (YuNet & OpenCV AI Active)' : 'Live AI Optical Recognition Feed'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {isBrowserCamera ? (
            <>
              <button
                type="button"
                onClick={handleToggleFacingMode}
                title={facingMode === 'user' ? 'Switch to Back Camera' : 'Switch to Front Camera'}
                className="bg-[#ea580c] hover:bg-[#c2410c] text-white text-[11px] font-semibold px-2.5 py-1 rounded flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <SwitchCamera className="w-3.5 h-3.5" />
                <span>{facingMode === 'user' ? 'Back Cam' : 'Front Cam'}</span>
              </button>
              <span className="hidden sm:flex bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[11px] font-semibold px-2 py-0.5 rounded items-center gap-1">
                <Camera className="w-3 h-3" />
                {facingMode === 'user' ? 'FRONT CAM' : 'BACK CAM'}
              </span>
            </>
          ) : (
            <span className="bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 text-[11px] font-semibold px-2 py-0.5 rounded flex items-center gap-1">
              <Video className="w-3 h-3" />
              RTSP IP STREAM
            </span>
          )}
          <button
            onClick={handleReload}
            title="Reload Video Stream"
            className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-white rounded transition-colors cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Video Stream Canvas */}
      <div className="relative flex items-center justify-center bg-black overflow-hidden" style={{ minHeight: height }}>
        {isBrowserCamera ? (
          browserPermissionError ? (
            <div className="text-center p-8 space-y-3">
              <ShieldAlert className="w-10 h-10 text-rose-500 mx-auto" />
              <div className="text-sm font-bold text-slate-200">Browser Camera Permission Required</div>
              <p className="text-xs text-slate-400 max-w-sm">
                Please tap "Allow" in your browser prompt to let SmartClass AI access your laptop camera.
              </p>
              <button
                onClick={handleReload}
                className="enterprise-btn-primary text-xs mx-auto mt-2"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Request Permission Again
              </button>
            </div>
          ) : (
            <div className="relative w-full h-full flex items-center justify-center">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-auto object-contain max-h-[500px]"
              />
              {/* High-Precision YOLO/OpenCV Overlay Canvas */}
              <canvas
                ref={overlayCanvasRef}
                className="absolute inset-0 w-full h-full pointer-events-none"
              />
            </div>
          )
        ) : streamError ? (
          <div className="text-center p-8 space-y-3">
            <ShieldAlert className="w-10 h-10 text-amber-500 mx-auto" />
            <div className="text-sm font-medium text-slate-300">Camera Feed Disconnected</div>
            <p className="text-xs text-slate-500 max-w-sm">
              Ensure the camera is streaming and network connectivity is active.
            </p>
            <button
              onClick={handleReload}
              className="enterprise-btn-primary text-xs mx-auto"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Retry Stream
            </button>
          </div>
        ) : (
          <img
            src={streamUrl}
            alt="AI Facial Recognition Stream"
            onError={() => setStreamError(true)}
            className="w-full h-auto object-contain max-h-[500px]"
          />
        )}
      </div>
    </div>
  );
}
