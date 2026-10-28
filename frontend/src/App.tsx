import React from "react";
import { BrowserRouter, Routes, Route, Navigate, useParams } from "react-router-dom";
import { AuthProvider, useAuth, getRoleHomeRoute } from "./auth/AuthContext";
import { RoleGuard } from "./auth/RoleGuard";
import { Navbar } from "./components/Navbar";
import { Login } from "./pages/Login";
import { Workspace } from "./pages/Workspace";
import { SubmissionDetailView } from "./pages/SubmissionDetail";
import { ReviewQueue } from "./pages/ReviewQueue";
import { KnowledgeBase } from "./pages/KnowledgeBase";
import { Insights } from "./pages/Insights";
import { AuditLog } from "./pages/AuditLog";
import { AnimatedBackground } from "./components/AnimatedBackground";

const ProtectedLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0E0E0B] text-muted font-mono text-xs">
        <span className="animate-pulse">Verifying security token...</span>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="min-h-screen flex flex-col bg-transparent relative z-10">
      <Navbar />
      <main className="flex-1">{children}</main>
    </div>
  );
};

// Root dispatcher: Redirects to user's assigned module
const HomeDispatcher: React.FC = () => {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0E0E0B] text-muted font-mono text-xs">
        <span className="animate-pulse">Loading dashboard clearance...</span>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <Navigate to={getRoleHomeRoute(user.role)} replace />;
};

// Dynamic Submission dispatcher for legacy /submissions/:id
const SubmissionDispatcher: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0E0E0B] text-muted font-mono text-xs">
        <span className="animate-pulse">Resolving submission routing...</span>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (user.role === "reviewer") {
    return <Navigate to={`/reviewer/evaluate/${id}`} replace />;
  }
  return <Navigate to={`/creator/editor/${id}`} replace />;
};

export default function App() {
  return (
    <AuthProvider>
      <div className="relative min-h-screen bg-[#0E0E0B] text-ink overflow-x-hidden">
        <AnimatedBackground />
        <div className="relative z-10">
          <BrowserRouter>
            <Routes>
              {/* Public Enterprise Auth Portal */}
              <Route path="/login" element={<Login />} />

              {/* Dynamic Role-Based Home Dispatcher */}
              <Route path="/" element={<HomeDispatcher />} />

              {/* =========================================================
                  MODULE A: Creator Studio (/creator/*)
                  Allowed: Creator, Agency, Admin
                  ========================================================= */}
              <Route
                path="/creator/workspace"
                element={
                  <ProtectedLayout>
                    <RoleGuard allowedRoles={["creator", "agency", "admin"]} moduleName="Creator Studio">
                      <Workspace />
                    </RoleGuard>
                  </ProtectedLayout>
                }
              />
              <Route
                path="/creator/editor/:id"
                element={
                  <ProtectedLayout>
                    <RoleGuard allowedRoles={["creator", "agency", "admin"]} moduleName="Creator Studio Editor">
                      <SubmissionDetailView />
                    </RoleGuard>
                  </ProtectedLayout>
                }
              />
              <Route
                path="/creator/guidelines"
                element={
                  <ProtectedLayout>
                    <RoleGuard allowedRoles={["creator", "agency", "reviewer", "brand_manager", "admin"]} moduleName="Brand Guidelines">
                      <KnowledgeBase />
                    </RoleGuard>
                  </ProtectedLayout>
                }
              />

              {/* =========================================================
                  MODULE B: Compliance Review Terminal (/reviewer/*)
                  Allowed: Reviewer, Admin
                  ========================================================= */}
              <Route
                path="/reviewer/queue"
                element={
                  <ProtectedLayout>
                    <RoleGuard allowedRoles={["reviewer", "admin"]} moduleName="Compliance Review Queue">
                      <ReviewQueue />
                    </RoleGuard>
                  </ProtectedLayout>
                }
              />
              <Route
                path="/reviewer/evaluate/:id"
                element={
                  <ProtectedLayout>
                    <RoleGuard allowedRoles={["reviewer", "admin"]} moduleName="Compliance Evaluation Terminal">
                      <SubmissionDetailView />
                    </RoleGuard>
                  </ProtectedLayout>
                }
              />

              {/* =========================================================
                  MODULE C: Governance & Analytics Center (/governance/*)
                  Allowed: Brand Manager, Admin
                  ========================================================= */}
              <Route
                path="/governance/insights"
                element={
                  <ProtectedLayout>
                    <RoleGuard allowedRoles={["brand_manager", "admin"]} moduleName="Rule Health & Insights Center">
                      <Insights />
                    </RoleGuard>
                  </ProtectedLayout>
                }
              />
              <Route
                path="/governance/rules"
                element={
                  <ProtectedLayout>
                    <RoleGuard allowedRoles={["brand_manager", "admin"]} moduleName="Brand Rules & Facts Management">
                      <KnowledgeBase />
                    </RoleGuard>
                  </ProtectedLayout>
                }
              />
              <Route
                path="/governance/audit-trail"
                element={
                  <ProtectedLayout>
                    <RoleGuard allowedRoles={["admin", "brand_manager"]} moduleName="Cryptographic Audit Ledger">
                      <AuditLog />
                    </RoleGuard>
                  </ProtectedLayout>
                }
              />

              {/* Legacy route aliases redirecting cleanly into isolated modules */}
              <Route path="/submissions/:id" element={<SubmissionDispatcher />} />
              <Route path="/review" element={<Navigate to="/reviewer/queue" replace />} />
              <Route path="/knowledge" element={<Navigate to="/creator/guidelines" replace />} />
              <Route path="/insights" element={<Navigate to="/governance/insights" replace />} />
              <Route path="/admin/audit" element={<Navigate to="/governance/audit-trail" replace />} />

              {/* Wildcard Fallback */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </BrowserRouter>
        </div>
      </div>
    </AuthProvider>
  );
}
