import React from "react";
import { BboxOverlay } from "./BboxOverlay";
import { useAssetBlobUrl } from "../../hooks/useAssetBlobUrl";
import { useReducedMotion } from "../../hooks/useReducedMotion";
import type { AssetOut, AssetFindingOut } from "../../types/round3";
import { Layers, CheckSquare, Square } from "lucide-react";

interface ImageCanvasProps {
  asset: AssetOut;
  findings: AssetFindingOut[];
  activeFindingId?: number | null;
  layers: { palette: boolean; contrast: boolean };
  onToggleLayer?: (layer: "palette" | "contrast") => void;
  onSelect: (id: number | null) => void;
  analyzing?: boolean;
}

export const ImageCanvas: React.FC<ImageCanvasProps> = ({
  asset,
  findings,
  activeFindingId,
  layers,
  onToggleLayer,
  onSelect,
  analyzing = false,
}) => {
  const blobSrc = useAssetBlobUrl(asset.id);
  const reduceMotion = useReducedMotion();

  // If blob not ready or mock offline, generate safe background or fallback
  const fallbackSrc = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="${asset.width}" height="${asset.height}" viewBox="0 0 ${asset.width} ${asset.height}"><rect width="100%" height="100%" fill="%23151511"/><text x="50%" y="50%" fill="%239E9E92" font-family="monospace" font-size="24" text-anchor="middle" dominant-baseline="middle">${asset.filename}</text></svg>`;

  const imageSrc = blobSrc || fallbackSrc;

  return (
    <div className="space-y-2">
      {/* Layer toggle toolbar */}
      {onToggleLayer && (
        <div className="flex items-center justify-between px-2 text-xs font-mono text-muted">
          <div className="flex items-center gap-1.5">
            <Layers size={13} className="text-ai" />
            <span className="font-semibold text-white">Visual Inspection Layers:</span>
          </div>

          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => onToggleLayer("palette")}
              className={`flex items-center gap-1.5 transition-colors ${
                layers.palette ? "text-primary font-bold" : "text-muted hover:text-white"
              }`}
            >
              {layers.palette ? <CheckSquare size={13} /> : <Square size={13} />}
              <span>Palette Check</span>
            </button>

            <button
              type="button"
              onClick={() => onToggleLayer("contrast")}
              className={`flex items-center gap-1.5 transition-colors ${
                layers.contrast ? "text-ai font-bold" : "text-muted hover:text-white"
              }`}
            >
              {layers.contrast ? <CheckSquare size={13} /> : <Square size={13} />}
              <span>Contrast Check</span>
            </button>
          </div>
        </div>
      )}

      {/* Main Canvas Container (Aspect Ratio Guarded) */}
      <figure
        onClick={() => onSelect(null)}
        className="relative w-full overflow-hidden rounded-2xl border border-white/10 bg-black/60 shadow-xl select-none"
        style={{
          aspectRatio: `${asset.width} / ${asset.height}`,
          maxHeight: "68vh",
        }}
      >
        {/* Creative Image */}
        <img
          src={imageSrc}
          alt={`Creative: ${asset.filename}`}
          className="absolute inset-0 h-full w-full object-cover select-none pointer-events-none"
          draggable={false}
        />

        {/* Scan line effect when analyzing */}
        {analyzing && !reduceMotion && (
          <div
            className="absolute inset-x-0 h-1 bg-gradient-to-r from-transparent via-ai to-transparent opacity-90 scan-line z-20 pointer-events-none"
            aria-hidden="true"
          />
        )}

        {/* Normalized SVG Annotation Layer */}
        <svg
          className="absolute inset-0 h-full w-full pointer-events-auto"
          viewBox="0 0 1000 1000"
          preserveAspectRatio="none"
          role="group"
          aria-label="Detected visual and accessibility issues on creative asset"
        >
          {findings
            .filter((f) => layers[f.check_type])
            .map((f) => (
              <BboxOverlay
                key={f.id}
                finding={f}
                active={f.id === activeFindingId}
                dimmed={activeFindingId != null && f.id !== activeFindingId}
                onSelect={onSelect}
              />
            ))}
        </svg>
      </figure>
    </div>
  );
};
