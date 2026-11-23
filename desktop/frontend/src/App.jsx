import React, { useState, useEffect } from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Sidebar from './components/Sidebar';
import Navbar from './components/Navbar';
import { apiService } from './services/apiService';

// Pages
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import StudentsPage from './pages/StudentsPage';
import PhotoEnrollmentPage from './pages/PhotoEnrollmentPage';
import AttendanceSessionPage from './pages/AttendanceSessionPage';
import RecognitionReviewPage from './pages/RecognitionReviewPage';
import AttendanceHistoryPage from './pages/AttendanceHistoryPage';
import ReportsPage from './pages/ReportsPage';
import CameraSettingsPage from './pages/CameraSettingsPage';
import SettingsPage from './pages/SettingsPage';
import SectionsPage from './pages/SectionsPage';
import AdminPanelPage from './pages/AdminPanelPage';

function AppLayout() {
  const { currentUser, loading } = useAuth();
  const [pendingReviews, setPendingReviews] = useState(0);
  const [cameraInfo, setCameraInfo] = useState({ status: 'CONNECTED', type: 'MOCK' });
  const [backendOnline, setBackendOnline] = useState(true);

  useEffect(() => {
    if (!currentUser) return;

    const checkStatus = async () => {
      try {
        const health = await apiService.getHealth();
        setBackendOnline(health?.status === 'ok');
      } catch (_) {
        setBackendOnline(false);
      }

      try {
        const rev = await apiService.getPendingReviews();
        if (rev && rev.reviews) {
          setPendingReviews(rev.reviews.length);
        }
      } catch (_) {}

      try {
        const cam = await apiService.getCameraStatus();
        if (cam) setCameraInfo(cam);
      } catch (_) {}
    };

    checkStatus();
    const interval = setInterval(checkStatus, 3000);
    return () => clearInterval(interval);
  }, [currentUser]);

  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-slate-900 text-white">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <div className="text-xs text-slate-400 font-medium">Initializing SmartClassroom AI...</div>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return <LoginPage />;
  }

  return (
    <div className="relative flex h-screen w-screen overflow-hidden bg-slate-50 selection:bg-indigo-500 selection:text-white">
      {/* Ambient background glowing orbs for light frosted glassmorphism */}
      <div className="ambient-bg" aria-hidden="true">
        <div className="ambient-glow-1" />
        <div className="ambient-glow-2" />
        <div className="ambient-glow-3" />
      </div>

      {/* Persistent Frosted Glass Sidebar */}
      <Sidebar pendingReviewCount={pendingReviews} />

      {/* Main Workspace Canvas */}
      <div className="relative z-10 flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Frosted Glass Top Navbar */}
        <Navbar
          cameraStatus={cameraInfo.status}
          cameraType={cameraInfo.type}
          backendOnline={backendOnline}
        />

        {/* Scrollable Page Canvas */}
        <main className="flex-1 overflow-y-auto p-6 md:p-8">
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/attendance" element={<AttendanceSessionPage />} />
            <Route path="/sections" element={<SectionsPage />} />
            <Route path="/students" element={<StudentsPage />} />
            <Route path="/enrollment" element={<PhotoEnrollmentPage />} />
            <Route path="/review" element={<RecognitionReviewPage />} />
            <Route path="/history" element={<AttendanceHistoryPage />} />
            <Route path="/reports" element={<ReportsPage />} />
            <Route path="/camera" element={<CameraSettingsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/admin" element={<AdminPanelPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <Router>
      <AuthProvider>
        <AppLayout />
      </AuthProvider>
    </Router>
  );
}
