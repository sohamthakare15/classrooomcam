import React, { useState, useEffect, useRef } from 'react';
import { apiService } from '../services/apiService';
import { Video, RefreshCw, ShieldAlert, Camera, CheckCircle2 } from 'lucide-react';

export default function CameraFeed({
  isSimulation = true,
  isBrowserCamera = false,
  height = "420px"
}) {
  const [streamError, setStreamError] = useState(false);
  const [key, setKey] = useState(0);
  const [browserPermissionError, setBrowserPermissionError] = useState(null);
  const [isCapturing, setIsCapturing] = useState(false);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
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
            facingMode: 'user'
          },
          audio: false
        })
        .then((mediaStream) => {
          streamRef.current = mediaStream;
          if (videoRef.current) {
            videoRef.current.srcObject = mediaStream;
          }
          setIsCapturing(true);

          // Ingest frames into AI engine every 400ms
          intervalId = setInterval(() => {
            if (!videoRef.current || !canvasRef.current) return;
            const video = videoRef.current;
            const canvas = canvasRef.current;
            if (video.videoWidth === 0 || video.videoHeight === 0) return;

            canvas.width = Math.min(video.videoWidth, 640);
            canvas.height = Math.min(video.videoHeight, 480);
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
              const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
              apiService.ingestCameraFrame(dataUrl).catch(() => {});
            }
          }, 400);
        })
        .catch((err) => {
          console.warn("Browser camera access denied or unavailable:", err);
          setBrowserPermissionError(err.message || 'Camera permission denied in browser.');
          setIsCapturing(false);
        });
    } else {
      // Clean up browser camera stream when switching away
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
      setIsCapturing(false);
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
    };
  }, [isBrowserCamera, key]);

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
            {isBrowserCamera ? 'Direct Browser Web Camera (YuNet AI Synced)' : 'Live AI Optical Recognition Feed'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {isBrowserCamera && (
            <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[11px] font-semibold px-2 py-0.5 rounded flex items-center gap-1">
              <Camera className="w-3 h-3" />
              PHYSICAL WEBCAM ACTIVE
            </span>
          )}
          {!isBrowserCamera && isSimulation && (
            <span className="bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[11px] font-semibold px-2 py-0.5 rounded">
              SIMULATION MODE
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
      <div className="relative flex items-center justify-center bg-black" style={{ minHeight: height }}>
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
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-auto object-contain max-h-[500px]"
            />
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
