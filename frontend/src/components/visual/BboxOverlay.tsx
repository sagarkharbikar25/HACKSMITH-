import React from "react";
import type { AssetFindingOut, Severity } from "../../types/round3";

interface BboxOverlayProps {
  finding: AssetFindingOut;
  active: boolean;
  dimmed: boolean;
  onSelect: (id: number) => void;
}

const SEV_COLORS: Record<Severity, string> = {
  critical: "#FF5C6E",
  high: "#FFB020",
  medium: "#AFE607",
  low: "#9E9E92",
};

export const BboxOverlay: React.FC<BboxOverlayProps> = ({
  finding: f,
  active,
  dimmed,
  onSelect,
}) => {
  const x = f.bbox.x * 1000;
  const y = f.bbox.y * 1000;
  const w = f.bbox.w * 1000;
  const h = f.bbox.h * 1000;

  // Solid = palette check, Dashed = contrast check (WCAG 1.4.1 non-colour signal)
  const dash = f.check_type === "contrast" ? "10 6" : undefined;
  const color = SEV_COLORS[f.severity] || "#AFE607";

  return (
    <g
      className={`bbox ${active ? "bbox--active" : ""} cursor-pointer outline-none transition-opacity duration-150`}
      opacity={dimmed ? 0.35 : 1}
      tabIndex={0}
      role="button"
      aria-label={`${f.issue_id} ${f.severity} ${f.check_type} issue: ${f.explanation}`}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(f.id);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          e.stopPropagation();
          onSelect(f.id);
        }
      }}
    >
      {/* Box rectangle */}
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx={6}
        fill={color}
        fillOpacity={active ? 0.28 : 0.12}
        stroke={color}
        strokeWidth={active ? 5 : 3}
        strokeDasharray={dash}
        vectorEffect="non-scaling-stroke"
      />

      {/* Floating ID badge tag */}
      <g transform={`translate(${x}, ${Math.max(0, y - 34)})`}>
        <rect
          width={64}
          height={30}
          rx={6}
          fill="#0E0E0B"
          stroke={color}
          strokeWidth={2}
          vectorEffect="non-scaling-stroke"
        />
        <text
          x={32}
          y={20}
          textAnchor="middle"
          fontSize={16}
          fontWeight="bold"
          fontFamily="monospace"
          fill="#F4F6F0"
        >
          {f.issue_id}
        </text>
      </g>
    </g>
  );
};
