import React, { useState, useEffect } from "react";
import { useParams, useLocation, Link } from "react-router-dom";
import {
  ArrowLeft,
  Send,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  History,
  Edit3,
  Eye,
  MessageSquare,
  Wand2,
  ShieldCheck,
  Cpu,
  Sparkles,
} from "lucide-react";
import { motion } from "motion/react";
import { api, ApiError } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import type { SubmissionDetail, Finding, EvidenceRef } from "../types";
import { HighlightedDraft } from "../components/HighlightedDraft";
import { FindingCard } from "../components/FindingCard";
import { EngineStatusBar } from "../components/EngineStatusBar";
import { EvidenceDrawer } from "../components/EvidenceDrawer";
import { DecisionModal } from "../components/DecisionModal";
import { replaceByCodePoints } from "../lib/codepoints";
import { CLEAN_DRAFT_TEXT } from "../components/HowToEvaluateDrawer";

export const SubmissionDetailView: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const { user } = useAuth();
  const submissionId = Number(id);

  // Check if active context is reviewer module
  const isReviewer = user?.role === "reviewer" || location.pathname.startsWith("/reviewer");
  const backRoute = isReviewer ? "/reviewer/queue" : "/creator/workspace";
  const backLabel = isReviewer ? "Return to Review Queue" : "Return to Creator Studio";

  const [submission, setSubmission] = useState<SubmissionDetail | null>(null);
  const [selectedVersionId, setSelectedVersionId] = useState<number | null>(null);
  const [draftBody, setDraftBody] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [showDecisionModal, setShowDecisionModal] = useState(false);
  const [selectedEvidence, setSelectedEvidence] = useState<EvidenceRef | null>(null);
  const [focusedFindingId, setFocusedFindingId] = useState<number | null>(null);
  const [diffData, setDiffData] = useState<{
    submission_id?: number;
    v1_number?: number;
    v2_number?: number;
    diff: string;
    v1_body: string;
    v2_body: string;
  } | null>(null);
  const [showDiff, setShowDiff] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [modelFilter, setModelFilter] = useState<"all" | "gemini" | "module">("all");

  const fetchDetail = async () => {
    try {
      const data = await api.submissions.get(submissionId);
      setSubmission(data);

      // Select the latest version by default
      if (data.versions && data.versions.length > 0) {
        const latest = data.versions[data.versions.length - 1];
        setSelectedVersionId(latest.id);
        setDraftBody(latest.body);
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to load submission");
    }
  };

  useEffect(() => {
    if (submissionId) {
      fetchDetail();
    }
  }, [submissionId]);

  // When switching version dropdown
  const handleSelectVersion = (versionId: number) => {
    setSelectedVersionId(versionId);
    const ver = submission?.versions.find((v) => v.id === versionId);
    if (ver) {
      setDraftBody(ver.body);
    }
  };

  // Re-audit / Create new version
  const handleSaveAndAudit = async () => {
    setIsScanning(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const result = await api.submissions.createVersion(submissionId, draftBody);
      await fetchDetail();
      setIsEditing(false);
      setSuccessMessage(
        `Version ${result.version} created and audited successfully. (${result.summary.total} findings)`
      );
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to audit new version");
    } finally {
      setIsScanning(false);
    }
  };

  // One-click apply suggestion to the text
  const handleApplyFix = async (finding: Finding) => {
    if (!finding.suggested_correction) return;
    setErrorMessage(null);

    // 1. Mark finding as accepted on backend
    try {
      await api.findings.resolve(finding.id, "accepted");
    } catch (err: any) {
      console.warn("Could not patch finding resolution:", err.message);
    }

    // 2. Perform code-point replacement in draft text
    const updated = replaceByCodePoints(
      draftBody,
      finding.excerpt.start,
      finding.excerpt.end,
      finding.suggested_correction
    );
    setDraftBody(updated);

    // Update local finding state to accepted
    if (submission) {
      const updatedFindings = submission.latest_findings.map((f) =>
        f.id === finding.id ? { ...f, resolution: "accepted" as const } : f
      );
      setSubmission({
        ...submission,
        latest_findings: updatedFindings,
      });
    }

    setSuccessMessage(`Applied suggested correction for ${finding.issue_id}. Click 'Save & Recheck' to audit new version.`);
  };

  // Dismiss finding with justification
  const handleDismissFinding = async (finding: Finding, reason: string) => {
    setErrorMessage(null);
    try {
      const updated = await api.findings.resolve(finding.id, "dismissed", reason);
      if (submission) {
        const updatedFindings = submission.latest_findings.map((f) =>
          f.id === finding.id ? updated : f
        );
        setSubmission({
          ...submission,
          latest_findings: updatedFindings,
        });
      }
      setSuccessMessage(`Finding ${finding.issue_id} dismissed with justification recorded.`);
    } catch (err: any) {
      if (err instanceof ApiError && err.code === "CANNOT_DISMISS_CRITICAL") {
        setErrorMessage("Compliance Rule: Critical severity findings cannot be dismissed.");
      } else {
        setErrorMessage(err.message || "Failed to dismiss finding.");
      }
    }
  };

  // Autofill Clean Draft helper
  const handleAutofillClean = () => {
    setDraftBody(CLEAN_DRAFT_TEXT);
    setIsEditing(true);
    setSuccessMessage("Autofilled compliant copy. Click 'Save & Recheck' to verify Version 2!");
  };

  // Submit for Review (workflow gate)
  const handleSubmitForReview = async () => {
    setIsSubmittingReview(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      await api.submissions.submit(submissionId);
      await fetchDetail();
      setSuccessMessage("Submission successfully passed compliance gates and is now in the Review Queue!");
    } catch (err: any) {
      if (err instanceof ApiError && err.code === "CANNOT_SUBMIT_OPEN_FINDINGS") {
        setErrorMessage(
          "Workflow Blocked: Cannot submit drafts with open critical or high findings. Apply suggestions or resolve findings before submitting."
        );
      } else {
        setErrorMessage(err.message || "Failed to submit for review.");
      }
    } finally {
      setIsSubmittingReview(false);
    }
  };

  // Reviewer Decision Handler
  const handleReviewDecisionSubmit = async (
    decision: "approve" | "request_revision",
    comment: string,
    overrideReason?: string
  ) => {
    try {
      await api.review.decide(submissionId, {
        decision,
        comment,
        override_reason: overrideReason,
      });
      setSuccessMessage(
        `Decision '${decision.toUpperCase()}' recorded successfully. Cryptographic audit log updated.`
      );
      setShowDecisionModal(false);
      await fetchDetail();
    } catch (err: any) {
      throw err;
    }
  };

  // Load Diff
  const handleToggleDiff = async () => {
    if (!showDiff) {
      try {
        const diffRes = await api.submissions.getDiff(submissionId);
        setDiffData(diffRes);
      } catch (err: any) {
        setErrorMessage(err.message || "Could not generate diff.");
      }
    }
    setShowDiff(!showDiff);
  };

  // Add Comment
  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return;
    try {
      const newComment = await api.submissions.addComment(submissionId, commentText);
      setCommentText("");
      if (submission) {
        setSubmission({
          ...submission,
          comments: [...submission.comments, newComment],
        });
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to add comment.");
    }
  };

  if (!submission) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-20 text-center font-mono text-xs">
        {errorMessage ? (
          <div className="p-6 rounded-2xl bg-critical/10 border border-critical/30 max-w-md mx-auto space-y-3">
            <AlertTriangle className="mx-auto text-critical" size={24} />
            <p className="text-white font-semibold font-sans">{errorMessage}</p>
            <Link
              to={backRoute}
              className="inline-block px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-mono text-xs transition-colors"
            >
              {backLabel}
            </Link>
          </div>
        ) : (
          <span className="text-muted animate-pulse">Loading submission details...</span>
        )}
      </div>
    );
  }

  const versionsList = submission.versions || [];
  const latestVersion = versionsList.length > 0 ? versionsList[versionsList.length - 1] : null;
  const currentVersionNumber =
    versionsList.find((v) => v.id === selectedVersionId)?.number ||
    latestVersion?.number ||
    1;

  const activeFindings = submission.latest_findings || [];
  const openFindingsCount = activeFindings.filter((f) => f.resolution === "open").length;

  const summary = {
    critical: activeFindings.filter((f) => f.resolution === "open" && f.severity === "critical").length,
    high: activeFindings.filter((f) => f.resolution === "open" && f.severity === "high").length,
    medium: activeFindings.filter((f) => f.resolution === "open" && f.severity === "medium").length,
    low: activeFindings.filter((f) => f.resolution === "open" && f.severity === "low").length,
    total: openFindingsCount,
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Top Header Navigation & Status */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-4 border-b border-line">
        <div className="flex items-center gap-3">
          <Link
            to={backRoute}
            className="p-2 rounded-xl bg-card hover:bg-white/10 border border-line text-muted hover:text-white transition-colors flex items-center gap-1.5"
            title={backLabel}
          >
            <ArrowLeft size={16} />
            <span className="text-[11px] font-mono hidden sm:inline">{backLabel}</span>
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold font-display text-white tracking-tight">
                {submission.title}
              </h1>
              <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-white/5 border border-line text-muted">
                {submission.content_type}
              </span>
              {isReviewer && (
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-primary/20 border border-primary/40 text-primary font-bold">
                  Reviewer Terminal
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 text-xs text-muted mt-1">
              <span>Submission #{submission.id}</span>
              <span>·</span>
              <span className="font-mono text-primary">Version {currentVersionNumber}</span>
              <span>·</span>
              <span
                className={`uppercase font-mono text-[10px] font-bold px-2 py-0.2 rounded border ${
                  submission.status === "approved"
                    ? "bg-success/20 text-success border-success/40"
                    : submission.status === "in_review"
                    ? "bg-high/20 text-high border-high/40"
                    : "bg-white/10 text-muted border-line"
                }`}
              >
                {submission.status.replace("_", " ")}
              </span>
            </div>
          </div>
        </div>

        {/* Primary Action Buttons */}
        <div className="flex items-center gap-2.5">
          {(submission.versions || []).length > 1 && (
            <button
              onClick={handleToggleDiff}
              className="px-3 py-2 rounded-xl bg-card hover:bg-white/10 border border-line text-xs font-semibold text-muted hover:text-white transition-all flex items-center gap-1.5"
            >
              <History size={14} />
              <span>{showDiff ? "Hide Version Diff" : "Compare V1 vs V2"}</span>
            </button>
          )}

          {isReviewer ? (
            <button
              onClick={() => setShowDecisionModal(true)}
              className="px-4 py-2 rounded-xl font-bold font-display text-xs bg-primary text-black hover:bg-primary/90 shadow-[0_0_15px_rgba(175,230,7,0.3)] flex items-center gap-1.5 transition-all"
            >
              <ShieldCheck size={14} />
              <span>Record Compliance Decision</span>
            </button>
          ) : (
            submission.status !== "approved" && (
              <button
                onClick={handleSubmitForReview}
                disabled={isSubmittingReview || submission.status === "in_review"}
                className={`px-4 py-2 rounded-xl font-semibold text-xs flex items-center gap-2 transition-all ${
                  openFindingsCount > 0
                    ? "bg-white/10 border border-line text-muted hover:text-white"
                    : "bg-primary text-black hover:bg-primary/90 shadow-[0_0_15px_rgba(175,230,7,0.3)]"
                } disabled:opacity-50`}
              >
                <Send size={14} />
                <span>
                  {submission.status === "in_review"
                    ? "In Review Queue"
                    : isSubmittingReview
                    ? "Verifying Gate..."
                    : "Submit for Review"}
                </span>
              </button>
            )
          )}
        </div>
      </div>

      {/* Alert Banners */}
      {errorMessage && (
        <div className="p-4 rounded-xl bg-critical/10 border border-critical/30 text-critical text-xs flex items-center gap-2.5 animate-in fade-in">
          <AlertTriangle size={16} className="shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {successMessage && (
        <div className="p-4 rounded-xl bg-success/10 border border-success/30 text-success text-xs flex items-center gap-2.5 animate-in fade-in">
          <CheckCircle2 size={16} className="shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Multi-Engine Status Bar */}
      <EngineStatusBar
        engines={{
          rules: "ran",
          llm: "disabled",
          llm_reason: "deterministic rule engine active",
        }}
        summary={summary}
        isScanning={isScanning}
      />

      {/* Version Diff Overlay */}
      {showDiff && diffData && (
        <div className="p-5 rounded-2xl bg-[#1D1D18] border border-line text-xs space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-line">
            <span className="font-mono font-bold text-white uppercase text-[11px]">
              Version Comparison (v{diffData.v1_number} &rarr; v{diffData.v2_number})
            </span>
            <span className="text-[10px] text-muted font-mono">Diff unified</span>
          </div>
          <pre className="p-3 rounded-xl bg-[#0E0E0B] border border-line text-xs font-mono text-muted whitespace-pre-wrap leading-relaxed">
            {diffData.diff || "No textual differences detected between versions."}
          </pre>
        </div>
      )}

      {/* Main 2-Column Split Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Draft Editor & Code-Point Highlighter (7 Cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted font-mono">
                Draft Content
              </span>

              {/* Version Switcher */}
              {(submission.versions || []).length > 1 && (
                <select
                  value={selectedVersionId || ""}
                  onChange={(e) => handleSelectVersion(Number(e.target.value))}
                  className="px-2 py-0.5 rounded bg-card border border-line text-xs text-white font-mono focus:outline-none focus:border-primary"
                >
                  {submission.versions.map((v) => (
                    <option key={v.id} value={v.id}>
                      Version {v.number}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {!isReviewer ? (
              <div className="flex items-center gap-2">
                {/* Autofill Clean Copy Shortcut for Judges */}
                <button
                  onClick={handleAutofillClean}
                  title="Autofill pre-verified compliant copy to test Version 2 clean pass"
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-line text-[11px] text-ai font-mono transition-colors"
                >
                  <Wand2 size={12} />
                  <span>Autofill Clean Copy</span>
                </button>

                <button
                  onClick={() => setIsEditing(!isEditing)}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-card hover:bg-white/10 border border-line text-[11px] text-muted hover:text-white transition-colors"
                >
                  {isEditing ? <Eye size={12} /> : <Edit3 size={12} />}
                  <span>{isEditing ? "View Highlights" : "Edit Text"}</span>
                </button>
              </div>
            ) : (
              <span className="text-[11px] font-mono text-muted bg-white/5 px-2.5 py-1 rounded-lg border border-line">
                Evaluation Mode (Read-Only)
              </span>
            )}
          </div>

          {/* Interactive Highlighted Draft */}
          <HighlightedDraft
            text={draftBody}
            findings={activeFindings}
            isScanning={isScanning}
            focusedFindingId={focusedFindingId}
            onSelectFinding={(id) => setFocusedFindingId(id)}
            isEditing={!isReviewer && isEditing}
            onChangeText={(val) => setDraftBody(val)}
          />

          {/* Draft Action Toolbar */}
          <div className="flex items-center justify-between pt-1">
            <div className="text-[11px] text-muted font-mono">
              {isReviewer
                ? "Locked for formal governance assessment"
                : `Status: ${isEditing ? "Unsaved edits in buffer" : "Viewing saved version"}`}
            </div>
            {!isReviewer ? (
              <button
                onClick={handleSaveAndAudit}
                disabled={isScanning}
                className="px-4 py-2 rounded-xl bg-signal text-black font-bold font-display text-xs hover:bg-signal/90 shadow-[0_0_15px_rgba(175,230,7,0.25)] flex items-center gap-1.5 transition-all disabled:opacity-50"
              >
                <RefreshCw size={13} className={isScanning ? "animate-spin" : ""} />
                <span>{isScanning ? "Auditing Rules..." : "Save & Recheck (New Version)"}</span>
              </button>
            ) : (
              <button
                onClick={() => setShowDecisionModal(true)}
                className="px-4 py-2 rounded-xl bg-primary text-black font-bold font-display text-xs hover:bg-primary/90 shadow-[0_0_15px_rgba(175,230,7,0.25)] flex items-center gap-1.5 transition-all"
              >
                <ShieldCheck size={13} />
                <span>Make Compliance Decision</span>
              </button>
            )}
          </div>

          {/* Comments & Audit Notes Section */}
          <div className="mt-8 pt-6 border-t border-line space-y-4">
            <div className="flex items-center gap-2">
              <MessageSquare size={16} className="text-muted" />
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted font-mono">
                Compliance Review Thread ({submission.comments.length})
              </h3>
            </div>

            {submission.comments.length > 0 && (
              <div className="space-y-2">
                {submission.comments.map((c) => (
                  <div key={c.id} className="p-3 rounded-xl bg-card border border-line text-xs">
                    <div className="flex items-center justify-between text-muted text-[10px] mb-1 font-mono">
                      <span>User #{c.author_id}</span>
                      <span>{new Date(c.created_at).toLocaleTimeString()}</span>
                    </div>
                    <p className="text-white leading-relaxed">{c.body}</p>
                  </div>
                ))}
              </div>
            )}

            <form onSubmit={handleAddComment} className="flex gap-2">
              <input
                type="text"
                placeholder="Add compliance notes or revision feedback..."
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                className="flex-1 p-2.5 bg-[#0E0E0B] border border-line rounded-xl text-xs text-white focus:outline-none focus:border-primary font-sans"
              />
              <button
                type="submit"
                disabled={!commentText.trim()}
                className="px-3.5 py-2 rounded-xl bg-card hover:bg-white/10 border border-line text-xs text-white disabled:opacity-50"
              >
                Post
              </button>
            </form>
          </div>
        </div>

        {/* Right Column: Findings & Evidence Inspector (5 Cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted font-mono">
                Audit Findings ({activeFindings.length})
              </h2>
              <span className="text-[10px] font-mono text-muted">
                {openFindingsCount} Open · {activeFindings.length - openFindingsCount} Resolved
              </span>
            </div>

            {/* AI Option Filter Tabs: BrandGuard Module vs Google Gemini */}
            {activeFindings.length > 0 && (
              <div className="flex items-center gap-1.5 p-1 bg-card rounded-xl border border-line text-xs font-mono">
                <button
                  onClick={() => setModelFilter("all")}
                  className={`px-2.5 py-1 rounded-lg transition-all text-[11px] ${
                    modelFilter === "all"
                      ? "bg-white/10 text-white font-bold shadow-sm"
                      : "text-muted hover:text-white"
                  }`}
                >
                  All ({activeFindings.length})
                </button>
                <button
                  onClick={() => setModelFilter("module")}
                  className={`px-2.5 py-1 rounded-lg transition-all flex items-center gap-1.5 text-[11px] ${
                    modelFilter === "module"
                      ? "bg-primary/20 text-primary border border-primary/40 font-bold"
                      : "text-muted hover:text-white"
                  }`}
                >
                  <Cpu size={11} className="text-primary" />
                  <span>BrandGuard Module ({activeFindings.filter(f => f.source_engine !== "llm" && f.source_engine !== "gemini").length})</span>
                </button>
                <button
                  onClick={() => setModelFilter("gemini")}
                  className={`px-2.5 py-1 rounded-lg transition-all flex items-center gap-1.5 text-[11px] ${
                    modelFilter === "gemini"
                      ? "bg-blue-500/20 text-blue-300 border border-blue-400/40 font-bold shadow-[0_0_12px_rgba(59,130,246,0.3)]"
                      : "text-muted hover:text-white"
                  }`}
                >
                  <Sparkles size={11} className="text-blue-400" />
                  <span>Google Gemini ({activeFindings.filter(f => f.source_engine === "llm" || f.source_engine === "gemini").length})</span>
                </button>
              </div>
            )}
          </div>

          {activeFindings.length === 0 ? (
            <motion.div
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
              className="p-8 rounded-2xl bg-card border border-success/40 text-center space-y-3 shadow-[0_0_30px_rgba(175,230,7,0.2)]"
            >
              <div className="w-12 h-12 rounded-full bg-success/15 text-success flex items-center justify-center mx-auto">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <motion.path
                    d="M4 12.5L9.5 18L20 6"
                    stroke="#AFE607"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                  />
                </svg>
              </div>
              <h3 className="text-base font-bold text-white font-display">
                All clear · 0 findings
              </h3>
              <p className="text-xs text-muted max-w-xs mx-auto font-sans leading-relaxed">
                Zero rule violations or factual conflicts detected in this version. Ready for review submission.
              </p>
            </motion.div>
          ) : (
            <div className="space-y-3">
              {activeFindings
                .filter((f) => {
                  const isGem = f.source_engine === "llm" || f.source_engine === "gemini";
                  if (modelFilter === "gemini") return isGem;
                  if (modelFilter === "module") return !isGem;
                  return true;
                })
                .map((finding) => (
                  <FindingCard
                    key={finding.id}
                    finding={finding}
                    isFocused={finding.id === focusedFindingId}
                    onApplyFix={handleApplyFix}
                    onDismiss={handleDismissFinding}
                    onSelectEvidence={(evidence) => setSelectedEvidence(evidence)}
                  />
                ))}
              {activeFindings.filter((f) => {
                const isGem = f.source_engine === "llm" || f.source_engine === "gemini";
                if (modelFilter === "gemini") return isGem;
                if (modelFilter === "module") return !isGem;
                return true;
              }).length === 0 && (
                <div className="p-6 rounded-xl bg-card border border-line text-center text-xs text-muted font-mono">
                  No findings from {modelFilter === "gemini" ? "Google Gemini" : "BrandGuard Module"} in this version.
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Slide-in Evidence Inspector Drawer */}
      <EvidenceDrawer
        evidence={selectedEvidence}
        onClose={() => setSelectedEvidence(null)}
      />

      {/* Reviewer Decision Modal */}
      {showDecisionModal && submission && (
        <DecisionModal
          isOpen={showDecisionModal}
          onClose={() => setShowDecisionModal(false)}
          onSubmit={handleReviewDecisionSubmit}
          hasOpenFindings={openFindingsCount > 0}
          submissionTitle={submission.title}
        />
      )}
    </div>
  );
};
