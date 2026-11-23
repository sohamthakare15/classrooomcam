import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Camera,
  Video,
  Radio,
  Play,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Sliders,
  Power,
  Tv,
  Wifi,
  MonitorCheck,
  Settings2
} from 'lucide-react';
import { apiService } from '../services/apiService';
import CameraFeed from '../components/CameraFeed';

export default function CameraSettingsPage() {
  const navigate = useNavigate();

  // Active Hardware Status
  const [cameraStatus, setCameraStatus] = useState({
    status: 'CONNECTED',
    type: 'MOCK',
    resolution: '1280x720',
    fps: 30,
    name: 'Integrated Classroom Camera'
  });

  // Selected Configuration Mode Tab: 'WEBCAM' | 'RTSP' | 'MOCK'
  const [activeTab, setActiveTab] = useState('WEBCAM');

  // Webcam State
  const [deviceIndex, setDeviceIndex] = useState(0);
  const [webcamResolution, setWebcamResolution] = useState('1280x720');

  // RTSP / IP Camera State
  const [rtspUrl, setRtspUrl] = useState('');
  const [rtspIp, setRtspIp] = useState('');
  const [rtspPort, setRtspPort] = useState(554);
  const [rtspUser, setRtspUser] = useState('');
  const [rtspPass, setRtspPass] = useState('');
  const [rtspPath, setRtspPath] = useState('/live/ch0');
  const [rtspTransport, setRtspTransport] = useState('tcp');
  const [useDirectUrl, setUseDirectUrl] = useState(true);

  // Action status indicators
  const [actionLoading, setActionLoading] = useState(false);
  const [feedback, setFeedback] = useState({ text: '', type: '' });

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
        if (status.type && !['WEBCAM', 'RTSP', 'MOCK'].includes(activeTab)) {
          setActiveTab(status.type);
        }
      }
    } catch (_) {}
  };

  const showFeedback = (text, type = 'success') => {
    setFeedback({ text, type });
    setTimeout(() => setFeedback({ text: '', type: '' }), 5000);
  };

  // 1. Connect Laptop / USB Webcam
  const handleConnectWebcam = async () => {
    setActionLoading(true);
    const [w, h] = webcamResolution.split('x').map(Number);
    try {
      const res = await apiService.connectCamera({
        cameraType: 'WEBCAM',
        name: `Physical Webcam (Device ${deviceIndex})`,
        deviceIndex: parseInt(deviceIndex, 10),
        width: w || 1280,
        height: h || 720,
        fps: 30.0
      });
      if (res.success) {
        showFeedback(`Switched to Laptop / USB Webcam (Device ${deviceIndex}) successfully!`, 'success');
        loadCameraStatus();
      } else {
        showFeedback(res.error || 'Failed to connect to webcam.', 'error');
      }
    } catch (err) {
      showFeedback(err.message || 'Webcam connection error.', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // 2. Connect RTSP IP Camera
  const handleConnectRTSP = async () => {
    setActionLoading(true);
    let fullUrl = rtspUrl.trim();
    if (!useDirectUrl) {
      const authPart = rtspUser.trim() ? `${encodeURIComponent(rtspUser)}:${encodeURIComponent(rtspPass)}@` : '';
      fullUrl = `rtsp://${authPart}${rtspIp.trim()}:${rtspPort || 554}${rtspPath.startsWith('/') ? rtspPath : `/${rtspPath}`}`;
    }

    if (!fullUrl && useDirectUrl) {
      showFeedback('Please enter a valid RTSP Stream URL.', 'error');
      setActionLoading(false);
      return;
    }

    try {
      const res = await apiService.connectCamera({
        cameraType: 'RTSP',
        name: 'Classroom IP Camera',
        rtspUrl: fullUrl,
        ip: rtspIp.trim() || undefined,
        port: parseInt(rtspPort, 10) || 554,
        username: rtspUser.trim() || undefined,
        password: rtspPass || undefined,
        streamPath: rtspPath || undefined,
        transport: rtspTransport
      });

      if (res.success) {
        showFeedback('Connected to RTSP IP Camera stream successfully!', 'success');
        loadCameraStatus();
      } else {
        showFeedback(res.error || 'Could not connect to RTSP stream.', 'error');
      }
    } catch (err) {
      showFeedback(err.message || 'RTSP IP connection error.', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // 3. Connect Classroom Simulation Camera
  const handleConnectMock = async () => {
    setActionLoading(true);
    try {
      const res = await apiService.connectCamera({
        cameraType: 'MOCK',
        name: 'Classroom Camera Simulator'
      });
      if (res.success) {
        showFeedback('Switched to Classroom Simulation Test Camera.', 'success');
        loadCameraStatus();
      } else {
        showFeedback(res.error || 'Failed to activate simulation.', 'error');
      }
    } catch (err) {
      showFeedback(err.message || 'Simulation camera error.', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Disconnect Camera
  const handleDisconnect = async () => {
    setActionLoading(true);
    try {
      await apiService.disconnectCamera();
      showFeedback('Camera disconnected.', 'success');
      loadCameraStatus();
    } catch (err) {
      showFeedback(err.message || 'Disconnect failed.', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-10">
      {/* 1. Header Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200/60">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-[#FFF2EE] text-[#FF5A36] border border-[#FFD9CE]">
              Optical Sensors & AI
            </span>
            <span className="text-slate-300">&bull;</span>
            <span className="text-xs text-slate-500 font-medium">Camera Hardware</span>
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2.5 mt-1.5">
            <Camera className="w-6 h-6 text-[#FF5A36]" />
            <span>Camera Modes & Optical View</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Switch between Integrated Laptop Webcams, Classroom RTSP IP Cameras, and Test Simulators.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/attendance')}
            className="enterprise-btn-primary text-xs flex items-center gap-2 shadow-sm"
          >
            <Play className="w-4 h-4 fill-white" />
            <span>Launch Attendance Session</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Status Feedback Banner */}
      {feedback.text && (
        <div
          className={`p-3.5 rounded-2xl text-xs font-semibold flex items-center gap-2.5 backdrop-blur-md shadow-2xs transition-all ${
            feedback.type === 'success'
              ? 'bg-emerald-50/95 border border-emerald-200 text-emerald-800'
              : 'bg-rose-50/95 border border-rose-200 text-rose-800'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          )}
          <span>{feedback.text}</span>
        </div>
      )}

      {/* 2. Main Grid: Left Stream + Right Mode Controller */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Live Stream (7 Cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="glass-card p-4 overflow-hidden border border-white/90 shadow-sm">
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-xs font-bold text-slate-800">Live AI Biometric Optical Feed</span>
              </div>
              <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-lg bg-slate-100 text-slate-700">
                {cameraStatus.type || 'ACTIVE'}
              </span>
            </div>

            <div className="rounded-2xl overflow-hidden bg-slate-900 border border-slate-800">
              <CameraFeed isSimulation={cameraStatus.type === 'MOCK'} height="380px" />
            </div>

            <div className="flex items-center justify-between mt-3 text-xs text-slate-500 pt-2 border-t border-slate-100">
              <div className="flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span className="font-semibold text-slate-700">YuNet 640 + SFace Embeddings Active</span>
              </div>
              <span className="font-mono text-[11px] font-bold text-slate-600">
                {cameraStatus.resolution || '1280x720'} @ {cameraStatus.fps || 30} FPS
              </span>
            </div>
          </div>

          {/* Quick Info Dashlet */}
          <div className="glass-card p-4 border border-white/90 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#FF5A36] to-[#FF7849] flex items-center justify-center text-white shadow-xs">
                <Tv className="w-4 h-4" />
              </div>
              <div>
                <span className="text-xs font-bold text-slate-800 block">
                  {cameraStatus.name || 'Active Camera Source'}
                </span>
                <span className="text-[11px] font-medium text-slate-500">
                  Status: <strong className="text-emerald-600">Connected & Ready</strong>
                </span>
              </div>
            </div>
            <button
              onClick={handleDisconnect}
              disabled={actionLoading}
              className="text-xs text-rose-600 hover:text-rose-700 font-bold px-3 py-1.5 rounded-xl border border-rose-200 hover:bg-rose-50 transition-all cursor-pointer flex items-center gap-1.5"
            >
              <Power className="w-3.5 h-3.5" />
              <span>Disconnect</span>
            </button>
          </div>
        </div>

        {/* Right Column: Camera Mode Selector & Configuration (5 Cols) */}
        <div className="lg:col-span-5 space-y-5">
          <div className="glass-card p-5 border border-white/90 shadow-md">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Settings2 className="w-4 h-4 text-[#FF5A36]" />
                <h2 className="text-sm font-extrabold text-slate-900">Select Camera Mode</h2>
              </div>
              <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400">
                Optical Source
              </span>
            </div>

            {/* Mode Switcher Tabs */}
            <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-100 rounded-2xl mb-5">
              <button
                type="button"
                onClick={() => setActiveTab('WEBCAM')}
                className={`py-2 px-1 text-center rounded-xl text-xs font-bold transition-all cursor-pointer flex flex-col items-center gap-1 ${
                  activeTab === 'WEBCAM'
                    ? 'bg-white text-[#FF5A36] shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Video className="w-4 h-4" />
                <span>Webcam</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('RTSP')}
                className={`py-2 px-1 text-center rounded-xl text-xs font-bold transition-all cursor-pointer flex flex-col items-center gap-1 ${
                  activeTab === 'RTSP'
                    ? 'bg-white text-[#FF5A36] shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Radio className="w-4 h-4" />
                <span>RTSP Camera</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('MOCK')}
                className={`py-2 px-1 text-center rounded-xl text-xs font-bold transition-all cursor-pointer flex flex-col items-center gap-1 ${
                  activeTab === 'MOCK'
                    ? 'bg-white text-[#FF5A36] shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <MonitorCheck className="w-4 h-4" />
                <span>Simulator</span>
              </button>
            </div>

            {/* TAB 1: WEBCAM */}
            {activeTab === 'WEBCAM' && (
              <div className="space-y-4 text-xs">
                <div className="p-3 bg-[#FFF2EE] rounded-2xl border border-[#FFD9CE] text-[#FF5A36] flex items-start gap-2">
                  <Video className="w-4 h-4 shrink-0 mt-0.5" />
                  <span className="font-semibold text-[11px]">
                    Use your laptop's integrated camera or any external USB webcam plugged directly into your machine.
                  </span>
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1.5">Webcam Device</label>
                  <select
                    value={deviceIndex}
                    onChange={(e) => setDeviceIndex(e.target.value)}
                    className="glass-input w-full"
                  >
                    <option value="0">Default Laptop Camera (Index 0)</option>
                    <option value="1">Secondary / USB Webcam (Index 1)</option>
                    <option value="2">External Video Ingest (Index 2)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1.5">Capture Resolution</label>
                  <select
                    value={webcamResolution}
                    onChange={(e) => setWebcamResolution(e.target.value)}
                    className="glass-input w-full font-mono"
                  >
                    <option value="1280x720">1280x720 (720p HD) - Recommended</option>
                    <option value="1920x1080">1920x1080 (1080p Full HD)</option>
                    <option value="640x480">640x480 (VGA 4:3)</option>
                  </select>
                </div>

                <div className="pt-2">
                  <button
                    onClick={handleConnectWebcam}
                    disabled={actionLoading}
                    className="w-full enterprise-btn-primary justify-center text-xs py-3"
                  >
                    {actionLoading ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <Video className="w-4 h-4" />
                        <span>Switch to Laptop Webcam</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* TAB 2: RTSP IP CAMERA */}
            {activeTab === 'RTSP' && (
              <div className="space-y-3.5 text-xs">
                <div className="p-3 bg-indigo-50/90 rounded-2xl border border-indigo-200 text-indigo-800 flex items-start gap-2">
                  <Wifi className="w-4 h-4 shrink-0 mt-0.5 text-indigo-600" />
                  <span className="font-semibold text-[11px]">
                    Connect to ceiling-mounted ONVIF / RTSP classroom IP cameras over the institutional Wi-Fi / LAN.
                  </span>
                </div>

                <div className="flex items-center gap-3 pb-1 border-b border-slate-100">
                  <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-700">
                    <input
                      type="radio"
                      checked={useDirectUrl}
                      onChange={() => setUseDirectUrl(true)}
                      className="text-[#FF5A36] focus:ring-[#FF5A36]"
                    />
                    <span>Full RTSP URL</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-700">
                    <input
                      type="radio"
                      checked={!useDirectUrl}
                      onChange={() => setUseDirectUrl(false)}
                      className="text-[#FF5A36] focus:ring-[#FF5A36]"
                    />
                    <span>IP / Hostname</span>
                  </label>
                </div>

                {useDirectUrl ? (
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">RTSP Stream URL *</label>
                    <input
                      type="text"
                      value={rtspUrl}
                      onChange={(e) => setRtspUrl(e.target.value)}
                      placeholder="rtsp://admin:pass@192.168.1.100:554/live/ch0"
                      className="glass-input w-full font-mono text-[11px]"
                    />
                    <span className="text-[10px] text-slate-400 mt-1 block">
                      Common format: rtsp://username:password@camera-ip:554/h264
                    </span>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    <div className="grid grid-cols-3 gap-2">
                      <div className="col-span-2">
                        <label className="block text-slate-700 font-bold mb-1">Camera IP Address</label>
                        <input
                          type="text"
                          value={rtspIp}
                          onChange={(e) => setRtspIp(e.target.value)}
                          placeholder="192.168.1.100"
                          className="glass-input w-full font-mono text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-700 font-bold mb-1">Port</label>
                        <input
                          type="number"
                          value={rtspPort}
                          onChange={(e) => setRtspPort(e.target.value)}
                          placeholder="554"
                          className="glass-input w-full font-mono text-xs"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-slate-700 font-bold mb-1">Username</label>
                        <input
                          type="text"
                          value={rtspUser}
                          onChange={(e) => setRtspUser(e.target.value)}
                          placeholder="admin"
                          className="glass-input w-full text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-700 font-bold mb-1">Password</label>
                        <input
                          type="password"
                          value={rtspPass}
                          onChange={(e) => setRtspPass(e.target.value)}
                          placeholder="••••••••"
                          className="glass-input w-full text-xs"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-slate-700 font-bold mb-1">Stream Path</label>
                      <input
                        type="text"
                        value={rtspPath}
                        onChange={(e) => setRtspPath(e.target.value)}
                        placeholder="/live/ch0 or /h264"
                        className="glass-input w-full font-mono text-xs"
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-slate-700 font-bold mb-1">Network Transport</label>
                  <select
                    value={rtspTransport}
                    onChange={(e) => setRtspTransport(e.target.value)}
                    className="glass-input w-full"
                  >
                    <option value="tcp">TCP (Reliable, Zero Packet Drop - Recommended)</option>
                    <option value="udp">UDP (Low Latency, Best for Gigabit Ethernet)</option>
                  </select>
                </div>

                <div className="pt-2">
                  <button
                    onClick={handleConnectRTSP}
                    disabled={actionLoading}
                    className="w-full enterprise-btn-primary justify-center text-xs py-3"
                  >
                    {actionLoading ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <Radio className="w-4 h-4" />
                        <span>Connect to RTSP Camera</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* TAB 3: MOCK SIMULATOR */}
            {activeTab === 'MOCK' && (
              <div className="space-y-4 text-xs">
                <div className="p-3 bg-amber-50/90 rounded-2xl border border-amber-200/80 text-amber-800 flex items-start gap-2">
                  <MonitorCheck className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
                  <span className="font-semibold text-[11px]">
                    Use the Classroom Camera Simulator to test attendance workflows, desk positioning, and face matching without needing a physical camera attached.
                  </span>
                </div>

                <div className="rounded-2xl bg-slate-50 p-3.5 border border-slate-100 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 font-medium">Simulation Scene:</span>
                    <span className="font-bold text-slate-800">Classroom 302 Multi-Desk</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 font-medium">Virtual Students:</span>
                    <span className="font-bold text-emerald-600">Simulated Facial Targets</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 font-medium">Lighting & Glare:</span>
                    <span className="font-bold text-slate-700">Dynamic Daylight</span>
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    onClick={handleConnectMock}
                    disabled={actionLoading}
                    className="w-full enterprise-btn-primary justify-center text-xs py-3"
                  >
                    {actionLoading ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <MonitorCheck className="w-4 h-4" />
                        <span>Activate Simulation Camera</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
