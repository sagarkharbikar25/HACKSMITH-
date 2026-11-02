import React, { useState } from "react";
import {
  Sparkles,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  RefreshCw,
  RotateCcw,
  Flag,
  FileQuestion,
} from "lucide-react";
import { WordingDiff } from "./WordingDiff";
import { AdoptWordingModal } from "./AdoptWordingModal";
import type { GapSuggestionOut, RuleWording } from "../../types/round3";

interface GapSuggestionsCardProps {
  suggestions: GapSuggestionOut[];
  onAdopt: (suggestionId: number, proposedWording?: RuleWording) => Promise<void>;
  onDismiss: (suggestionId: number) => Promise<void>;
  onUndo: (suggestionId: number) => Promise<void>;
  onGenerate: () => Promise<void>;
  isGenerating?: boolean;
  isReadOnly?: boolean;
  className?: string;
  focusedRuleId?: string | null;
}

export const GapSuggestionsCard: React.FC<GapSuggestionsCardProps> = ({
  suggestions,
  onAdopt,
  onDismiss,
  onUndo,
  onGenerate,
  isGenerating = false,
  isReadOnly = false,
  className = "",
  focusedRuleId = null,
}) => {
  // First item or focused item expanded by default
  const [expandedIds, setExpandedIds] = useState<Set<number>>(() => {
    const initial = new Set<number>();
    if (focusedRuleId) {
      const match = suggestions.find((s) => s.rule_id === focusedRuleId);
      if (match) initial.add(match.id);
    } else if (suggestions.length > 0) {
      initial.add(suggestions[0].id);
    }
    return initial;
  });

  const [expandedClusterKey, setExpandedClusterKey] = useState<string | null>(null);
  const [modalSuggestion, setModalSuggestion] = useState<GapSuggestionOut | null>(null);

  const toggleExpand = (id: number) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const pendingSuggestions = suggestions.filter((s) => s.status === "pending");
  const adoptedSuggestions = suggestions.filter((s) => s.status === "adopted");

  return (
    <div
      id="guideline-gap-suggestions"
      className={`rounded-2xl bg-[#12120E] border border-white/10 overflow-hidden shadow-lg space-y-4 ${className}`}
    >
      {/* ── HEADER ────────────────────────────────────────────────────── */}
      <div className="p-5 sm:px-6 bg-[#151511] border-b border-white/10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold font-display text-white tracking-tight">
              Guideline Gap Suggestions
            </h2>
            <span className="px-2 py-0.5 rounded-md bg-ai/10 border border-ai/20 text-[10px] font-mono text-ai font-semibold flex items-center gap-1">
              <Sparkles size={11} /> Round 3 Self-Healing Rules
            </span>
          </div>
          <p className="text-xs text-muted font-sans mt-0.5">
            Rules people keep disputing. AI suggests clearer wording and explicit exceptions.
          </p>
        </div>

        {!isReadOnly && (
          <button
            type="button"
            onClick={onGenerate}
            disabled={isGenerating}
            className="px-3.5 py-2 rounded-xl bg-[#1D1D18] hover:bg-white/10 border border-white/10 text-xs font-semibold text-white flex items-center gap-2 transition-colors disabled:opacity-40 shrink-0"
          >
            <RefreshCw size={13} className={isGenerating ? "animate-spin text-ai" : "text-muted"} />
            <span>{isGenerating ? "Analysing disputed rules… (up to 20 s)" : "Analyse Again"}</span>
          </button>
        )}
      </div>

      {/* ── CONTENT AREA ──────────────────────────────────────────────── */}
      <div className="p-5 sm:px-6 pt-0 space-y-4">
        {suggestions.length === 0 ? (
          <div className="p-8 rounded-xl bg-[#0E0E0B] border border-white/5 text-center space-y-3">
            <FileQuestion size={28} className="mx-auto text-muted/60" />
            <div className="space-y-1">
              <p className="text-xs font-semibold text-white">No unclear rules detected yet</p>
              <p className="text-[11px] text-muted font-sans max-w-sm mx-auto">
                Rules that are frequently dismissed or overridden by reviewers will appear here with
                suggested wording improvements.
              </p>
            </div>
            {!isReadOnly && (
              <button
                type="button"
                onClick={onGenerate}
                disabled={isGenerating}
                className="px-4 py-2 rounded-xl bg-primary hover:bg-primary/90 text-black text-xs font-bold font-sans transition-all shadow-md"
              >
                {isGenerating ? "Analyzing..." : "Analyse Now"}
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {/* Pending Suggestions List */}
            {pendingSuggestions.map((suggestion, idx) => {
              const isExpanded = expandedIds.has(suggestion.id);
              const isFirstLime = idx === 0; // Strict rule: Lime CTA max once per screen

              const dismissalRatePct = Math.round(suggestion.stats.dismissal_rate * 100);

              return (
                <div
                  key={suggestion.id}
                  className={`rounded-xl border transition-all ${
                    isExpanded
                      ? "bg-[#151511] border-white/20 shadow-md"
                      : "bg-[#0E0E0B] border-white/5 hover:border-white/15"
                  }`}
                >
                  {/* Row Header / Accordion trigger */}
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => toggleExpand(suggestion.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        toggleExpand(suggestion.id);
                      }
                    }}
                    className="p-4 flex items-center justify-between gap-3 cursor-pointer select-none outline-none"
                  >
                    <div className="flex flex-wrap items-center gap-2.5">
                      <span className="font-mono text-xs font-bold text-white bg-white/5 px-2 py-0.5 rounded border border-white/10">
                        {suggestion.rule_id}
                      </span>
                      <span className="text-xs font-semibold text-ink">{suggestion.rule_label}</span>

                      <span className="px-2 py-0.5 rounded-full bg-high/15 border border-high/30 text-high text-[10px] font-mono font-bold flex items-center gap-1">
                        <Flag size={10} /> Frequently disputed
                      </span>

                      {suggestion.generator === "heuristic" ? (
                        <span
                          className="px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-[10px] font-mono text-muted"
                          title="Derived from dismissed examples because AI wording wasn't available."
                        >
                          Rule-based suggestion
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-md bg-ai/10 border border-ai/20 text-[10px] font-mono text-ai flex items-center gap-1">
                          <Sparkles size={10} /> AI-suggested
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-[11px] font-mono text-muted hidden md:inline">
                        Fired {suggestion.stats.fired} · Dismissed {suggestion.stats.dismissed} (
                        {dismissalRatePct}%) · Overridden {suggestion.stats.overridden}
                      </span>
                      {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </div>
                  </div>

                  {/* Expanded Body */}
                  {isExpanded && (
                    <div className="px-4 pb-4 pt-1 space-y-4 border-t border-white/5">
                      {/* Cluster chips: why it's disputed */}
                      <div className="space-y-1.5 pt-2">
                        <span className="text-[10px] font-mono uppercase tracking-wider text-muted font-bold block">
                          Why people dispute this rule:
                        </span>
                        <div className="flex flex-wrap gap-2">
                          {suggestion.clusters.map((cluster, cIdx) => {
                            const clusterKey = `${suggestion.id}-${cIdx}`;
                            const isClusterOpen = expandedClusterKey === clusterKey;

                            return (
                              <div key={cIdx} className="space-y-1.5">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setExpandedClusterKey(isClusterOpen ? null : clusterKey)
                                  }
                                  className="px-2.5 py-1 rounded-lg bg-[#1D1D18] hover:bg-white/10 border border-white/10 text-xs font-mono text-white flex items-center gap-1.5 transition-colors"
                                >
                                  <span>▸ "{cluster.label}"</span>
                                  <span className="text-ai font-bold">×{cluster.count}</span>
                                </button>

                                {/* Cluster Example Excerpts (Max 5, truncated 120 chars) */}
                                {isClusterOpen && (
                                  <div className="p-3 rounded-xl bg-[#0E0E0B] border border-white/10 text-[11px] font-mono space-y-1.5 animate-fadeIn max-w-md">
                                    <span className="text-[10px] text-muted uppercase block font-bold">
                                      Flagged excerpts in drafts:
                                    </span>
                                    {cluster.examples.slice(0, 5).map((ex, exIdx) => (
                                      <p key={exIdx} className="text-muted/90 truncate italic">
                                        “{ex.slice(0, 120)}”
                                      </p>
                                    ))}
                                    <div className="pt-1 text-[10px] text-muted flex gap-1">
                                      <span>Reasons given:</span>
                                      <span className="text-white">{cluster.reasons.join(" · ")}</span>
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Side-by-side Wording Diff */}
                      <WordingDiff
                        currentWording={suggestion.current_wording}
                        proposedWording={suggestion.proposed_wording}
                      />

                      {/* Rationale explanation */}
                      <div className="p-3 rounded-xl bg-[#0E0E0B] border border-white/5 text-xs font-sans text-muted leading-relaxed">
                        <span className="font-mono font-bold text-white block mb-0.5 text-[11px]">
                          Rationale:
                        </span>
                        {suggestion.rationale}
                      </div>

                      {/* Action buttons */}
                      {!isReadOnly && (
                        <div className="pt-2 flex items-center justify-end gap-2.5">
                          <button
                            type="button"
                            onClick={() => onDismiss(suggestion.id)}
                            className="px-3.5 py-2 rounded-xl bg-[#1D1D18] hover:bg-white/10 border border-white/10 text-xs font-semibold text-muted hover:text-white transition-colors"
                          >
                            Dismiss
                          </button>

                          <button
                            type="button"
                            onClick={() => setModalSuggestion(suggestion)}
                            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-1.5 ${
                              isFirstLime
                                ? "bg-primary text-black hover:bg-primary/90"
                                : "bg-white/15 text-white hover:bg-white/25 border border-white/20"
                            }`}
                          >
                            <Sparkles size={13} />
                            <span>Adopt Improved Rule Wording</span>
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Adopted Suggestions Collapsed List */}
            {adoptedSuggestions.length > 0 && (
              <div className="pt-4 border-t border-white/10 space-y-2">
                <span className="text-[10px] font-mono uppercase tracking-wider text-muted font-bold block">
                  Adopted Improvements ({adoptedSuggestions.length})
                </span>
                <div className="space-y-2">
                  {adoptedSuggestions.map((suggestion) => (
                    <div
                      key={suggestion.id}
                      className="p-3.5 rounded-xl bg-[#151511] border border-white/5 flex items-center justify-between gap-3 text-xs font-mono"
                    >
                      <div className="flex items-center gap-2">
                        <CheckCircle2 size={14} className="text-success" />
                        <span className="font-bold text-white">{suggestion.rule_id}</span>
                        <span className="text-muted">· {suggestion.rule_label}</span>
                        <span className="text-[10px] text-success bg-success/15 px-2 py-0.5 rounded">
                          Wording Adopted
                        </span>
                      </div>

                      {!isReadOnly && (
                        <button
                          type="button"
                          onClick={() => onUndo(suggestion.id)}
                          className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-muted hover:text-white text-[11px] flex items-center gap-1 transition-colors"
                        >
                          <RotateCcw size={11} />
                          <span>Undo adoption</span>
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── 1-CLICK ADOPT WORDING MODAL ─────────────────────────────────── */}
      {modalSuggestion && (
        <AdoptWordingModal
          suggestion={modalSuggestion}
          isOpen={modalSuggestion != null}
          onClose={() => setModalSuggestion(null)}
          onConfirmAdopt={onAdopt}
          onRegenerateFresh={onGenerate}
        />
      )}
    </div>
  );
};
