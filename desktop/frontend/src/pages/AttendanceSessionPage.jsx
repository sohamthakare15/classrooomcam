import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Play,
  Square,
  CheckCircle2,
  AlertCircle,
  Clock,
  UserCheck,
  Check,
  X,
  FileCheck,
  UserPlus,
  RefreshCw,
  Video,
  Printer,
  ShieldCheck,
  Save,
  Users,
  ChevronRight,
  Camera
} from 'lucide-react';
import CameraFeed from '../components/CameraFeed';
import Modal from '../components/Modal';
import PrintableRegister from '../components/PrintableRegister';
import { storageService } from '../services/storageService';
import { apiService } from '../services/apiService';
import { useAuth } from '../context/AuthContext';
import { getTodayKolkataDateString, formatKolkataDate } from '../utils/dateUtils';

export default function AttendanceSessionPage() {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [sections, setSections] = useState([]);
  const [selectedClass, setSelectedClass] = useState('10');
  const [selectedSection, setSelectedSection] = useState('A');
  const [sessionDate, setSessionDate] = useState(getTodayKolkataDateString());
  const [sessionSubject, setSessionSubject] = useState('');

  const [activeSession, setActiveSession] = useState(null);
  const [sessionRecords, setSessionRecords] = useState([]);
  const [enrolledStudents, setEnrolledStudents] = useState([]);
  const [cameraInfo, setCameraInfo] = useState({ status: 'CONNECTED', type: 'WEBCAM' });
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState({ text: '', type: '' });

  // Confirmation Modal before Final Save
  const [showConfirmSaveModal, setShowConfirmSaveModal] = useState(false);

  // Official Printable Register Modal
  const [finalizedRegisterData, setFinalizedRegisterData] = useState(null);
  const [showPrintModal, setShowPrintModal] = useState(false);

  // Manual Correction Modal
  const [manualModalOpen, setManualModalOpen] = useState(false);
  const [manualStudent, setManualStudent] = useState(null);
  const [manualStatus, setManualStatus] = useState('present');
  const [manualReason, setManualReason] = useState('');

  useEffect(() => {
    loadInitialData();
    const interval = setInterval(loadSessionState, 1500); // 1.5s real-time AI status sync
    return () => clearInterval(interval);
  }, []);

  const loadInitialData = async () => {
    try {
      const [stuRes, secRes] = await Promise.all([
        storageService.syncFromBackend(apiService),
        storageService.syncSectionsFromBackend(apiService)
      ]);
      setEnrolledStudents(stuRes);
      setSections(secRes);
      if (secRes.length > 0) {
        setSelectedClass(secRes[0].className || '10');
        setSelectedSection(secRes[0].sectionName || 'A');
      }
    } catch (_) {
      setEnrolledStudents(storageService.getStudents());
      setSections(storageService.getClasses());
    }
    loadSessionState();
  };

  const loadSessionState = async () => {
    try {
      // 1. Check active session
      const activeRes = await apiService.getActiveSession();
      if (activeRes && activeRes.hasActive && activeRes.session) {
        setActiveSession(activeRes.session);
        setSessionRecords(activeRes.records || []);
      } else {
        setActiveSession(null);
        setSessionRecords([]);
      }

      // 2. Check camera
      const cam = await apiService.getCameraStatus();
      if (cam) setCameraInfo(cam);
    } catch (_) {}
  };

  const handleStartSession = async (allowDuplicate = false) => {
    setLoading(true);
    setStatusMessage({ text: '', type: '' });
    try {
      const sessionTitle = sessionSubject.trim()
        ? `${selectedClass}-${selectedSection} • ${sessionSubject.trim()}`
        : `${selectedClass}-${selectedSection} Attendance`;
      const res = await apiService.startAttendance(
        selectedClass,
        selectedSection,
        sessionDate,
        currentUser?.displayName || currentUser?.email || 'Lecturer',
        sessionTitle,
        allowDuplicate
      );
      if (res.success) {
        setActiveSession(res.session);
        setSessionRecords([]);
        setStatusMessage({
          text: `Attendance session active for Class ${selectedClass}-${selectedSection} (${formatKolkataDate(sessionDate)})`,
          type: 'success'
        });
      }
    } catch (err) {
      if (err.message && err.message.includes('already finalized')) {
        if (window.confirm(`${err.message}\nDo you want to start a new attendance session for this section anyway?`)) {
          handleStartSession(true);
          return;
        }
      } else {
        setStatusMessage({ text: `Failed to start session: ${err.message}`, type: 'error' });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleStopSession = async () => {
    if (!activeSession) return;
    setLoading(true);
    try {
      const res = await apiService.stopAttendance(activeSession.sessionId);
      if (res.success) {
        setActiveSession(null);
        setStatusMessage({ text: 'Scanning paused. Review records or click Save Attendance.', type: 'info' });
      }
    } catch (err) {
      alert(`Error pausing session: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmFinalizeSave = async () => {
    if (!activeSession) return;
    setShowConfirmSaveModal(false);
    setLoading(true);

    try {
      const targetSessionId = activeSession.sessionId;
      const res = await apiService.finalizeSession(
        targetSessionId,
        currentUser?.displayName || currentUser?.email || 'Lecturer',
        enrolledStudents
      );
      if (res.success) {
        try {
          const detRes = await apiService.getSessionDetails(targetSessionId);
          setFinalizedRegisterData({
            session: res.session || activeSession,
            records: detRes?.records || []
          });
        } catch (_) {
          setFinalizedRegisterData({
            session: res.session || activeSession,
            records: sessionRecords
          });
        }

        setStatusMessage({
          text: `Attendance saved successfully for Class ${activeSession.class}-${activeSession.section}! Records permanently stored in database.`,
          type: 'success'
        });
        setActiveSession(null);
        setSessionRecords([]);
        loadSessionState();
      }
    } catch (err) {
      setStatusMessage({ text: `Error saving attendance: ${err.message}`, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const openManualModal = (student) => {
    setManualStudent(student);
    const existing = sessionRecords.find(r => r.studentId === student.studentId);
    setManualStatus(existing ? existing.status : 'present');
    setManualReason(existing?.notes || '');
    setManualModalOpen(true);
  };

  const quickToggleStatus = async (student, targetStatus) => {
    if (!activeSession) return;
    try {
      await apiService.manualMark(
        activeSession.sessionId,
        student.studentId,
        targetStatus,
        currentUser?.displayName || 'Lecturer',
        `Lecturer manual override: marked ${targetStatus}`
      );
      loadSessionState();
    } catch (err) {
      alert(err.message);
    }
  };

  const submitManualAttendance = async (e) => {
    e.preventDefault();
    if (!activeSession || !manualStudent) return;

    try {
      await apiService.manualMark(
        activeSession.sessionId,
        manualStudent.studentId,
        manualStatus,
        currentUser?.displayName || 'Lecturer',
        manualReason || 'Lecturer verified'
      );
      setManualModalOpen(false);
      loadSessionState();
    } catch (err) {
      alert(err.message);
    }
  };

  // Target class & section
  const currentTargetClass = activeSession ? activeSession.class : selectedClass;
  const currentTargetSection = activeSession ? activeSession.section : selectedSection;

  // Filter roster for current target class & section
  const classRoster = enrolledStudents.filter(
    s => s.class === currentTargetClass && s.section === currentTargetSection
  ).sort((a, b) => parseInt(a.rollNumber || 0) - parseInt(b.rollNumber || 0));

  const recordsMap = new Map();
  sessionRecords.forEach(r => recordsMap.set(r.studentId, r));

  const presentCount = sessionRecords.filter(r => ['present', 'manually_added', 'late'].includes(r.status)).length;
  const absentCount = classRoster.length > presentCount ? classRoster.length - presentCount : 0;
  const attendanceRate = classRoster.length > 0 ? Math.round((presentCount / classRoster.length) * 100) : 100;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-8">
      {/* 1. Header Toolbar in Wink Style */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200/60">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-[#FFF2EE] text-[#FF5A36] border border-[#FFD9CE]">
              Biometric Attendance
            </span>
            <span className="text-slate-300">&bull;</span>
            <span className="text-xs text-slate-500 font-medium">One-Click Session</span>
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2 mt-1.5">
            <Play className="w-6 h-6 text-[#FF5A36] fill-[#FF5A36]" />
            <span>Take Class Attendance</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time biometric facial recognition attendance recording, verification, and permanent database finalization.
          </p>
        </div>

        {/* Primary Action Buttons */}
        <div className="flex items-center gap-3">
          {activeSession ? (
            <>
              <button
                onClick={handleStopSession}
                disabled={loading}
                className="enterprise-btn-secondary text-xs text-amber-700 hover:bg-amber-50 border-amber-300 shadow-xs"
              >
                <Square className="w-3.5 h-3.5 fill-current" />
                <span>Pause Scanning</span>
              </button>
              <button
                onClick={() => setShowConfirmSaveModal(true)}
                disabled={loading}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-2xl flex items-center gap-2 shadow-md shadow-emerald-600/25 transition-all cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>Save Attendance</span>
              </button>
            </>
          ) : (
            <button
              onClick={() => handleStartSession(false)}
              disabled={loading || classRoster.length === 0}
              className="enterprise-btn-primary text-xs px-5 py-2.5"
            >
              <Play className="w-4 h-4 fill-white" />
              <span>Start Attendance</span>
            </button>
          )}
        </div>
      </div>

      {statusMessage.text && (
        <div className={`p-4 rounded-2xl text-xs font-semibold flex items-center gap-2.5 shadow-2xs ${
          statusMessage.type === 'success'
            ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
            : statusMessage.type === 'error'
            ? 'bg-rose-50 border border-rose-200 text-rose-800'
            : 'bg-[#FFF2EE] border border-[#FFD9CE] text-[#FF5A36]'
        }`}>
          {statusMessage.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          )}
          <span>{statusMessage.text}</span>
        </div>
      )}

      {/* 2. Wink Attendance Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {/* Total Students */}
        <div className="glass-card p-5 border-l-4 border-l-cyan-500">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
            Total Students
          </span>
          <div className="text-3xl font-extrabold text-slate-900 mt-1">
            {classRoster.length}
          </div>
          <span className="text-xs text-slate-500 font-medium block mt-1">
            Class {currentTargetClass}-{currentTargetSection} Roster
          </span>
        </div>

        {/* Present Students (Green) */}
        <div className="glass-card p-5 border-l-4 border-l-emerald-500">
          <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 block">
            Present Students
          </span>
          <div className="text-3xl font-extrabold text-emerald-700 mt-1">
            {presentCount}
          </div>
          <span className="text-xs text-emerald-600 font-medium block mt-1">
            Verified On Camera / Manual
          </span>
        </div>

        {/* Absent Students (Red) */}
        <div className="glass-card p-5 border-l-4 border-l-rose-500">
          <span className="text-[11px] font-bold uppercase tracking-wider text-rose-700 block">
            Absent Students
          </span>
          <div className="text-3xl font-extrabold text-rose-700 mt-1">
            {absentCount}
          </div>
          <span className="text-xs text-rose-600 font-medium block mt-1">
            {activeSession ? 'Pending Review' : 'Finalized Absent'}
          </span>
        </div>

        {/* Attendance Percentage (Wink Coral) */}
        <div className="glass-card p-5 border-l-4 border-l-[#FF5A36]">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#FF5A36] block">
            Attendance Rate
          </span>
          <div className="text-3xl font-extrabold text-slate-900 mt-1">
            {attendanceRate}%
          </div>
          <span className="text-xs text-[#FF5A36] font-medium block mt-1">
            {presentCount} of {classRoster.length} Present
          </span>
        </div>
      </div>

      {/* 3. Section & Date Selection Strip (when Standby) */}
      {!activeSession && (
        <div className="glass-card p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 text-xs">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <label className="font-bold text-slate-700">Classroom / Course:</label>
              <select
                value={selectedClass}
                onChange={(e) => {
                  const nextClass = e.target.value;
                  setSelectedClass(nextClass);
                  const matchingSec = sections.find(s => s.className === nextClass);
                  if (matchingSec) setSelectedSection(matchingSec.sectionName);
                }}
                className="border border-slate-200 rounded-xl px-3.5 py-2 bg-white text-slate-900 font-bold focus:outline-none focus:ring-2 focus:ring-[#FF5A36]"
              >
                {Array.from(new Set([...sections.map(s => s.className), selectedClass].filter(Boolean))).map(cls => (
                  <option key={cls} value={cls}>{cls}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <label className="font-bold text-slate-700">Section / Batch:</label>
              <select
                value={selectedSection}
                onChange={(e) => setSelectedSection(e.target.value)}
                className="border border-slate-200 rounded-xl px-3.5 py-2 bg-white text-slate-900 font-bold focus:outline-none focus:ring-2 focus:ring-[#FF5A36]"
              >
                {Array.from(new Set([
                  ...sections.filter(s => s.className === selectedClass).map(s => s.sectionName),
                  ...sections.map(s => s.sectionName),
                  selectedSection
                ].filter(Boolean))).map(sec => (
                  <option key={sec} value={sec}>{sec}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <label className="font-bold text-slate-700">Date (IST):</label>
              <input
                type="date"
                value={sessionDate}
                onChange={(e) => setSessionDate(e.target.value)}
                className="border border-slate-200 rounded-xl px-3.5 py-2 bg-white text-slate-900 font-bold focus:outline-none focus:ring-2 focus:ring-[#FF5A36]"
              />
            </div>

            <div className="flex items-center gap-2">
              <label className="font-bold text-slate-700">Subject / Lecture:</label>
              <input
                type="text"
                value={sessionSubject}
                onChange={(e) => setSessionSubject(e.target.value)}
                placeholder="e.g. Mathematics, DBMS, Physics"
                className="border border-slate-200 rounded-xl px-3.5 py-2 bg-white text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-[#FF5A36]"
              />
            </div>
          </div>

          <div className="text-slate-500 font-medium">
            Students Enrolled: <strong className="text-slate-900 font-extrabold text-sm">{classRoster.length}</strong>
          </div>
        </div>
      )}

      {/* 4. Active Session Alert Banner */}
      {activeSession && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-3xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="relative flex items-center justify-center">
              <span className="animate-ping absolute inline-flex h-4 w-4 rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-600"></span>
            </div>
            <div>
              <span className="font-extrabold text-sm text-emerald-950 block">
                Live Attendance Session Active: Class {currentTargetClass}-{currentTargetSection}
              </span>
              <span className="text-xs text-emerald-700 font-medium">
                YuNet + SFace is detecting student faces in real time. Present counts update automatically.
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setShowConfirmSaveModal(true)}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-2xl text-xs flex items-center gap-2 shadow-sm cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>Save Attendance</span>
            </button>
          </div>
        </div>
      )}

      {/* 5. Main Split View: Camera Stream & Real-time Section Roster */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Camera Feed (7 Cols) */}
        <div className="lg:col-span-7 space-y-4">
          <CameraFeed
            isBrowserCamera={cameraInfo.type === 'BROWSER' || cameraInfo.type === 'WEBCAM'}
            height="440px"
          />

          {/* Camera Info Strip */}
          <div className="glass-card p-3.5 flex items-center justify-between text-xs text-slate-600">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>Camera: <strong>{cameraInfo.name || 'Integrated Laptop Webcam'}</strong></span>
              <span className="text-slate-300">&bull;</span>
              <span className="font-mono text-xs text-slate-500 font-bold">{cameraInfo.resolution || '1280x720 HD'}</span>
            </div>
            <button
              onClick={() => navigate('/camera')}
              className="text-[#FF5A36] hover:text-[#e84d2b] font-bold flex items-center gap-1"
            >
              <Camera className="w-3.5 h-3.5" />
              <span>Camera Settings</span>
            </button>
          </div>
        </div>

        {/* Right: Section Roster & Live Verification Checklist (5 Cols) */}
        <div className="lg:col-span-5 glass-card p-6 flex flex-col h-[560px]">
          <div className="pb-3.5 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-extrabold text-slate-900">
                Class {currentTargetClass}-{currentTargetSection} Attendance Roster
              </h3>
              <span className="text-xs text-slate-500 font-medium">
                {presentCount} Present &bull; {absentCount} Absent &bull; Total {classRoster.length}
              </span>
            </div>
            <button
              onClick={loadSessionState}
              title="Refresh Roster"
              className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Student List */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100 py-2">
            {classRoster.length > 0 ? (
              classRoster.map((student) => {
                const record = recordsMap.get(student.studentId);
                const isPresent = record && ['present', 'manually_added', 'late'].includes(record.status);

                return (
                  <div
                    key={student.studentId}
                    className={`py-3 px-2 flex items-center justify-between transition-colors ${
                      isPresent ? 'bg-emerald-50/50 rounded-2xl' : 'hover:bg-slate-50 rounded-2xl'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="font-mono font-extrabold text-xs text-slate-400 w-6">
                        {student.rollNumber}
                      </span>
                      <div className="w-9 h-9 rounded-2xl bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center shrink-0">
                        <img
                          src={record?.hasSnapshot ? apiService.getAttendanceSnapshotUrl(record.recordId) : apiService.getStudentPhotoUrl(student.studentId)}
                          alt={student.fullName}
                          className="w-full h-full object-cover"
                          onError={(e) => { e.target.style.display = 'none'; }}
                        />
                        <span className="text-xs font-extrabold text-slate-600 uppercase">
                          {student.fullName?.slice(0, 2) || 'ST'}
                        </span>
                      </div>
                      <div>
                        <div className="font-bold text-xs text-slate-900 leading-tight">
                          {student.fullName}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          Roll: {student.rollNumber} | {student.studentId}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {isPresent ? (
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-800 bg-emerald-100 px-3 py-1 rounded-full border border-emerald-200">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Present</span>
                        </span>
                      ) : activeSession ? (
                        <span className="inline-flex items-center gap-1 text-xs text-amber-700 bg-amber-50 px-2.5 py-1 rounded-xl font-bold border border-amber-200">
                          <Clock className="w-3 h-3 text-amber-500 animate-spin" /> Pending
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400 font-medium px-2.5 py-1 bg-slate-100 rounded-xl">
                          Not Marked
                        </span>
                      )}

                      {/* Quick Toggle Controls during active session */}
                      {activeSession && (
                        <div className="flex items-center gap-1 ml-1">
                          <button
                            onClick={() => quickToggleStatus(student, isPresent ? 'absent' : 'present')}
                            className={`p-1.5 rounded-xl border transition-all ${
                              isPresent
                                ? 'text-rose-600 hover:bg-rose-50 border-rose-200'
                                : 'text-emerald-600 hover:bg-emerald-50 border-emerald-200'
                            }`}
                            title={isPresent ? "Mark Absent" : "Mark Present"}
                          >
                            {isPresent ? <X className="w-3.5 h-3.5" /> : <Check className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-12 text-slate-400 text-xs">
                No students enrolled in Class {currentTargetClass}-{currentTargetSection}.
                <br />
                <button
                  onClick={() => navigate('/students')}
                  className="mt-3 text-[#FF5A36] hover:text-[#e84d2b] font-bold inline-block"
                >
                  Enroll Students in this Section &rarr;
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Confirmation Modal before Finalizing Save */}
      <Modal
        isOpen={showConfirmSaveModal}
        onClose={() => setShowConfirmSaveModal(false)}
        title="Finalize & Save Attendance Session"
      >
        <div className="space-y-4 text-xs">
          <p className="text-slate-600 leading-relaxed">
            You are about to finalize attendance for <strong>Class {currentTargetClass}-{currentTargetSection}</strong> on <strong>{formatKolkataDate(sessionDate)}</strong>.
          </p>

          <div className="grid grid-cols-2 gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-200">
            <div>
              <span className="text-slate-500 block">Present Students</span>
              <span className="text-lg font-extrabold text-emerald-700">{presentCount}</span>
            </div>
            <div>
              <span className="text-slate-500 block">Absent Students</span>
              <span className="text-lg font-extrabold text-rose-700">{absentCount}</span>
            </div>
          </div>

          <p className="text-[11px] text-slate-500">
            Attendance records will be permanently saved to the institutional database. Absent students will be officially recorded.
          </p>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setShowConfirmSaveModal(false)}
              className="enterprise-btn-secondary text-xs"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirmFinalizeSave}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-2xl shadow-md cursor-pointer"
            >
              Confirm & Save Attendance
            </button>
          </div>
        </div>
      </Modal>

      {/* Official Printable Register Modal */}
      {finalizedRegisterData && (
        <Modal
          isOpen={!!finalizedRegisterData}
          onClose={() => setFinalizedRegisterData(null)}
          title="Attendance Saved Successfully"
        >
          <div className="space-y-4 text-xs">
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-900 flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <div>
                <span className="font-bold block">Attendance Record Permanently Saved!</span>
                <span className="text-[11px] block text-emerald-700">
                  Class {finalizedRegisterData.session.class}-{finalizedRegisterData.session.section} attendance has been written to the database.
                </span>
              </div>
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setFinalizedRegisterData(null)}
                className="enterprise-btn-primary text-xs"
              >
                Done
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
