import React, { useState } from "react";
import { X, KeyRound, Mail, ArrowRight, CheckCircle2, AlertCircle, RefreshCw } from "lucide-react";
import { api } from "../api/client";

interface ForgotPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPasswordResetSuccess?: (email: string) => void;
  initialToken?: string | null;
}

export const ForgotPasswordModal: React.FC<ForgotPasswordModalProps> = ({
  isOpen,
  onClose,
  onPasswordResetSuccess,
  initialToken,
}) => {
  const [step, setStep] = useState<1 | 2>(initialToken ? 2 : 1);
  const [email, setEmail] = useState("");
  const [token, setToken] = useState(initialToken || "");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  React.useEffect(() => {
    if (initialToken && isOpen) {
      setToken(initialToken);
      setStep(2);
      setSuccessMsg("Security reset token verified from your email link. Enter your new password below.");
    }
  }, [initialToken, isOpen]);

  if (!isOpen) return null;

  const handleRequestToken = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setError("Please enter your registered email address.");
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const res = await api.auth.forgotPassword(email.trim());
      if (res.reset_token) {
        setToken(res.reset_token);
      } else {
        setToken("");
      }
      setSuccessMsg(res.message);
      setStep(2);
    } catch (err: any) {
      setError(err?.message || "Failed to generate password reset token.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token.trim()) {
      setError("Reset token is required.");
      return;
    }
    if (newPassword.length < 6) {
      setError("New password must be at least 6 characters long.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const res = await api.auth.resetPassword(token.trim(), newPassword);
      setSuccessMsg(res.message);
      if (onPasswordResetSuccess) {
        onPasswordResetSuccess(email);
      }
      setTimeout(() => {
        onClose();
        setStep(1);
        setEmail("");
        setToken("");
        setNewPassword("");
        setConfirmPassword("");
        setSuccessMsg(null);
      }, 2000);
    } catch (err: any) {
      setError(err?.message || "Failed to reset password. Token may be invalid or expired.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleModalClose = () => {
    onClose();
    setError(null);
    setSuccessMsg(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-md rounded-2xl bg-[#141410] border border-white/10 shadow-2xl overflow-hidden text-xs">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-white/10 bg-[#181813]">
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-primary/15 text-primary">
              <KeyRound size={18} />
            </span>
            <div>
              <h3 className="text-sm font-bold font-display text-white">
                {step === 1 ? "Forgot Password" : "Set New Password"}
              </h3>
              <p className="text-[11px] text-muted mt-0.5">
                {step === 1 ? "Step 1: Request a secure password reset token" : "Step 2: Enter new password"}
              </p>
            </div>
          </div>
          <button
            onClick={handleModalClose}
            className="p-1.5 rounded-lg text-muted hover:text-white hover:bg-white/10 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {error && (
            <div className="mb-4 p-3 rounded-xl bg-critical/10 border border-critical/30 text-critical text-xs flex items-center gap-2">
              <AlertCircle size={14} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="mb-4 p-3 rounded-xl bg-success/10 border border-success/30 text-success text-xs flex items-center gap-2">
              <CheckCircle2 size={14} className="shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {step === 1 ? (
            <form onSubmit={handleRequestToken} className="space-y-4">
              <div>
                <label className="text-muted block mb-1 font-medium">Account Email Address</label>
                <div className="relative">
                  <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="creator@lumora.demo"
                    className="w-full pl-9 pr-3 py-2.5 bg-[#0E0E0B] border border-line rounded-xl text-white font-mono focus:outline-none focus:border-primary text-xs"
                    required
                  />
                </div>
                <p className="text-[11px] text-muted font-mono mt-1.5">
                  We'll generate a 15-minute cryptographically secured token.
                </p>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-2.5 rounded-xl bg-primary text-black font-bold text-xs hover:bg-primary/90 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isLoading ? (
                    <>
                      <RefreshCw size={14} className="animate-spin" />
                      <span>Generating token...</span>
                    </>
                  ) : (
                    <>
                      <span>Continue to Reset</span>
                      <ArrowRight size={14} />
                    </>
                  )}
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleResetPassword} className="space-y-3.5">
              <div>
                <label className="text-muted block mb-1 font-medium font-mono text-[11px]">
                  Reset Security Token
                </label>
                <input
                  type="text"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder="Paste token if received externally"
                  className="w-full px-3 py-2 bg-[#0E0E0B] border border-line rounded-xl text-white font-mono text-xs focus:outline-none focus:border-primary"
                  required
                />
              </div>

              <div>
                <label className="text-muted block mb-1 font-medium font-mono text-[11px]">
                  New Password (min 6 characters)
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-3 py-2 bg-[#0E0E0B] border border-line rounded-xl text-white font-mono text-xs focus:outline-none focus:border-primary"
                  required
                />
              </div>

              <div>
                <label className="text-muted block mb-1 font-medium font-mono text-[11px]">
                  Confirm New Password
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-3 py-2 bg-[#0E0E0B] border border-line rounded-xl text-white font-mono text-xs focus:outline-none focus:border-primary"
                  required
                />
              </div>

              <div className="pt-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="w-1/3 py-2.5 rounded-xl bg-card border border-line text-muted hover:text-white text-xs font-mono transition-colors"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-2/3 py-2.5 rounded-xl bg-primary text-black font-bold text-xs hover:bg-primary/90 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isLoading ? (
                    <>
                      <RefreshCw size={14} className="animate-spin" />
                      <span>Updating...</span>
                    </>
                  ) : (
                    <span>Update Password</span>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

