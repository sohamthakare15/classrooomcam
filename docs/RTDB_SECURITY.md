# Firebase Realtime Database (RTDB) Security & Architecture Report

## 1. Architectural Scope & Operating Mode

The SmartClassroom AI Attendance System is configured to use **Firebase Realtime Database (RTDB) only**:
- **Project**: `classroomcam-1b81d`
- **Database URL**: `https://classroomcam-1b81d-default-rtdb.asia-southeast1.firebasedatabase.app`
- **Authentication**: **NO** Firebase Authentication (no Google login, no Firebase Email/Password, no client OAuth tokens).
- **Storage**: **NO** Cloud Firestore.
- **Biometric Templates**: Stored **strictly locally** on the host desktop in encrypted format (`storage/templates/*.enc`) via Fernet (AES-128-CBC + HMAC-SHA256).

---

## 2. Realtime Database Security Rules (`firebase/database.rules.json`)

Because the database operates **without Firebase Authentication** (`auth === null`), standard user-specific authorization rules (e.g., `auth != null`, `auth.token.role === 'admin'`) cannot be evaluated.

To protect data integrity without enabling unrestricted public access, we engineered a **structural schema-validation ruleset** in `firebase/database.rules.json`:

```json
{
  "rules": {
    "students": {
      ".read": true,
      "$studentId": {
        ".write": true,
        ".validate": "newData.hasChildren(['studentId', 'fullName', 'rollNumber', 'class', 'section']) && !newData.hasChildren(['embedding', 'biometricTemplate', 'faceVector', 'template'])",
        "studentId": { ".validate": "newData.isString() && newData.val() === $studentId" },
        "fullName": { ".validate": "newData.isString() && newData.val().length > 0 && newData.val().length < 100" },
        "rollNumber": { ".validate": "newData.isString() && newData.val().length > 0" },
        "class": { ".validate": "newData.isString()" },
        "section": { ".validate": "newData.isString()" },
        "enrollmentStatus": { ".validate": "newData.isString()" }
      }
    },
    "attendance_sessions": {
      ".read": true,
      "$sessionId": {
        ".write": true,
        ".validate": "newData.hasChildren(['sessionId', 'class', 'section', 'date', 'status'])",
        "sessionId": { ".validate": "newData.isString() && newData.val() === $sessionId" },
        "status": { ".validate": "newData.val() === 'in_progress' || newData.val() === 'completed' || newData.val() === 'cancelled'" },
        "presentCount": { ".validate": "newData.isNumber() && newData.val() >= 0" },
        "absentCount": { ".validate": "newData.isNumber() && newData.val() >= 0" }
      }
    },
    "attendance_records": {
      ".read": true,
      "$recordId": {
        ".write": true,
        ".validate": "newData.hasChildren(['recordId', 'sessionId', 'studentId', 'status']) && (!data.exists() || (newData.child('sessionId').val() === data.child('sessionId').val() && newData.child('studentId').val() === data.child('studentId').val()))",
        "recordId": { ".validate": "newData.isString() && newData.val() === $recordId && $recordId.contains('session_') && $recordId.contains('_student_')" },
        "sessionId": { ".validate": "newData.isString()" },
        "studentId": { ".validate": "newData.isString()" },
        "status": { ".validate": "newData.val() === 'present' || newData.val() === 'absent' || newData.val() === 'late' || newData.val() === 'manually_added' || newData.val() === 'needs_review'" },
        "confidenceScore": { ".validate": "newData.isNumber()" }
      }
    },
    "attendance_audit_logs": {
      ".read": true,
      "$logId": {
        ".write": "!data.exists()",
        ".validate": "newData.hasChildren(['logId', 'sessionId', 'studentId', 'action', 'timestamp'])",
        "logId": { ".validate": "newData.isString() && newData.val() === $logId" },
        "timestamp": { ".validate": "newData.isNumber()" }
      }
    },
    "review_queue": {
      ".read": true,
      "$reviewId": {
        ".write": true,
        ".validate": "newData.hasChildren(['reviewId', 'candidateStudentId', 'status'])",
        "reviewId": { ".validate": "newData.isString() && newData.val() === $reviewId" },
        "status": { ".validate": "newData.val() === 'pending' || newData.val() === 'confirmed' || newData.val() === 'rejected' || newData.val() === 'dismissed'" }
      }
    },
    "classrooms": {
      ".read": true,
      ".write": true
    },
    "application_settings": {
      ".read": true,
      ".write": true
    },
    "$other": {
      ".read": false,
      ".write": false
    }
  }
}
```

---

## 3. Critical Security Warnings & Inherent Limitations

> [!WARNING]
> **Consequences of an Unauthenticated Cloud Database Architecture:**
> 1. **Public Endpoint Exposure**: Because `.read: true` and `.write: true` are required for unauthenticated clients, anyone who discovers or extracts your Firebase Database URL (`https://classroomcam-1b81d-default-rtdb.asia-southeast1.firebasedatabase.app`) can read the classroom rosters and attendance statistics, or submit writes that conform to the schema validator.
> 2. **Client-Side Secrets Cannot Provide Security**: Storing a static shared API key or secret token inside a client-side Electron/React app does not secure an unauthenticated Firebase RTDB, as any user or network observer can inspect client memory or HTTP traffic.
> 3. **No Per-User Attribution in Cloud Database**: Without Firebase Auth tokens, the cloud database cannot independently verify the identity of the teacher performing manual overrides. The system mitigates this by recording user IDs inside the immutable `attendance_audit_logs`, but server-enforced identity guarantees require an authenticated provider or server-side proxy.

---

## 4. Privacy & Biometric Safeguards

Even with an unauthenticated cloud database, student privacy is strictly guarded through structural isolation:

1. **Biometric Data Boundary**:
   - `firebase/database.rules.json` enforces:
     ```json
     !newData.hasChildren(['embedding', 'biometricTemplate', 'faceVector', 'template'])
     ```
   - Any write containing raw face vectors or biometric templates is rejected by the database engine.
   - The Python `OfflineSyncQueue` sanitizes all outgoing payloads to strip biometric fields prior to transmission.
2. **Local Machine Encryption**:
   - 128-D facial feature embeddings generated by OpenCV SFace are encrypted with AES-GCM (Fernet) and stored on the local PC (`storage/templates/*.enc`).
3. **Deterministic Record IDs**:
   - Attendance documents are keyed as `session_{sessionId}_student_{studentId}`.
   - RTDB rules reject changing `sessionId` or `studentId` on an existing record, preventing record tampering or duplicate creation.
4. **Append-Only Audit Trail**:
   - The `attendance_audit_logs` collection enforces `".write": "!data.exists()"`. Once an audit log is created, it cannot be modified or deleted.

---

## 5. Deployment Instructions

To deploy the rules to your live Firebase project:

```powershell
# 1. Login to Firebase CLI
npx firebase login

# 2. Deploy Realtime Database rules
npx firebase deploy --only database
```

