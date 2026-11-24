import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Layers,
  Users,
  Plus,
  Play,
  UserCheck,
  Search,
  Filter,
  CheckCircle,
  AlertCircle,
  Building,
  Trash2,
  ArrowRight,
  RefreshCw,
  Edit
} from 'lucide-react';
import { storageService } from '../services/storageService';
import { apiService } from '../services/apiService';
import { subscribeToStudents, subscribeToSections, syncSectionToRTDB, deleteSectionFromRTDB } from '../services/rtdbService';
import Modal from '../components/Modal';

export default function SectionsPage() {
  const navigate = useNavigate();
  const [sections, setSections] = useState([]);
  const [students, setStudents] = useState([]);
  const [selectedSectionId, setSelectedSectionId] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [statusMsg, setStatusMsg] = useState({ text: '', type: '' });

  // Add Section Modal
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newClassName, setNewClassName] = useState('');
  const [newSectionName, setNewSectionName] = useState('');
  const [newRoom, setNewRoom] = useState('');

  // Assign Student Modal
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [assignStudent, setAssignStudent] = useState(null);
  const [assignTargetClass, setAssignTargetClass] = useState('10');
  const [assignTargetSection, setAssignTargetSection] = useState('A');

  useEffect(() => {
    loadData();

    const unsubSections = subscribeToSections((rtdbSections) => {
      if (Array.isArray(rtdbSections) && rtdbSections.length > 0) {
        const mapped = rtdbSections.map(s => ({
          sectionId: s.sectionId,
          classId: `${s.className}-${s.sectionName}`,
          name: s.className,
          section: s.sectionName,
          className: s.className,
          sectionName: s.sectionName,
          room: s.room || 'Room TBA',
          studentCount: s.studentCount || 0
        }));
        storageService.saveClasses(mapped);
        setSections(mapped);
        setLoading(false);
      }
    });

    const unsubStudents = subscribeToStudents((rtdbStudents) => {
      if (Array.isArray(rtdbStudents)) {
        storageService.saveStudents(rtdbStudents);
        setStudents(rtdbStudents);
      }
    });

    return () => {
      if (unsubSections) unsubSections();
      if (unsubStudents) unsubStudents();
    };
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      // 1. Load sections from SQLite or fallback
      const secList = await storageService.syncSectionsFromBackend(apiService);
      setSections(secList);

      // 2. Load students from SQLite or fallback
      const stuList = await storageService.syncFromBackend(apiService);
      setStudents(stuList);
    } catch (_) {
      setSections(storageService.getClasses());
      setStudents(storageService.getStudents());
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSection = async (e) => {
    e.preventDefault();
    if (!newClassName.trim() || !newSectionName.trim()) {
      setStatusMsg({ text: 'Class name and section name are required.', type: 'error' });
      return;
    }

    try {
      const res = await apiService.createSection({
        className: newClassName.trim(),
        sectionName: newSectionName.trim(),
        room: newRoom.trim()
      });
      if (res && res.section) {
        await syncSectionToRTDB(res.section);
      }
      setStatusMsg({ text: `Section ${newClassName}-${newSectionName} saved successfully!`, type: 'success' });
      setIsAddModalOpen(false);
      setNewClassName('');
      setNewSectionName('');
      setNewRoom('');
      loadData();
      setTimeout(() => setStatusMsg({ text: '', type: '' }), 4000);
    } catch (err) {
      setStatusMsg({ text: err.message || 'Failed to create section', type: 'error' });
    }
  };

  const handleDeleteSection = async (sec) => {
    const studentCount = students.filter(s => s.class === sec.className && s.section === sec.sectionName).length;
    if (studentCount > 0) {
      alert(`Cannot delete section Class ${sec.className}-${sec.sectionName} because ${studentCount} students are currently assigned to it.`);
      return;
    }

    if (!window.confirm(`Delete section Class ${sec.className}-${sec.sectionName}?`)) return;

    try {
      await apiService.deleteSection(sec.sectionId);
      await deleteSectionFromRTDB(sec.sectionId);
      setStatusMsg({ text: `Section deleted.`, type: 'success' });
      loadData();
      setTimeout(() => setStatusMsg({ text: '', type: '' }), 4000);
    } catch (err) {
      alert(err.message);
    }
  };

  const openAssignModal = (student) => {
    setAssignStudent(student);
    setAssignTargetClass(student.class || '10');
    setAssignTargetSection(student.section || 'A');
    setIsAssignModalOpen(true);
  };

  const handleAssignSubmit = async (e) => {
    e.preventDefault();
    if (!assignStudent) return;

    try {
      await apiService.assignSection(assignStudent.studentId, assignTargetClass, assignTargetSection);
      // Update local storage
      storageService.updateStudent(assignStudent.studentId, {
        class: assignTargetClass,
        section: assignTargetSection
      });
      setStatusMsg({
        text: `${assignStudent.fullName} assigned to Class ${assignTargetClass}-${assignTargetSection}`,
        type: 'success'
      });
      setIsAssignModalOpen(false);
      loadData();
      setTimeout(() => setStatusMsg({ text: '', type: '' }), 4000);
    } catch (err) {
      alert(err.message);
    }
  };

  const handleStartSectionAttendance = (sec) => {
    navigate('/attendance');
  };

  // Filter students based on selection and search
  const filteredStudents = students.filter(s => {
    if (selectedSectionId !== 'ALL') {
      const selectedSec = sections.find(sec => sec.sectionId === selectedSectionId);
      if (selectedSec) {
        if (s.class !== selectedSec.className || s.section !== selectedSec.sectionName) return false;
      }
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = s.fullName?.toLowerCase().includes(q);
      const matchRoll = String(s.rollNumber || '').toLowerCase().includes(q);
      const matchEnr = String(s.enrollmentNumber || '').toLowerCase().includes(q);
      if (!matchName && !matchRoll && !matchEnr) return false;
    }
    return true;
  }).sort((a, b) => parseInt(a.rollNumber || 0) - parseInt(b.rollNumber || 0));

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-8">
      {/* Header in Wink Style */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200/60">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-blue-50 text-blue-600 border border-blue-200">
              Cohorts & Classes
            </span>
            <span className="text-slate-300">&bull;</span>
            <span className="text-xs text-slate-500 font-medium">Academic Sections</span>
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2 mt-1.5">
            <Layers className="w-6 h-6 text-blue-600" />
            <span>Class & Section Management</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Organize student cohorts, configure class sections, and initiate targeted attendance sessions.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={loadData}
            className="enterprise-btn-secondary text-xs flex items-center gap-2"
            title="Reload Sections"
          >
            <RefreshCw className="w-3.5 h-3.5 text-slate-600" />
            <span>Refresh</span>
          </button>
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="enterprise-btn-primary text-xs flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            <span>Create New Section</span>
          </button>
        </div>
      </div>

      {statusMsg.text && (
        <div className={`p-4 rounded-2xl text-xs font-semibold flex items-center gap-2.5 ${
          statusMsg.type === 'success'
            ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
            : 'bg-rose-50 border border-rose-200 text-rose-800'
        }`}>
          {statusMsg.type === 'success' ? (
            <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          )}
          <span>{statusMsg.text}</span>
        </div>
      )}

      {/* Sections Overview Wink Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {sections.map((sec) => {
          const studentCount = students.filter(s => s.class === sec.className && s.section === sec.sectionName).length;
          const isSelected = selectedSectionId === sec.sectionId;

          return (
            <div
              key={sec.sectionId}
              onClick={() => setSelectedSectionId(isSelected ? 'ALL' : sec.sectionId)}
              className={`glass-card p-6 cursor-pointer transition-all border ${
                isSelected
                  ? 'border-[#FF5A36] ring-2 ring-[#FF5A36]/20 shadow-md bg-[#FFF5F2]/40'
                  : 'hover:border-blue-200'
              }`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                    Class & Section
                  </span>
                  <div className="text-xl font-extrabold text-slate-900 mt-0.5">
                    Class {sec.className}-{sec.sectionName}
                  </div>
                  <div className="text-xs text-slate-500 font-medium flex items-center gap-1.5 mt-1">
                    <Building className="w-3.5 h-3.5 text-slate-400" />
                    <span>{sec.room || 'Room TBA'}</span>
                  </div>
                </div>

                <div className="w-10 h-10 rounded-2xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 font-extrabold font-mono text-sm shadow-2xs">
                  {sec.className}
                </div>
              </div>

              {/* Student Count & Quick Launch */}
              <div className="mt-5 pt-3.5 border-t border-slate-100 flex items-center justify-between">
                <div>
                  <span className="text-lg font-extrabold text-slate-900">
                    {studentCount}
                  </span>
                  <span className="text-xs text-slate-500 font-medium ml-1.5">students</span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleStartSectionAttendance(sec);
                    }}
                    className="p-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 transition-colors"
                    title="Take Attendance for this Section"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                  </button>
                  {studentCount === 0 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteSection(sec);
                      }}
                      className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                      title="Delete Empty Section"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Section Filter & Students Roster Section */}
      <div className="glass-card p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-slate-100">
          <div>
            <h2 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
              <Users className="w-4 h-4 text-blue-600" />
              <span>Section Student Roster</span>
              {selectedSectionId !== 'ALL' && (
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-600 font-bold border border-blue-200">
                  Filtered by {sections.find(s => s.sectionId === selectedSectionId)?.className}-{sections.find(s => s.sectionId === selectedSectionId)?.sectionName}
                </span>
              )}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Showing {filteredStudents.length} students assigned to the selected section.
            </p>
          </div>

          {/* Search & Filter Controls */}
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name, roll, enrollment..."
                className="pl-8 pr-3 py-2 text-xs border border-slate-200 rounded-xl bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600 w-60"
              />
            </div>

            <select
              value={selectedSectionId}
              onChange={(e) => setSelectedSectionId(e.target.value)}
              className="px-3 py-2 text-xs border border-slate-200 rounded-xl bg-white text-slate-800 font-bold focus:outline-none focus:ring-2 focus:ring-blue-600"
            >
              <option value="ALL">All Sections ({students.length})</option>
              {sections.map(s => {
                const count = students.filter(st => st.class === s.className && st.section === s.sectionName).length;
                return (
                  <option key={s.sectionId} value={s.sectionId}>
                    Class {s.className}-{s.sectionName} ({count})
                  </option>
                );
              })}
            </select>
          </div>
        </div>

        {/* Student Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border border-slate-100 rounded-2xl overflow-hidden">
            <thead className="bg-slate-50/80 text-slate-500 font-bold uppercase text-[10px] tracking-wider border-b border-slate-100">
              <tr>
                <th className="py-3 px-3">Roll #</th>
                <th className="py-3 px-3">Student Name</th>
                <th className="py-3 px-3">Enrollment Number</th>
                <th className="py-3 px-3">Assigned Section</th>
                <th className="py-3 px-3">Biometric Vault</th>
                <th className="py-3 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
              {filteredStudents.map((stu) => {
                const isEnrolled = stu.enrollmentStatus === 'Enrolled';
                return (
                  <tr key={stu.studentId} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3.5 px-3 font-mono font-extrabold text-blue-600">
                      <span className="bg-blue-50 px-2.5 py-1 rounded-xl border border-blue-200">
                        {stu.rollNumber}
                      </span>
                    </td>
                    <td className="py-3.5 px-3 font-bold text-slate-900 flex items-center gap-3">
                      <div className="w-8 h-8 rounded-2xl bg-blue-50 text-blue-600 font-extrabold text-xs flex items-center justify-center shrink-0 border border-blue-200">
                        {stu.fullName?.[0] || 'S'}
                      </div>
                      <div>
                        <div>{stu.fullName}</div>
                        {stu.email && <div className="text-[10px] text-slate-400 font-normal">{stu.email}</div>}
                      </div>
                    </td>
                    <td className="py-3.5 px-3 font-mono text-xs text-slate-700 font-bold">
                      {stu.enrollmentNumber || `ENR-${stu.class}${stu.section}-${stu.rollNumber}`}
                    </td>
                    <td className="py-3.5 px-3">
                      <span className="px-3 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-600 border border-blue-200">
                        Class {stu.class}-{stu.section}
                      </span>
                    </td>
                    <td className="py-3.5 px-3">
                      {isEnrolled ? (
                        <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
                          <CheckCircle className="w-3.5 h-3.5 text-emerald-600" /> Face Enrolled
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400 font-medium px-2 py-0.5 bg-slate-100 rounded-lg">
                          Pending Photo
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-3 text-right">
                      <button
                        onClick={() => openAssignModal(stu)}
                        className="enterprise-btn-secondary text-xs py-1.5 px-3"
                        title="Reassign to another section"
                      >
                        <Edit className="w-3.5 h-3.5 text-slate-600" />
                        <span>Reassign Section</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
              {filteredStudents.length === 0 && (
                <tr>
                  <td colSpan="6" className="py-8 text-center text-slate-400 text-xs">
                    {loading ? "Loading section data..." : "No students found in this section."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Create New Section */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Create New Academic Section"
        maxWidth="max-w-md"
      >
        <form onSubmit={handleCreateSection} className="space-y-4 text-xs">
          <div>
            <label className="block text-slate-700 font-bold mb-1">Classroom / Course / Year *</label>
            <input
              type="text"
              required
              placeholder="e.g. B.Tech CSE, BCA Sem 2, Class 10, MBA, Batch A"
              value={newClassName}
              onChange={(e) => setNewClassName(e.target.value)}
              className="w-full border border-slate-200 rounded-xl p-2.5 bg-white text-slate-800 font-bold focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
            <div className="flex flex-wrap gap-1.5 mt-2">
              {['B.Tech CSE', 'BCA', 'MCA', 'MBA', 'Class 10', 'Class 12', 'Batch A'].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setNewClassName(preset)}
                  className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border transition-colors cursor-pointer ${
                    newClassName === preset
                      ? 'bg-blue-50 text-blue-600 border-blue-200'
                      : 'bg-slate-50 text-slate-500 border-slate-200 hover:text-slate-800 hover:bg-slate-100'
                  }`}
                >
                  {preset}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-slate-700 font-bold mb-1">Section Identifier *</label>
            <input
              type="text"
              required
              placeholder="e.g. A, B, Science, Commerce"
              value={newSectionName}
              onChange={(e) => setNewSectionName(e.target.value)}
              className="w-full border border-slate-200 rounded-xl p-2.5 bg-white text-slate-800 font-bold focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>

          <div>
            <label className="block text-slate-700 font-bold mb-1">Assigned Lecture Hall / Room</label>
            <input
              type="text"
              placeholder="e.g. Room 302 or Lab 1"
              value={newRoom}
              onChange={(e) => setNewRoom(e.target.value)}
              className="w-full border border-slate-200 rounded-xl p-2.5 bg-white text-slate-800 font-bold focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsAddModalOpen(false)}
              className="enterprise-btn-secondary text-xs"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="enterprise-btn-primary text-xs"
            >
              Save Section
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal: Reassign Section */}
      <Modal
        isOpen={isAssignModalOpen}
        onClose={() => setIsAssignModalOpen(false)}
        title={assignStudent ? `Reassign Section for ${assignStudent.fullName}` : "Reassign Section"}
        maxWidth="max-w-md"
      >
        <form onSubmit={handleAssignSubmit} className="space-y-4 text-xs">
          <p className="text-slate-500">
            Select the new class standard and section for <strong>{assignStudent?.fullName}</strong> (Roll #{assignStudent?.rollNumber}).
          </p>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 font-bold mb-1">Target Classroom / Course *</label>
              <select
                value={assignTargetClass}
                onChange={(e) => setAssignTargetClass(e.target.value)}
                className="w-full border border-slate-200 rounded-xl p-2.5 bg-white text-slate-800 font-bold focus:outline-none focus:ring-2 focus:ring-blue-600"
              >
                {Array.from(new Set([...sections.map(s => s.className), assignTargetClass].filter(Boolean))).map(cls => (
                  <option key={cls} value={cls}>{cls}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-slate-700 font-bold mb-1">Target Section / Batch *</label>
              <select
                value={assignTargetSection}
                onChange={(e) => setAssignTargetSection(e.target.value)}
                className="w-full border border-slate-200 rounded-xl p-2.5 bg-white text-slate-800 font-bold focus:outline-none focus:ring-2 focus:ring-blue-600"
              >
                {Array.from(new Set([...sections.filter(s => s.className === assignTargetClass).map(s => s.sectionName), assignTargetSection].filter(Boolean))).map(sec => (
                  <option key={sec} value={sec}>{sec}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsAssignModalOpen(false)}
              className="enterprise-btn-secondary text-xs"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="enterprise-btn-primary text-xs"
            >
              Confirm Reassignment
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
