import React, { useState, useEffect } from "react";
import {
  Check,
  Edit3,
  XCircle,
  RotateCcw,
  Copy,
  GitFork,
  BookOpen,
} from "lucide-react";
import { SourceBadge } from "./SourceBadge";
import { RejectReasonPopover } from "./RejectReasonPopover";
import type { ProposalOut, RejectReason } from "../../types/round3";

interface ProposalDetailProps {
  proposal: ProposalOut;
  onAccept: (payload?: Record<string, unknown>, note?: string) => void;
  onReject: (reason: RejectReason, note?: string) => void;
  isDeciding?: boolean;
}

export const ProposalDetail: React.FC<ProposalDetailProps> = ({
  proposal,
  onAccept,
  onReject,
  isDeciding = false,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [showRejectPopover, setShowRejectPopover] = useState(false);
  const [decisionNote, setDecisionNote] = useState("");

  // Editable payload form state
  const isRule = proposal.proposal_type === "rule";
  const [editedPayload, setEditedPayload] = useState<Record<string, any>>({});
  const [phrasesInput, setPhrasesInput] = useState("");

  // Sync edited payload when proposal changes
  useEffect(() => {
    setIsEditing(false);
    setShowRejectPopover(false);
    setDecisionNote("");
    const initial = { ...proposal.payload };
    setEditedPayload(initial);
    if (Array.isArray(initial.phrases)) {
      setPhrasesInput(initial.phrases.join(", "));
    } else {
      setPhrasesInput("");
    }
  }, [proposal]);

  const handleResetToExtracted = () => {
    const initial = { ...proposal.payload };
    setEditedPayload(initial);
    if (Array.isArray(initial.phrases)) {
      setPhrasesInput(initial.phrases.join(", "));
    }
  };

  const handleAcceptWithEdits = () => {
    const finalPayload = { ...editedPayload };
    if (isRule && phrasesInput.trim()) {
      finalPayload.phrases = phrasesInput
        .split(",")
        .map((p) => p.trim())
        .filter(Boolean);
    }
    onAccept(finalPayload, decisionNote.trim() || undefined);
  };

  return (
    <div className="flex flex-col h-full overflow-y-auto space-y-6 p-6">
      {/* ── TOP: SOURCE PANEL (READ-ONLY) ─────────────────────────────── */}
      <div className="p-5 rounded-2xl bg-[#0E0E0B] border border-white/10 space-y-3.5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="p-1 rounded-md bg-ai/20 text-ai">
              <BookOpen size={14} />
            </span>
            <span className="text-xs font-mono font-bold text-white tracking-wide uppercase">
              Verbatim Document Evidence
            </span>
          </div>
          <SourceBadge source={proposal.source} />
        </div>

        {/* Source citation info */}
        <div className="text-[11px] font-mono text-muted flex items-center justify-between">
          <span>{proposal.source.citation}</span>
          <span className="capitalize">
            Extraction Confidence:{" "}
            <span
              className={`font-bold ${
                proposal.extraction_confidence === "high"
                  ? "text-success"
                  : proposal.extraction_confidence === "medium"
                  ? "text-high"
                  : "text-muted"
              }`}
            >
              {proposal.extraction_confidence}
            </span>
          </span>
        </div>

        {/* Excerpt in mono blockquote */}
        <blockquote className="p-3.5 rounded-xl bg-[#151511] border-l-2 border-ai/60 text-xs font-mono text-ink/90 leading-relaxed italic">
          “{proposal.source.excerpt}”
        </blockquote>

        {proposal.source.page == null && proposal.source.section && (
          <p className="text-[11px] text-muted/70 font-sans">
            Section “{proposal.source.section}”. Page numbers are not available in Word files.
          </p>
        )}

        {/* ── Contextual Warnings ─────────────────────────────────── */}
        {proposal.duplicate_of && (
          <div className="p-3 rounded-xl bg-high/10 border border-high/30 flex items-start gap-2.5 text-xs text-high">
            <Copy size={15} className="shrink-0 mt-0.5" />
            <div>
              <span className="font-bold block">Potential Duplicate Detected</span>
              Looks the same as rule <span className="font-mono font-bold underline">{proposal.duplicate_of}</span>. Consider rejecting as duplicate.
            </div>
          </div>
        )}

        {proposal.conflicts_with && (
          <div className="p-3 rounded-xl bg-critical/10 border border-critical/30 flex items-start gap-2.5 text-xs text-critical">
            <GitFork size={15} className="shrink-0 mt-0.5" />
            <div>
              <span className="font-bold block">Conflicting Specification</span>
              Differs from existing record <span className="font-mono font-bold underline">{proposal.conflicts_with}</span> for the same product. Accepting adds a second record; retire the old one afterwards.
            </div>
          </div>
        )}
      </div>

      {/* ── BOTTOM: PROPOSED RECORD PANEL ─────────────────────────────── */}
      <div className="p-5 rounded-2xl bg-[#151511] border border-white/10 space-y-4 flex-1 flex flex-col justify-between">
        <div className="space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-white/10">
            <div>
              <h3 className="text-sm font-bold font-display text-white">
                Proposed {proposal.proposal_type === "rule" ? "Rule" : "Fact"} Specification
              </h3>
              <p className="text-[11px] text-muted font-sans mt-0.5">
                Review extracted parameters before publishing to the live governance knowledge base.
              </p>
            </div>
            {proposal.status !== "pending" && (
              <span
                className={`text-[10px] font-mono font-bold uppercase px-2.5 py-1 rounded-md ${
                  proposal.status === "accepted"
                    ? "bg-success/20 text-success border border-success/40"
                    : "bg-critical/20 text-critical border border-critical/40"
                }`}
              >
                {proposal.status}
              </span>
            )}
          </div>

          {!isEditing ? (
            /* ── READ-ONLY VIEW ─────────────────────────────────────── */
            <div className="space-y-3.5">
              {isRule ? (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 rounded-xl bg-[#0E0E0B] border border-white/5">
                      <span className="text-[10px] font-mono uppercase text-muted block mb-1">
                        Rule Type
                      </span>
                      <span className="text-xs font-mono font-bold text-white capitalize">
                        {(proposal.payload?.type as string) || "General"}
                      </span>
                    </div>
                    <div className="p-3 rounded-xl bg-[#0E0E0B] border border-white/5">
                      <span className="text-[10px] font-mono uppercase text-muted block mb-1">
                        Severity
                      </span>
                      <span
                        className={`text-xs font-mono font-bold uppercase ${
                          proposal.payload?.severity === "critical"
                            ? "text-critical"
                            : proposal.payload?.severity === "high"
                            ? "text-high"
                            : "text-medium"
                        }`}
                      >
                        {(proposal.payload?.severity as string) || "medium"}
                      </span>
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl bg-[#0E0E0B] border border-white/5">
                    <span className="text-[10px] font-mono uppercase text-muted block mb-1">
                      Enforced Guideline Directive
                    </span>
                    <p className="text-xs text-white leading-relaxed font-sans">
                      {(proposal.payload?.message as string) || "—"}
                    </p>
                  </div>

                  {Boolean(proposal.payload?.suggestion) && (
                    <div className="p-3.5 rounded-xl bg-success/10 border border-success/20 text-xs font-mono text-success">
                      <span className="text-[9px] uppercase font-bold block mb-0.5">
                        Suggested Alternative:
                      </span>
                      {proposal.payload.suggestion as string}
                    </div>
                  )}

                  {Array.isArray(proposal.payload?.phrases) &&
                    proposal.payload.phrases.length > 0 && (
                      <div className="p-3.5 rounded-xl bg-[#0E0E0B] border border-white/5">
                        <span className="text-[10px] font-mono uppercase text-muted block mb-2">
                          Flagged Matching Phrases
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {proposal.payload.phrases.map((phrase: string, idx: number) => (
                            <span
                              key={idx}
                              className="px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-[11px] font-mono text-primary"
                            >
                              "{phrase}"
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                </>
              ) : (
                /* Fact view */
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 rounded-xl bg-[#0E0E0B] border border-white/5">
                      <span className="text-[10px] font-mono uppercase text-muted block mb-1">
                        Topic & Subject
                      </span>
                      <span className="text-xs font-mono font-bold text-white">
                        {String(proposal.payload?.subject || "—")}{" "}
                        <span className="text-muted font-normal">
                          ({String(proposal.payload?.topic || "general")})
                        </span>
                      </span>
                    </div>
                    <div className="p-3 rounded-xl bg-[#0E0E0B] border border-white/5">
                      <span className="text-[10px] font-mono uppercase text-muted block mb-1">
                        Record Type
                      </span>
                      <span className="text-xs font-mono font-bold text-ai capitalize">
                        Fact Specification
                      </span>
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl bg-[#0E0E0B] border border-white/5">
                    <span className="text-[10px] font-mono uppercase text-muted block mb-1">
                      Factual Ground Truth Statement
                    </span>
                    <p className="text-xs text-white leading-relaxed font-sans">
                      {String(proposal.payload?.statement || "—")}
                    </p>
                  </div>

                  {Boolean(proposal.payload?.structured_value) && (
                    <div className="p-3.5 rounded-xl bg-[#0E0E0B] border border-white/5">
                      <span className="text-[10px] font-mono uppercase text-muted block mb-1.5">
                        Structured Key-Value Map
                      </span>
                      <pre className="p-2.5 rounded-lg bg-black border border-white/5 text-[11px] font-mono text-primary overflow-x-auto">
                        {JSON.stringify(proposal.payload.structured_value, null, 2)}
                      </pre>
                    </div>
                  )}
                </>
              )}
            </div>
          ) : (
            /* ── EDIT FORM VIEW ─────────────────────────────────────── */
            <div className="space-y-3.5">
              {isRule ? (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-mono uppercase text-muted mb-1">
                        Rule Type
                      </label>
                      <input
                        type="text"
                        value={editedPayload.type || ""}
                        onChange={(e) =>
                          setEditedPayload({ ...editedPayload, type: e.target.value })
                        }
                        className="w-full px-3 py-2 bg-[#0E0E0B] border border-white/10 rounded-xl text-xs text-white font-mono focus:border-ai outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-mono uppercase text-muted mb-1">
                        Severity
                      </label>
                      <select
                        value={editedPayload.severity || "medium"}
                        onChange={(e) =>
                          setEditedPayload({ ...editedPayload, severity: e.target.value })
                        }
                        className="w-full px-3 py-2 bg-[#0E0E0B] border border-white/10 rounded-xl text-xs text-white font-mono focus:border-ai outline-none"
                      >
                        <option value="critical">Critical</option>
                        <option value="high">High</option>
                        <option value="medium">Medium</option>
                        <option value="low">Low</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-mono uppercase text-muted mb-1">
                      Guideline Directive (Message)
                    </label>
                    <textarea
                      rows={3}
                      value={editedPayload.message || ""}
                      onChange={(e) =>
                        setEditedPayload({ ...editedPayload, message: e.target.value })
                      }
                      className="w-full px-3 py-2 bg-[#0E0E0B] border border-white/10 rounded-xl text-xs text-white font-sans focus:border-ai outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-mono uppercase text-muted mb-1">
                      Approved Brand Alternative (Suggestion)
                    </label>
                    <input
                      type="text"
                      value={editedPayload.suggestion || ""}
                      onChange={(e) =>
                        setEditedPayload({ ...editedPayload, suggestion: e.target.value })
                      }
                      className="w-full px-3 py-2 bg-[#0E0E0B] border border-white/10 rounded-xl text-xs text-white font-mono focus:border-ai outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-mono uppercase text-muted mb-1">
                      Flagged Phrases (comma separated)
                    </label>
                    <input
                      type="text"
                      value={phrasesInput}
                      onChange={(e) => setPhrasesInput(e.target.value)}
                      placeholder="e.g. world's best, unmatched, number one"
                      className="w-full px-3 py-2 bg-[#0E0E0B] border border-white/10 rounded-xl text-xs text-white font-mono focus:border-ai outline-none"
                    />
                  </div>
                </>
              ) : (
                /* Fact edit */
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-mono uppercase text-muted mb-1">
                        Topic
                      </label>
                      <input
                        type="text"
                        value={editedPayload.topic || ""}
                        onChange={(e) =>
                          setEditedPayload({ ...editedPayload, topic: e.target.value })
                        }
                        className="w-full px-3 py-2 bg-[#0E0E0B] border border-white/10 rounded-xl text-xs text-white font-mono focus:border-ai outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-mono uppercase text-muted mb-1">
                        Subject
                      </label>
                      <input
                        type="text"
                        value={editedPayload.subject || ""}
                        onChange={(e) =>
                          setEditedPayload({ ...editedPayload, subject: e.target.value })
                        }
                        className="w-full px-3 py-2 bg-[#0E0E0B] border border-white/10 rounded-xl text-xs text-white font-mono focus:border-ai outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-mono uppercase text-muted mb-1">
                      Ground Truth Statement
                    </label>
                    <textarea
                      rows={3}
                      value={editedPayload.statement || ""}
                      onChange={(e) =>
                        setEditedPayload({ ...editedPayload, statement: e.target.value })
                      }
                      className="w-full px-3 py-2 bg-[#0E0E0B] border border-white/10 rounded-xl text-xs text-white font-sans focus:border-ai outline-none"
                    />
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* ── ACTION CONTROLS ────────────────────────────────────────── */}
        <div className="pt-4 border-t border-white/10 flex items-center justify-between gap-3">
          {!isEditing ? (
            <>
              <button
                type="button"
                onClick={() => setShowRejectPopover(true)}
                disabled={isDeciding || proposal.status !== "pending"}
                className="px-3.5 py-2 rounded-xl bg-critical/10 hover:bg-critical/20 border border-critical/30 text-critical text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-40"
              >
                <XCircle size={14} />
                <span>Reject</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsEditing(true)}
                  disabled={isDeciding || proposal.status !== "pending"}
                  className="px-3.5 py-2 rounded-xl bg-[#1D1D18] hover:bg-white/10 border border-white/10 text-xs font-semibold text-white flex items-center gap-1.5 transition-colors disabled:opacity-40"
                >
                  <Edit3 size={14} />
                  <span>Edit Proposal</span>
                </button>

                <button
                  type="button"
                  onClick={() => onAccept()}
                  disabled={isDeciding || proposal.status !== "pending"}
                  className="px-4 py-2 rounded-xl bg-primary hover:bg-primary/90 text-black text-xs font-bold flex items-center gap-1.5 transition-all shadow-md disabled:opacity-40"
                >
                  <Check size={14} strokeWidth={2.5} />
                  <span>{isDeciding ? "Publishing..." : "Accept & Publish"}</span>
                </button>
              </div>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={handleResetToExtracted}
                className="px-3 py-2 rounded-xl text-xs font-mono text-muted hover:text-white flex items-center gap-1 transition-colors"
              >
                <RotateCcw size={13} />
                <span>Reset to Extracted</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="px-3.5 py-2 rounded-xl bg-[#1D1D18] border border-white/10 text-xs font-semibold text-white hover:bg-white/10 transition-colors"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={handleAcceptWithEdits}
                  disabled={isDeciding}
                  className="px-4 py-2 rounded-xl bg-primary hover:bg-primary/90 text-black text-xs font-bold flex items-center gap-1.5 transition-all shadow-md"
                >
                  <Check size={14} strokeWidth={2.5} />
                  <span>{isDeciding ? "Publishing..." : "Accept with Edits"}</span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Reject Reason Popover modal */}
      <RejectReasonPopover
        isOpen={showRejectPopover}
        onClose={() => setShowRejectPopover(false)}
        onConfirm={(reason, note) => {
          setShowRejectPopover(false);
          onReject(reason, note);
        }}
        isSubmitting={isDeciding}
      />
    </div>
  );
};
