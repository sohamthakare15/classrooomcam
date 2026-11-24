/**
 * Firebase Realtime Database (RTDB) Service.
 * Manages cloud data persistence for students, attendance sessions, records, review queue and audit logs.
 * Unauthenticated architecture: No Firebase Auth or Firestore SDK is imported or used.
 */
import { initializeApp } from 'firebase/app';
import {
  getDatabase,
  ref,
  set,
  get,
  remove,
  update,
  child,
  onValue
} from 'firebase/database';
import { cryptoService } from './cryptoService';

function decryptStudentFields(s) {
  if (!s || typeof s !== 'object') return s;
  return {
    ...s,
    email: cryptoService.decryptString(s.email || ''),
    contactNumber: cryptoService.decryptString(s.contactNumber || '')
  };
}

export const rtdbConfig = {
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL || "https://classroomcam-1b81d-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "classroomcam-1b81d"
};

let app = null;
let database = null;
let isConfigured = false;

try {
  if (rtdbConfig.databaseURL) {
    app = initializeApp(rtdbConfig);
    database = getDatabase(app);
    isConfigured = true;
    console.log('[RTDB] Initialized successfully for URL:', rtdbConfig.databaseURL);
  }
} catch (err) {
  console.warn('[RTDB] Initialization notice:', err.message);
}

export { app, database, isConfigured };

// --- STUDENTS ---

export async function syncStudentToRTDB(student) {
  if (!database || !isConfigured) return false;
  try {
    // Biometric security boundary: Never include raw biometric templates
    const cleanStudent = { ...student };
    delete cleanStudent.embedding;
    delete cleanStudent.template;
    delete cleanStudent.biometricTemplate;

    const studentRef = ref(database, `students/${student.studentId}`);
    await set(studentRef, {
      ...cleanStudent,
      email: cryptoService.encryptString(cleanStudent.email || ''),
      contactNumber: cryptoService.encryptString(cleanStudent.contactNumber || ''),
      updatedAt: Date.now()
    });
    return true;
  } catch (err) {
    console.warn('[RTDB] Failed to sync student:', err.message);
    return false;
  }
}

export async function fetchStudentsFromRTDB() {
  if (!database || !isConfigured) return null;
  try {
    const studentsRef = ref(database, 'students');
    const snapshot = await get(studentsRef);
    if (snapshot.exists()) {
      const val = snapshot.val();
      return Object.values(val).map(decryptStudentFields);
    }
    return [];
  } catch (err) {
    console.warn('[RTDB] Failed to fetch students:', err.message);
    return null;
  }
}

export async function deleteStudentFromRTDB(studentId) {
  if (!database || !isConfigured) return false;
  try {
    await remove(ref(database, `students/${studentId}`));
    return true;
  } catch (err) {
    console.warn('[RTDB] Failed to delete student:', err.message);
    return false;
  }
}

export function subscribeToStudents(callback) {
  if (!database || !isConfigured) return () => {};
  const studentsRef = ref(database, 'students');
  return onValue(studentsRef, (snapshot) => {
    if (snapshot.exists()) {
      callback(Object.values(snapshot.val()).map(decryptStudentFields));
    } else {
      callback([]);
    }
  }, (err) => {
    console.warn('[RTDB] Students listener error:', err.message);
  });
}

// --- FACULTY & USERS ---

export async function syncUserToRTDB(user) {
  if (!database || !isConfigured || !user?.uid) return false;
  try {
    const cleanUser = { ...user };
    delete cleanUser.password;
    await set(ref(database, `faculty_users/${user.uid}`), {
      ...cleanUser,
      updatedAt: Date.now()
    });
    return true;
  } catch (err) {
    console.warn('[RTDB] Failed to sync user:', err.message);
    return false;
  }
}

export async function fetchUsersFromRTDB() {
  if (!database || !isConfigured) return null;
  try {
    const snapshot = await get(ref(database, 'faculty_users'));
    if (snapshot.exists()) {
      return Object.values(snapshot.val());
    }
    return [];
  } catch (err) {
    console.warn('[RTDB] Failed to fetch users:', err.message);
    return null;
  }
}

export async function deleteUserFromRTDB(uid) {
  if (!database || !isConfigured || !uid) return false;
  try {
    await remove(ref(database, `faculty_users/${uid}`));
    return true;
  } catch (err) {
    console.warn('[RTDB] Failed to delete user:', err.message);
    return false;
  }
}

export function subscribeToUsers(callback) {
  if (!database || !isConfigured) return () => {};
  const usersRef = ref(database, 'faculty_users');
  return onValue(usersRef, (snapshot) => {
    if (snapshot.exists()) {
      callback(Object.values(snapshot.val()));
    } else {
      callback([]);
    }
  }, (err) => {
    console.warn('[RTDB] Users listener error:', err.message);
  });
}

// --- SECTIONS ---

export async function syncSectionToRTDB(section) {
  if (!database || !isConfigured || !section?.sectionId) return false;
  try {
    await set(ref(database, `sections/${section.sectionId}`), {
      ...section,
      updatedAt: Date.now()
    });
    return true;
  } catch (err) {
    console.warn('[RTDB] Failed to sync section:', err.message);
    return false;
  }
}

export async function fetchSectionsFromRTDB() {
  if (!database || !isConfigured) return null;
  try {
    const snapshot = await get(ref(database, 'sections'));
    if (snapshot.exists()) {
      return Object.values(snapshot.val());
    }
    return [];
  } catch (err) {
    console.warn('[RTDB] Failed to fetch sections:', err.message);
    return null;
  }
}

export async function deleteSectionFromRTDB(sectionId) {
  if (!database || !isConfigured || !sectionId) return false;
  try {
    await remove(ref(database, `sections/${sectionId}`));
    return true;
  } catch (err) {
    console.warn('[RTDB] Failed to delete section:', err.message);
    return false;
  }
}

export function subscribeToSections(callback) {
  if (!database || !isConfigured) return () => {};
  const sectionsRef = ref(database, 'sections');
  return onValue(sectionsRef, (snapshot) => {
    if (snapshot.exists()) {
      callback(Object.values(snapshot.val()));
    } else {
      callback([]);
    }
  }, (err) => {
    console.warn('[RTDB] Sections listener error:', err.message);
  });
}

export function subscribeToSessions(callback) {
  if (!database || !isConfigured) return () => {};
  const sessionsRef = ref(database, 'attendance_sessions');
  return onValue(sessionsRef, (snapshot) => {
    if (snapshot.exists()) {
      callback(Object.values(snapshot.val()));
    } else {
      callback([]);
    }
  }, (err) => {
    console.warn('[RTDB] Sessions listener error:', err.message);
  });
}

export async function deleteSessionFromRTDB(sessionId) {
  if (!database || !isConfigured || !sessionId) return false;
  try {
    await remove(ref(database, `attendance_sessions/${sessionId}`));
    const recSnap = await get(ref(database, 'attendance_records'));
    if (recSnap.exists()) {
      const records = recSnap.val();
      const deletes = Object.entries(records)
        .filter(([, r]) => r && r.sessionId === sessionId)
        .map(([recId]) => remove(ref(database, `attendance_records/${recId}`)));
      await Promise.all(deletes);
    }
    return true;
  } catch (err) {
    console.warn('[RTDB] Failed to delete session:', err.message);
    return false;
  }
}

export async function clearAllSessionsFromRTDB() {
  if (!database || !isConfigured) return false;
  try {
    await Promise.all([
      remove(ref(database, 'attendance_sessions')),
      remove(ref(database, 'attendance_records'))
    ]);
    return true;
  } catch (err) {
    console.warn('[RTDB] Failed to clear all sessions:', err.message);
    return false;
  }
}

// --- INSTITUTION SETTINGS ---

export async function syncSettingsToRTDB(settings) {
  if (!database || !isConfigured) return false;
  try {
    await set(ref(database, 'institution_settings'), {
      encryptedPayload: cryptoService.encryptJson(settings),
      updatedAt: Date.now()
    });
    return true;
  } catch (err) {
    console.warn('[RTDB] Failed to sync settings:', err.message);
    return false;
  }
}

export async function fetchSettingsFromRTDB() {
  if (!database || !isConfigured) return null;
  try {
    const snapshot = await get(ref(database, 'institution_settings'));
    if (snapshot.exists()) {
      const val = snapshot.val();
      if (val?.encryptedPayload) {
        return cryptoService.decryptJson(val.encryptedPayload, null);
      }
      return val;
    }
    return null;
  } catch (err) {
    console.warn('[RTDB] Failed to fetch settings:', err.message);
    return null;
  }
}

export function subscribeToSettings(callback) {
  if (!database || !isConfigured) return () => {};
  const settingsRef = ref(database, 'institution_settings');
  return onValue(settingsRef, (snapshot) => {
    if (snapshot.exists()) {
      const val = snapshot.val();
      if (val?.encryptedPayload) {
        const dec = cryptoService.decryptJson(val.encryptedPayload, null);
        if (dec) callback(dec);
      } else {
        callback(val);
      }
    }
  }, (err) => {
    console.warn('[RTDB] Settings listener error:', err.message);
  });
}

// --- ATTENDANCE SESSIONS ---

export async function syncSessionToRTDB(session) {
  if (!database || !isConfigured) return false;
  try {
    const sessionRef = ref(database, `attendance_sessions/${session.sessionId}`);
    await set(sessionRef, {
      ...session,
      updatedAt: Date.now()
    });
    return true;
  } catch (err) {
    console.warn('[RTDB] Failed to sync session:', err.message);
    return false;
  }
}

export async function fetchSessionsFromRTDB() {
  if (!database || !isConfigured) return [];
  try {
    const sessionsRef = ref(database, 'attendance_sessions');
    const snapshot = await get(sessionsRef);
    if (snapshot.exists()) {
      const val = snapshot.val();
      return Object.values(val);
    }
    return [];
  } catch (err) {
    console.warn('[RTDB] Failed to fetch sessions:', err.message);
    return [];
  }
}

// --- ATTENDANCE RECORDS (DETERMINISTIC IDs) ---

export async function syncRecordToRTDB(record) {
  if (!database || !isConfigured) return false;
  try {
    const recordId = record.recordId || `session_${record.sessionId}_student_${record.studentId}`;
    const recordRef = ref(database, `attendance_records/${recordId}`);
    await set(recordRef, {
      ...record,
      recordId,
      updatedAt: Date.now()
    });
    return true;
  } catch (err) {
    console.warn('[RTDB] Failed to sync attendance record:', err.message);
    return false;
  }
}

export async function fetchRecordsForSessionFromRTDB(sessionId) {
  if (!database || !isConfigured) return [];
  try {
    const recordsRef = ref(database, 'attendance_records');
    const snapshot = await get(recordsRef);
    if (snapshot.exists()) {
      const allRecords = Object.values(snapshot.val());
      return allRecords.filter(r => r.sessionId === sessionId);
    }
    return [];
  } catch (err) {
    console.warn('[RTDB] Failed to fetch session records:', err.message);
    return [];
  }
}

// --- AUDIT LOGS (IMMUTABLE APPEND-ONLY) ---

export async function syncAuditLogToRTDB(logEntry) {
  if (!database || !isConfigured) return false;
  try {
    const logId = logEntry.logId || `audit_${Date.now()}`;
    const logRef = ref(database, `attendance_audit_logs/${logId}`);
    await set(logRef, {
      ...logEntry,
      logId,
      timestamp: logEntry.timestamp || Date.now()
    });
    return true;
  } catch (err) {
    console.warn('[RTDB] Failed to append audit log:', err.message);
    return false;
  }
}

// --- REVIEW QUEUE ---

export async function syncReviewItemToRTDB(reviewItem) {
  if (!database || !isConfigured) return false;
  try {
    const reviewRef = ref(database, `review_queue/${reviewItem.reviewId}`);
    await set(reviewRef, {
      ...reviewItem,
      updatedAt: Date.now()
    });
    return true;
  } catch (err) {
    console.warn('[RTDB] Failed to sync review item:', err.message);
    return false;
  }
}

