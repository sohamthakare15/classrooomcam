import React, { useState, useEffect } from 'react';
import { HashRouter as Router, Routes, Route, Navigate, NavLink } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Sidebar from './components/Sidebar';
import Navbar from './components/Navbar';
import { apiService } from './services/apiService';
import {
  LayoutDashboard,
  CheckSquare,
  Users,
  Layers,
  History,
  ShieldCheck
} from 'lucide-react';

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
  const { currentUser, loading, isAdmin } = useAuth();
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
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

      {/* Persistent Frosted Glass Sidebar / Mobile Drawer */}
      <Sidebar
        pendingReviewCount={pendingReviews}
        isMobileOpen={isMobileNavOpen}
        setIsMobileOpen={setIsMobileNavOpen}
      />

      {/* Main Workspace Canvas */}
      <div className="relative z-10 flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Frosted Glass Top Navbar with Mobile Drawer Trigger */}
        <Navbar
          cameraStatus={cameraInfo.status}
          cameraType={cameraInfo.type}
          backendOnline={backendOnline}
          onOpenMobileNav={() => setIsMobileNavOpen(true)}
        />

        {/* Scrollable Page Canvas with mobile bottom padding */}
        <main className="flex-1 overflow-y-auto p-3.5 sm:p-6 md:p-8 pb-22 md:pb-8">
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
            {/* Strict Role Guard: Only administrator can access Admin Panel; teachers are redirected */}
            <Route
              path="/admin"
              element={isAdmin ? <AdminPanelPage /> : <Navigate to="/" replace />}
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>

        {/* Mobile Quick Navigation Bar (Finger-friendly Thumb Navigation) */}
        <nav className="fixed bottom-0 inset-x-0 z-30 bg-white/95 backdrop-blur-xl border-t border-slate-200/90 px-3 py-2 flex items-center justify-around md:hidden shadow-lg select-none">
          <NavLink
            to="/"
            className={({ isActive }) =>
              `flex flex-col items-center gap-1 py-1 px-2.5 rounded-xl text-[10px] font-bold transition-all ${
                isActive ? 'text-[#FF5A36]' : 'text-slate-500 hover:text-slate-800'
              }`
            }
          >
            <LayoutDashboard className="w-5 h-5" />
            <span>Home</span>
          </NavLink>
          <NavLink
            to="/attendance"
            className={({ isActive }) =>
              `flex flex-col items-center gap-1 py-1 px-2.5 rounded-xl text-[10px] font-bold transition-all ${
                isActive ? 'text-[#FF5A36]' : 'text-slate-500 hover:text-slate-800'
              }`
            }
          >
            <CheckSquare className="w-5 h-5" />
            <span>Attendance</span>
          </NavLink>
          <NavLink
            to="/students"
            className={({ isActive }) =>
              `flex flex-col items-center gap-1 py-1 px-2.5 rounded-xl text-[10px] font-bold transition-all ${
                isActive ? 'text-[#FF5A36]' : 'text-slate-500 hover:text-slate-800'
              }`
            }
          >
            <Users className="w-5 h-5" />
            <span>Students</span>
          </NavLink>
          <NavLink
            to="/sections"
            className={({ isActive }) =>
              `flex flex-col items-center gap-1 py-1 px-2.5 rounded-xl text-[10px] font-bold transition-all ${
                isActive ? 'text-[#FF5A36]' : 'text-slate-500 hover:text-slate-800'
              }`
            }
          >
            <Layers className="w-5 h-5" />
            <span>Classes</span>
          </NavLink>
          {isAdmin ? (
            <NavLink
              to="/admin"
              className={({ isActive }) =>
                `flex flex-col items-center gap-1 py-1 px-2.5 rounded-xl text-[10px] font-bold transition-all ${
                  isActive ? 'text-[#FF5A36]' : 'text-slate-500 hover:text-slate-800'
                }`
              }
            >
              <ShieldCheck className="w-5 h-5" />
              <span>Admin</span>
            </NavLink>
          ) : (
            <NavLink
              to="/history"
              className={({ isActive }) =>
                `flex flex-col items-center gap-1 py-1 px-2.5 rounded-xl text-[10px] font-bold transition-all ${
                  isActive ? 'text-[#FF5A36]' : 'text-slate-500 hover:text-slate-800'
                }`
              }
            >
              <History className="w-5 h-5" />
              <span>History</span>
            </NavLink>
          )}
        </nav>
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
