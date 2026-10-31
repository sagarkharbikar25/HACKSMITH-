import React from "react";
import { BookOpen, Bookmark } from "lucide-react";
import type { SourceRef } from "../../types/round3";

interface SourceBadgeProps {
  source?: SourceRef | null;
  citation?: string;
  page?: number | null;
  section?: string | null;
  documentTitle?: string;
  className?: string;
}

export const SourceBadge: React.FC<SourceBadgeProps> = ({
  source,
  citation,
  page,
  section,
  documentTitle,
  className = "",
}) => {
  const finalCitation = source?.citation || citation;
  const finalPage = source?.page ?? page;
  const finalSection = source?.section ?? section;
  const finalTitle = source?.document_title || documentTitle;

  // Short badge label: e.g. "p.14" or "§ Tone of voice" or "Brand Book 2026 · p.14"
  let shortText = "";
  if (finalPage != null) {
    shortText = `p.${finalPage}`;
  } else if (finalSection) {
    shortText = `§ ${finalSection}`;
  }

  const fullLabel = finalCitation || (finalTitle ? `${finalTitle}${shortText ? ` · ${shortText}` : ""}` : shortText || "Source Document");

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-[#1D1D18] border border-white/10 text-muted hover:text-white transition-colors text-[11px] font-mono select-none ${className}`}
      title={fullLabel}
    >
      {finalPage != null ? (
        <BookOpen size={11} className="text-ai shrink-0" aria-hidden="true" />
      ) : (
        <Bookmark size={11} className="text-ai shrink-0" aria-hidden="true" />
      )}
      <span className="truncate max-w-[200px]">{fullLabel}</span>
    </span>
  );
};
