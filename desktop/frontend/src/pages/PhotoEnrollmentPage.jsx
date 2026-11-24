import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  Upload,
  Camera,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Trash2,
  ShieldCheck,
  Info,
  RefreshCw,
  UserPlus,
  Sparkles,
  Image as ImageIcon
} from 'lucide-react';
import { storageService } from '../services/storageService';
import { apiService } from '../services/apiService';
import { subscribeToStudents } from '../services/rtdbService';

export default function PhotoEnrollmentPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const initialStudentId = searchParams.get('studentId') || '';

  const [students, setStudents] = useState([]);
  const [selectedStudentId, setSelectedStudentId] = useState(initialStudentId);
  const [selectedStudent, setSelectedStudent] = useState(null);

  // Uploaded/captured files: list of { file, preview, base64 }
  const [photos, setPhotos] = useState([]);
  const [status, setStatus] = useState('IDLE'); // 'IDLE', 'VALIDATING', 'PROCESSING', 'ENROLLED', 'FAILED'
  const [statusMessage, setStatusMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSnapping, setIsSnapping] = useState(false);

  useEffect(() => {
    const applyList = (list) => {
      setStudents(list);
      if (initialStudentId) {
        const found = list.find(s => s.studentId === initialStudentId);
        if (found) {
          setSelectedStudentId(found.studentId);
          setSelectedStudent(found);
        }
      } else if (list.length > 0 && !selectedStudentId) {
        setSelectedStudentId(list[0].studentId);
        setSelectedStudent(list[0]);
      }
    };

    storageService.syncFromBackend(apiService).then(applyList).catch(() => {
      applyList(storageService.getStudents());
    });

    const unsub = subscribeToStudents((rtdbList) => {
      if (Array.isArray(rtdbList)) {
        storageService.saveStudents(rtdbList);
        applyList(rtdbList);
      }
    });
    return () => { if (unsub) unsub(); };
  }, [initialStudentId]);

  const handleStudentChange = (sId) => {
    setSelectedStudentId(sId);
    const found = students.find(s => s.studentId === sId);
    setSelectedStudent(found || null);
    setPhotos([]);
    setStatus('IDLE');
    setErrorMessage('');
    setStatusMessage('');
  };

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;

    setErrorMessage('');

    const validFiles = [];
    for (const file of files) {
      if (!['image/jpeg', 'image/jpg', 'image/png'].includes(file.type)) {
        setErrorMessage('Only JPG, JPEG, and PNG images are supported.');
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        setErrorMessage(`File ${file.name} exceeds 10MB limit.`);
        return;
      }
      validFiles.push(file);
    }

    // Convert to preview and base64
    validFiles.forEach(file => {
      const reader = new FileReader();
      reader.onload = () => {
        setPhotos(prev => [
          ...prev,
          {
            file,
            preview: reader.result,
            base64: reader.result
          }
        ]);
      };
      reader.readAsDataURL(file);
    });
  };

  const handleCaptureFromWebcam = async () => {
    setIsSnapping(true);
    setErrorMessage('');
    try {
      const blob = await apiService.getCameraSnapshotBlob();
      const reader = new FileReader();
      reader.onload = () => {
        setPhotos(prev => [
          ...prev,
          {
            file: new File([blob], `webcam_snap_${Date.now()}.jpg`, { type: 'image/jpeg' }),
            preview: reader.result,
            base64: reader.result
          }
        ]);
        setStatusMessage(`Captured snapshot from laptop webcam! (${photos.length + 1} photos ready)`);
      };
      reader.readAsDataURL(blob);
    } catch (err) {
      setErrorMessage(`Webcam snapshot failed: ${err.message}. Ensure camera is connected in Camera Settings.`);
    } finally {
      setIsSnapping(false);
    }
  };

  const removePhoto = (index) => {
    setPhotos(prev => prev.filter((_, i) => i !== index));
  };

  const handleEnrollmentSubmit = async () => {
    if (!selectedStudent) {
      setErrorMessage('Please select or register a student first');
      return;
    }
    if (photos.length === 0) {
      setErrorMessage('Please snap or upload at least one clear face photograph');
      return;
    }

    setErrorMessage('');
    setStatus('VALIDATING');
    setStatusMessage('Analyzing photo quality, blur, lighting and single-face criteria...');

    try {
      const base64List = photos.map(p => p.base64);

      setStatus('PROCESSING');
      setStatusMessage('Extracting 128D deep feature embeddings and encrypting biometric template...');

      const res = await apiService.enrollStudent(selectedStudent.studentId, base64List);

      if (res.success) {
        setStatus('ENROLLED');
        setStatusMessage(res.message || 'Student biometrically enrolled successfully!');

        // Update local student registry status
        storageService.updateStudent(selectedStudent.studentId, {
          enrollmentStatus: 'Enrolled'
        });
        setSelectedStudent(prev => ({ ...prev, enrollmentStatus: 'Enrolled' }));
      } else {
        setStatus('FAILED');
        setErrorMessage(res.error || 'Enrollment validation failed');
      }
    } catch (err) {
      setStatus('FAILED');
      setErrorMessage(err.message || 'Error communicating with AI engine');
    }
  };

  const handleDeleteEnrollment = async () => {
    if (!selectedStudent) return;
    if (window.confirm(`Permanently remove local encrypted biometric templates and photos for ${selectedStudent.fullName}?`)) {
      setIsDeleting(true);
      try {
        await apiService.deleteEnrollment(selectedStudent.studentId);
        storageService.updateStudent(selectedStudent.studentId, {
          enrollmentStatus: 'Not Enrolled'
        });
        setSelectedStudent(prev => ({ ...prev, enrollmentStatus: 'Not Enrolled' }));
        setPhotos([]);
        setStatus('IDLE');
        setStatusMessage('Biometric enrollment data wiped from local storage.');
      } catch (err) {
        setErrorMessage(err.message);
      } finally {
        setIsDeleting(false);
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-slate-900 tracking-tight">Biometric Photo Enrollment</h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Enroll student face templates into local encrypted storage using your laptop webcam or uploaded portrait photos.
        </p>
      </div>

      {/* Mandatory Institutional Notice Alert */}
      <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl flex items-start gap-3">
        <ShieldCheck className="w-5 h-5 text-blue-700 shrink-0 mt-0.5" />
        <div className="text-xs text-blue-900 leading-relaxed">
          <strong className="font-semibold block mb-0.5">Biometric Privacy and Security Safeguard</strong>
          Face photographs and extracted 128-D vector templates are stored exclusively in locally encrypted machine storage (AES-GCM / Fernet). <strong>Uploading a photograph never automatically marks a student present.</strong>
        </div>
      </div>

      {students.length === 0 ? (
        <div className="enterprise-card p-12 text-center space-y-4">
          <div className="w-12 h-12 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center mx-auto">
            <UserPlus className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h3 className="font-bold text-slate-800 text-sm">No Registered Students in Roster</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              You have removed the demo dataset. To begin real-time facial recognition attendance, register your real students first.
            </p>
          </div>
          <button
            onClick={() => navigate('/students')}
            className="enterprise-btn-primary text-xs mx-auto"
          >
            <UserPlus className="w-3.5 h-3.5" /> Go to Student Directory
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Student Selector & Status Details */}
          <div className="space-y-6">
            <div className="enterprise-card p-5 space-y-4">
              <h3 className="text-sm font-bold text-slate-800">1. Select Student</h3>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Target Student
                </label>
                <select
                  value={selectedStudentId}
                  onChange={(e) => handleStudentChange(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg p-2 text-xs bg-white text-slate-800 focus:ring-1 focus:ring-blue-600 focus:outline-none font-medium"
                >
                  {students.map((s) => (
                    <option key={s.studentId} value={s.studentId}>
                      {s.rollNumber ? `#${s.rollNumber} - ` : ''}{s.fullName} ({s.class}-{s.section})
                    </option>
                  ))}
                </select>
              </div>

              {selectedStudent && (
                <div className="p-4 bg-slate-50 rounded-lg space-y-2 text-xs border border-slate-100">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Student ID:</span>
                    <span className="font-mono font-medium text-slate-800">{selectedStudent.studentId}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Class & Section:</span>
                    <span className="font-medium text-slate-800">Class {selectedStudent.class}-{selectedStudent.section}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Roll Number:</span>
                    <span className="font-medium text-slate-800">{selectedStudent.rollNumber}</span>
                  </div>
                  <div className="flex justify-between items-center pt-2 border-t border-slate-200">
                    <span className="text-slate-500">Enrollment Status:</span>
                    <span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                      selectedStudent.enrollmentStatus === 'Enrolled'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}>
                      {selectedStudent.enrollmentStatus || 'Not Enrolled'}
                    </span>
                  </div>
                </div>
              )}

              {selectedStudent?.enrollmentStatus === 'Enrolled' && (
                <button
                  onClick={handleDeleteEnrollment}
                  disabled={isDeleting}
                  className="w-full text-xs text-rose-600 hover:bg-rose-50 border border-rose-200 py-2 rounded-lg font-medium transition-colors flex items-center justify-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  {isDeleting ? "Wiping Template..." : "Delete Biometric Enrollment"}
                </button>
              )}
            </div>

            {/* Validation Checklist Card */}
            <div className="enterprise-card p-5 space-y-3 text-xs text-slate-600">
              <h4 className="font-bold text-slate-800 flex items-center gap-2">
                <Info className="w-4 h-4 text-blue-600" />
                Enrollment Quality Standards
              </h4>
              <ul className="space-y-2 text-slate-500 list-disc pl-4">
                <li>Direct forward-facing portrait with clear face visibility</li>
                <li>Exactly one face in the frame (multi-face frames are rejected)</li>
                <li>Webcam-optimized (automatically enhances indoor / dim lighting)</li>
                <li>Ensure your face is turned toward the screen / light source</li>
                <li>Resolution of at least 100 x 100 pixels</li>
              </ul>
            </div>
          </div>

          {/* Right: Upload Area, Previews & Action */}
          <div className="lg:col-span-2 space-y-6">
            <div className="enterprise-card p-5 space-y-5">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-800">2. Capture or Upload Photographs</h3>
                <span className="text-[11px] text-slate-500">1-3 photos recommended</span>
              </div>

              {/* Instant Webcam Capture Button */}
              <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                    <Camera className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-900">Live Webcam Snapshot</div>
                    <div className="text-[11px] text-slate-600">Position the student in front of your laptop camera and snap</div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleCaptureFromWebcam}
                  disabled={isSnapping}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors flex items-center gap-2 shrink-0 disabled:opacity-50"
                >
                  <Camera className={`w-3.5 h-3.5 ${isSnapping ? 'animate-spin' : ''}`} />
                  {isSnapping ? 'Capturing...' : 'Capture from Webcam'}
                </button>
              </div>

              {/* Drag & Drop Dropzone */}
              <div className="border-2 border-dashed border-slate-300 hover:border-blue-500 rounded-xl p-6 text-center transition-colors bg-slate-50/50">
                <input
                  type="file"
                  id="photo-upload-input"
                  multiple
                  accept="image/jpeg,image/jpg,image/png"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <label htmlFor="photo-upload-input" className="cursor-pointer block space-y-2">
                  <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center mx-auto">
                    <Upload className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-xs font-semibold text-blue-700 hover:underline">
                      Or upload photo files from computer
                    </span>
                    <span className="text-xs text-slate-500"> (JPG, JPEG, PNG up to 10MB)</span>
                  </div>
                </label>
              </div>

              {/* Previews Grid */}
              {photos.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs text-slate-600">
                    <span className="font-semibold">Ready for Biometric Extraction ({photos.length} photos)</span>
                    <button
                      onClick={() => setPhotos([])}
                      className="text-rose-600 hover:underline text-[11px]"
                    >
                      Clear All
                    </button>
                  </div>
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                    {photos.map((p, idx) => (
                      <div key={idx} className="relative group rounded-lg overflow-hidden border border-slate-200 bg-slate-100 aspect-square">
                        <img
                          src={p.preview}
                          alt={`Enrollment photo ${idx + 1}`}
                          className="w-full h-full object-cover"
                        />
                        <button
                          onClick={() => removePhoto(idx)}
                          className="absolute top-1 right-1 bg-rose-600/90 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Remove photo"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Error or Status Feedback */}
              {errorMessage && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-xs flex items-center gap-2">
                  <XCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {statusMessage && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-xs flex items-center gap-2">
                  {status === 'ENROLLED' ? (
                    <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                  ) : (
                    <RefreshCw className="w-4 h-4 text-blue-600 animate-spin shrink-0" />
                  )}
                  <span>{statusMessage}</span>
                </div>
              )}

              {/* Action Buttons */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setPhotos([])}
                  disabled={photos.length === 0 || status === 'VALIDATING' || status === 'PROCESSING'}
                  className="enterprise-btn-secondary text-xs disabled:opacity-50"
                >
                  Reset
                </button>
                <button
                  type="button"
                  onClick={handleEnrollmentSubmit}
                  disabled={photos.length === 0 || status === 'VALIDATING' || status === 'PROCESSING'}
                  className="enterprise-btn-primary text-xs disabled:opacity-50 flex items-center gap-2"
                >
                  {status === 'PROCESSING' || status === 'VALIDATING' ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Enrolling Student...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5" /> Process & Enroll Biometrics
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
