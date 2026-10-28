import React, { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ShieldCheck, BookOpen, BarChart3, History, CheckSquare, ChevronDown, LogOut, HelpCircle, Shield } from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import { HowToEvaluateDrawer } from "./HowToEvaluateDrawer";

import { BrandLogo } from "./BrandLogo";

export const Navbar: React.FC = () => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [personaMenuOpen, setPersonaMenuOpen] = useState(false);

  const getModuleLinks = () => {
    if (!user) return [];
    if (user.role === "creator" || user.role === "agency") {
      return [
        { to: "/creator/workspace", label: "My Campaigns", icon: ShieldCheck },
        { to: "/creator/guidelines", label: "Brand Guidelines", icon: BookOpen },
      ];
    }
    if (user.role === "reviewer") {
      return [
        { to: "/reviewer/queue", label: "Review Queue", icon: CheckSquare },
        { to: "/creator/guidelines", label: "Brand Guidelines", icon: BookOpen },
      ];
    }
    // Brand Manager & Admin
    return [
      { to: "/governance/insights", label: "Rule Insights", icon: BarChart3 },
      { to: "/governance/rules", label: "Rules & Facts", icon: BookOpen },
      { to: "/governance/audit-trail", label: "Audit Trail", icon: History },
    ];
  };

  const navLinks = getModuleLinks();

  const handleLogout = () => {
    logout();
    setPersonaMenuOpen(false);
    navigate("/login");
  };

  return (
    <>
      <header className="sticky top-0 z-40 w-full border-b border-line bg-[#0E0E0B]/90 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          {/* Logo & Module Badge */}
          <Link
            to={user ? (user.role === "reviewer" ? "/reviewer/queue" : (user.role === "admin" || user.role === "brand_manager") ? "/governance/insights" : "/creator/workspace") : "/login"}
            className="group hover:opacity-95 transition-opacity flex items-center gap-2.5"
          >
            <BrandLogo size="md" />
            {user && (
              <span className="hidden sm:inline-block px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase border bg-white/5 border-line text-primary">
                {user.role === "reviewer"
                  ? "Review Terminal"
                  : user.role === "admin" || user.role === "brand_manager"
                    ? "Governance Center"
                    : "Creator Studio"}
              </span>
            )}
          </Link>

          {/* Scoped Module Navigation Links */}
          {user && (
            <nav className="hidden md:flex items-center gap-1">
              {navLinks.map((item) => {
                const Icon = item.icon;
                const isActive =
                  location.pathname === item.to ||
                  (item.to !== "/" && location.pathname.startsWith(item.to));
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${isActive
                        ? "bg-white/10 text-white border border-line shadow-sm"
                        : "text-muted hover:text-white hover:bg-white/5"
                      }`}
                  >
                    <Icon size={14} className={isActive ? "text-primary" : "text-muted"} />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          )}

          {/* Right Controls */}
          <div className="flex items-center gap-3">
            {/* Guide Button for Judges */}
            <button
              onClick={() => setDrawerOpen(true)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-card hover:bg-white/10 border border-line text-xs font-semibold text-ink transition-all group"
            >
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-signal opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-signal"></span>
              </span>
              <span>Judge's Guide (7 Steps)</span>
              <HelpCircle size={14} className="text-muted group-hover:text-signal transition-colors" />
            </button>

            {/* User Session Menu */}
            {user ? (
              <div className="relative">
                <button
                  onClick={() => setPersonaMenuOpen(!personaMenuOpen)}
                  className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-card hover:bg-white/10 border border-line text-xs transition-all"
                >
                  <div className="w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-xs">
                    {user.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="text-left hidden sm:block">
                    <div className="text-[11px] font-semibold text-white leading-tight">{user.name}</div>
                    <div className="text-[9px] uppercase font-mono text-muted tracking-wider">{user.role}</div>
                  </div>
                  <ChevronDown size={13} className="text-muted" />
                </button>

                {personaMenuOpen && (
                  <div className="absolute right-0 mt-2 w-72 rounded-xl bg-[#1D1D18] border border-line shadow-2xl p-3 z-50 animate-in fade-in zoom-in-95">
                    {/* User Profile Card */}
                    <div className="pb-3 border-b border-line mb-3">
                      <div className="flex items-center gap-2.5 mb-2">
                        <div className="w-8 h-8 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-sm">
                          {user.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold text-white truncate">{user.name}</p>
                          <p className="text-[10px] text-muted font-mono truncate">{user.email}</p>
                        </div>
                      </div>

                      <div className="mt-2 flex items-center gap-1.5 px-2 py-1 rounded bg-[#0E0E0B] border border-line">
                        <Shield size={11} className="text-primary shrink-0" />
                        <span className="text-[10px] font-mono uppercase font-bold text-primary">
                          {user.role.replace(/_/g, " ")} CLEARANCE
                        </span>
                      </div>
                    </div>

                    <div className="px-1 py-1 text-[10px] text-muted font-mono leading-relaxed">
                      Active authenticated database session. Role switching bypass is restricted.
                    </div>

                    <div className="mt-2 pt-2 border-t border-line">
                      <button
                        onClick={handleLogout}
                        className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-left text-critical hover:bg-critical/10 text-xs font-semibold transition-colors"
                      >
                        <LogOut size={13} />
                        <span>Sign Out of Session</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <Link
                to="/login"
                className="px-3 py-1.5 rounded-lg bg-primary text-black font-semibold text-xs hover:bg-primary/90 transition-all"
              >
                Sign In
              </Link>
            )}
          </div>
        </div>
      </header>

      <HowToEvaluateDrawer isOpen={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </>
  );
};
