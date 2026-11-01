import React from "react";
import { Check, AlertTriangle, Minus, Circle } from "lucide-react";

interface ColorSwatchProps {
  hex: string;
  name?: string | null;
  share?: number;
  status?: "on_palette" | "off_palette" | "neutral_allowed" | "minor";
  deltaE?: number | null;
  role?: "primary" | "secondary" | "accent" | "neutral";
  size?: "sm" | "md" | "lg";
  className?: string;
}

export const ColorSwatch: React.FC<ColorSwatchProps> = ({
  hex,
  name,
  share,
  status,
  deltaE,
  role,
  size = "md",
  className = "",
}) => {
  const swatchDimensions =
    size === "sm" ? "w-4 h-4 rounded" : size === "lg" ? "w-7 h-7 rounded-lg" : "w-5 h-5 rounded-md";

  return (
    <div
      className={`inline-flex items-center gap-2 font-mono text-xs ${className}`}
      title={name ? `${name} (${hex})` : hex}
    >
      {/* 20px rounded square with 1px inner border */}
      <span
        className={`relative shrink-0 ${swatchDimensions} shadow-sm border border-white/20`}
        style={{ backgroundColor: hex }}
        aria-hidden="true"
      />

      {/* Hex value in mono (never colour-only) */}
      <div className="flex items-center gap-1.5 min-w-0">
        <span className="text-white font-semibold tracking-wider uppercase text-[11px]">
          {hex}
        </span>
        {name && (
          <span className="text-muted text-[11px] font-sans truncate max-w-[120px]">
            {name}
          </span>
        )}
        {role && (
          <span className="text-[9px] uppercase px-1.5 py-0.2 rounded bg-white/5 border border-white/10 text-muted">
            {role}
          </span>
        )}
      </div>

      {/* Share percentage & status icon */}
      {share != null && (
        <span className="text-muted text-[11px] tabular-nums shrink-0">
          ({Math.round(share * 100)}%)
        </span>
      )}

      {status === "on_palette" && (
        <span className="text-success text-[10px] flex items-center gap-0.5" title="On brand palette">
          <Check size={11} strokeWidth={3} />
        </span>
      )}
      {status === "neutral_allowed" && (
        <span className="text-muted text-[10px] flex items-center gap-0.5" title="Permitted neutral">
          <Circle size={9} />
        </span>
      )}
      {status === "off_palette" && (
        <span
          className="text-high text-[10px] flex items-center gap-1 font-bold"
          title={`Off-palette deviation (ΔE ${deltaE?.toFixed(1) ?? "—"})`}
        >
          <AlertTriangle size={11} />
          {deltaE != null && <span>ΔE {deltaE.toFixed(1)}</span>}
        </span>
      )}
      {status === "minor" && (
        <span className="text-muted/60 text-[10px]" title="Minor background color">
          <Minus size={10} />
        </span>
      )}
    </div>
  );
};

