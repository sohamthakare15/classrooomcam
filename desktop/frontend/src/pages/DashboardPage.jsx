import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users,
  CheckCircle2,
  XCircle,
  Percent,
  Play,
  UserPlus,
  ArrowRight,
  Clock,
  Calendar,
  Layers,
  ChevronRight,
  Printer,
  Sparkles
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { storageService } from '../services/storageService';
import { apiService } from '../services/apiService';
import { formatKolkataDate, formatKolkataTime } from '../utils/dateUtils';

export default function DashboardPage() {
  const navigate = useNavigate();
  const { currentUser } = useAuth();

  const [currentDateTime, setCurrentDateTime] = useState(new Date());
  const [students, setStudents] = useState([]);
  const [sections, setSections] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [activeSession, setActiveSession] = useState(null);
  const [loading, setLoading] = useState(true);

  // Live clock ticker
  useEffect(() => {
    const timer = setInterval(() => setCurrentDateTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    loadDashboardData();
    const interval = setInterval(loadDashboardData, 3000);
    return () => clearInterval(interval);
  }, []);

  const loadDashboardData = async () => {
    try {
      // 1. Students
      try {
        const dbStudents = await storageService.fetchStudentsFromDb();
        setStudents(dbStudents && dbStudents.length > 0 ? dbStudents : storageService.getStudents());
      } catch (_) {
        setStudents(storageService.getStudents());
      }

      // 2. Sections
      try {
        const secRes = await apiService.getSections();
        if (secRes && secRes.sections) {
          setSections(secRes.sections);
        }
      } catch (_) {
        setSections(storageService.getSections());
      }

      // 3. Attendance sessions
      try {
        const sessRes = await apiService.getSessions();
        if (sessRes && sessRes.sessions) {
          setSessions(sessRes.sessions);
          const running = sessRes.sessions.find(s => s.status === 'in_progress');
          setActiveSession(running || null);
        }
      } catch (_) {}
    } catch (err) {
      console.error('Dashboard data load error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Calculations for Key Statistic Cards
  const totalStudents = students.length;
  const enrolledStudents = students.filter(s => s.enrollmentStatus === 'Enrolled' || s.enrollment_status === 'Enrolled').length;

  const latestCompleted = sessions.find(s => s.status === 'completed');
  const presentToday = activeSession
    ? (activeSession.presentCount || 0)
    : latestCompleted
    ? (latestCompleted.presentCount || 0)
    : 0;

  const absentToday = activeSession
    ? (activeSession.totalStudents ? Math.max(0, activeSession.totalStudents - (activeSession.presentCount || 0)) : 0)
    : latestCompleted
    ? (latestCompleted.absentCount || 0)
    : 0;

  const sessionTotal = presentToday + absentToday;
  const attendanceRate = sessionTotal > 0
    ? Math.round((presentToday / sessionTotal) * 100)
    : (enrolledStudents > 0 ? 100 : 0);

  const getGreeting = () => {
    const hour = currentDateTime.getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const lecturerName = currentUser?.displayName || currentUser?.fullName || 'Faculty Member';
  const departmentName = currentUser?.department || 'Academic Faculty';

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-10">
      {/* 1. Wink Welcome Dashlet */}
      <div className="glass-card p-6 md:p-8 bg-gradient-to-r from-white/95 via-[#FFF5F2]/40 to-slate-50/50 border border-white/90 shadow-sm relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-5">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
              <span className="flex items-center gap-1.5 bg-white/90 px-3 py-1.5 rounded-xl border border-slate-200/50 shadow-2xs">
                <Calendar className="w-3.5 h-3.5 text-[#FF5A36]" />
                {formatKolkataDate(currentDateTime)}
              </span>
              <span>&bull;</span>
              <span className="font-mono text-[#FF5A36] font-bold flex items-center gap-1.5 bg-white/90 px-3 py-1.5 rounded-xl border border-slate-200/50 shadow-2xs">
                <Clock className="w-3.5 h-3.5 text-[#FF5A36]" />
                {formatKolkataTime(currentDateTime)} IST
              </span>
            </div>

            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-slate-900 flex items-center gap-2.5">
              <span>{getGreeting()}, {lecturerName}</span>
              <Sparkles className="w-5 h-5 text-[#FF5A36] shrink-0" />
            </h1>
            <p className="text-sm text-slate-600 max-w-2xl font-medium">
              {departmentName} &bull; Manage student attendance and view live classroom reports.
            </p>
          </div>

          {/* Core Action Buttons in Wink Style */}
          <div className="flex items-center gap-3 shrink-0 flex-wrap">
            <button
              onClick={() => navigate('/students')}
              className="enterprise-btn-secondary text-xs"
            >
              <UserPlus className="w-4 h-4 text-slate-600" />
              <span>Add Student</span>
            </button>
            <button
              onClick={() => navigate('/attendance')}
              className="enterprise-btn-primary text-xs"
            >
              <Play className="w-4 h-4 fill-white" />
              <span>Take Attendance</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. Key Wink Statistics Dashlets */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Total Students */}
        <div
          onClick={() => navigate('/students')}
          className="glass-card p-6 cursor-pointer hover:border-cyan-300 group border-l-4 border-l-cyan-500"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Total Students
            </span>
            <div className="w-10 h-10 rounded-2xl bg-cyan-50 border border-cyan-200/60 flex items-center justify-center text-cyan-600 group-hover:scale-105 transition-transform shadow-2xs">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-900 tracking-tight">
              {totalStudents}
            </span>
            <span className="text-xs text-slate-500 font-medium">
              enrolled
            </span>
          </div>
          <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
            <span>Student Directory</span>
            <span className="text-cyan-600 font-bold group-hover:translate-x-0.5 transition-transform flex items-center">
              View &rarr;
            </span>
          </div>
        </div>

        {/* Present Today */}
        <div
          onClick={() => navigate('/history')}
          className="glass-card p-6 cursor-pointer hover:border-emerald-300 group border-l-4 border-l-emerald-500"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Present Today
            </span>
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 border border-emerald-200/60 flex items-center justify-center text-emerald-600 group-hover:scale-105 transition-transform shadow-2xs">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-emerald-700 tracking-tight">
              {presentToday}
            </span>
            <span className="text-xs text-slate-500 font-medium">
              verified
            </span>
          </div>
          <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
            <span className="text-emerald-700 font-semibold flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              {activeSession ? 'Session in progress' : 'Latest session'}
            </span>
            <span className="text-emerald-700 font-bold group-hover:translate-x-0.5 transition-transform flex items-center">
              View &rarr;
            </span>
          </div>
        </div>

        {/* Absent Today */}
        <div
          onClick={() => navigate('/history')}
          className="glass-card p-6 cursor-pointer hover:border-rose-300 group border-l-4 border-l-rose-500"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Absent Today
            </span>
            <div className="w-10 h-10 rounded-2xl bg-rose-50 border border-rose-200/60 flex items-center justify-center text-rose-600 group-hover:scale-105 transition-transform shadow-2xs">
              <XCircle className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-rose-700 tracking-tight">
              {absentToday}
            </span>
            <span className="text-xs text-slate-500 font-medium">
              students
            </span>
          </div>
          <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
            <span className="text-rose-700 font-semibold">Absence count</span>
            <span className="text-rose-700 font-bold group-hover:translate-x-0.5 transition-transform flex items-center">
              View &rarr;
            </span>
          </div>
        </div>

        {/* Turnout Percentage in Wink Coral */}
        <div
          onClick={() => navigate('/history')}
          className="glass-card p-6 cursor-pointer hover:border-[#FFD9CE] group border-l-4 border-l-[#FF5A36]"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Turnout Rate
            </span>
            <div className="w-10 h-10 rounded-2xl bg-[#FFF2EE] border border-[#FFD9CE] flex items-center justify-center text-[#FF5A36] group-hover:scale-105 transition-transform shadow-2xs">
              <Percent className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-[#FF5A36] tracking-tight">
              {attendanceRate}%
            </span>
            <span className="text-xs text-slate-500 font-medium">
              turnout
            </span>
          </div>
          <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
            <span className="text-[#FF5A36] font-semibold">
              {attendanceRate >= 75 ? 'Good attendance' : 'Needs attention'}
            </span>
            <span className="text-[#FF5A36] font-bold group-hover:translate-x-0.5 transition-transform flex items-center">
              History &rarr;
            </span>
          </div>
        </div>
      </div>

      {/* 3. Classes & Take Attendance Hub */}
      <div className="glass-card p-6">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
          <div>
            <h2 className="text-base font-extrabold text-slate-900">
              Your Classes & Sections
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Select any class below to start taking attendance immediately
            </p>
          </div>
          <button
            onClick={() => navigate('/sections')}
            className="text-xs text-[#FF5A36] hover:text-[#e84d2b] font-bold cursor-pointer"
          >
            Manage Classes &rarr;
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {sections && sections.length > 0 ? (
            sections.map((sec) => {
              const secClass = sec.class_name || sec.className || '10';
              const secName = sec.section_name || sec.sectionName || 'A';
              const count = sec.student_count !== undefined ? sec.student_count : students.filter(s => s.class === secClass && s.section === secName).length;

              return (
                <div
                  key={sec.section_id || `${secClass}-${secName}`}
                  className="p-5 rounded-3xl border border-slate-100 bg-white hover:border-[#FFD9CE] transition-all shadow-2xs flex flex-col justify-between space-y-3"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-extrabold text-base text-slate-900">
                        Class {secClass}-{secName}
                      </h3>
                      <p className="text-xs text-slate-500 font-medium mt-0.5">
                        {count} Enrolled Students
                      </p>
                    </div>
                    <span className="w-8 h-8 rounded-xl bg-[#FFF2EE] text-[#FF5A36] font-extrabold text-xs flex items-center justify-center font-mono border border-[#FFD9CE]">
                      {secClass}
                    </span>
                  </div>

                  <button
                    onClick={() => navigate('/attendance')}
                    className="w-full enterprise-btn-primary text-xs py-2 justify-center font-bold"
                  >
                    <Play className="w-3.5 h-3.5 fill-white" />
                    <span>Take Attendance</span>
                  </button>
                </div>
              );
            })
          ) : (
            <div className="col-span-4 p-8 text-center text-xs text-slate-400">
              No classes configured yet. Click "Manage Classes" to add your sections.
            </div>
          )}
        </div>
      </div>

      {/* 4. Recent Attendance Ledger */}
      <div className="glass-card p-6">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-3">
          <div>
            <h2 className="text-base font-extrabold text-slate-900">
              Recent Attendance Sessions
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Recently recorded attendance logs across your assigned classes
            </p>
          </div>
          <button
            onClick={() => navigate('/history')}
            className="text-xs text-[#FF5A36] hover:text-[#e84d2b] font-bold cursor-pointer"
          >
            View Full History &rarr;
          </button>
        </div>

        {sessions && sessions.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-400 font-bold uppercase text-[10px] tracking-wider">
                  <th className="py-3 px-3">Class & Section</th>
                  <th className="py-3 px-3">Date (IST)</th>
                  <th className="py-3 px-3">Conducted By</th>
                  <th className="py-3 px-3">Present</th>
                  <th className="py-3 px-3">Absent</th>
                  <th className="py-3 px-3">Turnout</th>
                  <th className="py-3 px-3 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {sessions.slice(0, 5).map((s) => {
                  const sTotal = (s.presentCount || 0) + (s.absentCount || 0);
                  const rate = sTotal > 0 ? Math.round(((s.presentCount || 0) / sTotal) * 100) : 100;

                  return (
                    <tr key={s.sessionId} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3.5 px-3 font-bold text-slate-900">
                        Class {s.class}-{s.section}
                      </td>
                      <td className="py-3.5 px-3 font-mono text-slate-600">
                        {formatKolkataDate(s.date)}
                      </td>
                      <td className="py-3.5 px-3 text-slate-500">
                        {s.facultyName || 'Lecturer'}
                      </td>
                      <td className="py-3.5 px-3 text-emerald-600 font-bold">
                        {s.presentCount || 0}
                      </td>
                      <td className="py-3.5 px-3 text-rose-600 font-bold">
                        {s.absentCount || 0}
                      </td>
                      <td className="py-3.5 px-3 font-mono font-bold text-slate-900">
                        {rate}%
                      </td>
                      <td className="py-3.5 px-3 text-right">
                        {s.status === 'in_progress' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#FFF2EE] text-[#FF5A36] border border-[#FFD9CE]">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#FF5A36] animate-ping" />
                            Live
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                            Saved
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-10 text-xs text-slate-400">
            No attendance sessions recorded yet. Start your first session above!
          </div>
        )}
      </div>
    </div>
  );
}
