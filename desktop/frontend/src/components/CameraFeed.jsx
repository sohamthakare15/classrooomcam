import React, { useState } from 'react';
import { apiService } from '../services/apiService';
import { Video, RefreshCw, Maximize2, ShieldAlert } from 'lucide-react';

export default function CameraFeed({ isSimulation = true, height = "420px" }) {
  const [streamError, setStreamError] = useState(false);
  const [key, setKey] = useState(0);

  const streamUrl = `${apiService.getCameraStreamUrl()}?t=${key}`;

  const handleReload = () => {
    setStreamError(false);
    setKey(prev => prev + 1);
  };

  return (
    <div className="enterprise-card overflow-hidden flex flex-col bg-slate-950 text-white">
      {/* Top Stream Header */}
      <div className="px-4 py-2.5 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-300">
            Live Recognition Feed
          </span>
        </div>
        <div className="flex items-center gap-2">
          {isSimulation && (
            <span className="bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[11px] font-semibold px-2 py-0.5 rounded">
              SIMULATION MODE
            </span>
          )}
          <button
            onClick={handleReload}
            title="Reload Video Stream"
            className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-white rounded transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Video Content */}
      <div className="relative flex items-center justify-center bg-black" style={{ minHeight: height }}>
        {streamError ? (
          <div className="text-center p-8 space-y-3">
            <ShieldAlert className="w-10 h-10 text-amber-500 mx-auto" />
            <div className="text-sm font-medium text-slate-300">Camera Feed Disconnected</div>
            <p className="text-xs text-slate-500 max-w-sm">
              Ensure the Python AI backend service is running and the camera provider is active.
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

