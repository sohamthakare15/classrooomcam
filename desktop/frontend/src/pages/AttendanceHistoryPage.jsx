import React, { useState, useEffect } from 'react';
import {
  History,
  Calendar,
  Clock,
  Eye,
  CheckCircle,
  XCircle,
  FileSpreadsheet,
  AlertCircle,
  Filter,
  Printer,
  Trash2,
  RefreshCw,
  Layers,
  ArrowRight
} from 'lucide-react';
import DataTable from '../components/DataTable';
import Modal from '../components/Modal';
import PrintableRegister from '../components/PrintableRegister';
import { apiService } from '../services/apiService';
import { storageService } from '../services/storageService';
import {
  subscribeToSessions,
  fetchSessionsFromRTDB,
  fetchRecordsForSessionFromRTDB,
  deleteSessionFromRTDB,
  clearAllSessionsFromRTDB
} from '../services/rtdbService';
import { formatKolkataDate } from '../utils/dateUtils';

export default function AttendanceHistoryPage() {
  const [sessions, setSessions] = useState([]);
  const [students, setStudents] = useState([]);
  const [sections, setSections] = useState([]);
  const [selectedSectionFilter, setSelectedSectionFilter] = useState('ALL');
  const [selectedDateFilter, setSelectedDateFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [statusMsg, setStatusMsg] = useState('');

  // Selected session drill-down modal
  const [selectedSession, setSelectedSession] = useState(null);
  const [sessionRecords, setSessionRecords] = useState([]);
  const [recordsLoading, setRecordsLoading] = useState(false);
  const [showPrintRegister, setShowPrintRegister] = useState(false);

  useEffect(() => {
    loadData();

    const unsubSessions = subscribeToSessions((rtdbSessions) => {
      if (Array.isArray(rtdbSessions)) {
        setSessions(rtdbSessions);
      }
    });

    return () => {
      if (unsubSessions) unsubSessions();
    };
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [sessRes, rtdbSess, stuRes, secRes] = await Promise.all([
        apiService.getSessions().catch(() => null),
        fetchSessionsFromRTDB().catch(() => []),
        storageService.syncFromBackend(apiService),
        storageService.syncSectionsFromBackend(apiService)
      ]);
      const mergedSess = new Map();
      if (Array.isArray(rtdbSess)) {
        rtdbSess.forEach(s => { if (s && s.sessionId) mergedSess.set(s.sessionId, s); });
      }
      if (sessRes && Array.isArray(sessRes.sessions)) {
        sessRes.sessions.forEach(s => { if (s && s.sessionId) mergedSess.set(s.sessionId, s); });
      }
      setSessions(Array.from(mergedSess.values()));
      setStudents(stuRes);
      setSections(secRes);
    } catch (_) {
      setStudents(storageService.getStudents());
      setSections(storageService.getClasses());
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSession = async (sessionId, classStr, date) => {
    if (!window.confirm(`Delete attendance session for Class ${classStr} (${formatKolkataDate(date)})?\nThis will remove this session and all its records.`)) {
      return;
    }
    try {
      await Promise.all([
        apiService.deleteSession(sessionId).catch(() => null),
        deleteSessionFromRTDB(sessionId)
      ]);
      setSessions((prev) => prev.filter((s) => s.sessionId !== sessionId));
      setStatusMsg(`Session for Class ${classStr} removed successfully.`);
      setTimeout(() => setStatusMsg(''), 4000);
    } catch (err) {
      alert(`Error deleting session: ${err.message}`);
    }
  };

  const handleClearAllSessions = async () => {
    if (!window.confirm("Remove ALL past attendance sessions and test records from the database?\nStudent registrations will remain intact.")) {
      return;
    }
    try {
      const [res] = await Promise.all([
        apiService.clearAllSessions().catch(() => ({ deletedCount: sessions.length })),
        clearAllSessionsFromRTDB()
      ]);
      setSessions([]);
      setStatusMsg(`Cleaned up ${res?.deletedCount || sessions.length} past test sessions.`);
      setTimeout(() => setStatusMsg(''), 4000);
    } catch (err) {
      alert(`Error clearing sessions: ${err.message}`);
    }
  };

  const openSessionDetails = async (session) => {
    setSelectedSession(session);
    setRecordsLoading(true);
    try {
      const [res, rtdbRecords] = await Promise.all([
        apiService.getSessionDetails(session.sessionId).catch(() => null),
        fetchRecordsForSessionFromRTDB(session.sessionId).catch(() => [])
      ]);
      const merged = new Map();
      if (Array.isArray(rtdbRecords)) {
        rtdbRecords.forEach(r => { if (r && r.studentId) merged.set(r.studentId, r); });
      }
      if (res && Array.isArray(res.records)) {
        res.records.forEach(r => { if (r && r.studentId) merged.set(r.studentId, r); });
      }
      setSessionRecords(Array.from(merged.values()));
    } catch (err) {
      setSessionRecords([]);
    } finally {
      setRecordsLoading(false);
    }
  };

  // Filter sessions by date and section
  const filteredSessions = sessions.filter(s => {
    if (selectedSectionFilter !== 'ALL') {
      const secKey = `${s.class}-${s.section}`;
      if (secKey !== selectedSectionFilter) return false;
    }
    if (selectedDateFilter && s.date !== selectedDateFilter) {
      return false;
    }
    return true;
  });

  // Calculate history KPIs
  const totalSessionsCount = filteredSessions.length;
  const totalPresentCount = filteredSessions.reduce((acc, s) => acc + (s.presentCount || 0), 0);
  const totalAbsentCount = filteredSessions.reduce((acc, s) => acc + (s.absentCount || 0), 0);
  const totalPossible = totalPresentCount + totalAbsentCount;
  const averageAttendanceRate = totalPossible > 0 ? Math.round((totalPresentCount / totalPossible) * 100) : 100;

  const columns = [
    {
      header: "Session Date (IST)",
      accessor: "date",
      render: (s) => (
        <div className="flex items-center gap-2.5">
          <Calendar className="w-4 h-4 text-[#FF5A36]" />
          <div>
            <span className="font-bold text-slate-900 block">{formatKolkataDate(s.date)}</span>
            <span className="text-[10px] text-slate-400 font-mono">ID: {s.sessionId.slice(-8)}</span>
          </div>
        </div>
      )
    },
    {
      header: "Class & Section",
      render: (s) => (
        <span className="font-bold px-3 py-1 bg-[#FFF2EE] text-[#FF5A36] border border-[#FFD9CE] rounded-full text-xs">
          Class {s.class}-{s.section}
        </span>
      )
    },
    {
      header: "Total Students",
      render: (s) => {
        const total = (s.presentCount || 0) + (s.absentCount || 0);
        return (
          <span className="font-mono font-extrabold text-slate-800 text-xs">
            {total || s.totalStudents || 0}
          </span>
        );
      }
    },
    {
      header: "Present",
      render: (s) => (
        <span className="font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-full text-xs">
          {s.presentCount || 0}
        </span>
      )
    },
    {
      header: "Absent",
      render: (s) => (
        <span className="font-bold text-rose-700 bg-rose-50 border border-rose-200 px-3 py-1 rounded-full text-xs">
          {s.absentCount || 0}
        </span>
      )
    },
    {
      header: "Attendance %",
      render: (s) => {
        const total = (s.presentCount || 0) + (s.absentCount || 0);
        const pct = total > 0 ? Math.round(((s.presentCount || 0) / total) * 100) : 100;
        return (
          <div className="flex items-center gap-2">
            <span className="font-mono font-bold text-slate-900 text-xs">{pct}%</span>
            <div className="w-16 bg-slate-100 rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-emerald-500 h-full rounded-full"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        );
      }
    },
    {
      header: "Status",
      accessor: "status",
      render: (s) => (
        <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
          s.status === 'completed'
            ? 'bg-slate-100 text-slate-700 border border-slate-200'
            : 'bg-[#FFF2EE] text-[#FF5A36] border border-[#FFD9CE] animate-pulse'
        }`}>
          {s.status === 'completed' ? 'Finalized' : 'Live'}
        </span>
      )
    },
    {
      header: "Actions",
      render: (s) => (
        <div className="flex items-center gap-2">
          <button
            onClick={() => openSessionDetails(s)}
            className="enterprise-btn-secondary text-xs py-1 px-3"
            title="View student roster"
          >
            <Eye className="w-3.5 h-3.5" />
            <span>Roster</span>
          </button>
          <button
            onClick={() => handleDeleteSession(s.sessionId, `${s.class}-${s.section}`, s.date)}
            className="text-rose-600 hover:text-rose-800 p-1.5 hover:bg-rose-50 rounded-xl border border-rose-200 transition-colors"
            title="Delete this session"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      )
    }
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-8">
      {/* Header in Wink Style */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200/60">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-[#FFF2EE] text-[#FF5A36] border border-[#FFD9CE]">
              Session Ledger
            </span>
            <span className="text-slate-300">&bull;</span>
            <span className="text-xs text-slate-500 font-medium">Verified Records</span>
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2 mt-1.5">
            <History className="w-6 h-6 text-[#FF5A36]" />
            <span>Attendance History & Archives</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Audit historical attendance sessions, inspect individual student timestamps, and generate registers.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={loadData}
            className="enterprise-btn-secondary text-xs flex items-center gap-2"
            title="Refresh History"
          >
            <RefreshCw className="w-3.5 h-3.5 text-slate-600" />
            <span>Refresh</span>
          </button>
          {sessions.length > 0 && (
            <button
              onClick={handleClearAllSessions}
              className="px-3 py-1.5 text-xs font-bold text-rose-700 bg-rose-50 border border-rose-200 hover:bg-rose-100 rounded-xl flex items-center gap-1.5 transition-colors"
              title="Remove unwanted test sessions"
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-600" />
              <span>Clear Test Sessions</span>
            </button>
          )}
        </div>
      </div>

      {statusMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl text-xs font-semibold flex items-center gap-2.5">
          <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{statusMsg}</span>
        </div>
      )}

      {/* History Summary Wink Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="glass-card p-5 border-l-4 border-l-cyan-500">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
            Archived Sessions
          </span>
          <div className="text-3xl font-extrabold text-slate-900 mt-1">
            {totalSessionsCount}
          </div>
          <span className="text-xs text-slate-400 font-medium block mt-1">
            Stored in local SQLite
          </span>
        </div>

        <div className="glass-card p-5 border-l-4 border-l-emerald-500">
          <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 block">
            Total Present Marked
          </span>
          <div className="text-3xl font-extrabold text-emerald-700 mt-1">
            {totalPresentCount}
          </div>
          <span className="text-xs text-emerald-600 font-medium block mt-1">
            Across filtered sessions
          </span>
        </div>

        <div className="glass-card p-5 border-l-4 border-l-rose-500">
          <span className="text-[11px] font-bold uppercase tracking-wider text-rose-700 block">
            Total Absent Marked
          </span>
          <div className="text-3xl font-extrabold text-rose-700 mt-1">
            {totalAbsentCount}
          </div>
          <span className="text-xs text-rose-600 font-medium block mt-1">
            Across filtered sessions
          </span>
        </div>

        <div className="glass-card p-5 border-l-4 border-l-[#FF5A36]">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#FF5A36] block">
            Average Attendance Rate
          </span>
          <div className="text-3xl font-extrabold text-slate-900 mt-1">
            {averageAttendanceRate}%
          </div>
          <span className="text-xs text-[#FF5A36] font-medium block mt-1">
            Institutional aggregate
          </span>
        </div>
      </div>

      {/* Filter Toolbar in Wink Style */}
      <div className="glass-card p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2 font-bold text-slate-600">
            <Filter className="w-4 h-4 text-[#FF5A36]" /> Filters:
          </div>

          <div className="flex items-center gap-2">
            <label className="font-bold text-slate-700">Section:</label>
            <select
              value={selectedSectionFilter}
              onChange={(e) => setSelectedSectionFilter(e.target.value)}
              className="border border-slate-200 rounded-xl px-3 py-1.5 bg-white text-slate-800 font-bold focus:outline-none focus:ring-2 focus:ring-[#FF5A36]"
            >
              <option value="ALL">All Sections ({sessions.length})</option>
              {sections.map(sec => (
                <option key={sec.sectionId} value={`${sec.className}-${sec.sectionName}`}>
                  Class {sec.className}-{sec.sectionName}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label className="font-bold text-slate-700">Date (IST):</label>
            <input
              type="date"
              value={selectedDateFilter}
              onChange={(e) => setSelectedDateFilter(e.target.value)}
              className="border border-slate-200 rounded-xl px-3 py-1.5 bg-white text-slate-800 font-bold focus:outline-none focus:ring-2 focus:ring-[#FF5A36]"
            />
            {selectedDateFilter && (
              <button
                onClick={() => setSelectedDateFilter('')}
                className="text-[#FF5A36] hover:underline font-bold text-xs"
              >
                Clear Date
              </button>
            )}
          </div>
        </div>

        <div className="text-slate-500 font-medium">
          Showing <strong className="text-slate-900 font-extrabold text-sm">{filteredSessions.length}</strong> sessions
        </div>
      </div>

      {/* Sessions Table */}
      <DataTable
        columns={columns}
        data={filteredSessions}
        searchPlaceholder="Search history by date, class..."
        searchKey="date"
      />

      {/* Drill-down Modal */}
      <Modal
        isOpen={!!selectedSession && !showPrintRegister}
        onClose={() => setSelectedSession(null)}
        title={selectedSession ? `Session Roster: Class ${selectedSession.class}-${selectedSession.section} (${formatKolkataDate(selectedSession.date)})` : 'Session Details'}
        maxWidth="max-w-2xl"
      >
        <div className="space-y-4 text-xs">
          {/* Header Action Strip */}
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <span className="text-slate-500 font-medium">
              Session ID: <code className="font-mono text-slate-800 font-bold">{selectedSession?.sessionId}</code>
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowPrintRegister(true)}
                className="enterprise-btn-primary text-xs py-1.5"
              >
                <Printer className="w-3.5 h-3.5" /> Print Official Register
              </button>
              <button
                onClick={() => {
                  const s = selectedSession;
                  setSelectedSession(null);
                  handleDeleteSession(s.sessionId, `${s.class}-${s.section}`, s.date);
                }}
                className="px-3 py-1.5 text-xs font-bold text-rose-700 bg-rose-50 border border-rose-200 hover:bg-rose-100 rounded-xl flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-600" /> Delete Session
              </button>
            </div>
          </div>

          {/* Summary KPIs */}
          <div className="grid grid-cols-4 gap-3 text-center bg-slate-50/80 p-3.5 rounded-2xl border border-slate-200">
            <div>
              <span className="text-[10px] text-slate-400 block uppercase font-bold">Class</span>
              <span className="font-extrabold text-slate-800 text-sm">{selectedSession?.class}-{selectedSession?.section}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 block uppercase font-bold">Present</span>
              <span className="font-extrabold text-emerald-700 text-sm">{selectedSession?.presentCount || 0}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 block uppercase font-bold">Absent</span>
              <span className="font-extrabold text-rose-600 text-sm">{selectedSession?.absentCount || 0}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 block uppercase font-bold">Status</span>
              <span className="font-extrabold text-slate-700 text-sm">{selectedSession?.status?.toUpperCase()}</span>
            </div>
          </div>

          {/* Records Table */}
          <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 border border-slate-100 rounded-2xl">
            {recordsLoading ? (
              <div className="p-8 text-center text-slate-400">Loading student records...</div>
            ) : sessionRecords.length > 0 ? (
              sessionRecords.map((r) => {
                const stu = students.find(s => s.studentId === r.studentId);
                const isPresent = ['present', 'manually_added', 'late'].includes(r.status);

                return (
                  <div key={r.recordId} className="p-3 flex items-center justify-between hover:bg-slate-50 transition-colors">
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-slate-400 w-6 font-bold">
                        {stu?.rollNumber || '—'}
                      </span>
                      <div className="w-8 h-8 rounded-2xl bg-[#FFF2EE] text-[#FF5A36] border border-[#FFD9CE] overflow-hidden flex items-center justify-center shrink-0 font-extrabold text-xs">
                        <img
                          src={r.hasSnapshot ? apiService.getAttendanceSnapshotUrl(r.recordId) : apiService.getStudentPhotoUrl(r.studentId)}
                          alt={stu?.fullName || r.studentId}
                          className="w-full h-full object-cover"
                          onError={(e) => { e.target.style.display = 'none'; }}
                        />
                        <span>{(stu?.fullName || r.studentId).slice(0, 2).toUpperCase()}</span>
                      </div>
                      <div>
                        <div className="font-bold text-slate-900">{stu?.fullName || r.studentId}</div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          ID: {r.studentId} &bull; Method: {r.method}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                        isPresent
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-rose-50 text-rose-700 border border-rose-200'
                      }`}>
                        {r.status?.toUpperCase()}
                      </span>
                      {r.notes && (
                        <span className="text-[10px] text-slate-400 max-w-xs truncate" title={r.notes}>
                          ({r.notes})
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="p-8 text-center text-slate-400">No records found for this session.</div>
            )}
          </div>
        </div>
      </Modal>

      {/* Official Printable Register Modal */}
      {showPrintRegister && selectedSession && (
        <Modal
          isOpen={showPrintRegister}
          onClose={() => setShowPrintRegister(false)}
          title={`Official Attendance Register: Class ${selectedSession.class}-${selectedSession.section}`}
          maxWidth="max-w-5xl"
        >
          <PrintableRegister
            mode="session"
            session={selectedSession}
            sessionRecords={sessionRecords}
            students={students}
            selectedClass={selectedSession.class}
            selectedSection={selectedSession.section}
            onClose={() => setShowPrintRegister(false)}
            embedded={true}
          />
        </Modal>
      )}
    </div>
  );
}
