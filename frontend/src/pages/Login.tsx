import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Lock, Mail, User as UserIcon, Shield, ChevronDown, KeyRound, AlertCircle } from "lucide-react";
import { motion } from "motion/react";
import { useAuth, SYSTEM_CREDENTIALS, getRoleHomeRoute } from "../auth/AuthContext";
import { BrandSymbol } from "../components/BrandLogo";
import type { Role } from "../types";

export const Login: React.FC = () => {
  const { login, register, user } = useAuth();
  const navigate = useNavigate();

  // If already logged in, redirect to user's home module
  React.useEffect(() => {
    if (user) {
      navigate(getRoleHomeRoute(user.role), { replace: true });
    }
  }, [user, navigate]);

  const [activeTab, setActiveTab] = useState<"signin" | "register">("signin");

  // Sign In Form State
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  // Register Form State
  const [regName, setRegName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regRole, setRegRole] = useState<Role>("creator");

  // UI States
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDemoDrawer, setShowDemoDrawer] = useState(true);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginEmail.trim() || !loginPassword.trim()) {
      setError("Please provide both email and password.");
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const loggedUser = await login(loginEmail.trim(), loginPassword);
      navigate(getRoleHomeRoute(loggedUser.role), { replace: true });
    } catch (err: any) {
      setError(err.message || "Invalid credentials. Please verify your email and password.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regName.trim() || !regEmail.trim() || !regPassword.trim()) {
      setError("Please complete all registration fields.");
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const newUser = await register(regName.trim(), regEmail.trim(), regPassword, regRole);
      navigate(getRoleHomeRoute(newUser.role), { replace: true });
    } catch (err: any) {
      setError(err.message || "Failed to create account. User may already exist.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectAccount = (email: string, pass: string) => {
    setActiveTab("signin");
    setLoginEmail(email);
    setLoginPassword(pass);
    setError(null);
  };

  return (
    <div className="min-h-screen flex flex-col justify-center items-center px-4 py-12 relative z-10">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-md relative"
      >
        {/* Subtle Lime Green Radial Background Depth Glow */}
        <div 
          className="absolute -inset-10 sm:-inset-16 bg-[radial-gradient(ellipse_at_center,rgba(175,230,7,0.18)_0%,rgba(175,230,7,0.06)_50%,transparent_75%)] blur-2xl pointer-events-none -z-10 transform-gpu"
          aria-hidden="true" 
        />
        <div 
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-[110%] bg-primary/[0.08] rounded-full blur-[90px] pointer-events-none -z-10"
          aria-hidden="true" 
        />

        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center mb-4">
            <BrandSymbol size={56} className="shadow-[0_0_25px_rgba(175,230,7,0.35)]" />
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold font-display tracking-tight text-[#F4F6F0] uppercase leading-none">
            BRANDGUARD <span className="text-primary">AI</span>
          </h1>
          <p className="mt-2.5 text-xs text-muted max-w-xs mx-auto leading-relaxed">
            Enterprise automated brand guideline and factual compliance governance platform.
          </p>
        </div>

        {/* Dual Tab Card */}
        <div className="rounded-2xl bg-card border border-line p-6 shadow-2xl frame-shimmer-border relative">
          {/* Tab Navigation with Smooth Sliding Indicator */}
          <div className="relative grid grid-cols-2 p-1 rounded-xl bg-[#0E0E0B] border border-line mb-6">
            <button
              type="button"
              onClick={() => {
                setActiveTab("signin");
                setError(null);
              }}
              className={`relative z-10 py-2 text-xs font-semibold rounded-lg transition-colors duration-200 cursor-pointer ${
                activeTab === "signin"
                  ? "text-black font-bold"
                  : "text-muted hover:text-white"
              }`}
            >
              {activeTab === "signin" && (
                <motion.div
                  layoutId="activeTabIndicator"
                  className="absolute inset-0 bg-primary rounded-lg shadow-sm -z-10"
                  transition={{ type: "spring", bounce: 0.15, duration: 0.45 }}
                />
              )}
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab("register");
                setError(null);
              }}
              className={`relative z-10 py-2 text-xs font-semibold rounded-lg transition-colors duration-200 cursor-pointer ${
                activeTab === "register"
                  ? "text-black font-bold"
                  : "text-muted hover:text-white"
              }`}
            >
              {activeTab === "register" && (
                <motion.div
                  layoutId="activeTabIndicator"
                  className="absolute inset-0 bg-primary rounded-lg shadow-sm -z-10"
                  transition={{ type: "spring", bounce: 0.15, duration: 0.45 }}
                />
              )}
              Create Account
            </button>
          </div>

          {error && (
            <div className="mb-5 p-3 rounded-xl bg-critical/10 border border-critical/30 text-critical text-xs flex items-center gap-2 animate-in fade-in">
              <AlertCircle size={15} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* SIGN IN FORM */}
          {activeTab === "signin" ? (
            <form onSubmit={handleSignIn} className="space-y-4 text-xs">
              <div>
                <label className="text-muted block mb-1 font-medium">Business Email</label>
                <div className="relative">
                  <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                  <input
                    type="email"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    placeholder="saar@test.com"
                    className="w-full pl-9 pr-3 py-2.5 bg-[#0E0E0B] border border-line rounded-xl text-white font-mono focus:outline-none focus:border-primary focus:shadow-[0_0_15px_rgba(175,230,7,0.3)] transition-all duration-300 text-xs"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="text-muted block mb-1 font-medium">Password</label>
                <div className="relative">
                  <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                  <input
                    type="password"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-9 pr-3 py-2.5 bg-[#0E0E0B] border border-line rounded-xl text-white font-mono focus:outline-none focus:border-primary focus:shadow-[0_0_15px_rgba(175,230,7,0.3)] transition-all duration-300 text-xs"
                    required
                  />
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="group w-full py-2.5 rounded-xl bg-primary text-black font-bold text-xs hover:bg-primary/90 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(175,230,7,0.25)] hover:shadow-[0_0_22px_rgba(175,230,7,0.4)] disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
                >
                  <span>{isLoading ? "Signing in..." : "Sign In to Module"}</span>
                  <ArrowRight size={14} className="transition-transform duration-200 group-hover:translate-x-1.5" />
                </button>
              </div>
            </form>
          ) : (
            /* REGISTER FORM */
            <form onSubmit={handleRegister} className="space-y-3.5 text-xs">
              <div>
                <label className="text-muted block mb-1 font-medium">Full Name</label>
                <div className="relative">
                  <UserIcon size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                  <input
                    type="text"
                    value={regName}
                    onChange={(e) => setRegName(e.target.value)}
                    placeholder="e.g. Alex Morgan"
                    className="w-full pl-9 pr-3 py-2 bg-[#0E0E0B] border border-line rounded-xl text-white focus:outline-none focus:border-primary focus:shadow-[0_0_15px_rgba(175,230,7,0.3)] transition-all duration-300 text-xs"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="text-muted block mb-1 font-medium">Business Email</label>
                <div className="relative">
                  <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                  <input
                    type="email"
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    placeholder="alex@lumora.demo"
                    className="w-full pl-9 pr-3 py-2 bg-[#0E0E0B] border border-line rounded-xl text-white font-mono focus:outline-none focus:border-primary focus:shadow-[0_0_15px_rgba(175,230,7,0.3)] transition-all duration-300 text-xs"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="text-muted block mb-1 font-medium">Password</label>
                <div className="relative">
                  <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                  <input
                    type="password"
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-9 pr-3 py-2 bg-[#0E0E0B] border border-line rounded-xl text-white font-mono focus:outline-none focus:border-primary focus:shadow-[0_0_15px_rgba(175,230,7,0.3)] transition-all duration-300 text-xs"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="text-muted block mb-1 font-medium">Department Role</label>
                <div className="relative">
                  <Shield size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                  <select
                    value={regRole}
                    onChange={(e) => setRegRole(e.target.value as Role)}
                    className="w-full pl-9 pr-3 py-2 bg-[#0E0E0B] border border-line rounded-xl text-white focus:outline-none focus:border-primary focus:shadow-[0_0_15px_rgba(175,230,7,0.3)] transition-all duration-300 text-xs cursor-pointer"
                  >
                    <option value="creator" className="bg-[#1D1D18] text-white">
                      Marketing Copywriter / Creator
                    </option>
                    <option value="reviewer" className="bg-[#1D1D18] text-white">
                      Compliance & Legal Reviewer
                    </option>
                    <option value="brand_manager" className="bg-[#1D1D18] text-white">
                      Brand Governance Manager
                    </option>
                  </select>
                </div>
                <p className="text-[10px] text-muted mt-1">
                  Determines which isolated module workspace you will be authorized to access.
                </p>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="group w-full py-2.5 rounded-xl bg-primary text-black font-bold text-xs hover:bg-primary/90 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(175,230,7,0.25)] hover:shadow-[0_0_22px_rgba(175,230,7,0.4)] disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
                >
                  <span>{isLoading ? "Creating Account..." : "Create Account & Launch"}</span>
                  <ArrowRight size={14} className="transition-transform duration-200 group-hover:translate-x-1.5" />
                </button>
              </div>
            </form>
          )}

          {/* System Test Credentials Quick Fill */}
          <div className="mt-6 pt-4 border-t border-line">
            <button
              type="button"
              onClick={() => setShowDemoDrawer(!showDemoDrawer)}
              className="w-full flex items-center justify-between text-muted hover:text-white transition-colors duration-200 text-[11px] font-mono cursor-pointer"
            >
              <div className="flex items-center gap-1.5">
                <KeyRound size={13} className="text-primary" />
                <span className="font-semibold text-white">System Testing Accounts</span>
              </div>
              <ChevronDown
                size={14}
                className={`transition-transform duration-300 ease-in-out ${showDemoDrawer ? "rotate-180" : ""}`}
              />
            </button>

            {/* Smooth Collapsible Accordion */}
            <div
              className={`grid transition-all duration-300 ease-in-out overflow-hidden ${
                showDemoDrawer ? "grid-rows-[1fr] opacity-100 mt-3" : "grid-rows-[0fr] opacity-0 mt-0"
              }`}
            >
              <div className="overflow-hidden min-h-0 grid grid-cols-1 gap-2 pt-1">
                {SYSTEM_CREDENTIALS.map((p) => (
                  <button
                    key={p.email}
                    type="button"
                    onClick={() => handleSelectAccount(p.email, p.pass)}
                    disabled={isLoading}
                    className="p-2.5 rounded-xl bg-[#0E0E0B] hover:bg-[#1D1D18] border border-line hover:border-primary/50 text-left transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/50 flex items-center justify-between group cursor-pointer"
                    title={`Click to fill ${p.email}`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono uppercase font-bold text-primary px-1.5 py-0.5 rounded bg-primary/10 border border-primary/20">
                          {p.label}
                        </span>
                        <span className="text-xs font-semibold text-white group-hover:text-primary transition-colors duration-200">
                          {p.email}
                        </span>
                      </div>
                      <span className="text-[10px] text-muted font-mono mt-1 block">
                        Password: <code className="text-primary/90 font-bold">{p.pass}</code>
                      </span>
                    </div>
                    <ArrowRight 
                      size={12} 
                      className="text-muted group-hover:text-primary transition-all duration-200 group-hover:translate-x-1" 
                    />
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
