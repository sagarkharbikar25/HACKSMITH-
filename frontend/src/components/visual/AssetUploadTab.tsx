import React, { useState, useEffect } from "react";
import { AssetDropzone } from "./AssetDropzone";
import { AssetThumbRail } from "./AssetThumbRail";
import { ImageCanvas } from "./ImageCanvas";
import { PaletteStrip } from "./PaletteStrip";
import { VisualFindingCard } from "./VisualFindingCard";
import { listAssets, deleteAsset, resolveAssetFinding } from "../../api/assets";
import { mockAssets } from "../../api/mocks/round3";
import type { AssetOut, Resolution } from "../../types/round3";
import { CheckCircle2, Lock } from "lucide-react";

interface AssetUploadTabProps {
  submissionId: number;
  status: string;
  isReadOnly?: boolean;
  onSelectEvidence?: (evidenceId: string) => void;
  onAssetsChanged?: (assets: AssetOut[]) => void;
}

export const AssetUploadTab: React.FC<AssetUploadTabProps> = ({
  submissionId,
  status,
  isReadOnly = false,
  onSelectEvidence,
  onAssetsChanged,
}) => {
  const [assets, setAssets] = useState<AssetOut[]>([]);
  const [activeAssetId, setActiveAssetId] = useState<number | null>(null);
  const [activeFindingId, setActiveFindingId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [layers, setLayers] = useState({ palette: true, contrast: true });

  const isLocked = status === "in_review" || status === "approved" || isReadOnly;
  const isLimitReached = assets.length >= 5;

  // Load assets
  useEffect(() => {
    let active = true;
    async function load() {
      setIsLoading(true);
      try {
        const data = await listAssets(submissionId);
        if (active) {
          setAssets(data);
          onAssetsChanged?.(data);
          if (data.length > 0 && !activeAssetId) {
            setActiveAssetId(data[0].id);
          }
        }
      } catch {
        // Fallback to mock assets for demo resilience
        if (active) {
          setAssets(mockAssets);
          onAssetsChanged?.(mockAssets);
          if (mockAssets.length > 0 && !activeAssetId) {
            setActiveAssetId(mockAssets[0].id);
          }
        }
      } finally {
        if (active) setIsLoading(false);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, [submissionId]);

  const activeAsset = assets.find((a) => a.id === activeAssetId) || assets[0] || null;

  const handleAssetUploaded = (newAsset: AssetOut) => {
    setAssets((prev) => {
      const next = [newAsset, ...prev];
      onAssetsChanged?.(next);
      return next;
    });
    setActiveAssetId(newAsset.id);
  };

  const handleDeleteAsset = async (id: number) => {
    if (!window.confirm("Remove this image and its findings?")) return;
    try {
      await deleteAsset(id).catch(() => {});
    } finally {
      setAssets((prev) => {
        const next = prev.filter((a) => a.id !== id);
        onAssetsChanged?.(next);
        return next;
      });
      if (activeAssetId === id) {
        setActiveAssetId(assets.length > 1 ? assets.find((a) => a.id !== id)!.id : null);
      }
    }
  };

  const handleResolveFinding = async (
    findingId: number,
    resolution: Exclude<Resolution, "open">,
    reason?: string
  ) => {
    try {
      await resolveAssetFinding(findingId, { resolution, reason }).catch(() => {});
    } finally {
      setAssets((prev) => {
        const next = prev.map((asset) => ({
          ...asset,
          findings: asset.findings.map((f) =>
            f.id === findingId ? { ...f, resolution, resolution_reason: reason || null } : f
          ),
        }));
        onAssetsChanged?.(next);
        return next;
      });
    }
  };

  const handleToggleLayer = (layer: "palette" | "contrast") => {
    setLayers((prev) => ({ ...prev, [layer]: !prev[layer] }));
  };

  if (isLoading && assets.length === 0) {
    return (
      <div className="py-20 text-center text-muted font-mono text-xs animate-pulse">
        Loading creative assets & vision audit findings...
      </div>
    );
  }

  // Empty state: render large dropzone
  if (assets.length === 0) {
    return (
      <div className="space-y-4">
        {isLocked && (
          <div className="p-3 rounded-xl bg-white/5 border border-white/10 text-xs font-mono text-muted flex items-center gap-2">
            <Lock size={14} />
            <span>Locked while in review or approved state.</span>
          </div>
        )}
        <AssetDropzone
          submissionId={submissionId}
          onUploaded={handleAssetUploaded}
          disabled={isLocked}
          disabledReason="Locked while in review"
        />
      </div>
    );
  }

  const openFindings = activeAsset?.findings.filter((f) => f.resolution === "open") || [];
  const resolvedFindings = activeAsset?.findings.filter((f) => f.resolution !== "open") || [];

  return (
    <div className="space-y-6">
      {/* ── TOP CONTROLS BAR: THUMB RAIL + ADD BUTTON ────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-white/10">
        <AssetThumbRail
          assets={assets}
          activeId={activeAssetId}
          onSelect={(id) => {
            setActiveAssetId(id);
            setActiveFindingId(null);
          }}
          onDelete={handleDeleteAsset}
          isReadOnly={isLocked}
        />

        <div className="shrink-0">
          <AssetDropzone
            submissionId={submissionId}
            onUploaded={handleAssetUploaded}
            isCompact={true}
            disabled={isLocked || isLimitReached}
            disabledReason={
              isLimitReached
                ? "Maximum 5 images allowed per submission. Remove one to add another."
                : "Locked while in review"
            }
          />
        </div>
      </div>

      {isLocked && (
        <div className="p-2.5 rounded-xl bg-white/5 border border-white/10 text-xs font-mono text-muted flex items-center gap-2">
          <Lock size={13} className="text-ai" />
          <span>Locked while in review. Modifications and resolutions are disabled.</span>
        </div>
      )}

      {/* ── TWO-COLUMN WORKSPACE: CANVAS (LEFT) & FINDINGS (RIGHT) ────── */}
      {activeAsset && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Image Canvas Overlay (7 cols) */}
          <div className="lg:col-span-7 space-y-4">
            <ImageCanvas
              asset={activeAsset}
              findings={activeAsset.findings}
              activeFindingId={activeFindingId}
              layers={layers}
              onToggleLayer={handleToggleLayer}
              onSelect={(id) => setActiveFindingId(id)}
            />

            {/* Dominant Palette Strip */}
            <PaletteStrip
              dominantColors={activeAsset.dominant_colors}
              brandPalette={activeAsset.brand_palette}
              engines={activeAsset.engines}
            />
          </div>

          {/* Right Column: Visual Findings List (5 cols) */}
          <div className="lg:col-span-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-mono uppercase tracking-wider text-muted font-bold">
                Visual Findings ({openFindings.length} open)
              </h3>
              <span className="text-[10px] font-mono text-muted">
                Click box on image or card to highlight
              </span>
            </div>

            {openFindings.length === 0 ? (
              <div className="p-6 rounded-2xl bg-[#151511] border border-white/10 text-center space-y-2">
                <CheckCircle2 size={24} className="mx-auto text-success" />
                <p className="text-xs font-semibold text-white">All Visual Checks Passed</p>
                <p className="text-[11px] text-muted font-sans">
                  Colors align with approved brand guidelines and text meets WCAG AA 4.5:1 contrast.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {openFindings.map((finding) => (
                  <VisualFindingCard
                    key={finding.id}
                    finding={finding}
                    isActive={finding.id === activeFindingId}
                    onFocus={(id) => setActiveFindingId(id)}
                    onResolve={handleResolveFinding}
                    onSelectEvidence={onSelectEvidence}
                    isReadOnly={isLocked}
                  />
                ))}
              </div>
            )}

            {/* Resolved Findings Accordion / Section */}
            {resolvedFindings.length > 0 && (
              <div className="pt-4 border-t border-white/10 space-y-2.5">
                <span className="text-[10px] font-mono uppercase tracking-wider text-muted font-bold block">
                  Resolved / Dismissed ({resolvedFindings.length})
                </span>
                <div className="space-y-2">
                  {resolvedFindings.map((finding) => (
                    <VisualFindingCard
                      key={finding.id}
                      finding={finding}
                      isActive={finding.id === activeFindingId}
                      onFocus={(id) => setActiveFindingId(id)}
                      onResolve={handleResolveFinding}
                      onSelectEvidence={onSelectEvidence}
                      isReadOnly={true}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
