import React, { useState, useEffect } from 'react';
import {
  AlertTriangle,
  Check,
  X,
  UserCheck,
  EyeOff,
  Clock,
  ShieldCheck,
  RefreshCw,
  Camera,
  Trash2
} from 'lucide-react';
import { apiService } from '../services/apiService';
import { storageService } from '../services/storageService';
import { subscribeToStudents } from '../services/rtdbService';
import Modal from '../components/Modal';

export default function RecognitionReviewPage() {
  const [reviews, setReviews] = useState([]);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusMessage, setStatusMessage] = useState('');

  // Re-assign Student Modal
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [selectedReview, setSelectedReview] = useState(null);
  const [chosenStudentId, setChosenStudentId] = useState('');

  useEffect(() => {
    storageService.syncFromBackend(apiService).then(setStudents).catch(() => setStudents(storageService.getStudents()));
    const unsub = subscribeToStudents((list) => {
      if (Array.isArray(list)) {
        storageService.saveStudents(list);
        setStudents(list);
      }
    });
    loadReviews();
    const interval = setInterval(loadReviews, 3000);
    return () => {
      clearInterval(interval);
      if (unsub) unsub();
    };
  }, []);

  const loadReviews = async () => {
    try {
      const res = await apiService.getPendingReviews();
      if (res && res.reviews) {
        setReviews(res.reviews);
      }
    } catch (_) {} finally {
      setLoading(false);
    }
  };

  const handleAction = async (reviewId, action, assignedId = null) => {
    try {
      await apiService.resolveReview(reviewId, action, assignedId);
      setStatusMessage(`Review item resolved as ${action}`);
      loadReviews();
      setTimeout(() => setStatusMessage(''), 3000);
    } catch (err) {
      alert(`Error resolving review: ${err.message}`);
    }
  };

  const handleClearAllReviews = async () => {
    if (!window.confirm("Dismiss and remove all pending review items from the queue?")) return;
    try {
      const res = await apiService.clearAllReviews();
      setStatusMessage(`Cleared ${res.dismissedCount || 0} review items.`);
      loadReviews();
      setTimeout(() => setStatusMessage(''), 4000);
    } catch (err) {
      alert(`Error clearing reviews: ${err.message}`);
    }
  };


  const openAssignModal = (review) => {
    setSelectedReview(review);
    setChosenStudentId(students[0]?.studentId || '');
    setAssignModalOpen(true);
  };

  const submitManualAssignment = (e) => {
    e.preventDefault();
    if (!selectedReview || !chosenStudentId) return;
    handleAction(selectedReview.reviewId, 'MANUAL_SELECT', chosenStudentId);
    setAssignModalOpen(false);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">AI Recognition Review Panel</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Teacher supervision queue for ambiguous or uncertain facial recognition candidates.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadReviews}
            className="enterprise-btn-secondary text-xs"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Refresh Queue
          </button>
          {reviews.length > 0 && (
            <button
              onClick={handleClearAllReviews}
              className="px-3 py-1.5 text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 hover:bg-rose-100 rounded-lg flex items-center gap-1.5 transition-colors"
              title="Dismiss all unwanted items"
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-600" /> Clear Unwanted Items
            </button>
          )}
        </div>
      </div>

      {/* Info Banner */}
      <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
        <div className="text-xs text-amber-900 leading-relaxed">
          <strong className="font-semibold block mb-0.5">Human-in-the-Loop Safeguard Active</strong>
          When facial recognition confidence falls below 75% or when face quality is degraded by motion or lighting, attendance is not marked automatically. Confirm or re-assign candidate identities below.
        </div>
      </div>

      {statusMessage && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-xs font-medium">
          {statusMessage}
        </div>
      )}

      {/* Reviews Cards List */}
      {reviews.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {reviews.map((rev) => {
            const candidateStudent = students.find(s => s.studentId === rev.candidateStudentId);
            const cropUrl = apiService.getReviewCropUrl(rev.reviewId);
            const confPct = Math.round((rev.confidenceScore || 0) * 100);

            return (
              <div key={rev.reviewId} className="enterprise-card p-5 space-y-4 flex flex-col justify-between">
                <div>
                  {/* Face Crop Preview */}
                  <div className="relative rounded-lg overflow-hidden border border-slate-200 bg-slate-100 aspect-video flex items-center justify-center">
                    <img
                      src={cropUrl}
                      alt="Captured Face Crop"
                      onError={(e) => {
                        e.target.onerror = null;
                        e.target.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2'%3E%3Cpath d='M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2'/%3E%3Ccircle cx='12' cy='7' r='4'/%3E%3C/svg%3E";
                      }}
                      className="w-full h-full object-cover"
                    />
                    <span className="absolute top-2 right-2 bg-slate-900/80 text-white text-[10px] font-mono px-2 py-0.5 rounded">
                      {confPct}% Match
                    </span>
                  </div>

                  {/* Candidate Details */}
                  <div className="mt-3 space-y-1 text-xs">
                    <div className="font-bold text-slate-800 text-sm">
                      {candidateStudent?.fullName || rev.candidateStudentId}
                    </div>
                    <div className="text-slate-500 flex justify-between">
                      <span>Roll #: {candidateStudent?.rollNumber || '—'}</span>
                      <span>Class: {candidateStudent?.class}-{candidateStudent?.section}</span>
                    </div>
                    <div className="text-[11px] text-slate-400 font-mono pt-1">
                      Time: {new Date(rev.timestamp * 1000).toLocaleTimeString()} &bull; Source: {rev.cameraSource}
                    </div>
                  </div>
                </div>

                {/* Teacher Decision Actions */}
                <div className="pt-3 border-t border-slate-100 space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => handleAction(rev.reviewId, 'CONFIRM')}
                      className="enterprise-btn-primary text-xs justify-center py-1.5"
                    >
                      <Check className="w-3.5 h-3.5" /> Confirm
                    </button>
                    <button
                      onClick={() => handleAction(rev.reviewId, 'REJECT')}
                      className="enterprise-btn-secondary text-xs justify-center py-1.5 text-rose-600 hover:bg-rose-50"
                    >
                      <X className="w-3.5 h-3.5" /> Reject
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <button
                      onClick={() => openAssignModal(rev)}
                      className="text-slate-600 hover:text-slate-800 py-1 font-medium text-center hover:underline"
                    >
                      Re-assign...
                    </button>
                    <button
                      onClick={() => handleAction(rev.reviewId, 'DISMISS')}
                      className="text-slate-400 hover:text-slate-600 py-1 text-center hover:underline"
                    >
                      Dismiss False
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="enterprise-card p-12 text-center text-slate-400 space-y-2">
          <ShieldCheck className="w-12 h-12 mx-auto text-emerald-500" />
          <h3 className="font-bold text-slate-700 text-sm">Review Queue Clear</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            All detected faces during sessions met high confidence criteria or have been reviewed by a teacher.
          </p>
        </div>
      )}

      {/* Manual Assign Modal */}
      <Modal
        isOpen={assignModalOpen}
        onClose={() => setAssignModalOpen(false)}
        title="Manually Assign Face to Student"
      >
        <form onSubmit={submitManualAssignment} className="space-y-4 text-xs">
          <div>
            <label className="block text-slate-700 font-semibold mb-1">
              Select Correct Enrolled Student
            </label>
            <select
              value={chosenStudentId}
              onChange={(e) => setChosenStudentId(e.target.value)}
              className="w-full border border-slate-200 rounded-lg p-2.5 bg-white text-slate-800"
            >
              {students.map((s) => (
                <option key={s.studentId} value={s.studentId}>
                  {s.rollNumber} - {s.fullName} ({s.class}-{s.section})
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setAssignModalOpen(false)}
              className="enterprise-btn-secondary text-xs"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="enterprise-btn-primary text-xs"
            >
              Assign & Mark Present
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

