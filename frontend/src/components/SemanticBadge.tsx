import React from "react";
import { Sparkles } from "lucide-react";

interface SemanticBadgeProps {
  similarity: number;
  className?: string;
}

export const SemanticBadge: React.FC<SemanticBadgeProps> = ({
  similarity,
  className = "",
}) => {
  const pct = Math.round(similarity * 100);

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-mono font-medium ${className}`}
      style={{
        borderColor: "var(--ai-cyan, #00e5ff)",
        color: "var(--ai-cyan, #00e5ff)",
        backgroundColor: "rgba(0, 229, 255, 0.08)",
      }}
      title="How similar this sentence is to the approved rule's wording. It is not the probability of a violation."
      aria-label={`Semantic match ${pct} percent similar to the rule`}
    >
      <Sparkles size={11} className="text-ai shrink-0" aria-hidden="true" />
      <span>Semantic Match: {pct}%</span>
    </span>
  );
};
