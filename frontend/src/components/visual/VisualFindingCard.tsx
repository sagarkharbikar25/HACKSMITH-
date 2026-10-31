import React, { useState } from "react";
import {
  OctagonAlert,
  TriangleAlert,
  Diamond,
  Circle,
  CheckCircle2,
  ShieldCheck,
  AlertTriangle,
  Check,
} from "lucide-react";
import { ColorSwatch } from "./ColorSwatch";
import { ContrastMeter } from "./ContrastMeter";
import type {
  AssetFindingOut,
  PaletteMeasured,
  ContrastMeasured,
  Severity,
  Resolution,
} from "../../types/round3";

interface VisualFindingCardProps {
  finding: AssetFindingOut;
  isActive?: boolean;
  onFocus?: (id: number) => void;
  onResolve?: (findingId: number, resolution: Exclude<Resolution, "open">, reason?: string) => void;
  onSelectEvidence?: (evidenceId: string) => void;
  isReadOnly?: boolean;
  className?: string;
}

const SEVERITY_CONFIG: Record<
  Severity,
  { border: string; badge: string; icon: React.ComponentType<{ size: number }>; label: string }
> = {
  critical: {
    border: "border-l-critical",
    badge: "bg-critical/20 text-critical border-critical/40",
    icon: OctagonAlert,
    label: "Critical",
  },
  high: {
    border: "border-l-high",
    badge: "bg-high/20 text-high border-high/40",
    icon: TriangleAlert,
    label: "High",
  },
  medium: {
    border: "border-l-medium",
    badge: "bg-medium/20 text-medium border-medium/40",
    icon: Diamond,
    label: "Medium",
  },
  low: {
    border: "border-l-low",
    badge: "bg-low/20 text-low border-low/40",
    icon: Circle,
    label: "Low",
  },
};

export const VisualFindingCard: React.FC<VisualFindingCardProps> = ({
  finding,
  isActive = false,
  onFocus,
  onResolve,
  onSelectEvidence,
  isReadOnly = false,
  className = "",
}) => {
  const [showDismissInput, setShowDismissInput] = useState(false);
  const [dismissReason, setDismissReason] = useState("");

  const sevConfig = SEVERITY_CONFIG[finding.severity] || SEVERITY_CONFIG.medium;
  const Icon = sevConfig.icon;
  const isResolved = finding.resolution !== "open";
  const isCritical = finding.severity === "critical";

  const isPalette = finding.measured.kind === "palette";
  const isContrast = finding.measured.kind === "contrast";

  const paletteData = isPalette ? (finding.measured as PaletteMeasured) : null;
  const contrastData = isContrast ? (finding.measured as ContrastMeasured) : null;

  const handleDismissSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!dismissReason.trim()) return;
    onResolve?.(finding.id, "dismissed", dismissReason.trim());
    setShowDismissInput(false);
  };

  return (
    <div
      onClick={() => onFocus?.(finding.id)}
      className={`p-5 rounded-2xl bg-[#151511] border border-white/10 border-l-[4px] ${
        sevConfig.border
      } transition-all cursor-pointer ${
        isActive
          ? "ring-2 ring-primary bg-[#1C1C16] shadow-lg"
          : "hover:border-white/20 hover:bg-[#1A1A14]"
      } ${isResolved ? "opacity-75" : ""} ${className}`}
    >
      {/* ── HEADER: ISSUE ID + SEVERITY + CATEGORY ──────────────────── */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs font-bold text-white bg-white/10 px-2 py-0.5 rounded-md">
            {finding.issue_id}
          </span>

          <span
            className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase font-mono border flex items-center gap-1 ${
              sevConfig.badge
            }`}
          >
            <Icon size={11} />
            <span>{sevConfig.label}</span>
          </span>

          <span className="text-[11px] font-mono text-muted uppercase">
            {finding.category} · {finding.check_type}
          </span>
        </div>

        {isResolved ? (
          <span className="flex items-center gap-1 text-[11px] font-semibold text-success font-mono">
            <CheckCircle2 size={12} />
            <span className="uppercase">{finding.resolution}</span>
          </span>
        ) : (
          <span className="text-[10px] font-mono text-muted">Vision Engine</span>
        )}
      </div>

      {/* ── VARIANT 1: PALETTE MEASUREMENTS ─────────────────────────── */}
      {paletteData && (
        <div className="mt-3 p-3 rounded-xl bg-[#0E0E0B] border border-white/5 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
            <div>
              <span className="text-[10px] text-muted block mb-1">Found Color in Asset:</span>
              <ColorSwatch
                hex={paletteData.found_hex}
                share={paletteData.found_share}
                status="off_palette"
              />
            </div>

            <div>
              <span className="text-[10px] text-muted block mb-1">Nearest Approved Match:</span>
              <ColorSwatch
                hex={paletteData.nearest_hex}
                name={paletteData.nearest_name}
                status="on_palette"
              />
            </div>
          </div>

          <div className="pt-2 border-t border-white/5 flex items-center justify-between text-xs font-mono text-muted">
            <span className="text-high font-bold">
              Measured ΔE: {paletteData.delta_e.toFixed(1)}
            </span>
            <span>Allowed Limit: ≤ {paletteData.max_delta_e} ΔE</span>
          </div>
        </div>
      )}

      {/* ── VARIANT 2: CONTRAST MEASUREMENTS ────────────────────────── */}
      {contrastData && (
        <div className="mt-3 p-3.5 rounded-xl bg-[#0E0E0B] border border-white/5 space-y-3">
          <div className="flex items-center justify-between gap-3">
            {/* Real Text Sample Tile */}
            <div
              style={{
                backgroundColor: contrastData.background_hex,
                color: contrastData.foreground_hex,
              }}
              className="px-3 py-2 rounded-lg font-bold font-sans text-xs shadow-sm border border-white/10"
              title={`Foreground ${contrastData.foreground_hex} on Background ${contrastData.background_hex}`}
            >
              "{contrastData.text_sample}"
            </div>

            <div className="flex items-center gap-2 text-[11px] font-mono">
              <span className="text-muted">Fg:</span>
              <ColorSwatch hex={contrastData.foreground_hex} size="sm" />
              <span className="text-muted ml-1">Bg:</span>
              <ColorSwatch hex={contrastData.background_hex} size="sm" />
            </div>
          </div>

          {/* Contrast Meter */}
          <ContrastMeter
            ratio={contrastData.ratio}
            requiredRatio={contrastData.required_ratio}
            worstCaseRatio={contrastData.worst_case_ratio}
          />

          {contrastData.busy_background && (
            <div className="p-2 rounded-lg bg-high/10 border border-high/30 flex items-center gap-2 text-[11px] font-mono text-high">
              <AlertTriangle size={13} className="shrink-0" />
              <span>
                Busy background detected — verify manually (worst-case:{" "}
                {contrastData.worst_case_ratio?.toFixed(1) ?? "—"}:1).
              </span>
            </div>
          )}
        </div>
      )}

      {/* ── EXPLANATION ─────────────────────────────────────────────── */}
      <p className="mt-2.5 text-xs text-ink/90 font-sans leading-relaxed">
        {finding.explanation}
      </p>

      {/* ── SUGGESTED FIX ───────────────────────────────────────────── */}
      {finding.suggested_correction && (
        <div className="mt-2.5 p-2.5 rounded-xl bg-success/10 border border-success/20 text-xs font-mono text-success">
          <span className="text-[10px] uppercase font-bold block mb-0.5">
            Recommended Visual Fix:
          </span>
          {finding.suggested_correction}
        </div>
      )}

      {/* ── EVIDENCE CITATION CHIP ──────────────────────────────────── */}
      <div className="mt-3 pt-2.5 border-t border-white/5 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onSelectEvidence?.(finding.evidence.id);
          }}
          className="inline-flex items-center gap-1.5 text-xs font-mono text-muted hover:text-white transition-colors"
        >
          <ShieldCheck size={13} className="text-primary" />
          <span>Evidence: {finding.evidence.id} ({finding.evidence.label})</span>
        </button>

        {isResolved && finding.resolution_reason && (
          <span className="text-[10px] font-mono text-muted/70 truncate max-w-[180px]">
            Reason: {finding.resolution_reason}
          </span>
        )}
      </div>

      {/* ── RESOLVE CONTROLS (CREATOR / AGENCY ONLY) ────────────────── */}
      {!isReadOnly && !isResolved && (
        <div className="mt-3.5 pt-3 border-t border-white/10 flex flex-col gap-2">
          {!showDismissInput ? (
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (!isCritical) setShowDismissInput(true);
                }}
                disabled={isCritical}
                title={
                  isCritical
                    ? "Critical compliance violations cannot be dismissed."
                    : "Dismiss this finding with a justified reason"
                }
                className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-mono text-muted hover:text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                Dismiss...
              </button>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onResolve?.(finding.id, "accepted");
                }}
                className="px-3.5 py-1.5 rounded-lg bg-primary hover:bg-primary/90 text-black text-xs font-bold font-sans flex items-center gap-1 transition-all"
              >
                <Check size={13} strokeWidth={2.5} />
                <span>Mark Fixed</span>
              </button>
            </div>
          ) : (
            <form onSubmit={handleDismissSubmit} onClick={(e) => e.stopPropagation()} className="space-y-2">
              <input
                type="text"
                required
                placeholder="Reason for dismissal (required for audit log)..."
                value={dismissReason}
                onChange={(e) => setDismissReason(e.target.value)}
                className="w-full px-3 py-1.5 bg-[#0E0E0B] border border-white/10 rounded-lg text-xs text-white font-mono placeholder-muted/50 focus:border-ai outline-none"
              />
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowDismissInput(false)}
                  className="px-2.5 py-1 rounded-md text-xs font-mono text-muted hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!dismissReason.trim()}
                  className="px-3 py-1 rounded-md bg-high hover:bg-high/90 text-black text-xs font-bold font-mono disabled:opacity-40"
                >
                  Confirm Dismiss
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
};
