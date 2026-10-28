import React from "react";
import { Navigate, Link } from "react-router-dom";
import { ShieldAlert, ArrowRight, ArrowLeft } from "lucide-react";
import { useAuth, getRoleHomeRoute } from "./AuthContext";
import type { Role } from "../types";

interface RoleGuardProps {
  allowedRoles: Role[];
  moduleName: string;
  children: React.ReactNode;
}

export const RoleGuard: React.FC<RoleGuardProps> = ({
  allowedRoles,
  moduleName,
  children,
}) => {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0E0E0B] text-muted font-mono text-xs">
        <span className="animate-pulse">Authenticating clearance level...</span>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!allowedRoles.includes(user.role as Role)) {
    const homeRoute = getRoleHomeRoute(user.role);

    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center px-4 py-16 text-center">
        <div className="w-full max-w-md p-8 rounded-2xl bg-card border border-critical/40 shadow-2xl space-y-4 frame-shimmer-border">
          <div className="w-14 h-14 rounded-full bg-critical/15 text-critical flex items-center justify-center mx-auto border border-critical/30">
            <ShieldAlert size={28} />
          </div>

          <div>
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-critical/20 text-critical border border-critical/30">
              403 · Clearance Forbidden
            </span>
            <h2 className="text-xl font-bold font-display text-white mt-2">
              Module Access Restricted
            </h2>
            <p className="text-xs text-muted mt-2 font-sans leading-relaxed">
              You are signed in as <span className="font-mono text-white font-semibold">{user.name}</span> (<span className="text-primary font-mono capitalize">{user.role}</span>).
              Your role does not have authorization to access the <span className="text-white font-medium">{moduleName}</span>.
            </p>
          </div>

          <div className="pt-4 border-t border-line flex flex-col gap-2">
            <Link
              to={homeRoute}
              className="w-full py-2.5 rounded-xl bg-primary text-black font-semibold text-xs hover:bg-primary/90 transition-all flex items-center justify-center gap-2 shadow-sm"
            >
              <span>Return to My Authorized Module</span>
              <ArrowRight size={14} />
            </Link>

            <Link
              to="/login"
              className="w-full py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-line text-muted hover:text-white text-xs transition-colors flex items-center justify-center gap-1.5"
            >
              <ArrowLeft size={13} />
              <span>Switch Account</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
