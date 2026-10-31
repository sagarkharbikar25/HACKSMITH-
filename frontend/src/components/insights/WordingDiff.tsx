import React from "react";
import type { RuleWording } from "../../types/round3";
import { Plus } from "lucide-react";

interface WordingDiffProps {
  currentWording: RuleWording;
  proposedWording: RuleWording;
  className?: string;
}

export const WordingDiff: React.FC<WordingDiffProps> = ({
  currentWording,
  proposedWording,
  className = "",
}) => {
  return (
    <div className={`space-y-3 font-sans text-xs ${className}`}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
        {/* Current Wording (Read-only reference) */}
        <div className="p-3.5 rounded-xl bg-[#0E0E0B] border border-white/5 space-y-2">
          <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-wider text-muted font-bold">
            <span>Current Active Wording</span>
            <span className="text-high">Baseline</span>
          </div>

          <div className="space-y-1.5 font-mono text-[11px] text-muted">
            <p className="line-through opacity-70">
              {currentWording.message}
            </p>
            {currentWording.suggestion && (
              <p className="text-[10px] text-muted/60 italic">
                Suggestion: {currentWording.suggestion}
              </p>
            )}
          </div>
        </div>

        {/* Proposed Wording (With highlights & added exceptions) */}
        <div className="p-3.5 rounded-xl bg-[#12120E] border border-ai/30 space-y-2 shadow-sm">
          <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-wider text-ai font-bold">
            <span>AI Improved Wording</span>
            <span className="text-success font-semibold flex items-center gap-1">
              <Plus size={11} /> Clarified
            </span>
          </div>

          <div className="space-y-1.5 font-mono text-[11px] text-white">
            <p className="underline decoration-ai underline-offset-4 leading-relaxed">
              {proposedWording.message}
            </p>
            {proposedWording.suggestion && (
              <p className="text-[10px] text-ai/80 italic font-mono">
                Suggestion: {proposedWording.suggestion}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Added Explicit Exceptions Chips */}
      {proposedWording.added_exceptions && proposedWording.added_exceptions.length > 0 && (
        <div className="pt-2 flex items-center gap-2 text-xs font-mono">
          <span className="text-muted text-[11px]">Explicit Exceptions Added:</span>
          <div className="flex flex-wrap gap-1.5">
            {proposedWording.added_exceptions.map((exc, idx) => (
              <span
                key={idx}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-success/15 border border-success/30 text-[10px] font-bold text-success"
              >
                <Plus size={10} />
                <span>"{exc}"</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
