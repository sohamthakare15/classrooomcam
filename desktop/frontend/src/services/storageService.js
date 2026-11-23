/**
 * Data Storage & Synchronization Service.
 * Interfaces with Local Offline Storage (LocalStorage), SQLite Database, and Firebase Realtime Database (RTDB).
 */
import {
  syncStudentToRTDB,
  fetchStudentsFromRTDB,
  syncSessionToRTDB,
  syncRecordToRTDB,
  syncAuditLogToRTDB
} from './rtdbService';

const STORAGE_KEYS = {
  STUDENTS: 'smartclassroom_students',
  CLASSES: 'smartclassroom_classes',
  SETTINGS: 'smartclassroom_settings',
  USER: 'smartclassroom_active_user'
};

const INITIAL_CLASSES = [
  { sectionId: "sec_10_a", classId: "10-A", name: "10", section: "A", className: "10", sectionName: "A", room: "Room 302", studentCount: 0 },
  { sectionId: "sec_10_b", classId: "10-B", name: "10", section: "B", className: "10", sectionName: "B", room: "Room 304", studentCount: 0 },
  { sectionId: "sec_11_sci", classId: "11-Sci", name: "11", section: "Science", className: "11", sectionName: "Science", room: "Lab 1", studentCount: 0 },
  { sectionId: "sec_12_sci", classId: "12-Sci", name: "12", section: "Science", className: "12", sectionName: "Science", room: "Lab 2", studentCount: 0 }
];

export const storageService = {
  // Synchronous Students (Local Cache)
  getStudents() {
    const raw = localStorage.getItem(STORAGE_KEYS.STUDENTS);
    if (!raw) {
      localStorage.setItem(STORAGE_KEYS.STUDENTS, JSON.stringify([]));
      return [];
    }
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (_) {
      return [];
    }
  },

  clearAllStudents() {
    localStorage.setItem(STORAGE_KEYS.STUDENTS, JSON.stringify([]));
    return [];
  },

  saveStudents(students) {
    localStorage.setItem(STORAGE_KEYS.STUDENTS, JSON.stringify(students));
  },

  // Synchronize with SQLite Backend
  async syncFromBackend(apiService) {
    try {
      const res = await apiService.getDbStudents();
      if (res && Array.isArray(res.students)) {
        this.saveStudents(res.students);
        return res.students;
      }
    } catch (_) {}
    return this.getStudents();
  },

  addStudent(student) {
    const students = this.getStudents();
    const cleanRoll = String(student.rollNumber || '').trim();
    const cleanClass = String(student.class || student.className || '10').trim();
    const cleanSection = String(student.section || 'A').trim();
    const cleanEnr = student.enrollmentNumber ? String(student.enrollmentNumber).trim().toUpperCase() : null;

    // Validate duplicate roll number in same class/section
    const dupRoll = students.find(
      s => String(s.class).trim() === cleanClass &&
           String(s.section).trim().toLowerCase() === cleanSection.toLowerCase() &&
           String(s.rollNumber).trim() === cleanRoll &&
           s.studentId !== student.studentId
    );
    if (dupRoll) {
      throw new Error(`Roll number ${cleanRoll} already exists in Class ${cleanClass}-${cleanSection} (${dupRoll.fullName})`);
    }

    // Validate duplicate enrollment number
    if (cleanEnr) {
      const dupEnr = students.find(
        s => s.enrollmentNumber &&
             String(s.enrollmentNumber).trim().toUpperCase() === cleanEnr &&
             s.studentId !== student.studentId
      );
      if (dupEnr) {
        throw new Error(`Enrollment number ${cleanEnr} already exists (${dupEnr.fullName})`);
      }
    }

    const newStudent = {
      ...student,
      rollNumber: cleanRoll,
      class: cleanClass,
      section: cleanSection,
      enrollmentNumber: cleanEnr || `ENR-${cleanClass}${cleanSection}-${cleanRoll.padStart(3, '0')}`,
      registrationDate: student.registrationDate || new Date().toISOString().split('T')[0],
      enrollmentStatus: student.enrollmentStatus || "Not Enrolled",
      isActive: true
    };

    const existingIndex = students.findIndex(s => s.studentId === newStudent.studentId);
    if (existingIndex >= 0) {
      students[existingIndex] = newStudent;
    } else {
      students.push(newStudent);
    }

    this.saveStudents(students);
    try { syncStudentToRTDB(newStudent); } catch (_) {}
    return newStudent;
  },

  updateStudent(studentId, updates) {
    const students = this.getStudents();
    const index = students.findIndex(s => s.studentId === studentId);
    if (index === -1) throw new Error("Student not found");

    const current = students[index];
    const cleanRoll = updates.rollNumber ? String(updates.rollNumber).trim() : current.rollNumber;
    const cleanClass = updates.class ? String(updates.class).trim() : current.class;
    const cleanSection = updates.section ? String(updates.section).trim() : current.section;
    const cleanEnr = updates.enrollmentNumber ? String(updates.enrollmentNumber).trim().toUpperCase() : current.enrollmentNumber;

    // Validate duplicate roll number
    const dupRoll = students.find(
      s => String(s.class).trim() === cleanClass &&
           String(s.section).trim().toLowerCase() === cleanSection.toLowerCase() &&
           String(s.rollNumber).trim() === cleanRoll &&
           s.studentId !== studentId
    );
    if (dupRoll) {
      throw new Error(`Roll number ${cleanRoll} already exists in Class ${cleanClass}-${cleanSection}`);
    }

    // Validate duplicate enrollment number
    if (cleanEnr) {
      const dupEnr = students.find(
        s => s.enrollmentNumber &&
             String(s.enrollmentNumber).trim().toUpperCase() === cleanEnr &&
             s.studentId !== studentId
      );
      if (dupEnr) {
        throw new Error(`Enrollment number ${cleanEnr} is already assigned to ${dupEnr.fullName}`);
      }
    }

    students[index] = {
      ...current,
      ...updates,
      rollNumber: cleanRoll,
      class: cleanClass,
      section: cleanSection,
      enrollmentNumber: cleanEnr
    };

    this.saveStudents(students);
    try { syncStudentToRTDB(students[index]); } catch (_) {}
    return students[index];
  },

  deleteStudent(studentId) {
    const students = this.getStudents();
    const filtered = students.filter(s => s.studentId !== studentId);
    this.saveStudents(filtered);
    return true;
  },

  getStudentById(studentId) {
    const students = this.getStudents();
    return students.find(s => s.studentId === studentId) || null;
  },

  // Sections
  getClasses() {
    const raw = localStorage.getItem(STORAGE_KEYS.CLASSES);
    if (!raw) {
      localStorage.setItem(STORAGE_KEYS.CLASSES, JSON.stringify(INITIAL_CLASSES));
      return INITIAL_CLASSES;
    }
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) && parsed.length > 0 ? parsed : INITIAL_CLASSES;
    } catch (_) {
      return INITIAL_CLASSES;
    }
  },

  saveClasses(classes) {
    localStorage.setItem(STORAGE_KEYS.CLASSES, JSON.stringify(classes));
  },

  async syncSectionsFromBackend(apiService) {
    try {
      const res = await apiService.getSections();
      if (res && Array.isArray(res.sections)) {
        const mapped = res.sections.map(s => ({
          sectionId: s.sectionId,
          classId: `${s.className}-${s.sectionName}`,
          name: s.className,
          section: s.sectionName,
          className: s.className,
          sectionName: s.sectionName,
          room: s.room || 'Room TBA',
          studentCount: s.studentCount || 0
        }));
        this.saveClasses(mapped);
        return mapped;
      }
    } catch (_) {}
    return this.getClasses();
  },

  // Settings
  getSettings() {
    const raw = localStorage.getItem(STORAGE_KEYS.SETTINGS);
    const defaults = {
      institutionName: "Greenwood International Academy",
      academicYear: "2026-2027",
      cameraType: "WEBCAM",
      rtspUrl: "",
      rtspUsername: "",
      rtspPassword: "",
      highConfidenceThreshold: 75,
      reviewThreshold: 50,
      enableOfflineSync: true,
      esp32Enabled: false,
      esp32Ip: "192.168.1.180"
    };
    if (!raw) return defaults;
    try {
      return { ...defaults, ...JSON.parse(raw) };
    } catch (_) {
      return defaults;
    }
  },

  saveSettings(settings) {
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
  }
};
