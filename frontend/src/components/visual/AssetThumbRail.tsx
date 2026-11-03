import React from "react";
import { Image as ImageIcon, Trash2, CheckCircle2, AlertTriangle } from "lucide-react";
import type { AssetOut } from "../../types/round3";
import { formatBytes } from "../../lib/format";

interface AssetThumbRailProps {
  assets: AssetOut[];
  activeId: number | null;
  onSelect: (id: number) => void;
  onDelete?: (id: number) => void;
  isReadOnly?: boolean;
}

export const AssetThumbRail: React.FC<AssetThumbRailProps> = ({
  assets,
  activeId,
  onSelect,
  onDelete,
  isReadOnly = false,
}) => {
  if (assets.length === 0) return null;

  return (
    <div className="flex items-center gap-2.5 overflow-x-auto pb-2 select-none">
      {assets.map((asset) => {
        const isSelected = asset.id === activeId;
        const openFindingsCount = asset.findings.filter((f) => f.resolution === "open").length;

        return (
          <div
            key={asset.id}
            role="button"
            tabIndex={0}
            onClick={() => onSelect(asset.id)}
            onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onSelect(asset.id)}
            className={`group relative flex items-center gap-2.5 p-2 rounded-xl border transition-all cursor-pointer shrink-0 outline-none ${
              isSelected
                ? "bg-[#1D1D18] border-ai shadow-md ring-1 ring-ai/40"
                : "bg-[#151511] border-white/10 hover:border-white/20 hover:bg-[#1A1A14]"
            }`}
          >
            <div className="p-1.5 rounded-lg bg-black/40 text-ai shrink-0">
              <ImageIcon size={16} />
            </div>

            <div className="text-left font-mono text-xs">
              <span className="font-semibold text-white truncate max-w-[120px] block">
                {asset.filename}
              </span>
              <span className="text-[10px] text-muted">
                {asset.width}×{asset.height} · {formatBytes(asset.size_bytes)}
              </span>
            </div>

            {/* Findings count badge */}
            <div className="ml-1 shrink-0">
              {openFindingsCount > 0 ? (
                <span className="px-1.5 py-0.5 rounded-full bg-high/20 border border-high/30 text-[10px] font-mono text-high font-bold flex items-center gap-0.5">
                  <AlertTriangle size={10} />
                  <span>{openFindingsCount}</span>
                </span>
              ) : (
                <span className="text-success" title="All checks passed">
                  <CheckCircle2 size={14} />
                </span>
              )}
            </div>

            {/* Delete button (if not locked / read-only) */}
            {!isReadOnly && onDelete && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(asset.id);
                }}
                className="opacity-0 group-hover:opacity-100 p-1 text-muted hover:text-critical rounded transition-opacity"
                title="Remove image asset and findings"
              >
                <Trash2 size={13} />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
};

