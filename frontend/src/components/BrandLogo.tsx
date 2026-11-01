import React from "react";

interface LogoProps {
  size?: "sm" | "md" | "lg" | "xl";
  showWordmark?: boolean;
  className?: string;
  color?: "lime" | "white" | "current";
}

/**
 * BrandSymbol — Default Mark: Concept A ("Range Bracket B")
 * A bold geometric letter B built from a text-selection bracket [ and a highlighted span.
 * References the [start:end] deterministic character range flagged by the compliance engine,
 * sliced by the signature audit scan notch.
 * Works as a single flat colour: no gradients, shadows, glows, or stock clip-art.
 */
export const BrandSymbol: React.FC<{
  size?: number;
  className?: string;
  color?: "lime" | "white" | "current";
}> = ({
  size = 32,
  className = "",
  color = "lime",
}) => {
  const fillColor = color === "lime" ? "#AFE607" : color === "white" ? "#F4F6F0" : "currentColor";
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`shrink-0 ${className}`}
      aria-hidden="true"
    >
      {/* Upper Range Span with text-bracket anchor [ */}
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M8 12C8 8.68629 10.6863 6 14 6H28C33.5228 6 38 10.4772 38 16C38 21.5228 33.5228 22 28 22H8V12ZM16 11H26C28.7614 11 31 13.2386 31 16C31 18.7614 28.7614 17 26 17H16V11Z"
        fill={fillColor}
      />
      {/* Lower Highlighted Span (separated by 4px laser scan beam notch) */}
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M8 26H30C35.5228 26 40 30.4772 40 36C40 39.3137 37.3137 42 34 42H8V26ZM16 31H28C30.7614 31 33 33.2386 33 36C33 38.7614 30.7614 37 28 37H16V31Z"
        fill={fillColor}
      />
    </svg>
  );
};

export const BrandLogo: React.FC<LogoProps> = ({
  size = "md",
  showWordmark = true,
  className = "",
  color = "lime",
}) => {
  const sizeConfigs = {
    sm: {
      symbolSize: 20,
      titleSize: "text-[14px]",
      tagSize: "text-[8px] px-1 py-0.5",
      subSize: "text-[9px]",
      gap: "gap-2.5",
    },
    md: {
      symbolSize: 26,
      titleSize: "text-[16px]",
      tagSize: "text-[9px] px-1.5 py-0.5",
      subSize: "text-[10px]",
      gap: "gap-3",
    },
    lg: {
      symbolSize: 38,
      titleSize: "text-xl",
      tagSize: "text-[10px] px-2 py-0.5",
      subSize: "text-xs",
      gap: "gap-3.5",
    },
    xl: {
      symbolSize: 56,
      titleSize: "text-3xl",
      tagSize: "text-xs px-2.5 py-1",
      subSize: "text-sm",
      gap: "gap-4",
    },
  };

  const config = sizeConfigs[size];

  return (
    <div className={`inline-flex items-center ${config.gap} ${className}`}>
      <BrandSymbol size={config.symbolSize} color={color} />
      {showWordmark && (
        <div className="flex flex-col justify-center select-none">
          <div className="flex items-center gap-1.5 leading-none">
            <span
              className={`font-display font-extrabold tracking-[-0.02em] text-[#F4F6F0] leading-none ${config.titleSize}`}
            >
              BrandGuard
            </span>
            <span
              className={`inline-flex items-center justify-center font-mono font-bold leading-none rounded bg-primary/15 text-primary border border-primary/30 uppercase tracking-wider ${config.tagSize}`}
            >
              AI
            </span>
          </div>
          <span
            className={`font-sans text-muted tracking-normal leading-tight mt-1 ${config.subSize}`}
          >
            Compliance &amp; Governance Engine
          </span>
        </div>
      )}
    </div>
  );
};
