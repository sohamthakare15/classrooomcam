import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { formatKolkataDate, formatKolkataTime } from '../utils/dateUtils';
import {
  LogOut,
  Calendar,
  Clock,
  ShieldCheck,
  User,
  Menu,
  GraduationCap
} from 'lucide-react';

export default function Navbar({ onOpenMobileNav }) {
  const { currentUser, logout, isAdmin } = useAuth();
  const [currentDateTime, setCurrentDateTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentDateTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <header className="h-14 bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between select-none sticky top-0 z-20">
      {/* Left: Mobile menu toggle & Date/Time */}
      <div className="flex items-center gap-2.5 sm:gap-4">
        <button
          type="button"
          onClick={onOpenMobileNav}
          className="md:hidden p-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer border border-slate-200"
          aria-label="Toggle Navigation Drawer"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2 md:hidden">
          <div className="w-7 h-7 rounded-lg bg-slate-900 flex items-center justify-center text-white">
            <GraduationCap className="w-4 h-4" />
          </div>
          <span className="font-bold text-slate-900 text-sm tracking-tight">SmartClass</span>
        </div>

        {/* Desktop: Clean Date & Time */}
        <div className="hidden md:flex items-center gap-2.5 text-slate-600 text-xs font-medium">
          <Calendar className="w-3.5 h-3.5 text-slate-400" />
          <span className="font-semibold text-slate-700">{formatKolkataDate(currentDateTime)}</span>
          <span className="text-slate-300">|</span>
          <Clock className="w-3.5 h-3.5 text-slate-400" />
          <span className="font-mono text-slate-800 font-semibold">{formatKolkataTime(currentDateTime)}</span>
          <span className="text-[10px] text-slate-500 font-semibold uppercase">IST</span>
        </div>

        {/* Mobile: Compact Time */}
        <div className="flex md:hidden items-center gap-1 text-slate-700 bg-slate-50 px-2 py-1 rounded-md border border-slate-200 text-[11px] font-semibold">
          <Clock className="w-3 h-3 text-slate-500" />
          <span className="font-mono">{formatKolkataTime(currentDateTime)}</span>
        </div>
      </div>

      {/* Right: Faculty Profile & Sign Out */}
      <div className="flex items-center gap-2 sm:gap-3">
        <div className="flex items-center gap-2.5 py-1">
          <div className="w-7 h-7 rounded-lg bg-slate-800 text-white flex items-center justify-center font-bold text-[11px]">
            {currentUser?.displayName ? currentUser.displayName.slice(0, 2).toUpperCase() : <User className="w-3.5 h-3.5" />}
          </div>
          <div className="hidden sm:flex flex-col text-left">
            <span className="text-xs font-semibold text-slate-900 leading-tight">
              {currentUser?.displayName || currentUser?.fullName || 'Faculty Member'}
            </span>
            <span className="text-[11px] text-slate-500 flex items-center gap-1">
              <ShieldCheck className={`w-3 h-3 ${isAdmin ? 'text-amber-600' : 'text-blue-600'}`} />
              <span>{isAdmin ? 'Administrator' : (currentUser?.department || 'Lecturer')}</span>
            </span>
          </div>
        </div>

        <button
          onClick={logout}
          title="Sign Out"
          className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors border border-slate-200 hover:border-rose-200 cursor-pointer"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Logout</span>
        </button>
      </div>
    </header>
  );
}
