import React from "react";
import { ColorSwatch } from "./ColorSwatch";
import type { SwatchOut, PaletteColorOut, AssetEngines } from "../../types/round3";
import { AlertCircle } from "lucide-react";

interface PaletteStripProps {
  dominantColors: SwatchOut[];
  brandPalette: PaletteColorOut[];
  engines?: AssetEngines;
  className?: string;
}

const CONTRAST_REASON_MAP: Record<string, string> = {
  timeout: "the AI took too long",
  rate_limited: "AI is rate-limited",
  not_configured: "AI review is off",
  no_text_detected: "no text found in the image",
};

export const PaletteStrip: React.FC<PaletteStripProps> = ({
  dominantColors,
  brandPalette,
  engines,
  className = "",
}) => {
  // Sort dominant colors by share descending
  const sortedDominant = [...dominantColors].sort((a, b) => b.share - a.share);

  return (
    <div className={`p-4 rounded-2xl bg-[#151511] border border-white/10 space-y-4 ${className}`}>
      {/* ── STACKED PROPORTIONAL DISTRIBUTION BAR ────────────────────── */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-[11px] font-mono text-muted uppercase">
          <span>Image Color Breakdown</span>
          <span>100% Total Area</span>
        </div>
        <div
          className="h-3 w-full rounded-full overflow-hidden flex border border-white/10 bg-black/40"
          role="group"
          aria-label="Color distribution in image"
        >
          {sortedDominant.map((color, idx) => (
            <div
              key={idx}
              style={{
                width: `${Math.round(color.share * 100)}%`,
                backgroundColor: color.hex,
              }}
              title={`${color.hex} (${Math.round(color.share * 100)}%)`}
              aria-label={`${color.hex} ${Math.round(color.share * 100)} percent, ${color.status}`}
              className="h-full relative group transition-all hover:opacity-90"
            />
          ))}
        </div>
      </div>

      {/* ── ROW 1: FOUND IN THIS IMAGE ───────────────────────────────── */}
      <div className="space-y-2 pt-1 border-t border-white/5">
        <span className="text-[10px] font-mono uppercase tracking-wider text-muted font-bold block">
          Found in this Creative ({sortedDominant.length})
        </span>
        <div className="flex flex-wrap gap-2.5">
          {sortedDominant.map((swatch, idx) => (
            <ColorSwatch
              key={idx}
              hex={swatch.hex}
              name={swatch.nearest_name}
              share={swatch.share}
              status={swatch.status}
              deltaE={swatch.delta_e}
              size="md"
            />
          ))}
        </div>
      </div>

      {/* ── ROW 2: APPROVED BRAND PALETTE ────────────────────────────── */}
      <div className="space-y-2 pt-2 border-t border-white/5">
        <span className="text-[10px] font-mono uppercase tracking-wider text-muted font-bold block">
          Approved Brand Palette ({brandPalette.length})
        </span>
        <div className="flex flex-wrap gap-2.5">
          {brandPalette.map((color, idx) => (
            <ColorSwatch
              key={idx}
              hex={color.hex}
              name={color.name}
              role={color.role}
              size="md"
            />
          ))}
        </div>
      </div>

      {/* ── CONTRAST UNAVAILABLE NOTICE ──────────────────────────────── */}
      {engines?.contrast === "unavailable" && (
        <div className="p-3 rounded-xl bg-high/10 border border-high/30 flex items-center gap-2 text-xs font-mono text-high">
          <AlertCircle size={14} className="shrink-0" />
          <span>
            Text contrast could not be checked (
            {CONTRAST_REASON_MAP[engines.contrast_reason || ""] || engines.contrast_reason || "unavailable"}
            ). Colour results are still valid.
          </span>
        </div>
      )}
    </div>
  );
};

