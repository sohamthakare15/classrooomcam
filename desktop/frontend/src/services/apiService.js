/**
 * Local AI Backend API Client.
 * Connects React UI to FastAPI Python server on 127.0.0.1:8000.
 */

let envUrl = import.meta.env.VITE_AI_BACKEND_URL;
if (!envUrl) {
  const isLocal = typeof window !== 'undefined' && 
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
  envUrl = isLocal ? 'http://127.0.0.1:8000' : 'https://smartclassroom-api-h96b.onrender.com';
}

let rawBackend = envUrl.trim().replace(/\/+$/, '');
if (!rawBackend.includes('.') && !rawBackend.includes('localhost') && !rawBackend.includes('127.0.0.1')) {
  rawBackend = `${rawBackend}.onrender.com`;
}

const BASE_URL = (!rawBackend.startsWith('http://') && !rawBackend.startsWith('https://'))
  ? `https://${rawBackend}`
  : rawBackend;

const API_TOKEN = import.meta.env.VITE_AI_API_TOKEN || 'smartclassroom-secure-ipc-token-2026';

const defaultHeaders = {
  'Content-Type': 'application/json',
  'X-App-Token': API_TOKEN
};

async function handleResponse(res) {
  if (!res.ok) {
    let errorMsg = `HTTP Error ${res.status}`;
    try {
      const text = await res.text();
      try {
        const err = JSON.parse(text);
        errorMsg = err.detail || err.message || errorMsg;
      } catch (_) {
        if (text && text.length < 200 && !text.includes('<!doctype') && !text.includes('<html')) {
          errorMsg = text;
        }
      }
    } catch (_) {}
    throw new Error(errorMsg);
  }
  return await res.json();
}

export const apiService = {
  getBaseUrl() {
    return BASE_URL;
  },

  getCameraStreamUrl() {
    return `${BASE_URL}/camera/stream`;
  },

  async getCameraSnapshotBlob() {
    const res = await fetch(`${BASE_URL}/camera/snapshot`);
    if (!res.ok) throw new Error("Camera frame is not available");
    return await res.blob();
  },

  async ingestCameraFrame(base64Image) {
    const res = await fetch(`${BASE_URL}/camera/frame/ingest`, {
      method: 'POST',
      headers: defaultHeaders,
      body: JSON.stringify({ image: base64Image })
    });
    return handleResponse(res);
  },

  getReviewCropUrl(reviewId) {
    return `${BASE_URL}/recognition/review/${reviewId}/crop`;
  },

  getStudentPhotoUrl(studentId) {
    return `${BASE_URL}/students/${studentId}/photo`;
  },

  getAttendanceSnapshotUrl(recordId) {
    return `${BASE_URL}/attendance/records/${recordId}/snapshot`;
  },

  // Health
  async getHealth() {
    const res = await fetch(`${BASE_URL}/health`);
    return handleResponse(res);
  },

  // Students & Enrollment
  async enrollStudent(studentId, photosBase64) {
    const res = await fetch(`${BASE_URL}/students/enroll`, {
      method: 'POST',
      headers: defaultHeaders,
      body: JSON.stringify({ studentId, photosBase64 })
    });
    return handleResponse(res);
  },

  async getEnrolledStudents() {
    const res = await fetch(`${BASE_URL}/students`, {
      headers: defaultHeaders
    });
    return handleResponse(res);
  },

  async getStudentEnrollment(studentId) {
    const res = await fetch(`${BASE_URL}/students/${studentId}`, {
      headers: defaultHeaders
    });
    return handleResponse(res);
  },

  async deleteEnrollment(studentId) {
    const res = await fetch(`${BASE_URL}/students/${studentId}/enrollment`, {
      method: 'DELETE',
      headers: defaultHeaders
    });
    return handleResponse(res);
  },

  // Student Directory Module (Database Integration)
  async getDbStudents(className = null, section = null) {
    let url = `${BASE_URL}/api/students`;
    const params = new URLSearchParams();
    if (className && className !== 'ALL') params.append('class_name', className);
    if (section && section !== 'ALL') params.append('section', section);
    if (params.toString()) url += `?${params.toString()}`;

    const res = await fetch(url, { headers: defaultHeaders });
    return handleResponse(res);
  },

  async createDbStudent(studentData) {
    const res = await fetch(`${BASE_URL}/api/students`, {
      method: 'POST',
      headers: defaultHeaders,
      body: JSON.stringify(studentData)
    });
    return handleResponse(res);
  },

  async updateDbStudent(studentId, studentData) {
    const res = await fetch(`${BASE_URL}/api/students/${studentId}`, {
      method: 'PUT',
      headers: defaultHeaders,
      body: JSON.stringify(studentData)
    });
    return handleResponse(res);
  },

  async deleteDbStudent(studentId) {
    const res = await fetch(`${BASE_URL}/api/students/${studentId}`, {
      method: 'DELETE',
      headers: defaultHeaders
    });
    return handleResponse(res);
  },

  // Section Management Module
  async getSections() {
    const res = await fetch(`${BASE_URL}/api/sections`, { headers: defaultHeaders });
    return handleResponse(res);
  },

  async createSection(sectionData) {
    const res = await fetch(`${BASE_URL}/api/sections`, {
      method: 'POST',
      headers: defaultHeaders,
      body: JSON.stringify(sectionData)
    });
    return handleResponse(res);
  },

  async deleteSection(sectionId) {
    const res = await fetch(`${BASE_URL}/api/sections/${sectionId}`, {
      method: 'DELETE',
      headers: defaultHeaders
    });
    return handleResponse(res);
  },

  async assignSection(studentId, className, sectionName) {
    const res = await fetch(`${BASE_URL}/api/sections/assign`, {
      method: 'POST',
      headers: defaultHeaders,
      body: JSON.stringify({ studentId, className, sectionName })
    });
    return handleResponse(res);
  },

  // Attendance Sessions
  async startAttendance(classVal, section, date, createdBy, title, allowDuplicate = false) {
    const res = await fetch(`${BASE_URL}/attendance/start`, {
      method: 'POST',
      headers: defaultHeaders,
      body: JSON.stringify({
        class: classVal,
        section,
        date,
        createdBy,
        title,
        allowDuplicate
      })
    });
    return handleResponse(res);
  },

  async stopAttendance(sessionId) {
    const res = await fetch(`${BASE_URL}/attendance/stop`, {
      method: 'POST',
      headers: defaultHeaders,
      body: JSON.stringify({ sessionId })
    });
    return handleResponse(res);
  },

  async getActiveSession() {
    const res = await fetch(`${BASE_URL}/attendance/active`, {
      headers: defaultHeaders
    });
    return handleResponse(res);
  },

  async getSessions() {
    const res = await fetch(`${BASE_URL}/attendance/sessions`, {
      headers: defaultHeaders
    });
    return handleResponse(res);
  },

  async getAllAttendanceRecords(sessionId = null, studentId = null) {
    let url = `${BASE_URL}/attendance/records`;
    const params = new URLSearchParams();
    if (sessionId) params.append('session_id', sessionId);
    if (studentId) params.append('student_id', studentId);
    if (params.toString()) url += `?${params.toString()}`;

    const res = await fetch(url, {
      headers: defaultHeaders
    });
    return handleResponse(res);
  },

  async getSessionDetails(sessionId) {
    const res = await fetch(`${BASE_URL}/attendance/${sessionId}`, {
      headers: defaultHeaders
    });
    return handleResponse(res);
  },

  async manualMark(sessionId, studentId, status, userId, reason) {
    const res = await fetch(`${BASE_URL}/attendance/manual`, {
      method: 'POST',
      headers: defaultHeaders,
      body: JSON.stringify({
        sessionId,
        studentId,
        status,
        userId,
        reason
      })
    });
    return handleResponse(res);
  },

  async finalizeSession(sessionId, finalizedBy, enrolledStudents) {
    const res = await fetch(`${BASE_URL}/attendance/${sessionId}/finalize`, {
      method: 'POST',
      headers: defaultHeaders,
      body: JSON.stringify({
        sessionId,
        finalizedBy,
        enrolledStudents
      })
    });
    return handleResponse(res);
  },

  async deleteSession(sessionId) {
    const res = await fetch(`${BASE_URL}/attendance/sessions/${sessionId}`, {
      method: 'DELETE',
      headers: defaultHeaders
    });
    return handleResponse(res);
  },

  async clearAllSessions() {
    const res = await fetch(`${BASE_URL}/attendance/sessions`, {
      method: 'DELETE',
      headers: defaultHeaders
    });
    return handleResponse(res);
  },


  // Camera Management
  async getCameraStatus() {
    const res = await fetch(`${BASE_URL}/camera/status`);
    return handleResponse(res);
  },

  async getAvailableWebcams() {
    const res = await fetch(`${BASE_URL}/camera/webcams`, {
      headers: defaultHeaders
    });
    return handleResponse(res);
  },

  async connectCamera(payload) {
    const res = await fetch(`${BASE_URL}/camera/connect`, {
      method: 'POST',
      headers: defaultHeaders,
      body: JSON.stringify(payload)
    });
    return handleResponse(res);
  },

  async disconnectCamera() {
    const res = await fetch(`${BASE_URL}/camera/disconnect`, {
      method: 'POST',
      headers: defaultHeaders
    });
    return handleResponse(res);
  },

  async testCamera(payload) {
    const res = await fetch(`${BASE_URL}/camera/test`, {
      method: 'POST',
      headers: defaultHeaders,
      body: JSON.stringify(payload)
    });
    return handleResponse(res);
  },

  async discoverONVIFCameras(timeout = 2.5) {
    const res = await fetch(`${BASE_URL}/camera/onvif/discover?timeout=${timeout}`, {
      headers: defaultHeaders
    });
    return handleResponse(res);
  },

  async getSavedCameraConfig() {
    const res = await fetch(`${BASE_URL}/camera/config`, {
      headers: defaultHeaders
    });
    return handleResponse(res);
  },

  async saveCameraConfig(payload) {
    const res = await fetch(`${BASE_URL}/camera/config`, {
      method: 'POST',
      headers: defaultHeaders,
      body: JSON.stringify(payload)
    });
    return handleResponse(res);
  },

  // Recognition Review
  async getPendingReviews() {
    const res = await fetch(`${BASE_URL}/recognition/review`, {
      headers: defaultHeaders
    });
    return handleResponse(res);
  },

  async resolveReview(reviewId, action, assignedStudentId = null) {
    const res = await fetch(`${BASE_URL}/recognition/review/${reviewId}`, {
      method: 'POST',
      headers: defaultHeaders,
      body: JSON.stringify({ action, assignedStudentId })
    });
    return handleResponse(res);
  },

  async clearAllReviews() {
    const res = await fetch(`${BASE_URL}/recognition/review`, {
      method: 'DELETE',
      headers: defaultHeaders
    });
    return handleResponse(res);
  },


  // Sync Status
  async getSyncStatus() {
    const res = await fetch(`${BASE_URL}/sync/status`, {
      headers: defaultHeaders
    });
    return handleResponse(res);
  },

  async flushRtdbSync(limit = 50) {
    const res = await fetch(`${BASE_URL}/sync/rtdb/push?limit=${limit}`, {
      method: 'POST',
      headers: defaultHeaders
    });
    return handleResponse(res);
  },

  // User Authentication & Management
  async login(identifier, password) {
    const res = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: defaultHeaders,
      body: JSON.stringify({ identifier, password })
    });
    return handleResponse(res);
  },

  async getUsers() {
    const res = await fetch(`${BASE_URL}/auth/users`, {
      headers: defaultHeaders
    });
    return handleResponse(res);
  },

  async createUser(userData) {
    const res = await fetch(`${BASE_URL}/auth/users`, {
      method: 'POST',
      headers: defaultHeaders,
      body: JSON.stringify(userData)
    });
    return handleResponse(res);
  },

  async deleteUser(uid) {
    const res = await fetch(`${BASE_URL}/auth/users/${uid}`, {
      method: 'DELETE',
      headers: defaultHeaders
    });
    return handleResponse(res);
  }
};

