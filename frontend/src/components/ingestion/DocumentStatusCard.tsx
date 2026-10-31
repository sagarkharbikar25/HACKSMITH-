import React from "react";
import {
  FileText,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Sparkles,
  RefreshCw,
} from "lucide-react";
import { useDocumentPolling } from "../../hooks/useDocumentPolling";
import type { DocumentOut } from "../../types/round3";

interface DocumentStatusCardProps {
  initialDocument: DocumentOut;
  onReviewProposals: (documentId: number) => void;
  onRetryUpload?: (documentId: number) => void;
}

const STAGES = [
  { id: "uploaded", label: "Uploaded" },
  { id: "reading", label: "Reading pages" },
  { id: "extracting", label: "Extracting rules" },
  { id: "ready", label: "Ready" },
];

export const DocumentStatusCard: React.FC<DocumentStatusCardProps> = ({
  initialDocument,
  onReviewProposals,
  onRetryUpload,
}) => {
  const { data: polledDoc } = useDocumentPolling(initialDocument.id);
  const doc = polledDoc || initialDocument;

  const isFailed = doc.status === "failed";
  const isPartial = doc.status === "partial";
  const isReady = doc.status === "ready" || isPartial;
  const isProcessing = ["queued", "parsing", "extracting"].includes(doc.status);

  // Determine stage progress step (0 to 3)
  let currentStep = 0;
  if (doc.status === "queued") currentStep = 0;
  else if (doc.status === "parsing") currentStep = 1;
  else if (doc.status === "extracting") currentStep = 2;
  else if (doc.status === "ready" || doc.status === "partial") currentStep = 3;

  const progressPercent =
    doc.chunks_total > 0
      ? Math.round((doc.chunks_done / doc.chunks_total) * 100)
      : isReady
      ? 100
      : 25;

  const pendingCount = doc.proposal_counts?.pending ?? 0;
  const acceptedCount = doc.proposal_counts?.accepted ?? 0;
  const rejectedCount = doc.proposal_counts?.rejected ?? 0;
  const totalCount = pendingCount + acceptedCount + rejectedCount;

  return (
    <div className="p-5 rounded-2xl bg-[#151511] border border-white/10 space-y-4 hover:border-white/20 transition-all">
      {/* Header Info */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="p-2.5 rounded-xl bg-[#1D1D18] border border-white/5 text-ai shrink-0 mt-0.5">
            <FileText size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold font-display text-white">
                {doc.title}
              </h3>
              {doc.generator === "heuristic" && (
                <span
                  className="px-2 py-0.5 rounded-md bg-high/15 border border-high/30 text-[10px] font-mono text-high font-semibold flex items-center gap-1"
                  title="Extracted using deterministic patterns because AI was unavailable"
                >
                  <Sparkles size={10} />
                  Heuristic extraction (review carefully)
                </span>
              )}
            </div>
            <p className="text-xs text-muted font-mono mt-0.5">
              {doc.filename} · {doc.mime.includes("pdf") ? "PDF" : "DOCX"} ·{" "}
              {doc.page_count != null ? `${doc.page_count} pages` : "Word Document"}
            </p>
          </div>
        </div>

        {/* Status Pill */}
        <div className="flex items-center gap-2">
          {isProcessing && (
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-ai/10 border border-ai/30 text-ai text-xs font-mono">
              <RefreshCw size={11} className="animate-spin" />
              <span>Processing</span>
            </span>
          )}
          {isReady && !isPartial && (
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-success/15 border border-success/30 text-success text-xs font-mono font-semibold">
              <CheckCircle2 size={12} />
              <span>Ready</span>
            </span>
          )}
          {isPartial && (
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-high/15 border border-high/30 text-high text-xs font-mono font-semibold">
              <AlertTriangle size={12} />
              <span>Partial</span>
            </span>
          )}
          {isFailed && (
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-critical/15 border border-critical/30 text-critical text-xs font-mono font-semibold">
              <AlertCircle size={12} />
              <span>Failed</span>
            </span>
          )}
        </div>
      </div>

      {/* ── 4-STEP PROGRESS RAIL ────────────────────────────────────────── */}
      {!isFailed && (
        <div className="space-y-2 pt-1">
          <div className="grid grid-cols-4 gap-1.5 text-[10px] font-mono">
            {STAGES.map((s, idx) => {
              const done = idx <= currentStep;
              const current = idx === currentStep && isProcessing;
              return (
                <div key={s.id} className="flex flex-col gap-1">
                  <div
                    className={`h-1.5 rounded-full transition-all ${
                      done
                        ? "bg-ai"
                        : "bg-white/10"
                    } ${current ? "progress-sheen bg-ai/70" : ""}`}
                  />
                  <span
                    className={`truncate ${
                      done ? "text-white font-semibold" : "text-muted/60"
                    }`}
                  >
                    {s.label}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Subtext under rail */}
          <div className="flex items-center justify-between text-[11px] font-mono text-muted">
            <span>
              {isProcessing ? doc.stage : isReady ? `Extracted ${totalCount} candidate proposals` : "Queued for processing"}
            </span>
            {isProcessing && (
              <span className="tabular-nums">
                {doc.chunks_done}/{doc.chunks_total} chunks ({progressPercent}%)
              </span>
            )}
          </div>
        </div>
      )}

      {/* ── ERROR / WARNING BANNERS ─────────────────────────────────────── */}
      {isFailed && (
        <div className="p-3.5 rounded-xl bg-critical/10 border border-critical/30 flex items-center justify-between gap-3 text-xs text-critical font-mono">
          <div className="flex items-center gap-2">
            <AlertCircle size={15} className="shrink-0" />
            <span>{doc.error_message || "Document processing failed. Try a clean PDF or Word file."}</span>
          </div>
          {onRetryUpload && (
            <button
              onClick={() => onRetryUpload(doc.id)}
              className="px-3 py-1 rounded-lg bg-critical hover:bg-critical/90 text-black font-bold shrink-0 transition-colors"
            >
              Upload again
            </button>
          )}
        </div>
      )}

      {isPartial && doc.error_message && (
        <div className="p-3 rounded-xl bg-high/10 border border-high/30 flex items-center gap-2 text-xs text-high font-mono">
          <AlertTriangle size={14} className="shrink-0" />
          <span>Notice: {doc.error_message}</span>
        </div>
      )}

      {/* ── FOOTER STATS & CALL TO ACTION ───────────────────────────────── */}
      {isReady && (
        <div className="pt-3 border-t border-white/5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs font-mono">
            <span className="px-2 py-0.5 rounded-md bg-high/10 border border-high/20 text-high font-semibold">
              {pendingCount} pending
            </span>
            <span className="px-2 py-0.5 rounded-md bg-success/10 border border-success/20 text-success">
              {acceptedCount} accepted
            </span>
            <span className="px-2 py-0.5 rounded-md bg-critical/10 border border-critical/20 text-critical">
              {rejectedCount} rejected
            </span>
          </div>

          <button
            onClick={() => onReviewProposals(doc.id)}
            className="px-4 py-2 rounded-xl bg-primary hover:bg-primary/90 text-black text-xs font-bold flex items-center gap-1.5 transition-all shadow-md group"
          >
            <span>Review proposals</span>
            <ArrowRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
          </button>
        </div>
      )}
    </div>
  );
};
