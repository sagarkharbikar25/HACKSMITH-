import React from "react";
import logoImg from "../assets/logo.png";

interface LogoProps {
  size?: "sm" | "md" | "lg" | "xl";
  showWordmark?: boolean;
  className?: string;
}

export const BrandSymbol: React.FC<{ size?: number; className?: string }> = ({
  size = 32,
  className = "",
}) => {
  return (
    <div
      style={{ width: size, height: size }}
      className={`relative inline-flex items-center justify-center shrink-0 rounded-xl overflow-hidden shadow-[0_0_20px_rgba(175,230,7,0.3)] border border-primary/30 frame-pulse ${className}`}
    >
      <img
        src={logoImg}
        alt="BrandGuard AI Logo"
        className="w-full h-full object-cover select-none"
      />
    </div>
  );
};

export const BrandLogo: React.FC<LogoProps> = ({
  size = "md",
  showWordmark = true,
  className = "",
}) => {
  const pixelSizes = {
    sm: 26,
    md: 36,
    lg: 48,
    xl: 64,
  };

  const textStyles = {
    sm: { title: "text-sm", sub: "text-[9px]" },
    md: { title: "text-base", sub: "text-[10px]" },
    lg: { title: "text-xl", sub: "text-xs" },
    xl: { title: "text-3xl", sub: "text-xs" },
  };

  return (
    <div className={`inline-flex items-center gap-3 ${className}`}>
      <BrandSymbol size={pixelSizes[size]} />
      {showWordmark && (
        <div className="flex flex-col justify-center select-none">
          <div className="flex items-center gap-1.5 leading-none">
            <span
              className={`font-display font-extrabold tracking-[-0.03em] text-[#F4F6F0] ${textStyles[size].title}`}
            >
              BRANDGUARD
            </span>
            <span className="font-mono text-[9px] font-bold px-1.5 py-0.5 rounded bg-primary/20 text-primary border border-primary/30 uppercase tracking-wider">
              AI
            </span>
          </div>
          <span
            className={`font-sans tracking-wide text-muted ${textStyles[size].sub} mt-0.5`}
          >
            Compliance & Governance Engine
          </span>
        </div>
      )}
    </div>
  );
};
