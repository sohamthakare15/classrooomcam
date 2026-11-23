import React, { useState, useEffect } from 'react';
import {
  Settings as SettingsIcon,
  Cpu,
  Database,
  Shield,
  Save,
  RefreshCw,
  HardDrive,
  Radio,
  Sliders,
  CheckCircle,
  Users,
  UserPlus,
  Trash2,
  Lock,
  Mail,
  User,
  Building,
  AlertCircle
} from 'lucide-react';
import { storageService } from '../services/storageService';
import { apiService } from '../services/apiService';
import { useAuth } from '../context/AuthContext';

export default function SettingsPage() {
  const { currentUser, isAdmin } = useAuth();
  const [settings, setSettings] = useState(storageService.getSettings());
  const [syncStatus, setSyncStatus] = useState(null);
  const [saveMessage, setSaveMessage] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);

  // User management state
  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [showAddUser, setShowAddUser] = useState(false);
  const [newFullName, setNewFullName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newDepartment, setNewDepartment] = useState('Faculty of Science');
  const [userMsg, setUserMsg] = useState({ text: '', type: '' });
  const [submittingUser, setSubmittingUser] = useState(false);

  useEffect(() => {
    loadSyncStatus();
    loadUsers();
  }, []);

  const loadSyncStatus = async () => {
    try {
      const res = await apiService.getSyncStatus();
      setSyncStatus(res);
    } catch (_) {}
  };

  const loadUsers = async () => {
    setLoadingUsers(true);
    try {
      const res = await apiService.getUsers();
      if (res && res.users) {
        setUsers(res.users);
      }
    } catch (_) {}
    finally {
      setLoadingUsers(false);
    }
  };

  const handleCreateTeacher = async (e) => {
    e.preventDefault();
    setUserMsg({ text: '', type: '' });
    setSubmittingUser(true);
    try {
      await apiService.createUser({
        fullName: newFullName,
        email: newEmail,
        password: newPassword,
        department: newDepartment,
        role: 'teacher'
      });
      setUserMsg({ text: `Teacher account "${newFullName}" successfully created in SQLite database!`, type: 'success' });
      setNewFullName('');
      setNewEmail('');
      setNewPassword('');
      setShowAddUser(false);
      loadUsers();
    } catch (err) {
      setUserMsg({ text: err.message || 'Failed to create teacher account', type: 'error' });
    } finally {
      setSubmittingUser(false);
    }
  };

  const handleDeleteUser = async (uid, name) => {
    if (!window.confirm(`Are you sure you want to delete teacher account "${name}"?`)) return;
    setUserMsg({ text: '', type: '' });
    try {
      await apiService.deleteUser(uid);
      setUserMsg({ text: `Account "${name}" deleted.`, type: 'success' });
      loadUsers();
    } catch (err) {
      setUserMsg({ text: err.message || 'Failed to delete account', type: 'error' });
    }
  };

  const handleSave = (e) => {
    e.preventDefault();
    storageService.saveSettings(settings);
    setSaveMessage('Settings saved successfully!');
    setTimeout(() => setSaveMessage(''), 3000);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-slate-900 tracking-tight">System & Account Settings</h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Manage teacher accounts in SQLite database, AI confidence thresholds, and hardware adapters.
        </p>
      </div>

      {saveMessage && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-xs font-medium flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-emerald-600" />
          <span>{saveMessage}</span>
        </div>
      )}

      {/* Real Faculty & Teacher Accounts Panel */}
      <div className="enterprise-card p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-teal-600" />
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Institutional Accounts (Local Database Storage)
              </h3>
              <p className="text-[11px] text-slate-500">
                Permanent Admin and Teacher accounts persisted directly in SQLite (<code className="text-teal-700">storage/offline_queue.db</code>).
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => { setShowAddUser(!showAddUser); setUserMsg({ text: '', type: '' }); }}
            className="enterprise-btn-primary text-xs flex items-center gap-1.5"
          >
            <UserPlus className="w-3.5 h-3.5" />
            {showAddUser ? "Cancel" : "Create New Teacher"}
          </button>
        </div>

        {userMsg.text && (
          <div className={`p-3 rounded-lg text-xs flex items-center gap-2 ${
            userMsg.type === 'success'
              ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border border-rose-200 text-rose-800'
          }`}>
            {userMsg.type === 'success' ? (
              <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{userMsg.text}</span>
          </div>
        )}

        {/* Add Teacher Form */}
        {showAddUser && (
          <form onSubmit={handleCreateTeacher} className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Add New Faculty Teacher Account
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Teacher Full Name</label>
                <div className="relative">
                  <User className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    value={newFullName}
                    onChange={(e) => setNewFullName(e.target.value)}
                    placeholder="Prof. Maria Garcia"
                    className="w-full pl-8 pr-2.5 py-1.5 border border-slate-200 rounded bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-teal-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Email / Username</label>
                <div className="relative">
                  <Mail className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="mgarcia@school.edu"
                    className="w-full pl-8 pr-2.5 py-1.5 border border-slate-200 rounded bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-teal-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Department</label>
                <div className="relative">
                  <Building className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    value={newDepartment}
                    onChange={(e) => setNewDepartment(e.target.value)}
                    placeholder="Physics & Astronomy"
                    className="w-full pl-8 pr-2.5 py-1.5 border border-slate-200 rounded bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-teal-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Password</label>
                <div className="relative">
                  <Lock className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Initial password"
                    className="w-full pl-8 pr-2.5 py-1.5 border border-slate-200 rounded bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-teal-600"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowAddUser(false)}
                className="enterprise-btn-secondary text-xs"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submittingUser}
                className="enterprise-btn-primary text-xs"
              >
                {submittingUser ? "Saving to Database..." : "Save Teacher to Database"}
              </button>
            </div>
          </form>
        )}

        {/* User List Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border border-slate-200 rounded-lg overflow-hidden">
            <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
              <tr>
                <th className="py-2.5 px-3">Name</th>
                <th className="py-2.5 px-3">Email / Identifier</th>
                <th className="py-2.5 px-3">Department</th>
                <th className="py-2.5 px-3">Role</th>
                <th className="py-2.5 px-3">Database Status</th>
                <th className="py-2.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {users.map((u) => {
                const isPerm = Boolean(u.isPermanent);
                return (
                  <tr key={u.uid} className="hover:bg-slate-50/70">
                    <td className="py-2.5 px-3 font-semibold text-slate-900 flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-teal-100 text-teal-800 flex items-center justify-center font-bold text-[10px]">
                        {u.displayName?.[0] || 'U'}
                      </div>
                      {u.displayName}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-[11px] text-slate-600">{u.email}</td>
                    <td className="py-2.5 px-3 text-slate-500">{u.department || 'Academic Faculty'}</td>
                    <td className="py-2.5 px-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                        u.role === 'admin'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-teal-100 text-teal-800'
                      }`}>
                        {u.role}
                      </span>
                    </td>
                    <td className="py-2.5 px-3">
                      {isPerm ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                          <Shield className="w-3 h-3 text-emerald-600" /> Permanent Account
                        </span>
                      ) : (
                        <span className="text-[11px] text-slate-500 font-medium">
                          Custom Teacher
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      {isPerm ? (
                        <span className="text-[10px] text-slate-400 italic">Protected</span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleDeleteUser(u.uid, u.displayName)}
                          className="text-rose-600 hover:text-rose-800 p-1 hover:bg-rose-50 rounded"
                          title="Delete Teacher Account"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {users.length === 0 && (
                <tr>
                  <td colSpan="6" className="py-4 text-center text-slate-400">
                    {loadingUsers ? "Loading institutional accounts..." : "No accounts found in database."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Institutional Info */}
          <div className="enterprise-card p-5 space-y-4 text-xs">
            <h3 className="text-sm font-bold text-slate-800 border-b border-slate-100 pb-2 flex items-center gap-2">
              <Shield className="w-4 h-4 text-teal-600" /> Institutional Information
            </h3>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">Institution Name</label>
              <input
                type="text"
                value={settings.institutionName}
                onChange={(e) => setSettings({ ...settings, institutionName: e.target.value })}
                className="w-full border border-slate-200 rounded p-2 bg-white text-slate-800"
              />
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">Academic Year</label>
              <input
                type="text"
                value={settings.academicYear}
                onChange={(e) => setSettings({ ...settings, academicYear: e.target.value })}
                className="w-full border border-slate-200 rounded p-2 bg-white text-slate-800"
              />
            </div>
          </div>

          {/* AI Thresholds */}
          <div className="enterprise-card p-5 space-y-4 text-xs">
            <h3 className="text-sm font-bold text-slate-800 border-b border-slate-100 pb-2 flex items-center gap-2">
              <Sliders className="w-4 h-4 text-teal-600" /> AI Confidence Calibration
            </h3>

            <div>
              <div className="flex justify-between font-semibold text-slate-700 mb-1">
                <span>Automatic Confirmation Threshold:</span>
                <span className="font-mono text-teal-700">{settings.highConfidenceThreshold}%</span>
              </div>
              <input
                type="range"
                min="60"
                max="95"
                value={settings.highConfidenceThreshold}
                onChange={(e) => setSettings({ ...settings, highConfidenceThreshold: parseInt(e.target.value) })}
                className="w-full accent-teal-600"
              />
              <span className="text-[11px] text-slate-400">
                Matches with confidence &ge; {settings.highConfidenceThreshold}% are automatically marked present.
              </span>
            </div>

            <div className="pt-2">
              <div className="flex justify-between font-semibold text-slate-700 mb-1">
                <span>Teacher Review Lower Bound:</span>
                <span className="font-mono text-amber-600">{settings.reviewThreshold}%</span>
              </div>
              <input
                type="range"
                min="35"
                max="65"
                value={settings.reviewThreshold}
                onChange={(e) => setSettings({ ...settings, reviewThreshold: parseInt(e.target.value) })}
                className="w-full accent-amber-600"
              />
              <span className="text-[11px] text-slate-400">
                Matches between {settings.reviewThreshold}% and {settings.highConfidenceThreshold}% route to Teacher Review.
              </span>
            </div>
          </div>

          {/* Offline Sync & Storage */}
          <div className="enterprise-card p-5 space-y-4 text-xs">
            <h3 className="text-sm font-bold text-slate-800 border-b border-slate-100 pb-2 flex items-center gap-2">
              <Database className="w-4 h-4 text-teal-600" /> Offline Durability & RTDB Sync
            </h3>

            <p className="text-slate-600 leading-relaxed">
              When disconnected or running offline, all attendance events are durably recorded in local SQLite. On connection, deterministic idempotent writes push to Firebase Realtime Database.
            </p>

            <div className="p-3 bg-slate-50 rounded-lg flex items-center justify-between border border-slate-100">
              <div>
                <span className="text-slate-500 block text-[11px]">Pending Sync Items</span>
                <span className="text-base font-bold text-slate-800">
                  {syncStatus ? syncStatus.pending_count : 0} items
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={loadSyncStatus}
                  className="enterprise-btn-secondary text-xs"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Refresh
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    setIsSyncing(true);
                    try {
                      const res = await apiService.flushRtdbSync();
                      alert(`Synced: ${res.result?.synced || 0}, Remaining: ${res.result?.remaining_pending || 0}`);
                      loadSyncStatus();
                    } catch (err) {
                      alert(`Sync error: ${err.message}`);
                    } finally {
                      setIsSyncing(false);
                    }
                  }}
                  disabled={isSyncing}
                  className="enterprise-btn-primary text-xs"
                >
                  {isSyncing ? "Pushing..." : "Sync to RTDB"}
                </button>
              </div>
            </div>
          </div>

          {/* ESP32 Hardware Adapter */}
          <div className="enterprise-card p-5 space-y-4 text-xs">
            <h3 className="text-sm font-bold text-slate-800 border-b border-slate-100 pb-2 flex items-center gap-2">
              <Radio className="w-4 h-4 text-teal-600" /> Classroom IoT Adapter (ESP32 Integration)
            </h3>

            <p className="text-slate-500">
              Optional hardware telemetry: Controls Green LED (Session Active), Red LED (System Alert), OLED status display, and audio buzzer notifications. (ESP32 does NOT perform recognition).
            </p>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="esp32-enable-toggle"
                checked={settings.esp32Enabled}
                onChange={(e) => setSettings({ ...settings, esp32Enabled: e.target.checked })}
                className="rounded text-teal-600"
              />
              <label htmlFor="esp32-enable-toggle" className="text-slate-800 font-semibold">
                Enable ESP32 IoT Microcontroller Bridge
              </label>
            </div>

            {settings.esp32Enabled && (
              <div>
                <label className="block text-slate-700 font-semibold mb-1">ESP32 Device IP Address</label>
                <input
                  type="text"
                  value={settings.esp32Ip}
                  onChange={(e) => setSettings({ ...settings, esp32Ip: e.target.value })}
                  className="w-full border border-slate-200 rounded p-2 bg-white text-slate-800 font-mono"
                  placeholder="192.168.1.180"
                />
              </div>
            )}
          </div>

          {/* Simple Data Cleanup & Maintenance */}
          <div className="enterprise-card p-5 space-y-4 text-xs lg:col-span-2 bg-rose-50/20 border-rose-100">
            <h3 className="text-sm font-bold text-slate-800 border-b border-rose-100 pb-2 flex items-center gap-2">
              <Trash2 className="w-4 h-4 text-rose-600" /> Simple Data Cleanup (Remove Unwanted Items)
            </h3>

            <p className="text-slate-600 leading-relaxed">
              Quickly wipe unwanted testing artifacts, stale sessions, or review backlogs with one click.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div className="p-3 bg-white rounded-lg border border-slate-200 flex items-center justify-between">
                <div>
                  <span className="font-semibold text-slate-800 block text-xs">Clear Test Attendance Sessions</span>
                  <span className="text-[11px] text-slate-400">Deletes all past attendance history and audit snapshots.</span>
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    if (window.confirm("Delete all past attendance sessions? (Students will remain)")) {
                      try {
                        const res = await apiService.clearAllSessions();
                        alert(`Cleared ${res.deletedCount || 0} sessions.`);
                      } catch (err) {
                        alert(err.message);
                      }
                    }
                  }}
                  className="px-2.5 py-1.5 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg flex items-center gap-1 shrink-0 ml-3"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Clear Sessions
                </button>
              </div>

              <div className="p-3 bg-white rounded-lg border border-slate-200 flex items-center justify-between">
                <div>
                  <span className="font-semibold text-slate-800 block text-xs">Clear Review Queue</span>
                  <span className="text-[11px] text-slate-400">Dismisses all ambiguous face detection review items.</span>
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    if (window.confirm("Dismiss and clear all items in the review queue?")) {
                      try {
                        const res = await apiService.clearAllReviews();
                        alert(`Cleared ${res.dismissedCount || 0} review items.`);
                      } catch (err) {
                        alert(err.message);
                      }
                    }
                  }}
                  className="px-2.5 py-1.5 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg flex items-center gap-1 shrink-0 ml-3"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Clear Queue
                </button>
              </div>
            </div>
          </div>

        </div>

        {/* Save Bar */}
        <div className="flex justify-end pt-2">
          <button type="submit" className="enterprise-btn-primary text-xs">
            <Save className="w-3.5 h-3.5" /> Save Configuration
          </button>
        </div>
      </form>
    </div>
  );
}
