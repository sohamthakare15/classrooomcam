import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  GraduationCap,
  Lock,
  Mail,
  ShieldCheck,
  AlertCircle,
  ArrowRight,
  LogIn,
  Eye,
  EyeOff
} from 'lucide-react';

export default function LoginPage() {
  const { login } = useAuth();
  
  // Login form state - clean and un-prefilled
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(identifier, password);
    } catch (err) {
      setError(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-8 px-4 sm:px-6 lg:px-8 select-none">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center space-y-2">
        <div className="w-11 h-11 rounded-xl bg-slate-900 flex items-center justify-center text-white mx-auto shadow-xs">
          <GraduationCap className="w-6 h-6" />
        </div>
        <h2 className="text-2xl font-bold text-slate-900 tracking-tight">SmartClass Attendance</h2>
        <p className="text-xs text-slate-500">
          Faculty &amp; Academic Administration Portal
        </p>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-7 px-5 sm:px-8 border border-slate-200 rounded-xl shadow-sm">
          {/* Header */}
          <div className="mb-5">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <LogIn className="w-4 h-4 text-blue-600" />
              <span>Sign in to your account</span>
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Enter your institutional email or username to continue.
            </p>
          </div>

          {error && (
            <div className="mb-5 p-3.5 bg-rose-50/90 border border-rose-200/80 rounded-2xl flex items-center gap-3 text-xs text-rose-700 animate-shake">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span className="font-semibold">{error}</span>
            </div>
          )}

          {/* Sign In Form */}
          <form onSubmit={handleLoginSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Email or Username
              </label>
              <div className="relative rounded-2xl shadow-2xs">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  required
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="Enter your email or username"
                  autoComplete="username"
                  className="block w-full pl-10 pr-3.5 py-2.5 bg-white/90 border border-slate-200 rounded-2xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Password
              </label>
              <div className="relative rounded-2xl shadow-2xs">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showLoginPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  className="block w-full pl-10 pr-10 py-2.5 bg-white/90 border border-slate-200 rounded-2xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowLoginPassword(!showLoginPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer focus:outline-none"
                  title={showLoginPassword ? "Hide password" : "Show password"}
                >
                  {showLoginPassword ? (
                    <EyeOff className="w-4 h-4 text-blue-600" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full enterprise-btn-primary justify-center text-xs py-3"
              >
                {loading ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <span>Sign In to Dashboard</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Secure Institutional Footer Note */}
          <div className="mt-6 pt-4 border-t border-slate-100 text-center">
            <span className="text-[11px] text-slate-400 flex items-center justify-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>Authorized Institutional Access Only</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
