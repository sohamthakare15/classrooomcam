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
  update,
  child,
  onValue
} from 'firebase/database';

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
      return Object.values(val);
    }
    return [];
  } catch (err) {
    console.warn('[RTDB] Failed to fetch students:', err.message);
    return null;
  }
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

