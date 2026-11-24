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
    <header className="h-16 sm:h-18 bg-white/80 backdrop-blur-xl border-b border-slate-100 px-3.5 sm:px-8 flex items-center justify-between shadow-2xs select-none sticky top-0 z-20">
      {/* Left: Mobile menu toggle, mobile brand, & desktop clock */}
      <div className="flex items-center gap-2 sm:gap-4">
        {/* Mobile Hamburger Button */}
        <button
          type="button"
          onClick={onOpenMobileNav}
          className="md:hidden p-2 rounded-xl text-slate-700 hover:text-slate-900 hover:bg-slate-100/90 transition-colors cursor-pointer border border-slate-200/60 shadow-xs"
          aria-label="Toggle Navigation Drawer"
        >
          <Menu className="w-5 h-5 text-slate-800" />
        </button>

        {/* Mobile Brand Title */}
        <div className="flex items-center gap-1.5 md:hidden">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-[#FF5A36] to-[#FF7849] flex items-center justify-center text-white shadow-xs">
            <GraduationCap className="w-4 h-4" />
          </div>
          <span className="font-extrabold text-slate-900 text-sm tracking-tight">SmartClass</span>
        </div>

        {/* Desktop: Full Date & Time in Wink Style */}
        <div className="hidden md:flex items-center gap-3 text-slate-700 bg-white/95 px-4 py-2 rounded-2xl border border-slate-200/60 shadow-xs text-xs font-medium">
          <Calendar className="w-4 h-4 text-[#FF5A36]" />
          <span className="font-bold text-slate-800">{formatKolkataDate(currentDateTime)}</span>
          <span className="text-slate-200">|</span>
          <Clock className="w-4 h-4 text-[#FF5A36]" />
          <span className="font-mono text-slate-900 font-extrabold">{formatKolkataTime(currentDateTime)}</span>
          <span className="text-[10px] bg-[#FFF2EE] text-[#FF5A36] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
            IST
          </span>
        </div>

        {/* Mobile: Compact Time Pill */}
        <div className="flex md:hidden items-center gap-1 text-slate-700 bg-white/95 px-2 py-1 rounded-xl border border-slate-200/60 shadow-xs text-[11px] font-bold">
          <Clock className="w-3.5 h-3.5 text-[#FF5A36]" />
          <span className="font-mono">{formatKolkataTime(currentDateTime)}</span>
        </div>
      </div>

      {/* Right: Faculty Profile & Sign Out */}
      <div className="flex items-center gap-2 sm:gap-4">
        {/* Profile Card */}
        <div className="flex items-center gap-2 sm:gap-3 pl-1 sm:pl-2 py-1">
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl sm:rounded-2xl bg-gradient-to-tr from-[#FF5A36] to-[#FF7849] text-white flex items-center justify-center font-extrabold text-xs shadow-xs border border-white/60">
            {currentUser?.displayName ? currentUser.displayName.slice(0, 2).toUpperCase() : <User className="w-4 h-4" />}
          </div>
          <div className="hidden sm:flex flex-col text-left">
            <span className="text-xs font-bold text-slate-900 leading-tight">
              {currentUser?.displayName || currentUser?.fullName || 'Faculty Member'}
            </span>
            <span className="text-[11px] text-slate-500 font-medium flex items-center gap-1 mt-0.5">
              <ShieldCheck className={`w-3.5 h-3.5 ${isAdmin ? 'text-amber-500' : 'text-[#FF5A36]'}`} />
              <span className={isAdmin ? 'text-amber-700 font-bold' : 'text-slate-600'}>
                {isAdmin ? 'Administrator' : (currentUser?.department || 'Lecturer')}
              </span>
            </span>
          </div>
        </div>

        {/* Logout Button */}
        <button
          onClick={logout}
          title="Sign Out of Session"
          className="flex items-center gap-1.5 px-2.5 sm:px-3.5 py-1.5 sm:py-2 text-xs font-bold text-slate-600 hover:text-rose-600 hover:bg-rose-50/80 rounded-xl sm:rounded-2xl transition-all border border-slate-200/60 sm:border-transparent hover:border-rose-100 cursor-pointer"
        >
          <LogOut className="w-4 h-4 text-slate-500 hover:text-rose-600" />
          <span className="hidden sm:inline">Logout</span>
        </button>
      </div>
    </header>
  );
}
