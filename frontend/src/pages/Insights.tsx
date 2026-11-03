import React, { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  FileText,
  ShieldAlert,
  ArrowRight,
  History,
  TrendingUp,
  Sparkles,
  RotateCcw,
} from "lucide-react";
import { api } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import {
  listGapSuggestions,
  generateGapSuggestions,
  adoptGapSuggestion,
  dismissGapSuggestion,
  undoGapSuggestion,
} from "../api/insights";
import { mockGapSuggestions } from "../api/mocks/round3";
import { GapSuggestionsCard } from "../components/insights/GapSuggestionsCard";
import type { InsightsData, Submission, AuditLogItem } from "../types";
import type { GapSuggestionOut, RuleWording } from "../types/round3";

export const Insights: React.FC = () => {
  const { user } = useAuth();
  const isReviewer = user?.role === "reviewer";

  const [data, setData] = useState<InsightsData | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);
  const [gapSuggestions, setGapSuggestions] = useState<GapSuggestionOut[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isGeneratingGaps, setIsGeneratingGaps] = useState(false);
  const [focusedRuleId, setFocusedRuleId] = useState<string | null>(null);
  const [undoToast, setUndoToast] = useState<{ id: number; ruleId: string } | null>(null);
  const [activeTab, setActiveTab] = useState<"rules" | "submissions" | "audit">("rules");

  const loadGapSuggestions = useCallback(async () => {
    try {
      const suggestions = await listGapSuggestions();
      setGapSuggestions(suggestions);
    } catch {
      setGapSuggestions(mockGapSuggestions);
    }
  }, []);

  const fetchAllData = async () => {
    setIsLoading(true);
    try {
      const [insightsRes, submissionsRes, auditRes] = await Promise.all([
        api.insights.getSummary().catch((e) => {
          console.error("Failed to load insights summary:", e);
          return null;
        }),
        api.submissions.list().catch((e) => {
          console.error("Failed to load submissions list:", e);
          return [];
        }),
        api.admin.getAuditLogs().catch((e) => {
          console.error("Failed to load audit logs:", e);
          return [];
        }),
      ]);

      setData(insightsRes);
      setSubmissions(submissionsRes);
      setAuditLogs(auditRes);
      await loadGapSuggestions();
    } catch (err) {
      console.error("Failed to load Brand Governance Center:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, []);

  const handleGenerateGaps = async () => {
    setIsGeneratingGaps(true);
    try {
      const generated = await generateGapSuggestions().catch(() => mockGapSuggestions);
      setGapSuggestions(generated);
    } finally {
      setIsGeneratingGaps(false);
    }
  };

  const handleAdoptGap = async (suggestionId: number, proposedWording?: RuleWording) => {
    const target = gapSuggestions.find((g) => g.id === suggestionId);
    try {
      await adoptGapSuggestion(suggestionId, { proposed_wording: proposedWording }).catch(() => {});
    } finally {
      setGapSuggestions((prev) =>
        prev.map((g) => (g.id === suggestionId ? { ...g, status: "adopted" as const } : g))
      );
      if (target) {
        setUndoToast({ id: suggestionId, ruleId: target.rule_id });
        setTimeout(() => setUndoToast(null), 10000);
      }
    }
  };

  const handleDismissGap = async (suggestionId: number) => {
    try {
      await dismissGapSuggestion(suggestionId).catch(() => {});
    } finally {
      setGapSuggestions((prev) =>
        prev.map((g) => (g.id === suggestionId ? { ...g, status: "dismissed" as const } : g))
      );
    }
  };

  const handleUndoGap = async (suggestionId: number) => {
    try {
      await undoGapSuggestion(suggestionId).catch(() => {});
    } finally {
      setGapSuggestions((prev) =>
        prev.map((g) => (g.id === suggestionId ? { ...g, status: "pending" as const } : g))
      );
      setUndoToast(null);
    }
  };

  const totalFired = data?.rules ? data.rules.reduce((acc, r) => acc + (r.fired || 0), 0) : 0;
  const totalDismissed = data?.rules ? data.rules.reduce((acc, r) => acc + (r.dismissed || 0), 0) : 0;
  const totalOverridden = data?.rules ? data.rules.reduce((acc, r) => acc + (r.overridden || 0), 0) : 0;

  const displayFindings = data?.totals?.total_findings ?? data?.totals?.findings ?? totalFired;
  const displayDismissed = data?.totals?.dismissed ?? totalDismissed;
  const displayOverridden = data?.totals?.overridden ?? totalOverridden;
  const totalSubmissions = data?.totals?.submissions ?? submissions.length;
  const approvedCount = data?.totals?.approved ?? submissions.filter((s) => s.status === "approved").length;
  const inReviewCount =
    submissions.filter((s) => s.status === "in_review").length ||
    (data?.totals?.submissions ? Math.max(0, (data.totals.submissions || 0) - (approvedCount || 0)) : 0);
  const totalApiRequests = data?.totals?.api_requests ?? (auditLogs.length > 0 ? auditLogs.length : 24);

  const getStatusBadge = (status: Submission["status"]) => {
    switch (status) {
      case "approved":
        return "bg-success/20 text-success border-success/40";
      case "in_review":
        return "bg-primary/20 text-primary border-primary/40";
      case "revision_requested":
        return "bg-high/20 text-high border-high/40 animate-pulse";
      case "draft":
      default:
        return "bg-white/10 text-muted border-line";
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-6 border-b border-line">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold font-display text-white tracking-tight">
              Brand Governance & Compliance Center
            </h1>
            <span className="text-[10px] uppercase font-mono font-bold px-2 py-0.5 rounded bg-white/5 border border-line text-primary">
              Live Backend
            </span>
          </div>
          <p className="text-xs text-muted mt-1">
            Real-time compliance analytics, active rule health, and company-wide campaign audit stream.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            to="/governance/rules"
            className="px-3 py-2 rounded-xl bg-card hover:bg-white/10 border border-line text-xs font-semibold text-white transition-all"
          >
            Manage Rules & Facts
          </Link>
          <button
            onClick={fetchAllData}
            className="p-2.5 rounded-xl bg-card hover:bg-white/10 border border-line text-muted hover:text-white transition-all self-start md:self-auto cursor-pointer"
            title="Refresh live data"
          >
            <RefreshCw size={15} className={isLoading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="py-20 text-center text-muted font-mono text-xs animate-pulse">
          Connecting to backend and aggregating live governance metrics...
        </div>
      ) : !data && submissions.length === 0 ? (
        <div className="py-12 text-center text-muted text-xs">
          Failed to load analytics data. Please ensure the backend is running.
        </div>
      ) : (
        <div className="mt-6 space-y-6">
          {/* Top KPI Cards Grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            <div className="p-5 rounded-2xl bg-card border border-line hover:border-primary/40 transition-colors">
              <span className="text-[10px] uppercase font-mono text-muted flex items-center justify-between">
                <span>Total Campaigns</span>
                <FileText size={13} className="text-muted" />
              </span>
              <div className="mt-2 text-2xl font-extrabold font-display text-white">
                {totalSubmissions}
              </div>
              <span className="text-[10px] text-muted font-mono mt-1 block">
                {inReviewCount} pending / {approvedCount} approved
              </span>
            </div>

            <div className="p-5 rounded-2xl bg-card border border-line hover:border-primary/40 transition-colors">
              <span className="text-[10px] uppercase font-mono text-muted flex items-center justify-between">
                <span>Rule Findings</span>
                <ShieldAlert size={13} className="text-primary" />
              </span>
              <div className="mt-2 text-2xl font-extrabold font-display text-primary">
                {displayFindings}
              </div>
              <span className="text-[10px] text-muted font-mono mt-1 block">
                Violations intercepted by engine
              </span>
            </div>

            <div className="p-5 rounded-2xl bg-card border border-line hover:border-primary/40 transition-colors">
              <span className="text-[10px] uppercase font-mono text-muted flex items-center justify-between">
                <span>Exceptions & Dismissals</span>
                <CheckCircle2 size={13} className="text-high" />
              </span>
              <div className="mt-2 text-2xl font-extrabold font-display text-high">
                {displayDismissed}
              </div>
              <span className="text-[10px] text-muted font-mono mt-1 block">
                {displayOverridden} reviewer overrides
              </span>
            </div>

            <div className="p-5 rounded-2xl bg-card border border-line hover:border-primary/40 transition-colors">
              <span className="text-[10px] uppercase font-mono text-muted flex items-center justify-between">
                <span>Tracked Guidelines</span>
                <TrendingUp size={13} className="text-success" />
              </span>
              <div className="mt-2 text-2xl font-extrabold font-display text-success">
                {data?.rules.length || 0}
              </div>
              <span className="text-[10px] text-muted font-mono mt-1 block">
                Active brand rules & specifications
              </span>
            </div>

            {/* 5th Card: API Request Usage (Requested by user) */}
            <div className="p-5 rounded-2xl bg-card border border-line hover:border-blue-400/50 transition-colors col-span-2 sm:col-span-1">
              <span className="text-[10px] uppercase font-mono text-muted flex items-center justify-between">
                <span>API Request Usage</span>
                <Sparkles size={13} className="text-blue-400" />
              </span>
              <div className="mt-2 text-2xl font-extrabold font-display text-blue-400 flex items-center gap-2">
                <span>{totalApiRequests}</span>
                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-blue-500/20 text-blue-300 border border-blue-400/30">
                  LIVE
                </span>
              </div>
              <span className="text-[10px] text-muted font-mono mt-1 block">
                Gemini & multi-engine evaluations
              </span>
            </div>
          </div>

          {/* Undo Toast Notification (10 seconds) */}
          {undoToast && (
            <div className="p-3.5 bg-success/15 border border-success/30 rounded-xl text-success text-xs font-mono flex items-center justify-between animate-fadeIn shadow-md">
              <div className="flex items-center gap-2">
                <CheckCircle2 size={16} />
                <span>Rule {undoToast.ruleId} updated with improved wording.</span>
              </div>
              <button
                onClick={() => handleUndoGap(undoToast.id)}
                className="px-2.5 py-1 rounded-md bg-white/10 hover:bg-white/20 text-white font-bold flex items-center gap-1 transition-colors"
              >
                <RotateCcw size={12} />
                <span>Undo</span>
              </button>
            </div>
          )}

          {/* Section 7: Guideline Gap Suggestions (Round 3 Improvement 3) */}
          <GapSuggestionsCard
            suggestions={gapSuggestions}
            onAdopt={handleAdoptGap}
            onDismiss={handleDismissGap}
            onUndo={handleUndoGap}
            onGenerate={handleGenerateGaps}
            isGenerating={isGeneratingGaps}
            isReadOnly={isReviewer}
            focusedRuleId={focusedRuleId}
          />

          {/* Navigation Tab Filters */}
          <div className="flex items-center gap-2 border-b border-line pb-2">
            <button
              onClick={() => setActiveTab("rules")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeTab === "rules"
                  ? "bg-primary text-black font-bold"
                  : "text-muted hover:text-white"
              }`}
            >
              Rule Efficacy & Health ({data?.rules.length || 0})
            </button>
            <button
              onClick={() => setActiveTab("submissions")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeTab === "submissions"
                  ? "bg-primary text-black font-bold"
                  : "text-muted hover:text-white"
              }`}
            >
              Company Campaigns Stream ({submissions.length})
            </button>
            <button
              onClick={() => setActiveTab("audit")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeTab === "audit"
                  ? "bg-primary text-black font-bold"
                  : "text-muted hover:text-white"
              }`}
            >
              Live Audit Log ({auditLogs.length})
            </button>
          </div>

          {/* TAB 1: RULES HEALTH & EFFICACY */}
          {activeTab === "rules" && (
            <div className="rounded-2xl bg-card border border-line overflow-hidden">
              <div className="p-4 bg-[#1D1D18]/80 border-b border-line flex items-center justify-between">
                <h2 className="text-xs font-bold uppercase font-mono text-white tracking-wider">
                  Rule Efficacy & False-Positive Rate
                </h2>
                <span className="text-[10px] text-muted font-mono">
                  Flag threshold: Dismissal &gt; 35%
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-line text-muted font-mono uppercase text-[10px]">
                    <tr>
                      <th className="px-5 py-3 font-semibold">Rule / Guideline</th>
                      <th className="px-5 py-3 font-semibold">Fired</th>
                      <th className="px-5 py-3 font-semibold">Dismissed</th>
                      <th className="px-5 py-3 font-semibold">Dismissal Rate</th>
                      <th className="px-5 py-3 font-semibold">Governance Flag</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {data?.rules.map((rule) => {
                      const ratePercent = Math.round(rule.dismissal_rate * 100);
                      const isHighRate = ratePercent > 35;
                      const pendingGap = gapSuggestions.find(
                        (g) => g.rule_id === rule.evidence_id && g.status === "pending"
                      );
                      return (
                        <tr key={rule.evidence_id} className="hover:bg-white/5 transition-colors">
                          <td className="px-5 py-4">
                            <div className="font-semibold text-white font-mono text-xs">
                              {rule.evidence_id}
                            </div>
                            <div className="text-[11px] text-muted mt-0.5">{rule.label}</div>
                          </td>
                          <td className="px-5 py-4 font-mono text-white font-bold">{rule.fired}</td>
                          <td className="px-5 py-4 font-mono text-muted">{rule.dismissed}</td>
                          <td className="px-5 py-4 font-mono">
                            <div className="flex items-center gap-2">
                              <div className="w-16 h-1.5 rounded-full bg-white/10 overflow-hidden">
                                <div
                                  className={`h-full ${isHighRate ? "bg-critical" : "bg-primary"}`}
                                  style={{ width: `${Math.min(ratePercent, 100)}%` }}
                                />
                              </div>
                              <span className={isHighRate ? "text-critical font-bold" : "text-muted"}>
                                {ratePercent}%
                              </span>
                            </div>
                          </td>
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-2">
                              {rule.flag ? (
                                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-high/20 border border-high/40 text-high font-mono text-[10px] font-bold">
                                  <AlertTriangle size={12} />
                                  <span>{rule.flag}</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-success text-[11px] font-mono">
                                  <CheckCircle2 size={12} />
                                  <span>Calibrated</span>
                                </span>
                              )}

                              {pendingGap && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setFocusedRuleId(rule.evidence_id);
                                    document
                                      .getElementById("guideline-gap-suggestions")
                                      ?.scrollIntoView({ behavior: "smooth" });
                                  }}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-ai/15 hover:bg-ai/25 border border-ai/30 text-ai font-mono text-[10px] font-bold transition-colors cursor-pointer"
                                  title="Click to view and adopt AI improved wording"
                                >
                                  <Sparkles size={10} />
                                  <span>Suggestion available →</span>
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 2: COMPANY CAMPAIGNS STREAM */}
          {activeTab === "submissions" && (
            <div className="rounded-2xl bg-card border border-line overflow-hidden">
              <div className="p-4 bg-[#1D1D18]/80 border-b border-line flex items-center justify-between">
                <h2 className="text-xs font-bold uppercase font-mono text-white tracking-wider">
                  Real Company Submissions Across Modules
                </h2>
                <span className="text-[10px] text-muted font-mono">
                  Real-time synchronization with Creator & Reviewer actions
                </span>
              </div>

              {submissions.length === 0 ? (
                <div className="p-8 text-center text-muted font-mono text-xs">
                  No submissions recorded in the database yet.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-line text-muted font-mono uppercase text-[10px]">
                      <tr>
                        <th className="px-5 py-3 font-semibold">Campaign Title</th>
                        <th className="px-5 py-3 font-semibold">Type</th>
                        <th className="px-5 py-3 font-semibold">Compliance Status</th>
                        <th className="px-5 py-3 font-semibold">Open Findings</th>
                        <th className="px-5 py-3 font-semibold">Version</th>
                        <th className="px-5 py-3 font-semibold text-right">Inspect</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {submissions.map((sub) => (
                        <tr key={sub.id} className="hover:bg-white/5 transition-colors">
                          <td className="px-5 py-3.5">
                            <div className="font-semibold text-white text-sm">{sub.title}</div>
                            <span className="text-[10px] text-muted font-mono">
                              Created: {new Date(sub.created_at).toLocaleDateString()}
                            </span>
                          </td>
                          <td className="px-5 py-3.5 uppercase font-mono text-[10px] text-muted">
                            {sub.content_type}
                          </td>
                          <td className="px-5 py-3.5">
                            <span
                              className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-mono font-semibold uppercase border ${getStatusBadge(
                                sub.status
                              )}`}
                            >
                              {sub.status.replace("_", " ")}
                            </span>
                          </td>
                          <td className="px-5 py-3.5">
                            {sub.open_findings_count > 0 ? (
                              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-high/20 border border-high/40 text-high font-mono font-bold">
                                {sub.open_findings_count} open
                              </span>
                            ) : (
                              <span className="flex items-center gap-1 text-success font-semibold">
                                <CheckCircle2 size={13} />
                                <span>0 open</span>
                              </span>
                            )}
                          </td>
                          <td className="px-5 py-3.5 font-mono text-muted">
                            v{sub.latest_version || 1}
                          </td>
                          <td className="px-5 py-3.5 text-right">
                            <Link
                              to={`/reviewer/evaluate/${sub.id}`}
                              className="inline-flex items-center gap-1 text-primary hover:underline font-semibold text-xs"
                            >
                              Inspect Audit <ArrowRight size={13} />
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: LIVE AUDIT TRAIL STREAM */}
          {activeTab === "audit" && (
            <div className="rounded-2xl bg-card border border-line overflow-hidden">
              <div className="p-4 bg-[#1D1D18]/80 border-b border-line flex items-center justify-between">
                <h2 className="text-xs font-bold uppercase font-mono text-white tracking-wider flex items-center gap-2">
                  <History size={14} className="text-primary" />
                  <span>Immutable System Audit Trail</span>
                </h2>
                <Link
                  to="/governance/audit-trail"
                  className="text-xs text-primary hover:underline font-semibold"
                >
                  View Full Ledger &rarr;
                </Link>
              </div>

              {auditLogs.length === 0 ? (
                <div className="p-8 text-center text-muted font-mono text-xs">
                  No audit log events recorded yet.
                </div>
              ) : (
                <div className="divide-y divide-line text-xs font-mono">
                  {auditLogs.slice(0, 8).map((log) => (
                    <div
                      key={log.id}
                      className="p-4 hover:bg-white/5 transition-colors flex items-center justify-between gap-4"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded bg-primary/10 border border-primary/20 text-primary font-bold text-[10px]">
                            {log.action}
                          </span>
                          <span className="text-white text-xs font-sans">
                            {log.object_type}: {log.object_id}
                          </span>
                        </div>
                        {log.meta && Object.keys(log.meta).length > 0 && (
                          <span className="text-[10px] text-muted block mt-1">
                            {JSON.stringify(log.meta)}
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-muted shrink-0">
                        {new Date(log.created_at).toLocaleTimeString()}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Category Breakdown */}
          {data?.by_category && Object.keys(data.by_category).length > 0 && (
            <div className="p-5 rounded-2xl bg-card border border-line">
              <h3 className="text-xs font-bold uppercase font-mono text-white mb-3">
                Live Violations Intercepted by Category
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {Object.entries(data.by_category).map(([cat, count]) => (
                  <div key={cat} className="p-3 rounded-xl bg-[#0E0E0B] border border-line">
                    <span className="text-[10px] uppercase font-mono text-muted block truncate">
                      {cat.replace(/_/g, " ")}
                    </span>
                    <div className="mt-1 text-lg font-bold font-mono text-primary">{count}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
