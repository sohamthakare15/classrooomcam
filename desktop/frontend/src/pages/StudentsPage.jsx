import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  UserPlus,
  Edit,
  Trash2,
  Camera,
  CheckCircle,
  Clock,
  AlertCircle,
  Eye,
  Filter,
  Search,
  RefreshCw,
  Hash,
  Mail,
  Phone,
  Layers,
  GraduationCap
} from 'lucide-react';
import DataTable from '../components/DataTable';
import Modal from '../components/Modal';
import { storageService } from '../services/storageService';
import { apiService } from '../services/apiService';

export default function StudentsPage() {
  const navigate = useNavigate();
  const [students, setStudents] = useState([]);
  const [sections, setSections] = useState([]);
  const [selectedClass, setSelectedClass] = useState('ALL');
  const [selectedSection, setSelectedSection] = useState('ALL');
  const [statusMsg, setStatusMsg] = useState({ text: '', type: '' });
  const [loading, setLoading] = useState(true);

  // Add/Edit Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState(null);
  const [formError, setFormError] = useState('');
  const [formData, setFormData] = useState({
    studentId: '',
    fullName: '',
    rollNumber: '',
    enrollmentNumber: '',
    class: '10',
    section: 'A',
    email: '',
    contactNumber: ''
  });

  useEffect(() => {
    loadStudentsAndSections();
  }, []);

  const loadStudentsAndSections = async () => {
    setLoading(true);
    try {
      const [stuRes, secRes] = await Promise.all([
        storageService.syncFromBackend(apiService),
        storageService.syncSectionsFromBackend(apiService)
      ]);
      setStudents(stuRes);
      setSections(secRes);
    } catch (_) {
      setStudents(storageService.getStudents());
      setSections(storageService.getClasses());
    } finally {
      setLoading(false);
    }
  };

  const openAddModal = () => {
    setEditingStudent(null);
    setFormError('');
    const nextRoll = String(students.length + 1).padStart(2, '0');
    setFormData({
      studentId: `STU-${String(Date.now()).slice(-4)}`,
      fullName: '',
      rollNumber: nextRoll,
      enrollmentNumber: `ENR-2026-${nextRoll.padStart(3, '0')}`,
      class: '10',
      section: 'A',
      email: '',
      contactNumber: ''
    });
    setIsModalOpen(true);
  };

  const openEditModal = (student) => {
    setEditingStudent(student);
    setFormError('');
    setFormData({
      studentId: student.studentId,
      fullName: student.fullName,
      rollNumber: student.rollNumber,
      enrollmentNumber: student.enrollmentNumber || `ENR-2026-${String(student.rollNumber).padStart(3, '0')}`,
      class: student.class || '10',
      section: student.section || 'A',
      email: student.email || '',
      contactNumber: student.contactNumber || ''
    });
    setIsModalOpen(true);
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    if (!formData.fullName.trim()) {
      setFormError('Student full name is required');
      return;
    }
    if (!formData.rollNumber.trim()) {
      setFormError('Roll number is required');
      return;
    }

    try {
      if (editingStudent) {
        // Backend DB update
        try {
          await apiService.updateDbStudent(editingStudent.studentId, {
            ...formData,
            className: formData.class
          });
        } catch (_) {}
        storageService.updateStudent(editingStudent.studentId, formData);
        setStatusMsg({ text: `Student ${formData.fullName} updated successfully!`, type: 'success' });
      } else {
        // Backend DB insert
        try {
          await apiService.createDbStudent({
            ...formData,
            className: formData.class
          });
        } catch (_) {}
        storageService.addStudent(formData);
        setStatusMsg({ text: `Student ${formData.fullName} enrolled in Class ${formData.class}-${formData.section}!`, type: 'success' });
      }

      setIsModalOpen(false);
      loadStudentsAndSections();
      setTimeout(() => setStatusMsg({ text: '', type: '' }), 4000);
    } catch (err) {
      setFormError(err.message || 'Operation failed');
    }
  };

  const handleDelete = async (student) => {
    if (window.confirm(`Delete student "${student.fullName}" (Roll #${student.rollNumber})?\nThis permanently removes their biometric face templates and attendance association.`)) {
      try {
        try {
          await apiService.deleteDbStudent(student.studentId);
        } catch (_) {
          await apiService.deleteEnrollment(student.studentId);
        }
        storageService.deleteStudent(student.studentId);
        setStatusMsg({ text: `Student "${student.fullName}" removed from records.`, type: 'success' });
        loadStudentsAndSections();
        setTimeout(() => setStatusMsg({ text: '', type: '' }), 4000);
      } catch (err) {
        alert(`Failed to delete student: ${err.message}`);
      }
    }
  };

  // Filter students
  const filteredStudents = students.filter(s => {
    if (selectedClass !== 'ALL' && s.class !== selectedClass) return false;
    if (selectedSection !== 'ALL' && s.section !== selectedSection) return false;
    return true;
  }).sort((a, b) => parseInt(a.rollNumber || 0) - parseInt(b.rollNumber || 0));

  const columns = [
    {
      header: "Roll #",
      accessor: "rollNumber",
      render: (s) => (
        <span className="font-mono font-extrabold text-[#FF5A36] bg-[#FFF2EE] px-2.5 py-1 rounded-xl border border-[#FFD9CE]">
          {s.rollNumber}
        </span>
      )
    },
    {
      header: "Student Name",
      accessor: "fullName",
      render: (s) => (
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-2xl bg-[#FFF2EE] text-[#FF5A36] border border-[#FFD9CE] flex items-center justify-center font-extrabold text-xs overflow-hidden shrink-0">
            {s.enrollmentStatus === 'Enrolled' ? (
              <img
                src={apiService.getStudentPhotoUrl(s.studentId)}
                alt={s.fullName}
                className="w-full h-full object-cover"
                onError={(e) => { e.target.style.display = 'none'; }}
              />
            ) : null}
            <span>{s.fullName?.slice(0, 2).toUpperCase() || 'ST'}</span>
          </div>
          <div>
            <div className="font-bold text-slate-900 text-xs">{s.fullName}</div>
            <div className="text-[10px] text-slate-400 font-mono">
              ID: {s.studentId} {s.email ? `• ${s.email}` : ''}
            </div>
          </div>
        </div>
      )
    },
    {
      header: "Enrollment Number",
      accessor: "enrollmentNumber",
      render: (s) => (
        <span className="font-mono text-xs text-slate-700 font-bold">
          {s.enrollmentNumber || `ENR-${s.class}${s.section}-${s.rollNumber}`}
        </span>
      )
    },
    {
      header: "Section",
      render: (s) => (
        <span className="px-3 py-1 rounded-full text-xs font-bold bg-[#FFF2EE] text-[#FF5A36] border border-[#FFD9CE]">
          Class {s.class}-{s.section}
        </span>
      )
    },
    {
      header: "Biometric Status",
      accessor: "enrollmentStatus",
      render: (s) => (
        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${
          s.enrollmentStatus === 'Enrolled'
            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
            : 'bg-amber-50 text-amber-700 border-amber-200'
        }`}>
          {s.enrollmentStatus === 'Enrolled' ? (
            <>
              <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
              <span>Face Enrolled</span>
            </>
          ) : (
            <>
              <Clock className="w-3.5 h-3.5 text-amber-500" />
              <span>Pending Photo</span>
            </>
          )}
        </span>
      )
    },
    {
      header: "Actions",
      render: (s) => (
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate(`/enrollment?studentId=${s.studentId}`)}
            title="Biometric Photo Enrollment"
            className="p-1.5 text-[#FF5A36] hover:bg-[#FFF2EE] rounded-xl transition-colors border border-[#FFD9CE]"
          >
            <Camera className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => openEditModal(s)}
            title="Edit Student"
            className="p-1.5 text-slate-600 hover:bg-slate-100 rounded-xl transition-colors border border-slate-200"
          >
            <Edit className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => handleDelete(s)}
            title="Delete Student"
            className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-xl transition-colors border border-rose-200 hover:border-rose-300"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      )
    }
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-8">
      {/* Header Toolbar in Wink Style */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200/60">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-[#FFF2EE] text-[#FF5A36] border border-[#FFD9CE]">
              Student Directory
            </span>
            <span className="text-slate-300">&bull;</span>
            <span className="text-xs text-slate-500 font-medium">Academic Records</span>
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2 mt-1.5">
            <GraduationCap className="w-6 h-6 text-[#FF5A36]" />
            <span>Enrolled Students</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Register students, manage academic roll numbers, assign sections, and authorize biometric face scans.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={loadStudentsAndSections}
            className="enterprise-btn-secondary text-xs flex items-center gap-2"
            title="Refresh Directory"
          >
            <RefreshCw className="w-3.5 h-3.5 text-slate-600" />
            <span>Refresh</span>
          </button>
          <button
            onClick={openAddModal}
            className="enterprise-btn-primary text-xs flex items-center gap-2"
          >
            <UserPlus className="w-4 h-4" />
            <span>Enroll New Student</span>
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

      {/* Filter Toolbar in Wink Style */}
      <div className="glass-card p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2 text-xs text-slate-600 font-bold">
            <Filter className="w-4 h-4 text-[#FF5A36]" /> Section Filters:
          </div>

          <div className="flex items-center gap-2 text-xs">
            <label className="text-slate-600 font-medium">Class:</label>
            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              className="border border-slate-200 rounded-xl px-3 py-1.5 text-slate-800 bg-white font-bold focus:outline-none focus:ring-2 focus:ring-[#FF5A36]"
            >
              <option value="ALL">All Classes</option>
              <option value="10">Class 10</option>
              <option value="11">Class 11</option>
              <option value="12">Class 12</option>
            </select>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <label className="text-slate-600 font-medium">Section:</label>
            <select
              value={selectedSection}
              onChange={(e) => setSelectedSection(e.target.value)}
              className="border border-slate-200 rounded-xl px-3 py-1.5 text-slate-800 bg-white font-bold focus:outline-none focus:ring-2 focus:ring-[#FF5A36]"
            >
              <option value="ALL">All Sections</option>
              <option value="A">Section A</option>
              <option value="B">Section B</option>
              <option value="Science">Section Science</option>
            </select>
          </div>
        </div>

        <div className="text-xs text-slate-500 font-medium">
          Total Enrolled: <strong className="text-slate-900 font-extrabold text-sm">{filteredStudents.length}</strong> students
        </div>
      </div>

      {/* Data Table */}
      <DataTable
        columns={columns}
        data={filteredStudents}
        searchPlaceholder="Search by name, roll #, enrollment # or student ID..."
      />

      {/* Register / Edit Student Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingStudent ? `Edit Student: ${editingStudent.fullName}` : "Enroll New Student"}
        maxWidth="max-w-xl"
      >
        <form onSubmit={handleFormSubmit} className="space-y-4 text-xs">
          {formError && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-2xl flex items-center gap-2 font-medium">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 font-bold mb-1">Student ID (Internal)</label>
              <input
                type="text"
                value={formData.studentId}
                disabled={!!editingStudent}
                onChange={(e) => setFormData({ ...formData, studentId: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-slate-50 font-mono disabled:opacity-75"
                required
              />
            </div>
            <div>
              <label className="block text-slate-700 font-bold mb-1">Roll Number *</label>
              <input
                type="text"
                value={formData.rollNumber}
                onChange={(e) => setFormData({ ...formData, rollNumber: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#FF5A36]"
                placeholder="e.g. 01"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-700 font-bold mb-1">Student Full Name *</label>
            <input
              type="text"
              value={formData.fullName}
              onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-[#FF5A36]"
              placeholder="e.g. Aarav Sharma"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 font-bold mb-1">Enrollment Number *</label>
              <input
                type="text"
                value={formData.enrollmentNumber}
                onChange={(e) => setFormData({ ...formData, enrollmentNumber: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white font-mono uppercase focus:outline-none focus:ring-2 focus:ring-[#FF5A36]"
                placeholder="e.g. ENR-2026-001"
                required
              />
            </div>
            <div>
              <label className="block text-slate-700 font-bold mb-1">Assigned Section *</label>
              <select
                value={`${formData.class}-${formData.section}`}
                onChange={(e) => {
                  const [c, s] = e.target.value.split('-');
                  setFormData({ ...formData, class: c, section: s });
                }}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white font-bold focus:outline-none focus:ring-2 focus:ring-[#FF5A36]"
              >
                {sections.map(sec => (
                  <option key={sec.sectionId} value={`${sec.className}-${sec.sectionName}`}>
                    Class {sec.className}-{sec.sectionName} ({sec.room || 'Room TBA'})
                  </option>
                ))}
                {sections.length === 0 && (
                  <>
                    <option value="10-A">Class 10-A</option>
                    <option value="10-B">Class 10-B</option>
                    <option value="11-Science">Class 11-Science</option>
                    <option value="12-Science">Class 12-Science</option>
                  </>
                )}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 font-bold mb-1">Email Address (Optional)</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-[#FF5A36]"
                placeholder="student@school.edu"
              />
            </div>
            <div>
              <label className="block text-slate-700 font-bold mb-1">Contact Number (Optional)</label>
              <input
                type="tel"
                value={formData.contactNumber}
                onChange={(e) => setFormData({ ...formData, contactNumber: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-[#FF5A36]"
                placeholder="+91 98765 43210"
              />
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="enterprise-btn-secondary text-xs"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="enterprise-btn-primary text-xs"
            >
              {editingStudent ? "Save Student Changes" : "Save Student to Database"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
