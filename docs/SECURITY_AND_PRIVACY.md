# Security, Biometric Privacy & Institutional Compliance

The **SmartClassroom AI Attendance System** incorporates privacy-by-design principles to comply with educational biometric privacy laws (e.g., FERPA, GDPR-K, state student privacy regulations).

---

## 1. Biometric Template Separation Architecture

- **No Cloud Biometrics**: Raw student photographs and extracted 128-dimensional facial embedding vectors are **NEVER uploaded to Firebase Firestore, external servers, or third-party cloud services**.
- **Local Encryption Vault**: All local templates are encrypted on the host computer (`storage/templates/*.enc`) using symmetric encryption (AES-128-CBC with HMAC-SHA256 via Fernet) using a machine-specific secret key generated in `storage/.secrets/vault.key` with restricted operating system permissions.
- **In-Memory Decryption**: Templates are decrypted into RAM strictly during active recognition loops and are wiped upon application termination.

---

## 2. Enrollment Safeguards

1. **No Automatic Presence on Photo Upload**:
   - Uploading a student portrait for enrollment creates a face template only.
   - It **strictly never marks a student present** in any attendance session.
2. **Single-Face Enforcement**:
   - Enrollment images are automatically analyzed to guarantee that exactly one face exists in the image.
   - Group photos or background faces are rejected to prevent identity confusion.
3. **Right to Erasure (Delete Enrollment)**:
   - Clicking **Delete Enrollment** permanently removes the encrypted biometric template file (`.enc`), local cached thumbnail (`.jpg`), and unlinks the student from the recognition gallery.

---

## 3. Human-in-the-Loop Safeguard (Teacher Review Panel)

- **Calibrated Matching Thresholds**:
  - The recognition engine uses a dual-threshold system:
    - **Confirmed Identity ($\ge 75\%$)**: High confidence match.
    - **Ambiguous Match ($45\% - 75\%$)**: Routes to the **Teacher Review Queue**. The student is **NOT** marked present until the human teacher visually verifies the captured crop and confirms identity.
    - **Unknown ($< 45\%$)**: Ignored or tagged as unidentified.
- **Audit Logging**:
  - Every manual correction, review decision, or attendance modification is recorded with the teacher's User ID, timestamp, prior status, new status, and reason in an immutable append-only audit log.

---

## 4. Network and Camera Privacy

- **RTSP IP Streams**: Stream processing is executed entirely on the local computer's CPU/GPU via OpenCV. No live video stream is broadcast over the internet.
- **Masked Credentials**: Camera passwords are obfuscated in memory, logging, and status reporting.

