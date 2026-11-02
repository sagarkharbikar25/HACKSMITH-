import React, { useState } from "react";
import { X, Plus, ShieldCheck, AlertCircle } from "lucide-react";
import { createRule } from "../../api/knowledge";
import type { Rule } from "../../types";

interface CreateRuleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRuleCreated: (rule: Rule) => void;
}

export const CreateRuleModal: React.FC<CreateRuleModalProps> = ({
  isOpen,
  onClose,
  onRuleCreated,
}) => {
  const [ruleType, setRuleType] = useState<"claim" | "phrase" | "term" | "tone">("claim");
  const [severity, setSeverity] = useState<"critical" | "high" | "medium" | "low">("high");
  const [brandTag, setBrandTag] = useState("Lumora");
  const [message, setMessage] = useState("");
  const [phrases, setPhrases] = useState("");
  const [suggestion, setSuggestion] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) {
      setError("Please provide a clear rule directive statement.");
      return;
    }

    const phraseList = phrases
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean);

    const tags = [
      brandTag.trim() ? `brand:${brandTag.trim().toLowerCase()}` : "brand:lumora",
      ruleType,
      "custom_rule",
    ];

    setIsSubmitting(true);
    setError(null);

    try {
      const payload: Record<string, unknown> = {
        type: ruleType,
        severity,
        message: message.trim(),
        suggestion: suggestion.trim() || undefined,
        pattern: {
          phrases: phraseList.length > 0 ? phraseList : [message.trim().slice(0, 30)],
        },
        tags,
      };

      const newRule = await createRule(payload);
      onRuleCreated(newRule);
      onClose();
    } catch (err: any) {
      setError(err?.message || "Failed to create rule. Please check input values.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-xl rounded-2xl bg-[#141410] border border-white/10 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-white/10 bg-[#181813]">
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-primary/15 text-primary">
              <ShieldCheck size={18} />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold font-display text-white">
                  Create Custom Brand Rule
                </h3>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-primary/20 text-primary border border-primary/30">
                  Brand Governance
                </span>
              </div>
              <p className="text-xs text-muted mt-0.5">
                Author new compliance requirements enforced during live creator audits.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted hover:text-white hover:bg-white/10 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs font-sans">
          {error && (
            <div className="p-3 rounded-xl bg-critical/10 border border-critical/30 flex items-center gap-2 text-critical font-mono text-xs">
              <AlertCircle size={14} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Type & Severity Row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-mono uppercase tracking-wider text-muted mb-1 font-semibold">
                Rule Category
              </label>
              <select
                value={ruleType}
                onChange={(e) => setRuleType(e.target.value as any)}
                className="w-full px-3 py-2 rounded-xl bg-[#1D1D18] border border-white/10 text-white font-mono text-xs focus:outline-none focus:border-primary"
              >
                <option value="claim">Claim (Substantiation)</option>
                <option value="phrase">Phrase (Banned words)</option>
                <option value="term">Term (Brand Nomenclature)</option>
                <option value="tone">Tone (Voice & Style)</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-mono uppercase tracking-wider text-muted mb-1 font-semibold">
                Severity Level
              </label>
              <select
                value={severity}
                onChange={(e) => setSeverity(e.target.value as any)}
                className="w-full px-3 py-2 rounded-xl bg-[#1D1D18] border border-white/10 text-white font-mono text-xs focus:outline-none focus:border-primary"
              >
                <option value="critical">Critical (Blocks submission)</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-mono uppercase tracking-wider text-muted mb-1 font-semibold">
                Brand Scope
              </label>
              <input
                type="text"
                placeholder="e.g. Lumora"
                value={brandTag}
                onChange={(e) => setBrandTag(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-[#1D1D18] border border-white/10 text-white font-mono text-xs focus:outline-none focus:border-primary"
              />
            </div>
          </div>

          {/* Rule Message / Directive */}
          <div>
            <label className="block text-[11px] font-mono uppercase tracking-wider text-muted mb-1 font-semibold">
              Rule Directive / Requirement *
            </label>
            <textarea
              rows={2}
              placeholder="e.g. Do not claim 100% waterproof without citing laboratory test certification."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#1D1D18] border border-white/10 text-white placeholder-muted/60 text-xs focus:outline-none focus:border-primary resize-none font-sans"
              required
            />
          </div>

          {/* Target Phrases */}
          <div>
            <label className="block text-[11px] font-mono uppercase tracking-wider text-muted mb-1 font-semibold">
              Trigger Phrases (Comma-Separated)
            </label>
            <input
              type="text"
              placeholder="e.g. 100% waterproof, submarine-grade, fully impervious"
              value={phrases}
              onChange={(e) => setPhrases(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl bg-[#1D1D18] border border-white/10 text-white placeholder-muted/60 font-mono text-xs focus:outline-none focus:border-primary"
            />
            <p className="text-[10px] text-muted font-mono mt-1">
              Deterministic string matcher will flag these patterns in creator drafts.
            </p>
          </div>

          {/* Suggested Fix */}
          <div>
            <label className="block text-[11px] font-mono uppercase tracking-wider text-muted mb-1 font-semibold">
              Suggested Correction (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. Water-resistant up to 1m (IPX7 certified)"
              value={suggestion}
              onChange={(e) => setSuggestion(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl bg-[#1D1D18] border border-white/10 text-white placeholder-muted/60 font-mono text-xs focus:outline-none focus:border-primary"
            />
          </div>

          {/* Footer Actions */}
          <div className="pt-3 border-t border-white/5 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl bg-[#1D1D18] hover:bg-white/10 text-muted hover:text-white font-mono text-xs transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl bg-primary hover:bg-primary/90 text-black font-bold text-xs flex items-center gap-1.5 transition-all shadow-md disabled:opacity-40"
            >
              <Plus size={14} strokeWidth={2.5} />
              <span>{isSubmitting ? "Creating Rule..." : "Create & Publish Rule"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
