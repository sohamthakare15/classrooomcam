/**
 * Data Storage & Synchronization Service.
 * Interfaces with Local Offline Storage (LocalStorage), SQLite Database, and Firebase Realtime Database (RTDB).
 */
import {
  syncStudentToRTDB,
  fetchStudentsFromRTDB,
  deleteStudentFromRTDB,
  fetchSectionsFromRTDB,
  syncSettingsToRTDB,
  fetchSettingsFromRTDB,
  syncSessionToRTDB,
  syncRecordToRTDB,
  syncAuditLogToRTDB
} from './rtdbService';
import { cryptoService } from './cryptoService';

const STORAGE_KEYS = {
  STUDENTS: 'smartclassroom_students',
  CLASSES: 'smartclassroom_classes',
  SETTINGS: 'smartclassroom_settings',
  USER: 'smartclassroom_active_user'
};

const INITIAL_CLASSES = [];

export const storageService = {
  // Synchronous Students (Encrypted Local Cache)
  getStudents() {
    const parsed = cryptoService.getEncryptedItem(STORAGE_KEYS.STUDENTS, null);
    if (!parsed) {
      cryptoService.setEncryptedItem(STORAGE_KEYS.STUDENTS, []);
      return [];
    }
    return Array.isArray(parsed) ? parsed : [];
  },

  clearAllStudents() {
    cryptoService.setEncryptedItem(STORAGE_KEYS.STUDENTS, []);
    return [];
  },

  saveStudents(students) {
    cryptoService.setEncryptedItem(STORAGE_KEYS.STUDENTS, students);
  },

  // Synchronize with SQLite Backend & Firebase RTDB
  async syncFromBackend(apiService) {
    try {
      const [backendRes, rtdbStudents] = await Promise.all([
        apiService.getDbStudents().catch(() => null),
        fetchStudentsFromRTDB().catch(() => null)
      ]);

      const mergedMap = new Map();
      // 1. Load from RTDB first (cloud source of truth)
      if (Array.isArray(rtdbStudents)) {
        rtdbStudents.forEach(s => {
          if (s && s.studentId) mergedMap.set(s.studentId, s);
        });
      }
      // 2. Merge with backend SQLite
      if (backendRes && Array.isArray(backendRes.students)) {
        backendRes.students.forEach(s => {
          if (s && s.studentId) {
            const existing = mergedMap.get(s.studentId);
            mergedMap.set(s.studentId, existing ? { ...existing, ...s } : s);
          }
        });
      }

      if (mergedMap.size > 0 || (Array.isArray(rtdbStudents) && rtdbStudents.length === 0 && backendRes && Array.isArray(backendRes.students) && backendRes.students.length === 0)) {
        const mergedList = Array.from(mergedMap.values());
        this.saveStudents(mergedList);
        return mergedList;
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
    try { deleteStudentFromRTDB(studentId); } catch (_) {}
    return true;
  },

  getStudentById(studentId) {
    const students = this.getStudents();
    return students.find(s => s.studentId === studentId) || null;
  },

  // Sections
  getClasses() {
    const parsed = cryptoService.getEncryptedItem(STORAGE_KEYS.CLASSES, null);
    if (!parsed) {
      cryptoService.setEncryptedItem(STORAGE_KEYS.CLASSES, INITIAL_CLASSES);
      return INITIAL_CLASSES;
    }
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : INITIAL_CLASSES;
  },

  saveClasses(classes) {
    cryptoService.setEncryptedItem(STORAGE_KEYS.CLASSES, classes);
  },

  async syncSectionsFromBackend(apiService) {
    try {
      const [res, rtdbSections] = await Promise.all([
        apiService.getSections().catch(() => null),
        fetchSectionsFromRTDB().catch(() => null)
      ]);

      const mergedMap = new Map();
      if (Array.isArray(rtdbSections)) {
        rtdbSections.forEach(s => {
          if (s && s.sectionId) {
            mergedMap.set(s.sectionId, {
              sectionId: s.sectionId,
              classId: `${s.className}-${s.sectionName}`,
              name: s.className,
              section: s.sectionName,
              className: s.className,
              sectionName: s.sectionName,
              room: s.room || 'Room TBA',
              studentCount: s.studentCount || 0
            });
          }
        });
      }
      if (res && Array.isArray(res.sections)) {
        res.sections.forEach(s => {
          if (s && s.sectionId) {
            mergedMap.set(s.sectionId, {
              sectionId: s.sectionId,
              classId: `${s.className}-${s.sectionName}`,
              name: s.className,
              section: s.sectionName,
              className: s.className,
              sectionName: s.sectionName,
              room: s.room || 'Room TBA',
              studentCount: s.studentCount || 0
            });
          }
        });
      }

      if (mergedMap.size > 0 || (Array.isArray(rtdbSections) && rtdbSections.length === 0 && res && Array.isArray(res.sections) && res.sections.length === 0)) {
        const mapped = Array.from(mergedMap.values());
        this.saveClasses(mapped);
        return mapped;
      }
    } catch (_) {}
    return this.getClasses();
  },

  // Settings
  getSettings() {
    const defaults = {
      institutionName: "SmartClass Institution",
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
    const parsed = cryptoService.getEncryptedItem(STORAGE_KEYS.SETTINGS, null);
    if (!parsed) return defaults;
    return { ...defaults, ...parsed };
  },

  saveSettings(settings) {
    cryptoService.setEncryptedItem(STORAGE_KEYS.SETTINGS, settings);
    try { syncSettingsToRTDB(settings); } catch (_) {}
  },

  async syncSettingsFromRTDB() {
    try {
      const rtdbSettings = await fetchSettingsFromRTDB();
      if (rtdbSettings) {
        const merged = { ...this.getSettings(), ...rtdbSettings };
        cryptoService.setEncryptedItem(STORAGE_KEYS.SETTINGS, merged);
        return merged;
      }
    } catch (_) {}
    return this.getSettings();
  }
};
