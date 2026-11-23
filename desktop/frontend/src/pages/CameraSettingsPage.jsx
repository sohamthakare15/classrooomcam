import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Camera,
  CheckCircle2,
  Video,
  Play,
  ArrowRight,
  Sparkles,
  ShieldCheck,
  RefreshCw
} from 'lucide-react';
import { apiService } from '../services/apiService';
import CameraFeed from '../components/CameraFeed';

export default function CameraSettingsPage() {
  const navigate = useNavigate();
  const [cameraStatus, setCameraStatus] = useState({
    status: 'CONNECTED',
    type: 'WEBCAM',
    resolution: '1280x720',
    name: 'Integrated Laptop Webcam'
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadCameraStatus();
    const interval = setInterval(loadCameraStatus, 3000);
    return () => clearInterval(interval);
  }, []);

  const loadCameraStatus = async () => {
    try {
      const status = await apiService.getCameraStatus();
      if (status) {
        setCameraStatus(status);
      }
    } catch (_) {}
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Camera Feed & Optical View</h1>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/60">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              Live Feed Active
            </span>
          </div>
          <p className="text-xs text-slate-500 font-medium mt-1">
            Integrated Laptop Webcam stream with YuNet face detection and SFace biometric identification.
          </p>
        </div>

        <button
          onClick={() => navigate('/attendance')}
          className="enterprise-btn-primary"
        >
          <Play className="w-4 h-4 fill-white" />
          <span>Start Attendance</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      {/* Main Grid: Feed & Device Info */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Live Video Feed Card */}
        <div className="lg:col-span-2 space-y-4">
          <div className="enterprise-card p-4 overflow-hidden">
            <CameraFeed isSimulation={false} height="400px" />
          </div>
        </div>

        {/* Right: Camera Details Card in Wink Style */}
        <div className="space-y-5">
          <div className="glass-card p-6 space-y-4 border border-white/90">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-[#FFF2EE] text-[#FF5A36] flex items-center justify-center font-bold">
                <Camera className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Webcam Hardware</h3>
                <span className="text-[11px] text-slate-400 font-medium">DirectShow Hardware Video</span>
              </div>
            </div>

            <div className="space-y-3 pt-2 text-xs">
              <div className="flex items-center justify-between py-2 border-b border-slate-100">
                <span className="text-slate-500 font-medium">Device</span>
                <span className="font-bold text-slate-800">{cameraStatus.name || 'Integrated Laptop Webcam'}</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-slate-100">
                <span className="text-slate-500 font-medium">Status</span>
                <span className="inline-flex items-center gap-1.5 font-bold text-emerald-600 bg-emerald-50 px-2.5 py-0.5 rounded-full">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Connected
                </span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-slate-100">
                <span className="text-slate-500 font-medium">Resolution</span>
                <span className="font-mono font-bold text-slate-800">{cameraStatus.resolution || '1280x720 HD'}</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-slate-100">
                <span className="text-slate-500 font-medium">Framerate</span>
                <span className="font-mono font-bold text-slate-800">{cameraStatus.fps || 30.0} FPS</span>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-slate-500 font-medium">Biometric Models</span>
                <span className="font-bold text-[#FF5A36] bg-[#FFF2EE] px-2 py-0.5 rounded-full">YuNet + SFace</span>
              </div>
            </div>

            <div className="pt-3">
              <button
                onClick={() => navigate('/attendance')}
                className="w-full enterprise-btn-primary justify-center text-xs"
              >
                <Play className="w-3.5 h-3.5 fill-white" />
                <span>Launch Attendance Session</span>
              </button>
            </div>
          </div>

          <div className="glass-card p-5 border border-white/90 text-xs text-slate-600 space-y-2">
            <div className="flex items-center gap-2 font-bold text-slate-800">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Edge AI Biometrics</span>
            </div>
            <p className="text-[11px] leading-relaxed text-slate-500">
              Facial features are captured, detected, and matched on your local device. No biometric video feeds are sent to cloud servers without authorization.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
