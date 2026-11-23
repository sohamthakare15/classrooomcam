import React, { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import {
  ShieldCheck,
  UserPlus,
  Users,
  Trash2,
  Lock,
  Mail,
  User,
  Building,
  KeyRound,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  ShieldAlert,
  GraduationCap,
  Sparkles,
  Eye,
  EyeOff
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiService } from '../services/apiService';
import { formatKolkataDateTime } from '../utils/dateUtils';
import Modal from '../components/Modal';

export default function AdminPanelPage() {
  const { currentUser, isAdmin } = useAuth();

  // Strict Role Guard: Redirect non-admin users immediately to Dashboard
  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusMsg, setStatusMsg] = useState({ text: '', type: '' });

  // Add Teacher Modal States
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newFullName, setNewFullName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showTeacherPassword, setShowTeacherPassword] = useState(false);
  const [newDepartment, setNewDepartment] = useState('Mathematics & Computing');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Delete Confirmation Modal States
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState(null);

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const res = await apiService.getUsers();
      if (res && res.users) {
        setUsers(res.users);
      }
    } catch (err) {
      console.error("Error loading users:", err);
      setStatusMsg({ text: `Failed to load faculty: ${err.message}`, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTeacher = async (e) => {
    e.preventDefault();
    if (!newFullName.trim() || !newEmail.trim() || !newPassword.trim()) {
      setStatusMsg({ text: 'Please fill in all required fields.', type: 'error' });
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await apiService.createUser({
        email: newEmail.trim().toLowerCase(),
        password: newPassword,
        fullName: newFullName.trim(),
        role: 'teacher',
        department: newDepartment.trim() || 'Academic Faculty'
      });

      if (res && res.user) {
        setStatusMsg({
          text: `Teacher account created for ${res.user.fullName} (${res.user.email}). Credentials saved to database.`,
          type: 'success'
        });
        setIsAddModalOpen(false);
        setNewFullName('');
        setNewEmail('');
        setNewPassword('');
        setNewDepartment('Mathematics & Computing');
        loadUsers();
      }
    } catch (err) {
      setStatusMsg({ text: err.message || 'Failed to create teacher account', type: 'error' });
    } finally {
      setIsSubmitting(false);
      setTimeout(() => setStatusMsg({ text: '', type: '' }), 5000);
    }
  };

  const confirmDeleteUser = (user) => {
    if (user.isPermanent || user.role === 'admin') {
      alert("The permanent system administrator account cannot be deleted.");
      return;
    }
    setUserToDelete(user);
    setIsDeleteModalOpen(true);
  };

  const handleDeleteUser = async () => {
    if (!userToDelete) return;
    try {
      await apiService.deleteUser(userToDelete.uid);
      setStatusMsg({
        text: `Faculty account for ${userToDelete.fullName || userToDelete.email} has been permanently removed.`,
        type: 'success'
      });
      setIsDeleteModalOpen(false);
      setUserToDelete(null);
      loadUsers();
    } catch (err) {
      setStatusMsg({ text: `Delete failed: ${err.message}`, type: 'error' });
    } finally {
      setTimeout(() => setStatusMsg({ text: '', type: '' }), 5000);
    }
  };

  const teacherUsers = users.filter(u => u.role === 'teacher');
  const adminUsers = users.filter(u => u.role === 'admin');

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-10">
      {/* 1. Header Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200/60">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-[#FFF2EE] text-[#FF5A36] border border-[#FFD9CE]">
              Faculty & Access
            </span>
            <span className="text-slate-300">&bull;</span>
            <span className="text-xs text-slate-500 font-medium">Teacher Directory</span>
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2.5 mt-1.5">
            <ShieldCheck className="w-6 h-6 text-[#FF5A36]" />
            <span>Admin Panel & Teacher Accounts</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage lecturer accounts, register new faculty members, and configure institutional access credentials.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={loadUsers}
            className="enterprise-btn-secondary text-xs flex items-center gap-2"
            title="Refresh Users"
          >
            <RefreshCw className="w-3.5 h-3.5 text-slate-600" />
            <span>Refresh</span>
          </button>
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="enterprise-btn-primary text-xs flex items-center gap-2 shadow-sm"
          >
            <UserPlus className="w-4 h-4" />
            <span>Add New Teacher</span>
          </button>
        </div>
      </div>

      {/* Status Alert Banner */}
      {statusMsg.text && (
        <div className={`p-4 rounded-2xl text-xs font-semibold flex items-center gap-2.5 backdrop-blur-md shadow-2xs ${
          statusMsg.type === 'success'
            ? 'bg-emerald-50/90 border border-emerald-200 text-emerald-800'
            : 'bg-rose-50/90 border border-rose-200 text-rose-800'
        }`}>
          {statusMsg.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          )}
          <span>{statusMsg.text}</span>
        </div>
      )}

      {/* 2. Overview Wink Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        {/* Card 1: Registered Teachers */}
        <div className="glass-card p-6 border-l-4 border-l-[#FF5A36]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Active Faculty Teachers
            </span>
            <div className="w-10 h-10 rounded-2xl bg-[#FFF2EE] border border-[#FFD9CE] flex items-center justify-center text-[#FF5A36] shadow-2xs">
              <GraduationCap className="w-5 h-5" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-slate-900 mt-2">
            {teacherUsers.length}
          </div>
          <span className="text-xs text-slate-500 block mt-1">
            Authorized to conduct attendance sessions
          </span>
        </div>

        {/* Card 2: System Administrator */}
        <div className="glass-card p-6 border-l-4 border-l-amber-500">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              System Administrator
            </span>
            <div className="w-10 h-10 rounded-2xl bg-amber-50 border border-amber-200/60 flex items-center justify-center text-amber-700 shadow-2xs">
              <ShieldCheck className="w-5 h-5" />
            </div>
          </div>
          <div className="text-xl font-extrabold text-slate-900 mt-2">
            Master Administrator
          </div>
          <span className="text-xs text-amber-700 font-semibold block mt-1">
            Permanent Protected Superuser
          </span>
        </div>

        {/* Card 3: Security & Encryption */}
        <div className="glass-card p-6 border-l-4 border-l-emerald-500">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Credential Vault
            </span>
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 border border-emerald-200/60 flex items-center justify-center text-emerald-600 shadow-2xs">
              <Lock className="w-5 h-5" />
            </div>
          </div>
          <div className="text-lg font-bold text-slate-900 mt-2">
            PBKDF2-HMAC-SHA256
          </div>
          <span className="text-xs text-slate-500 block mt-1">
            Salted hashed authentication stored in SQLite
          </span>
        </div>
      </div>

      {/* 3. Faculty Teachers Ledger */}
      <div className="glass-card p-6">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Authorized Faculty Directory
            </h2>
            <span className="text-xs text-slate-500">
              Real registered faculty accounts in the system with login permissions
            </span>
          </div>
          <span className="text-xs font-semibold px-3 py-1 bg-white border border-slate-200 rounded-full text-slate-600 shadow-2xs">
            {users.length} Total Accounts
          </span>
        </div>

        {users.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px] tracking-wider">
                  <th className="py-3 px-3">Faculty Member</th>
                  <th className="py-3 px-3">Login ID / Email</th>
                  <th className="py-3 px-3">Department</th>
                  <th className="py-3 px-3">Role</th>
                  <th className="py-3 px-3">Created At</th>
                  <th className="py-3 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                {users.map((u) => {
                  const isMasterAdmin = u.isPermanent === 1 || u.role === 'admin';

                  return (
                    <tr key={u.uid} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-3">
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-2xl flex items-center justify-center text-xs font-extrabold text-white shadow-2xs ${
                            isMasterAdmin
                              ? 'bg-gradient-to-tr from-amber-500 to-orange-500'
                              : 'bg-gradient-to-tr from-[#FF5A36] to-[#FF7849]'
                          }`}>
                            {(u.fullName || u.displayName || 'T').slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-bold text-slate-900 text-xs">
                              {u.fullName || u.displayName}
                            </div>
                            <div className="text-[10px] text-slate-400 font-mono">
                              UID: {u.uid}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-3 font-mono text-slate-700">
                        {u.email}
                      </td>

                      <td className="py-3.5 px-3 text-slate-600">
                        <span className="flex items-center gap-1.5">
                          <Building className="w-3.5 h-3.5 text-slate-400" />
                          <span>{u.department || 'Academic Faculty'}</span>
                        </span>
                      </td>

                      <td className="py-3.5 px-3">
                        {isMasterAdmin ? (
                          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200">
                            <ShieldCheck className="w-3.5 h-3.5 text-amber-600" />
                            <span>Administrator</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-[#FFF2EE] text-[#FF5A36] border border-[#FFD9CE]">
                            <GraduationCap className="w-3.5 h-3.5 text-[#FF5A36]" />
                            <span>Faculty Teacher</span>
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-3 text-slate-500 font-mono text-[11px]">
                        {u.createdAt ? formatKolkataDateTime(new Date(u.createdAt * 1000)) : 'Seeded'}
                      </td>

                      <td className="py-3.5 px-3 text-right">
                        {isMasterAdmin ? (
                          <span className="text-[10px] text-slate-400 font-semibold italic">
                            Protected System Account
                          </span>
                        ) : (
                          <button
                            onClick={() => confirmDeleteUser(u)}
                            className="p-1.5 text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-xl transition-colors border border-rose-200 cursor-pointer"
                            title="Remove Teacher Account"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-12 text-xs text-slate-400">
            <Users className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            No faculty teachers registered yet. Click "Add New Teacher" to create an account.
          </div>
        )}
      </div>

      {/* 4. Add Teacher Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Register New Faculty Teacher"
      >
        <form onSubmit={handleCreateTeacher} className="space-y-4 text-xs">
          <div>
            <label className="block text-slate-700 font-bold mb-1.5">Full Name & Title *</label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                required
                value={newFullName}
                onChange={(e) => setNewFullName(e.target.value)}
                placeholder="e.g. Dr. Rajesh Kumar"
                className="glass-input w-full pl-9"
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-700 font-bold mb-1.5">Email / Login ID *</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                required
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="e.g. rajesh.kumar@school.edu or rajesh"
                className="glass-input w-full pl-9"
              />
            </div>
            <span className="text-[10px] text-slate-400 mt-1 block">
              The teacher will use this email or username to sign in to the lecturer portal.
            </span>
          </div>

          <div>
            <label className="block text-slate-700 font-bold mb-1.5">Password *</label>
            <div className="relative">
              <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type={showTeacherPassword ? "text" : "password"}
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Secure teacher password"
                className="glass-input w-full pl-9 pr-10"
              />
              <button
                type="button"
                onClick={() => setShowTeacherPassword(!showTeacherPassword)}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                title={showTeacherPassword ? "Hide password" : "Show password"}
              >
                {showTeacherPassword ? (
                  <EyeOff className="w-4 h-4 text-[#FF5A36]" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
            <span className="text-[10px] text-slate-400 mt-1 block">
              Credentials are encrypted with PBKDF2 salt & hash in local SQLite.
            </span>
          </div>

          <div>
            <label className="block text-slate-700 font-bold mb-1.5">Academic Department / Subject</label>
            <div className="relative">
              <Building className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={newDepartment}
                onChange={(e) => setNewDepartment(e.target.value)}
                placeholder="e.g. Mathematics & Computer Science"
                className="glass-input w-full pl-9"
              />
            </div>
          </div>

          <div className="p-3 bg-[#FFF2EE] rounded-2xl border border-[#FFD9CE] text-xs text-[#FF5A36] flex items-start gap-2">
            <Sparkles className="w-4 h-4 text-[#FF5A36] shrink-0 mt-0.5" />
            <span className="font-semibold">
              The teacher account will be immediately created in the real database and can log in without any dummy placeholders.
            </span>
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsAddModalOpen(false)}
              className="enterprise-btn-secondary text-xs"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="enterprise-btn-primary text-xs"
            >
              {isSubmitting ? 'Creating Account...' : 'Create Teacher Account'}
            </button>
          </div>
        </form>
      </Modal>

      {/* 5. Delete Teacher Confirmation Modal */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title="Confirm Account Deletion"
      >
        <div className="space-y-4 text-xs">
          <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-rose-800 flex items-start gap-2.5">
            <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0" />
            <div>
              <span className="font-bold block">Are you sure you want to delete this faculty account?</span>
              <span className="text-[11px] block mt-0.5">
                This will permanently revoke login access for <strong>{userToDelete?.fullName}</strong> ({userToDelete?.email}).
              </span>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsDeleteModalOpen(false)}
              className="enterprise-btn-secondary text-xs"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDeleteUser}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-2xl text-xs font-bold shadow-xs transition-colors cursor-pointer"
            >
              Confirm Delete
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
