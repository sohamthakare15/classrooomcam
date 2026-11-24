import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  CheckSquare,
  Users,
  Layers,
  History,
  Camera,
  ShieldCheck,
  GraduationCap,
  X
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function Sidebar({ isMobileOpen, setIsMobileOpen }) {
  const { currentUser, isAdmin } = useAuth();

  // Role-based navigation: Teachers CANNOT see or access the Admin panel
  const navItems = [
    { name: 'Dashboard', path: '/', icon: LayoutDashboard },
    { name: 'Take Attendance', path: '/attendance', icon: CheckSquare },
    { name: 'Camera & Hardware', path: '/camera', icon: Camera },
    { name: 'Students', path: '/students', icon: Users },
    { name: 'Classes & Sections', path: '/sections', icon: Layers },
    { name: 'Attendance History', path: '/history', icon: History },
    ...(isAdmin ? [{ name: 'Faculty & Admin', path: '/admin', icon: ShieldCheck }] : [])
  ];

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-40 md:hidden transition-opacity"
          onClick={() => setIsMobileOpen?.(false)}
        />
      )}

      {/* Sidebar / Mobile Slide-in Drawer */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-50 w-72 bg-white/95 backdrop-blur-2xl text-slate-700 flex flex-col shrink-0 border-r border-slate-100 shadow-2xl select-none transition-transform duration-300 ease-in-out
          md:static md:w-64 md:translate-x-0 md:bg-white/85 md:shadow-sm
          ${isMobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        `}
      >
        {/* Brand Header */}
        <div className="h-16 sm:h-18 flex items-center justify-between px-6 border-b border-slate-100/80 bg-white/50">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#FF5A36] to-[#FF7849] flex items-center justify-center text-white shadow-md shadow-[#FF5A36]/25 border border-white/60">
              <GraduationCap className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h1 className="text-base font-extrabold text-slate-900 tracking-tight leading-none">SmartClass</h1>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-[#FFF0EB] text-[#FF5A36]">AI</span>
              </div>
              <span className="text-xs text-slate-400 font-medium block mt-1">
                Faculty Attendance
              </span>
            </div>
          </div>

          {/* Close button for Mobile Drawer */}
          <button
            type="button"
            onClick={() => setIsMobileOpen?.(false)}
            className="md:hidden p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
            aria-label="Close menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Main Navigation */}
        <nav className="flex-1 px-3.5 py-5 space-y-1.5 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={() => setIsMobileOpen?.(false)}
                className={({ isActive }) =>
                  `group relative flex items-center gap-3.5 px-4 py-3 rounded-2xl text-xs font-semibold transition-all duration-200 ${
                    isActive
                      ? 'bg-[#FFF2EE] text-[#FF5A36] shadow-xs border border-[#FFD9CE] font-bold'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50/80'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <div className={`p-2 rounded-xl transition-all ${
                      isActive
                        ? 'bg-gradient-to-tr from-[#FF5A36] to-[#FF7849] text-white shadow-sm shadow-[#FF5A36]/30'
                        : 'text-slate-400 group-hover:text-[#FF5A36] group-hover:bg-[#FFF2EE]'
                    }`}>
                      <Icon className="w-4 h-4 shrink-0" />
                    </div>
                    <span className="text-xs font-bold tracking-tight">{item.name}</span>
                    {isActive && (
                      <span className="ml-auto w-2 h-2 bg-[#FF5A36] rounded-full shadow-xs shadow-[#FF5A36]/50" />
                    )}
                  </>
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* User Dashlet in Footer */}
        <div className="p-3.5 m-3.5 rounded-2xl bg-slate-50/80 border border-slate-100 shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#FF5A36] to-[#FF7849] text-white font-extrabold text-xs flex items-center justify-center font-mono shadow-xs">
              {(currentUser?.displayName || currentUser?.fullName || 'FA').slice(0, 2).toUpperCase()}
            </div>
            <div className="overflow-hidden">
              <span className="text-xs font-bold text-slate-800 block truncate">
                {currentUser?.displayName || currentUser?.fullName || 'Faculty Member'}
              </span>
              <span className="text-[11px] font-medium text-slate-500 block truncate">
                {isAdmin ? 'Administrator' : (currentUser?.department || 'Lecturer')}
              </span>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
