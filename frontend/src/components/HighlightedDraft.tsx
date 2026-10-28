import React from "react";
import type { Finding } from "../types";
import { sliceByCodePoints } from "../lib/codepoints";

interface Props {
  text: string;
  findings: Finding[];
  isScanning?: boolean;
  focusedFindingId?: number | null;
  onSelectFinding?: (findingId: number) => void;
  isEditing?: boolean;
  onChangeText?: (newText: string) => void;
}

interface SpanSegment {
  text: string;
  finding?: Finding;
  start: number;
  end: number;
  findingIndex: number;
}

export const HighlightedDraft: React.FC<Props> = ({
  text,
  findings,
  isScanning = false,
  focusedFindingId = null,
  onSelectFinding,
  isEditing = false,
  onChangeText,
}) => {
  // Build segments strictly adhering to code points
  const buildSegments = (): SpanSegment[] => {
    if (!text) return [];

    const activeFindings = findings
      .filter((f) => f.excerpt && f.excerpt.start !== undefined && f.excerpt.end !== undefined)
      .sort((a, b) => a.excerpt.start - b.excerpt.start);

    const segments: SpanSegment[] = [];
    let currentIndex = 0;
    const totalLength = Array.from(text).length;

    activeFindings.forEach((f, idx) => {
      const { start, end } = f.excerpt;

      // Unflagged segment before finding
      if (start > currentIndex) {
        segments.push({
          text: sliceByCodePoints(text, currentIndex, Math.min(start, totalLength)),
          start: currentIndex,
          end: Math.min(start, totalLength),
          findingIndex: -1,
        });
      }

      // Flagged finding segment
      if (end > start && start < totalLength) {
        segments.push({
          text: sliceByCodePoints(text, Math.max(start, currentIndex), Math.min(end, totalLength)),
          finding: f,
          start: Math.max(start, currentIndex),
          end: Math.min(end, totalLength),
          findingIndex: idx,
        });
        currentIndex = Math.min(end, totalLength);
      }
    });

    // Trailing unflagged segment
    if (currentIndex < totalLength) {
      segments.push({
        text: sliceByCodePoints(text, currentIndex, totalLength),
        start: currentIndex,
        end: totalLength,
        findingIndex: -1,
      });
    }

    return segments;
  };

  // Section 4 & 5.4: Specific Underline Styles & 22% Alpha Backgrounds per Severity
  const getSeverityUnderline = (severity: string) => {
    switch (severity) {
      case "critical":
        return {
          bg: "rgba(255, 107, 122, 0.22)",
          colorVar: "#FF6B7A",
          borderStyle: "solid",
          borderWidth: "2px",
        };
      case "high":
        return {
          bg: "rgba(255, 184, 77, 0.22)",
          colorVar: "#FFB84D",
          borderStyle: "dashed",
          borderWidth: "2px",
        };
      case "medium":
        return {
          bg: "rgba(175, 230, 7, 0.22)",
          colorVar: "#AFE607",
          borderStyle: "dotted",
          borderWidth: "2px",
        };
      case "low":
      default:
        return {
          bg: "rgba(169, 184, 198, 0.22)",
          colorVar: "#A9B8C6",
          borderStyle: "solid",
          borderWidth: "1px",
        };
    }
  };

  const segments = buildSegments();

  return (
    <div className={`relative rounded-2xl bg-card border border-line p-5 shadow-inner overflow-hidden font-mono text-sm leading-relaxed text-ink frame-shimmer-border ${
      isScanning ? "frame-pulse shadow-[0_0_30px_rgba(175,230,7,0.18)]" : "focus-within:border-primary/50 focus-within:shadow-[0_0_20px_rgba(175,230,7,0.12)]"
    } transition-all`}>
      {/* Signature Audit Scanline Overlay (Section 5.4: P0-3) */}
      {isScanning && <div className="scan-line" />}

      {isEditing ? (
        <textarea
          value={text}
          onChange={(e) => onChangeText?.(e.target.value)}
          rows={10}
          className="w-full bg-transparent border-0 text-ink font-mono text-sm leading-relaxed resize-none focus:outline-none focus:ring-0"
          placeholder="Enter or paste draft copy to audit..."
        />
      ) : (
        <div
          className={`whitespace-pre-wrap select-text transition-opacity duration-200 ${
            isScanning ? "opacity-85" : "opacity-100"
          }`}
        >
          {segments.map((seg, idx) => {
            if (!seg.finding) {
              return <span key={idx}>{seg.text}</span>;
            }

            const underline = getSeverityUnderline(seg.finding.severity);
            const isFocused = seg.finding.id === focusedFindingId;
            const isResolved = seg.finding.resolution !== "open";

            return (
              <mark
                key={idx}
                onClick={() => onSelectFinding?.(seg.finding!.id)}
                style={
                  {
                    "--hl-bg": underline.bg,
                    "--i": seg.findingIndex,
                    borderBottom: isResolved
                      ? "1px dashed var(--color-muted)"
                      : `${underline.borderWidth} ${underline.borderStyle} ${underline.colorVar}`,
                    padding: "1px 2px",
                    color: isResolved ? "var(--color-ink)" : "#FFFFFF",
                  } as React.CSSProperties
                }
                className={`hl-span ${
                  isFocused ? "ring-2 ring-primary ring-offset-2 ring-offset-card" : ""
                }`}
                title={`[${seg.finding.severity.toUpperCase()}] ${seg.finding.explanation}`}
              >
                {seg.text}
              </mark>
            );
          })}
        </div>
      )}

      {/* Footer Info: Tabular Numbers per Section 3 */}
      <div className="mt-4 pt-3 border-t border-line flex items-center justify-between text-[11px] text-muted">
        <div className="font-mono tabular-nums">
          <span>{Array.from(text).length} characters</span>
          <span className="mx-2">·</span>
          <span>{text.trim() ? text.trim().split(/\s+/).length : 0} words</span>
        </div>
        <div className="flex items-center gap-2 font-sans">
          {isEditing ? (
            <span className="text-ai">Editing mode active</span>
          ) : (
            <span className="text-muted">Click flagged highlight to focus finding card</span>
          )}
        </div>
      </div>
    </div>
  );
};
