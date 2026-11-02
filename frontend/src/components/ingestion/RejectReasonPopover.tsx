import React, { useState, useEffect, useRef } from "react";
import { AlertTriangle, X } from "lucide-react";
import type { RejectReason } from "../../types/round3";

interface RejectReasonPopoverProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reason: RejectReason, note?: string) => void;
  isSubmitting?: boolean;
}

const REJECT_OPTIONS: { id: RejectReason; label: string; desc: string }[] = [
  {
    id: "not_a_rule",
    label: "Not a rule",
    desc: "Descriptive marketing copy or narrative that should not be enforced.",
  },
  {
    id: "duplicate",
    label: "Duplicate",
    desc: "Matches an existing rule or fact already tracked in the governance center.",
  },
  {
    id: "incorrect_extraction",
    label: "Incorrect extraction",
    desc: "The parser misread or distorted the directive from the original document.",
  },
  {
    id: "out_of_scope",
    label: "Out of scope",
    desc: "Applies to internal logistics, operations, or non-marketing collateral.",
  },
  {
    id: "other",
    label: "Other reason",
    desc: "Custom rationale explained in the note below.",
  },
];

export const RejectReasonPopover: React.FC<RejectReasonPopoverProps> = ({
  isOpen,
  onClose,
  onConfirm,
  isSubmitting = false,
}) => {
  const [selectedReason, setSelectedReason] = useState<RejectReason>("not_a_rule");
  const [note, setNote] = useState("");
  const cancelBtnRef = useRef<HTMLButtonElement>(null);

  // Esc key and focus management (Reject is never default focus)
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        cancelBtnRef.current?.focus();
      }, 50);

      const handleKey = (e: KeyboardEvent) => {
        if (e.key === "Escape") {
          onClose();
        }
      };
      window.addEventListener("keydown", handleKey);
      return () => window.removeEventListener("keydown", handleKey);
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onConfirm(selectedReason, note.trim() || undefined);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="reject-popover-title"
    >
      <div className="relative w-full max-w-md bg-[#151511] border border-white/10 rounded-2xl p-6 shadow-2xl drawer-enter">
        <div className="flex items-center justify-between pb-3 border-b border-white/10">
          <div className="flex items-center gap-2 text-critical">
            <AlertTriangle size={18} />
            <h3 id="reject-popover-title" className="text-sm font-bold font-display text-white">
              Reject Proposal
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-muted hover:text-white rounded-lg transition-colors"
            aria-label="Close reject dialog"
          >
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div className="space-y-2">
            <label className="block text-xs font-mono uppercase text-muted">
              Select rejection rationale
            </label>
            <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
              {REJECT_OPTIONS.map((opt) => (
                <label
                  key={opt.id}
                  className={`flex items-start gap-3 p-3 rounded-xl border text-xs cursor-pointer transition-all ${
                    selectedReason === opt.id
                      ? "bg-critical/10 border-critical/40 text-white"
                      : "bg-[#1D1D18] border-white/5 text-muted hover:border-white/20"
                  }`}
                >
                  <input
                    type="radio"
                    name="reject_reason"
                    value={opt.id}
                    checked={selectedReason === opt.id}
                    onChange={() => setSelectedReason(opt.id)}
                    className="mt-0.5 text-critical focus:ring-0"
                  />
                  <div>
                    <span className="font-semibold block text-white">{opt.label}</span>
                    <span className="text-[11px] text-muted leading-tight block mt-0.5">
                      {opt.desc}
                    </span>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label htmlFor="reject-note" className="block text-xs font-mono uppercase text-muted mb-1">
              Decision Note (Optional)
            </label>
            <textarea
              id="reject-note"
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Provide context for the audit trail..."
              className="w-full px-3 py-2 bg-[#0E0E0B] border border-white/10 rounded-xl text-xs text-white placeholder-muted/50 focus:outline-none focus:border-critical font-mono"
            />
          </div>

          <div className="pt-2 flex items-center justify-end gap-2.5">
            <button
              ref={cancelBtnRef}
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-[#1D1D18] border border-white/10 text-xs font-semibold text-white hover:bg-white/10 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl bg-critical hover:bg-critical/90 text-black text-xs font-bold transition-all disabled:opacity-50"
            >
              {isSubmitting ? "Rejecting..." : "Confirm Rejection"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
