import React, { useState, useEffect } from 'react';
import {
  FileSpreadsheet,
  Printer,
  Calendar,
  Filter,
  CheckCircle,
  XCircle,
  Percent,
  Download,
  BookOpen,
  LayoutGrid,
  FileText
} from 'lucide-react';
import DataTable from '../components/DataTable';
import PrintableRegister from '../components/PrintableRegister';
import { storageService } from '../services/storageService';
import { apiService } from '../services/apiService';

export default function ReportsPage() {
  const [students, setStudents] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);

  // View state
  const [activeView, setActiveView] = useState('analytics'); // 'analytics' | 'register'
  const [registerMode, setRegisterMode] = useState('monthly'); // 'monthly' | 'session'
  const [selectedSessionId, setSelectedSessionId] = useState('');

  // Filters
  const [selectedClass, setSelectedClass] = useState('10');
  const [selectedSection, setSelectedSection] = useState('A');
  const [reportType, setReportType] = useState('STUDENT_WISE'); // 'STUDENT_WISE', 'ABSENT_ONLY'

  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    setLoading(true);
    try {
      const stuList = storageService.getStudents();
      setStudents(stuList);

      const [sessRes, recRes] = await Promise.allSettled([
        apiService.getSessions(),
        apiService.getAllAttendanceRecords()
      ]);

      let loadedSessions = [];
      if (sessRes.status === 'fulfilled' && sessRes.value && sessRes.value.sessions) {
        loadedSessions = sessRes.value.sessions.filter(s => s.status === 'completed');
        setSessions(loadedSessions);
        if (loadedSessions.length > 0) {
          setSelectedSessionId(loadedSessions[0].sessionId);
        }
      }

      if (recRes.status === 'fulfilled' && recRes.value && recRes.value.records) {
        setRecords(recRes.value.records);
      }
    } catch (_) {
    } finally {
      setLoading(false);
    }
  };

  // Map records for exact student-wise metric calculations
  const recordMap = {};
  records.forEach(r => {
    recordMap[`${r.sessionId}_${r.studentId}`] = r;
  });

  // Calculate real student attendance metrics based on actual SQLite session records
  const reportRows = students
    .filter(s => {
      if (selectedClass !== 'ALL' && s.class !== selectedClass) return false;
      if (selectedSection !== 'ALL' && s.section !== selectedSection) return false;
      return true;
    })
    .map(student => {
      const studentSessions = sessions.filter(
        sess => sess.class === student.class && sess.section === student.section
      );

      const totalSessions = studentSessions.length;
      let presentCount = 0;
      let absentCount = 0;

      studentSessions.forEach(sess => {
        const rec = recordMap[`${sess.sessionId}_${student.studentId}`];
        const isP = rec && ['present', 'manually_added', 'late'].includes(rec.status);
        if (isP) presentCount++;
        else absentCount++;
      });

      const pct = totalSessions > 0 ? Math.round((presentCount / totalSessions) * 100) : 100;

      return {
        studentId: student.studentId,
        rollNumber: student.rollNumber || '—',
        fullName: student.fullName,
        class: student.class,
        section: student.section,
        totalSessions,
        presentCount,
        absentCount,
        percentage: `${pct}%`,
        status: pct >= 85 ? 'GOOD' : pct >= 75 ? 'WARNING' : 'CRITICAL'
      };
    })
    .filter(r => {
      if (reportType === 'ABSENT_ONLY' && r.absentCount === 0) return false;
      return true;
    });

  const exportCSV = () => {
    const headers = ["Roll #", "Student ID", "Full Name", "Class", "Section", "Total Sessions", "Present", "Absent", "Attendance %"];
    const csvContent = [
      headers.join(","),
      ...reportRows.map(r => [
        `"${r.rollNumber}"`,
        `"${r.studentId}"`,
        `"${r.fullName}"`,
        `"${r.class}"`,
        `"${r.section}"`,
        r.totalSessions,
        r.presentCount,
        r.absentCount,
        `"${r.percentage}"`
      ].join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `attendance_analytics_class${selectedClass}-${selectedSection}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const selectedSessionObj = sessions.find(s => s.sessionId === selectedSessionId) || sessions[0] || null;

  const columns = [
    {
      header: "Roll #",
      accessor: "rollNumber",
      render: (r) => <span className="font-mono font-bold text-slate-800">{r.rollNumber}</span>
    },
    {
      header: "Student",
      accessor: "fullName",
      render: (r) => (
        <div>
          <div className="font-semibold text-slate-800">{r.fullName}</div>
          <div className="text-[10px] text-slate-400 font-mono">{r.studentId}</div>
        </div>
      )
    },
    {
      header: "Class & Section",
      render: (r) => <span>Class {r.class}-{r.section}</span>
    },
    {
      header: "Total Sessions",
      accessor: "totalSessions",
      render: (r) => <span className="font-medium text-slate-700">{r.totalSessions}</span>
    },
    {
      header: "Present Count",
      accessor: "presentCount",
      render: (r) => <span className="font-bold text-teal-700">{r.presentCount}</span>
    },
    {
      header: "Absent Count",
      accessor: "absentCount",
      render: (r) => <span className="font-bold text-rose-600">{r.absentCount}</span>
    },
    {
      header: "Rate",
      accessor: "percentage",
      render: (r) => (
        <span className={`font-mono font-bold px-2 py-0.5 rounded text-xs ${
          r.status === 'GOOD'
            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
            : r.status === 'WARNING'
            ? 'bg-amber-50 text-amber-700 border border-amber-200'
            : 'bg-rose-50 text-rose-700 border border-rose-200'
        }`}>
          {r.percentage}
        </span>
      )
    }
  ];

  return (
    <div className="space-y-6">
      {/* Top Header & View Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-4 no-print">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Attendance Analytics & Registers</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Audit institutional attendance data, generate analytics, and print official certified registers.
          </p>
        </div>

        {/* View Switcher Tabs */}
        <div className="flex items-center gap-2 bg-slate-200/80 p-1 rounded-lg">
          <button
            onClick={() => setActiveView('analytics')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
              activeView === 'analytics'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <LayoutGrid className="w-3.5 h-3.5" /> Analytics Overview
          </button>
          <button
            onClick={() => setActiveView('register')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
              activeView === 'register'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <FileText className="w-3.5 h-3.5" /> 📄 Official Register (Print / PDF)
          </button>
        </div>
      </div>

      {activeView === 'analytics' ? (
        /* ================= ANALYTICS OVERVIEW VIEW ================= */
        <div className="space-y-6">
          {/* Action Toolbar */}
          <div className="flex items-center justify-between">
            <div className="text-xs text-slate-500">
              Computed directly from <strong>{sessions.length}</strong> finalized sessions and <strong>{records.length}</strong> attendance records.
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={exportCSV}
                className="enterprise-btn-secondary text-xs"
              >
                <Download className="w-3.5 h-3.5" /> Export Summary CSV
              </button>
              <button
                onClick={() => setActiveView('register')}
                className="enterprise-btn-primary text-xs"
              >
                <Printer className="w-3.5 h-3.5" /> Print Official Register
              </button>
            </div>
          </div>

          {/* Filter Toolbar */}
          <div className="enterprise-card p-4 flex items-center justify-between bg-white text-xs">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <label className="font-semibold text-slate-700">Scope:</label>
                <select
                  value={reportType}
                  onChange={(e) => setReportType(e.target.value)}
                  className="border border-slate-200 rounded px-2.5 py-1.5 bg-white text-slate-800 font-medium"
                >
                  <option value="STUDENT_WISE">Student-wise Aggregate</option>
                  <option value="ABSENT_ONLY">Absentee List Only</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <label className="font-semibold text-slate-700">Class:</label>
                <select
                  value={selectedClass}
                  onChange={(e) => setSelectedClass(e.target.value)}
                  className="border border-slate-200 rounded px-2.5 py-1.5 bg-white text-slate-800"
                >
                  <option value="ALL">All Classes</option>
                  <option value="10">Class 10</option>
                  <option value="11">Class 11</option>
                  <option value="12">Class 12</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <label className="font-semibold text-slate-700">Section:</label>
                <select
                  value={selectedSection}
                  onChange={(e) => setSelectedSection(e.target.value)}
                  className="border border-slate-200 rounded px-2.5 py-1.5 bg-white text-slate-800"
                >
                  <option value="ALL">All Sections</option>
                  <option value="A">Section A</option>
                  <option value="B">Section B</option>
                  <option value="Science">Section Science</option>
                </select>
              </div>
            </div>

            <div className="text-slate-500">
              Showing <strong>{reportRows.length}</strong> students
            </div>
          </div>

          {/* Report Data Table */}
          <DataTable
            columns={columns}
            data={reportRows}
            searchPlaceholder="Search student by name, roll #..."
          />
        </div>
      ) : (
        /* ================= OFFICIAL PRINTABLE REGISTER VIEW ================= */
        <div className="space-y-6">
          {/* Register Settings Ribbon (Screen Only) */}
          <div className="no-print enterprise-card p-4 bg-white border-blue-200 shadow-xs flex flex-wrap items-center justify-between gap-4 text-xs">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <label className="font-bold text-slate-800">Register Format:</label>
                <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded border border-slate-200">
                  <button
                    onClick={() => setRegisterMode('monthly')}
                    className={`px-3 py-1 rounded font-medium transition-all ${
                      registerMode === 'monthly'
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Cumulative Academic Matrix
                  </button>
                  <button
                    onClick={() => setRegisterMode('session')}
                    className={`px-3 py-1 rounded font-medium transition-all ${
                      registerMode === 'session'
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Single Session Official Roster
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <label className="font-bold text-slate-700">Class:</label>
                <select
                  value={selectedClass}
                  onChange={(e) => setSelectedClass(e.target.value)}
                  className="border border-slate-200 rounded px-2.5 py-1 bg-white text-slate-800 font-medium"
                >
                  <option value="10">Class 10</option>
                  <option value="11">Class 11</option>
                  <option value="12">Class 12</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <label className="font-bold text-slate-700">Section:</label>
                <select
                  value={selectedSection}
                  onChange={(e) => setSelectedSection(e.target.value)}
                  className="border border-slate-200 rounded px-2.5 py-1 bg-white text-slate-800 font-medium"
                >
                  <option value="A">Section A</option>
                  <option value="B">Section B</option>
                  <option value="Science">Section Science</option>
                </select>
              </div>

              {registerMode === 'session' && (
                <div className="flex items-center gap-2">
                  <label className="font-bold text-slate-700">Session:</label>
                  <select
                    value={selectedSessionId}
                    onChange={(e) => setSelectedSessionId(e.target.value)}
                    className="border border-slate-200 rounded px-2.5 py-1 bg-white text-slate-800 font-medium max-w-[200px]"
                  >
                    {sessions
                      .filter(s => s.class === selectedClass && s.section === selectedSection)
                      .map(s => (
                        <option key={s.sessionId} value={s.sessionId}>
                          {s.date} ({s.sessionId.slice(-6)})
                        </option>
                      ))}
                    {sessions.filter(s => s.class === selectedClass && s.section === selectedSection).length === 0 && (
                      <option value="">No sessions for this class</option>
                    )}
                  </select>
                </div>
              )}
            </div>

            <div className="text-slate-500 font-medium">
              💡 Tip: Click <strong>"Print / Save as PDF"</strong> to generate a certified PDF document.
            </div>
          </div>

          {/* Render the Printable Register */}
          <PrintableRegister
            mode={registerMode}
            session={selectedSessionObj}
            sessions={sessions}
            records={records}
            students={students}
            selectedClass={selectedClass}
            selectedSection={selectedSection}
            institutionName="SMARTCLASSROOM ACADEMIC SYSTEM"
            facultyName="Authorized Faculty Member"
            facultyId="FAC-REC"
            academicYear="2026–2027"
          />
        </div>
      )}
    </div>
  );
}
