import React, { useRef } from 'react';
import {
  Printer,
  Download,
  X,
  GraduationCap,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ShieldCheck,
  Calendar,
  User,
  Clock,
  Building
} from 'lucide-react';

/**
 * Printable Attendance Register Component.
 * Supports:
 * 1. mode="session": Official single-session roster with AI confidence, timestamp, method.
 * 2. mode="monthly": Official cumulative multi-session gradebook matrix with P/A columns and rates.
 * Formatted for A4 / Letter paper with official academic institutional headers and signature blocks.
 */
export default function PrintableRegister({
  mode = 'monthly',
  session = null,
  sessionRecords = [],
  sessions = [],
  records = [],
  students = [],
  selectedClass = '10',
  selectedSection = 'A',
  institutionName = 'SMARTCLASSROOM ACADEMIC SYSTEM',
  institutionSubtitle = 'Accredited Higher Secondary & Technical Education Institution',
  facultyName = 'Authorized Faculty Lecturer',
  facultyId = 'FAC-REC',
  academicYear = '2026–2027',
  subject = 'Computer Science & AI Lab',
  onClose = null,
  embedded = false
}) {
  const registerRef = useRef(null);

  // Filter students based on class and section
  const relevantStudents = students.filter(s => {
    if (selectedClass && selectedClass !== 'ALL' && s.class !== selectedClass) return false;
    if (selectedSection && selectedSection !== 'ALL' && s.section !== selectedSection) return false;
    return true;
  }).sort((a, b) => {
    const rollA = parseInt(a.rollNumber, 10) || 0;
    const rollB = parseInt(b.rollNumber, 10) || 0;
    return rollA - rollB || (a.fullName || '').localeCompare(b.fullName || '');
  });

  // Filter sessions for monthly mode
  const relevantSessions = (mode === 'monthly' ? sessions : [session]).filter(Boolean).filter(sess => {
    if (selectedClass && selectedClass !== 'ALL' && sess.class !== selectedClass) return false;
    if (selectedSection && selectedSection !== 'ALL' && sess.section !== selectedSection) return false;
    return true;
  }).sort((a, b) => (a.date || '').localeCompare(b.date || '') || (a.startTime || 0) - (b.startTime || 0));

  // Compute lookup of records by sessionId and studentId
  const recordMap = {};
  const allRecs = mode === 'session' ? sessionRecords : records;
  allRecs.forEach(r => {
    const key = `${r.sessionId}_${r.studentId}`;
    recordMap[key] = r;
  });

  // Calculate high-level summary KPIs
  let totalStudentEntries = 0;
  let totalPresentMarks = 0;
  let totalAbsentMarks = 0;
  let totalAiVerified = 0;
  let totalManualMarks = 0;

  if (mode === 'session') {
    totalStudentEntries = relevantStudents.length;
    relevantStudents.forEach(stu => {
      const rec = recordMap[`${session?.sessionId}_${stu.studentId}`];
      const isPresent = rec && ['present', 'manually_added', 'late'].includes(rec.status);
      if (isPresent) {
        totalPresentMarks += 1;
        if (rec?.method === 'ai') totalAiVerified += 1;
        else totalManualMarks += 1;
      } else {
        totalAbsentMarks += 1;
      }
    });
  } else {
    relevantSessions.forEach(sess => {
      relevantStudents.forEach(stu => {
        totalStudentEntries += 1;
        const rec = recordMap[`${sess.sessionId}_${stu.studentId}`];
        const isPresent = rec && ['present', 'manually_added', 'late'].includes(rec.status);
        if (isPresent) {
          totalPresentMarks += 1;
          if (rec?.method === 'ai') totalAiVerified += 1;
          else totalManualMarks += 1;
        } else {
          totalAbsentMarks += 1;
        }
      });
    });
  }

  const overallRate = totalStudentEntries > 0
    ? Math.round((totalPresentMarks / totalStudentEntries) * 100)
    : 0;

  const handlePrint = () => {
    window.print();
  };

  const handleExportCSV = () => {
    let headers = [];
    let rows = [];

    if (mode === 'session') {
      headers = ['Roll #', 'Student ID', 'Student Full Name', 'Class', 'Section', 'Status', 'Method', 'Confidence Score', 'Timestamp', 'Remarks'];
      rows = relevantStudents.map(stu => {
        const rec = recordMap[`${session?.sessionId}_${stu.studentId}`];
        const status = rec?.status ? rec.status.toUpperCase() : 'ABSENT';
        const method = rec?.method || 'N/A';
        const conf = rec?.confidenceScore ? `${Math.round(rec.confidenceScore * 100)}%` : '—';
        const timeStr = rec?.detectedAt ? new Date(rec.detectedAt * 1000).toLocaleTimeString() : '—';
        const notes = rec?.notes || '';
        return [
          `"${stu.rollNumber || ''}"`,
          `"${stu.studentId}"`,
          `"${stu.fullName}"`,
          `"${stu.class}"`,
          `"${stu.section}"`,
          `"${status}"`,
          `"${method}"`,
          `"${conf}"`,
          `"${timeStr}"`,
          `"${notes}"`
        ];
      });
    } else {
      const dateHeaders = relevantSessions.map(s => `"${s.date || 'Session'}"`);
      headers = ['Roll #', 'Student ID', 'Student Full Name', 'Class', 'Section', ...dateHeaders, 'Total Sessions', 'Present', 'Absent', 'Attendance %', 'Standing'];
      rows = relevantStudents.map(stu => {
        let pCount = 0;
        let aCount = 0;
        const marks = relevantSessions.map(sess => {
          const rec = recordMap[`${sess.sessionId}_${stu.studentId}`];
          const isP = rec && ['present', 'manually_added', 'late'].includes(rec.status);
          if (isP) {
            pCount += 1;
            return '"P"';
          } else {
            aCount += 1;
            return '"A"';
          }
        });
        const total = pCount + aCount;
        const pct = total > 0 ? Math.round((pCount / total) * 100) : 0;
        const standing = pct >= 75 ? 'ELIGIBLE' : pct >= 65 ? 'WARNING' : 'SHORTAGE';
        return [
          `"${stu.rollNumber || ''}"`,
          `"${stu.studentId}"`,
          `"${stu.fullName}"`,
          `"${stu.class}"`,
          `"${stu.section}"`,
          ...marks,
          total,
          pCount,
          aCount,
          `"${pct}%"`,
          `"${standing}"`
        ];
      });
    }

    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const filename = mode === 'session'
      ? `attendance_register_session_${session?.date || 'export'}_class${selectedClass}-${selectedSection}.csv`
      : `attendance_register_cumulative_class${selectedClass}-${selectedSection}_${new Date().toISOString().split('T')[0]}.csv`;
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const docRefId = mode === 'session'
    ? `REG-SESS-${(session?.sessionId || 'DEMO').slice(-8).toUpperCase()}`
    : `REG-TERM-${selectedClass}${selectedSection}-${new Date().toISOString().slice(0, 7)}`;

  return (
    <div className={`print-wrapper ${embedded ? '' : 'bg-slate-100 p-6 rounded-xl border border-slate-200'}`}>
      {/* Action / Control Ribbon (Hidden during printing) */}
      <div className="no-print mb-6 p-4 bg-white rounded-lg border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-50 border border-blue-200 text-blue-700 flex items-center justify-center font-bold">
            <GraduationCap className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              {mode === 'session' ? 'Official Session Attendance Register' : 'Cumulative Academic Attendance Register'}
            </h3>
            <p className="text-xs text-slate-500">
              Class {selectedClass}-{selectedSection} &bull; Document Ref: <span className="font-mono font-medium text-slate-700">{docRefId}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleExportCSV}
            className="enterprise-btn-secondary text-xs"
            title="Download CSV Spreadsheet"
          >
            <Download className="w-4 h-4" /> Export CSV
          </button>

          <button
            onClick={handlePrint}
            className="enterprise-btn-primary text-xs font-semibold px-4 py-2"
            title="Open browser print preview or Save as PDF"
          >
            <Printer className="w-4 h-4" /> Print / Save as PDF
          </button>

          {onClose && (
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
              title="Close Preview"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* Official Printable Document Container */}
      <div
        ref={registerRef}
        id="printable-register"
        className="printable-document bg-white p-8 rounded-lg shadow-md border border-slate-300 max-w-6xl mx-auto text-slate-900 font-sans print:shadow-none print:border-none print:p-0 print:m-0 print:max-w-none"
      >
        {/* Document Header */}
        <div className="border-b-2 border-slate-900 pb-4 mb-6">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-lg bg-slate-900 text-white flex items-center justify-center font-bold shadow-sm">
                <GraduationCap className="w-8 h-8" />
              </div>
              <div>
                <h1 className="text-xl font-black tracking-tight text-slate-900 uppercase">
                  {institutionName}
                </h1>
                <p className="text-xs text-slate-600 font-medium">
                  {institutionSubtitle}
                </p>
                <div className="text-[11px] font-mono text-slate-500 mt-1 uppercase tracking-wider">
                  OFFICIAL GRADEBOOK & BIOMETRIC ATTENDANCE REGISTER
                </div>
              </div>
            </div>

            <div className="text-right border border-slate-300 p-2.5 rounded bg-slate-50/50 min-w-[200px]">
              <div className="text-[10px] uppercase tracking-wider font-bold text-slate-500">Document Ref</div>
              <div className="font-mono font-bold text-xs text-slate-900">{docRefId}</div>
              <div className="text-[10px] text-slate-500 mt-1">Generated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
            </div>
          </div>

          {/* Academic Metadata Grid */}
          <div className="grid grid-cols-4 gap-4 mt-5 pt-4 border-t border-slate-200 text-xs">
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-500 block">Class & Section</span>
              <span className="font-bold text-slate-900 text-sm">Class {selectedClass} - Section {selectedSection}</span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-500 block">Subject / Lab</span>
              <span className="font-semibold text-slate-800">{subject}</span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-500 block">Faculty In-Charge</span>
              <span className="font-semibold text-slate-800">{facultyName} <span className="text-slate-500 font-mono text-[11px]">({facultyId})</span></span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-500 block">Academic Year / Scope</span>
              <span className="font-semibold text-slate-800">
                {mode === 'session' ? `Date: ${session?.date || 'N/A'}` : `Term: ${academicYear}`}
              </span>
            </div>
          </div>
        </div>

        {/* Statistical KPI Strip */}
        <div className="grid grid-cols-5 gap-3 mb-6 bg-slate-50 border border-slate-200 rounded p-3 text-center print:bg-white print:border-slate-800">
          <div className="border-r border-slate-200 pr-2 last:border-none">
            <div className="text-[10px] uppercase font-bold text-slate-500">Total Enrolled</div>
            <div className="text-base font-black text-slate-900">{relevantStudents.length}</div>
          </div>
          <div className="border-r border-slate-200 pr-2 last:border-none">
            <div className="text-[10px] uppercase font-bold text-slate-500">
              {mode === 'session' ? 'Session Records' : 'Total Sessions'}
            </div>
            <div className="text-base font-black text-slate-900">
              {mode === 'session' ? relevantStudents.length : relevantSessions.length}
            </div>
          </div>
          <div className="border-r border-slate-200 pr-2 last:border-none">
            <div className="text-[10px] uppercase font-bold text-slate-500">Present (P)</div>
            <div className="text-base font-black text-emerald-700">{totalPresentMarks}</div>
          </div>
          <div className="border-r border-slate-200 pr-2 last:border-none">
            <div className="text-[10px] uppercase font-bold text-slate-500">Absent (A)</div>
            <div className="text-base font-black text-rose-700">{totalAbsentMarks}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase font-bold text-slate-500">Attendance Rate</div>
            <div className="text-base font-black text-blue-700">{overallRate}%</div>
          </div>
        </div>

        {/* Register Content Table */}
        <div className="mb-6 overflow-x-auto">
          {mode === 'session' ? (
            /* MODE A: Single Session Detailed Roster */
            <table className="w-full text-left border-collapse border border-slate-300 text-xs">
              <thead>
                <tr className="bg-slate-100 text-slate-700 border-b border-slate-300 print:bg-slate-200">
                  <th className="p-2 border border-slate-300 text-center w-12 font-bold">#</th>
                  <th className="p-2 border border-slate-300 w-16 font-bold">Roll</th>
                  <th className="p-2 border border-slate-300 w-24 font-bold">Student ID</th>
                  <th className="p-2 border border-slate-300 font-bold">Student Full Name</th>
                  <th className="p-2 border border-slate-300 text-center w-20 font-bold">Status</th>
                  <th className="p-2 border border-slate-300 w-36 font-bold">Verification Method</th>
                  <th className="p-2 border border-slate-300 text-center w-24 font-bold">Confidence</th>
                  <th className="p-2 border border-slate-300 text-center w-24 font-bold">Time</th>
                  <th className="p-2 border border-slate-300 font-bold">Audit Remarks</th>
                </tr>
              </thead>
              <tbody>
                {relevantStudents.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="p-4 text-center text-slate-500 border border-slate-300">
                      No enrolled students found for Class {selectedClass}-{selectedSection}.
                    </td>
                  </tr>
                ) : (
                  relevantStudents.map((stu, idx) => {
                    const rec = recordMap[`${session?.sessionId}_${stu.studentId}`];
                    const isPresent = rec && ['present', 'manually_added', 'late'].includes(rec.status);
                    const isManual = rec?.method === 'manual';
                    const isFinalized = rec?.method === 'finalization';
                    const conf = rec?.confidenceScore ? `${Math.round(rec.confidenceScore * 100)}%` : '—';
                    const timeStr = rec?.detectedAt ? new Date(rec.detectedAt * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—';

                    return (
                      <tr key={stu.studentId} className="border-b border-slate-200 hover:bg-slate-50/50 print:hover:bg-transparent">
                        <td className="p-2 border border-slate-300 text-center text-slate-500 font-mono">{idx + 1}</td>
                        <td className="p-2 border border-slate-300 font-mono font-bold text-slate-800">{stu.rollNumber || '—'}</td>
                        <td className="p-2 border border-slate-300 font-mono text-slate-600">{stu.studentId}</td>
                        <td className="p-2 border border-slate-300 font-semibold text-slate-900">{stu.fullName}</td>
                        <td className="p-2 border border-slate-300 text-center font-bold">
                          {isPresent ? (
                            <span className="inline-block px-2 py-0.5 rounded text-[11px] bg-emerald-100 text-emerald-800 border border-emerald-300 print:border-black print:text-black">
                              P (Present)
                            </span>
                          ) : (
                            <span className="inline-block px-2 py-0.5 rounded text-[11px] bg-rose-100 text-rose-800 border border-rose-300 print:border-black print:text-black">
                              A (Absent)
                            </span>
                          )}
                        </td>
                        <td className="p-2 border border-slate-300 text-slate-700">
                          {rec?.method === 'ai' ? (
                            <span className="text-teal-700 font-medium">AI Facial Biometric</span>
                          ) : isManual ? (
                            <span className="text-amber-800 font-medium">Manual Correction</span>
                          ) : isFinalized ? (
                            <span className="text-slate-500">Session Finalization</span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="p-2 border border-slate-300 text-center font-mono font-medium text-slate-700">{conf}</td>
                        <td className="p-2 border border-slate-300 text-center font-mono text-slate-600">{timeStr}</td>
                        <td className="p-2 border border-slate-300 text-slate-600 text-[11px]">
                          {rec?.notes || (isPresent ? 'Facial match verified' : 'No biometric detection recorded')}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          ) : (
            /* MODE B: Cumulative Monthly / Term Attendance Matrix */
            <table className="w-full text-left border-collapse border border-slate-300 text-xs">
              <thead>
                <tr className="bg-slate-100 text-slate-700 border-b border-slate-300 print:bg-slate-200">
                  <th className="p-2 border border-slate-300 text-center w-10 font-bold">#</th>
                  <th className="p-2 border border-slate-300 w-14 font-bold">Roll</th>
                  <th className="p-2 border border-slate-300 w-24 font-bold">Student ID</th>
                  <th className="p-2 border border-slate-300 font-bold min-w-[140px]">Student Full Name</th>

                  {/* Dynamic Date Columns */}
                  {relevantSessions.map((sess, sIdx) => {
                    const datePart = (sess.date || '').slice(5); // e.g. "11-14"
                    return (
                      <th
                        key={sess.sessionId}
                        className="p-1 border border-slate-300 text-center font-bold font-mono text-[10px] w-12"
                        title={`${sess.date} (${sess.title || 'Session'})`}
                      >
                        <div>{datePart || `S${sIdx + 1}`}</div>
                      </th>
                    );
                  })}

                  <th className="p-2 border border-slate-300 text-center w-12 font-bold bg-slate-50">Tot</th>
                  <th className="p-2 border border-slate-300 text-center w-12 font-bold bg-emerald-50 text-emerald-800">P</th>
                  <th className="p-2 border border-slate-300 text-center w-12 font-bold bg-rose-50 text-rose-800">A</th>
                  <th className="p-2 border border-slate-300 text-center w-16 font-bold bg-blue-50 text-blue-900">Rate</th>
                  <th className="p-2 border border-slate-300 text-center w-20 font-bold">Standing</th>
                </tr>
              </thead>
              <tbody>
                {relevantStudents.length === 0 ? (
                  <tr>
                    <td colSpan={8 + relevantSessions.length} className="p-4 text-center text-slate-500 border border-slate-300">
                      No enrolled students found for Class {selectedClass}-{selectedSection}.
                    </td>
                  </tr>
                ) : (
                  relevantStudents.map((stu, idx) => {
                    let pCount = 0;
                    let aCount = 0;

                    return (
                      <tr key={stu.studentId} className="border-b border-slate-200 hover:bg-slate-50/50 print:hover:bg-transparent">
                        <td className="p-2 border border-slate-300 text-center text-slate-500 font-mono">{idx + 1}</td>
                        <td className="p-2 border border-slate-300 font-mono font-bold text-slate-800">{stu.rollNumber || '—'}</td>
                        <td className="p-2 border border-slate-300 font-mono text-slate-600">{stu.studentId}</td>
                        <td className="p-2 border border-slate-300 font-semibold text-slate-900">{stu.fullName}</td>

                        {/* Date Attendance cells */}
                        {relevantSessions.map((sess) => {
                          const rec = recordMap[`${sess.sessionId}_${stu.studentId}`];
                          const isPresent = rec && ['present', 'manually_added', 'late'].includes(rec.status);
                          if (isPresent) pCount += 1;
                          else aCount += 1;

                          return (
                            <td
                              key={sess.sessionId}
                              className={`p-1 border border-slate-300 text-center font-mono font-bold text-[11px] ${
                                isPresent ? 'text-emerald-700 bg-emerald-50/40' : 'text-rose-600 bg-rose-50/40'
                              }`}
                            >
                              {isPresent ? 'P' : 'A'}
                            </td>
                          );
                        })}

                        {/* Metrics */}
                        {(() => {
                          const total = pCount + aCount;
                          const pct = total > 0 ? Math.round((pCount / total) * 100) : 0;
                          const standing = pct >= 75 ? 'ELIGIBLE' : pct >= 65 ? 'WARNING' : 'SHORTAGE';

                          return (
                            <>
                              <td className="p-2 border border-slate-300 text-center font-mono font-medium text-slate-700 bg-slate-50">
                                {total}
                              </td>
                              <td className="p-2 border border-slate-300 text-center font-mono font-bold text-emerald-700 bg-emerald-50/30">
                                {pCount}
                              </td>
                              <td className="p-2 border border-slate-300 text-center font-mono font-bold text-rose-700 bg-rose-50/30">
                                {aCount}
                              </td>
                              <td className="p-2 border border-slate-300 text-center font-mono font-bold text-blue-900 bg-blue-50/30">
                                {pct}%
                              </td>
                              <td className="p-2 border border-slate-300 text-center">
                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                  standing === 'ELIGIBLE'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : standing === 'WARNING'
                                    ? 'bg-amber-100 text-amber-800'
                                    : 'bg-rose-100 text-rose-800'
                                }`}>
                                  {standing}
                                </span>
                              </td>
                            </>
                          );
                        })()}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          )}
        </div>

        {/* Legal & Regulatory Institutional Certification */}
        <div className="border border-slate-200 bg-slate-50/70 p-3 rounded mb-8 text-[11px] text-slate-600 leading-relaxed print:bg-white print:border-slate-400">
          <p className="font-semibold text-slate-800 mb-1">
            Institutional Regulatory Certification & Biometric Compliance Declaration:
          </p>
          <p>
            I hereby certify that this attendance register has been compiled through the SmartClassroom AI Biometric Vision System in accordance with statutory academic attendance requirements. Biometric verifications were processed locally with encrypted templates. All manual amendments and finalization overrides have been logged in the audit trail.
          </p>
        </div>

        {/* Official Sign-Off Footer Blocks */}
        <div className="grid grid-cols-3 gap-8 pt-4 border-t-2 border-slate-900 print:break-inside-avoid">
          {/* Class Teacher Signature */}
          <div className="text-center">
            <div className="h-16 flex items-end justify-center pb-2 border-b border-dashed border-slate-400">
              <span className="font-serif italic text-slate-500 text-xs">{facultyName}</span>
            </div>
            <div className="mt-2">
              <div className="font-bold text-slate-900 text-xs">Class Teacher / Faculty In-Charge</div>
              <div className="text-[10px] text-slate-500">{facultyName} &bull; Date: _______________</div>
            </div>
          </div>

          {/* Head of Department Signature */}
          <div className="text-center">
            <div className="h-16 flex items-end justify-center pb-2 border-b border-dashed border-slate-400">
              <span className="font-serif italic text-slate-500 text-xs">Dr. R. K. Vance</span>
            </div>
            <div className="mt-2">
              <div className="font-bold text-slate-900 text-xs">Head of Department (HOD)</div>
              <div className="text-[10px] text-slate-500">Dept. of Computer Science &bull; Date: _______________</div>
            </div>
          </div>

          {/* Principal / Registrar Seal Box */}
          <div className="text-center border-2 border-slate-900 p-2 rounded bg-slate-50/30 print:bg-transparent">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-700">Institutional Seal & Stamp</div>
            <div className="h-10 flex items-center justify-center text-slate-300 font-mono text-[9px] uppercase tracking-widest border border-dashed border-slate-300 my-1">
              [ Official Stamp Area ]
            </div>
            <div className="text-[10px] font-semibold text-slate-800">Office of the Principal / Registrar</div>
          </div>
        </div>
      </div>
    </div>
  );
}

