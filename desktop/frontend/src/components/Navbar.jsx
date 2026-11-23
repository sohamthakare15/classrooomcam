import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { formatKolkataDate, formatKolkataTime } from '../utils/dateUtils';
import {
  LogOut,
  Calendar,
  Clock,
  ShieldCheck,
  User,
  Sparkles
} from 'lucide-react';

export default function Navbar() {
  const { currentUser, logout, isAdmin } = useAuth();
  const [currentDateTime, setCurrentDateTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentDateTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <header className="h-18 bg-white/80 backdrop-blur-xl border-b border-slate-100 px-6 sm:px-8 flex items-center justify-between shadow-2xs select-none sticky top-0 z-20">
      {/* Left: Indian Standard Time & Date in Wink Style */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-3 text-slate-700 bg-white/95 px-4 py-2 rounded-2xl border border-slate-200/60 shadow-xs text-xs font-medium">
          <Calendar className="w-4 h-4 text-[#FF5A36]" />
          <span className="font-bold text-slate-800">{formatKolkataDate(currentDateTime)}</span>
          <span className="text-slate-200">|</span>
          <Clock className="w-4 h-4 text-[#FF5A36]" />
          <span className="font-mono text-slate-900 font-extrabold">{formatKolkataTime(currentDateTime)}</span>
          <span className="text-[10px] bg-[#FFF2EE] text-[#FF5A36] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
            IST
          </span>
        </div>
      </div>

      {/* Right: Faculty Profile & Sign Out */}
      <div className="flex items-center gap-4">
        {/* Profile Card */}
        <div className="flex items-center gap-3 pl-2 py-1">
          <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-[#FF5A36] to-[#FF7849] text-white flex items-center justify-center font-extrabold text-xs shadow-xs border border-white/60">
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
          className="flex items-center gap-2 px-3.5 py-2 text-xs font-bold text-slate-500 hover:text-rose-600 hover:bg-rose-50/80 rounded-2xl transition-all border border-transparent hover:border-rose-100 cursor-pointer ml-1"
        >
          <LogOut className="w-4 h-4" />
          <span className="hidden sm:inline">Logout</span>
        </button>
      </div>
    </header>
  );
}
