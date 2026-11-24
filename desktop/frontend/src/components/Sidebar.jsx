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
          className="fixed inset-0 bg-slate-900/40 z-40 md:hidden transition-opacity"
          onClick={() => setIsMobileOpen?.(false)}
        />
      )}

      {/* Clean Enterprise Sidebar / Mobile Slide-in Drawer */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-50 w-64 bg-white text-slate-700 flex flex-col shrink-0 border-r border-slate-200 select-none transition-transform duration-200 ease-out
          md:static md:w-60 md:translate-x-0
          ${isMobileOpen ? 'translate-x-0 shadow-xl' : '-translate-x-full md:translate-x-0'}
        `}
      >
        {/* Brand Header */}
        <div className="h-14 flex items-center justify-between px-4 border-b border-slate-200">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-slate-900 flex items-center justify-center text-white">
              <GraduationCap className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h1 className="text-sm font-bold text-slate-900 tracking-tight leading-none">SmartClass</h1>
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                  PRO
                </span>
              </div>
              <span className="text-[11px] text-slate-500 block mt-0.5 leading-none">
                Attendance Portal
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsMobileOpen?.(false)}
            className="md:hidden p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
            aria-label="Close menu"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Main Navigation */}
        <nav className="flex-1 px-2.5 py-3 space-y-0.5 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={() => setIsMobileOpen?.(false)}
                className={({ isActive }) =>
                  `group relative flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] transition-colors ${
                    isActive
                      ? 'bg-blue-50/80 text-blue-700 font-semibold'
                      : 'text-slate-600 font-medium hover:text-slate-900 hover:bg-slate-100/70'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-blue-600' : 'text-slate-400 group-hover:text-slate-600'}`} />
                    <span className="truncate">{item.name}</span>
                    {isActive && (
                      <span className="ml-auto w-1.5 h-1.5 bg-blue-600 rounded-full" />
                    )}
                  </>
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* Clean Account Footer */}
        <div className="p-3 border-t border-slate-200 bg-slate-50/60">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-slate-800 text-white font-bold text-xs flex items-center justify-center shrink-0">
              {(currentUser?.displayName || currentUser?.fullName || 'FA').slice(0, 2).toUpperCase()}
            </div>
            <div className="overflow-hidden">
              <span className="text-xs font-semibold text-slate-900 block truncate">
                {currentUser?.displayName || currentUser?.fullName || 'Faculty Member'}
              </span>
              <span className="text-[11px] text-slate-500 block truncate">
                {isAdmin ? 'Administrator' : (currentUser?.department || 'Lecturer')}
              </span>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
