import React, { useState } from "react";
import { X, CheckCircle, AlertTriangle, ShieldCheck, Send } from "lucide-react";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (decision: "approve" | "request_revision", comment: string, overrideReason?: string) => Promise<void>;
  hasOpenFindings: boolean;
  submissionTitle: string;
}

export const DecisionModal: React.FC<Props> = ({
  isOpen,
  onClose,
  onSubmit,
  hasOpenFindings,
  submissionTitle,
}) => {
  const [decision, setDecision] = useState<"approve" | "request_revision">("approve");
  const [comment, setComment] = useState("");
  const [overrideReason, setOverrideReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!comment.trim()) {
      setError("Review comments are mandatory for compliance auditability.");
      return;
    }

    if (decision === "approve" && hasOpenFindings && !overrideReason.trim()) {
      setError("An explicit override justification is mandatory when approving drafts with open findings.");
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      await onSubmit(decision, comment, overrideReason.trim() ? overrideReason : undefined);
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to submit review decision.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-lg rounded-2xl bg-[#1D1D18] border border-line p-6 shadow-2xl text-ink">
        <div className="flex items-center justify-between pb-4 border-b border-line">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-primary/20 text-primary">
              <ShieldCheck size={18} />
            </span>
            <h3 className="text-base font-bold font-display text-white">Reviewer Compliance Decision</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-muted hover:text-white hover:bg-white/10 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <span className="text-[10px] uppercase font-mono text-muted">Submission</span>
            <p className="text-sm font-semibold text-white mt-0.5">{submissionTitle}</p>
          </div>

          {/* Decision Selector */}
          <div>
            <label className="text-xs font-semibold text-muted block mb-2">Decision</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setDecision("approve")}
                className={`p-3 rounded-xl border text-left flex items-center gap-2.5 transition-all ${
                  decision === "approve"
                    ? "bg-success/15 border-success text-success font-semibold shadow-sm"
                    : "bg-card border-line text-muted hover:text-white"
                }`}
              >
                <CheckCircle size={16} />
                <div>
                  <div className="text-xs">Approve Draft</div>
                  <div className="text-[10px] opacity-75">Authorize for release</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setDecision("request_revision")}
                className={`p-3 rounded-xl border text-left flex items-center gap-2.5 transition-all ${
                  decision === "request_revision"
                    ? "bg-high/15 border-high text-high font-semibold shadow-sm"
                    : "bg-card border-line text-muted hover:text-white"
                }`}
              >
                <AlertTriangle size={16} />
                <div>
                  <div className="text-xs">Request Revision</div>
                  <div className="text-[10px] opacity-75">Return with feedback</div>
                </div>
              </button>
            </div>
          </div>

          {/* Warning banner if approving with open findings */}
          {decision === "approve" && hasOpenFindings && (
            <div className="p-3 rounded-xl bg-high/10 border border-high/30 text-high text-xs">
              <div className="flex items-center gap-1.5 font-bold mb-1">
                <AlertTriangle size={14} />
                <span>Override Warning</span>
              </div>
              <p className="text-[11px] leading-relaxed">
                This submission contains open or flagged findings. Approving it requires an explicit
                override justification recorded in the immutable audit trail.
              </p>
            </div>
          )}

          {/* Override Reason Field */}
          {decision === "approve" && hasOpenFindings && (
            <div>
              <label className="text-xs font-semibold text-high block mb-1">
                Mandatory Override Justification *
              </label>
              <textarea
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
                rows={2}
                placeholder="e.g., Reviewed by VP of Brand; marketing campaign has legal exemption #402."
                className="w-full p-2.5 bg-[#0E0E0B] border border-high/40 rounded-xl text-xs text-white placeholder-muted/50 focus:outline-none focus:border-high"
                required
              />
            </div>
          )}

          {/* Review Comment */}
          <div>
            <label className="text-xs font-semibold text-muted block mb-1">
              Reviewer Notes / Feedback *
            </label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={3}
              placeholder="Provide constructive context for the creator..."
              className="w-full p-2.5 bg-[#0E0E0B] border border-line rounded-xl text-xs text-white placeholder-muted/50 focus:outline-none focus:border-primary"
              required
            />
          </div>

          {error && (
            <div className="p-2.5 rounded-lg bg-critical/10 border border-critical/30 text-critical text-xs">
              {error}
            </div>
          )}

          <div className="pt-3 border-t border-line flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg bg-card hover:bg-white/10 border border-line text-xs text-muted hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className={`px-4 py-2 rounded-lg font-semibold text-xs flex items-center gap-1.5 transition-all ${
                decision === "approve"
                  ? "bg-success text-black hover:bg-success/90"
                  : "bg-high text-black hover:bg-high/90"
              } disabled:opacity-50`}
            >
              <Send size={13} />
              <span>{isSubmitting ? "Submitting..." : "Confirm Decision"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
