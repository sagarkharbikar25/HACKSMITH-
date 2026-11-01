import React, { useState } from "react";
import { X, Check, AlertTriangle, RefreshCw, Sparkles } from "lucide-react";
import { WordingDiff } from "./WordingDiff";
import type { GapSuggestionOut, RuleWording } from "../../types/round3";

interface AdoptWordingModalProps {
  suggestion: GapSuggestionOut;
  isOpen: boolean;
  onClose: () => void;
  onConfirmAdopt: (suggestionId: number, proposedWording?: RuleWording) => Promise<void>;
  onRegenerateFresh?: () => void;
}

export const AdoptWordingModal: React.FC<AdoptWordingModalProps> = ({
  suggestion,
  isOpen,
  onClose,
  onConfirmAdopt,
  onRegenerateFresh,
}) => {
  const [editedMessage, setEditedMessage] = useState(suggestion.proposed_wording.message);
  const [editedSuggestion, setEditedSuggestion] = useState(
    suggestion.proposed_wording.suggestion || ""
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isStale, setIsStale] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);

    const hasChanged =
      editedMessage !== suggestion.proposed_wording.message ||
      editedSuggestion !== (suggestion.proposed_wording.suggestion || "");

    const customWording: RuleWording | undefined = hasChanged
      ? {
          ...suggestion.proposed_wording,
          message: editedMessage,
          suggestion: editedSuggestion || null,
        }
      : undefined;

    try {
      await onConfirmAdopt(suggestion.id, customWording);
      onClose();
    } catch (err: any) {
      if (err.code === "GAP_SUGGESTION_STALE") {
        setIsStale(true);
      } else {
        setErrorMessage(
          err.message || "Failed to adopt improved rule wording. Please try again."
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="adopt-modal-title"
    >
      <div className="relative w-full max-w-2xl bg-[#151511] border border-white/10 rounded-2xl p-6 shadow-2xl drawer-enter space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <span className="p-1.5 rounded-lg bg-ai/20 text-ai">
              <Sparkles size={16} />
            </span>
            <div>
              <h2 id="adopt-modal-title" className="text-base font-bold font-display text-white">
                Adopt Improved Wording for {suggestion.rule_id}?
              </h2>
              <p className="text-xs text-muted font-mono mt-0.5">{suggestion.rule_label}</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-md text-muted hover:text-white hover:bg-white/10 transition-colors"
            aria-label="Close modal"
          >
            <X size={18} />
          </button>
        </div>

        {/* Stale State Banner */}
        {isStale ? (
          <div className="p-4 rounded-xl bg-high/10 border border-high/30 space-y-3 text-xs font-mono text-high">
            <div className="flex items-center gap-2">
              <AlertTriangle size={16} />
              <span className="font-bold">This suggestion is now stale</span>
            </div>
            <p className="text-muted font-sans">
              Rule {suggestion.rule_id} was modified after this AI suggestion was generated.
              Generate fresh suggestions to match the latest governance rulebook.
            </p>
            <button
              type="button"
              onClick={() => {
                onRegenerateFresh?.();
                onClose();
              }}
              className="px-3.5 py-1.5 rounded-lg bg-high hover:bg-high/90 text-black font-bold flex items-center gap-1.5 transition-colors"
            >
              <RefreshCw size={13} />
              <span>Generate Fresh Suggestions</span>
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Visual Diff View */}
            <WordingDiff
              currentWording={suggestion.current_wording}
              proposedWording={suggestion.proposed_wording}
            />

            {/* Optional tweaks */}
            <div className="space-y-3 pt-2 border-t border-white/5">
              <div>
                <label className="block text-[11px] font-mono uppercase text-muted mb-1">
                  Enforced Rule Message (Optional tweak)
                </label>
                <textarea
                  rows={2}
                  value={editedMessage}
                  onChange={(e) => setEditedMessage(e.target.value)}
                  className="w-full px-3 py-2 bg-[#0E0E0B] border border-white/10 rounded-xl text-xs text-white font-mono focus:border-ai outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-mono uppercase text-muted mb-1">
                  Recommended Alternative / Suggestion
                </label>
                <input
                  type="text"
                  value={editedSuggestion}
                  onChange={(e) => setEditedSuggestion(e.target.value)}
                  className="w-full px-3 py-2 bg-[#0E0E0B] border border-white/10 rounded-xl text-xs text-white font-mono focus:border-ai outline-none"
                />
              </div>
            </div>

            {/* Error Message */}
            {errorMessage && (
              <div className="p-3 rounded-xl bg-critical/10 border border-critical/30 flex items-center gap-2 text-xs text-critical font-mono">
                <AlertTriangle size={14} className="shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Confirm Actions */}
            <div className="pt-3 border-t border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <span className="text-[11px] text-muted font-sans">
                Changes take effect on the next audit. Past findings aren't changed. You can undo this.
              </span>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-3.5 py-2 rounded-xl bg-[#1D1D18] hover:bg-white/10 border border-white/10 text-xs font-semibold text-white transition-colors"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={isSubmitting || !editedMessage.trim()}
                  className="px-4 py-2 rounded-xl bg-primary hover:bg-primary/90 text-black text-xs font-bold flex items-center gap-1.5 transition-all shadow-md disabled:opacity-40"
                >
                  <Check size={14} strokeWidth={2.5} />
                  <span>{isSubmitting ? "Updating Rule..." : "Adopt Wording"}</span>
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

