import React, { useState, useEffect } from "react";
import { CheckCircle2, XCircle } from "lucide-react";
import { useReducedMotion } from "../../hooks/useReducedMotion";

interface ContrastMeterProps {
  ratio: number;
  requiredRatio?: number;
  worstCaseRatio?: number | null;
  className?: string;
}

export const ContrastMeter: React.FC<ContrastMeterProps> = ({
  ratio,
  requiredRatio = 4.5,
  worstCaseRatio,
  className = "",
}) => {
  const reducedMotion = useReducedMotion();
  const [displayRatio, setDisplayRatio] = useState(reducedMotion ? ratio : 1.0);

  // Animated count-up (400 ms) unless reduced motion
  useEffect(() => {
    if (reducedMotion) {
      setDisplayRatio(ratio);
      return;
    }

    const duration = 400;
    const startRatio = 1.0;
    const startTime = performance.now();

    const animate = (time: number) => {
      const elapsed = time - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease-out curve
      const current = startRatio + (ratio - startRatio) * (1 - Math.pow(1 - progress, 3));
      setDisplayRatio(current);

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        setDisplayRatio(ratio);
      }
    };

    const frameId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frameId);
  }, [ratio, reducedMotion]);

  const passes = ratio >= requiredRatio;

  // Log scale for contrast ratios 1:1 to 21:1
  const getScalePos = (val: number): number => {
    const clamped = Math.max(1, Math.min(val, 21));
    return (Math.log(clamped) / Math.log(21)) * 100;
  };

  const ratioPos = getScalePos(ratio);
  const requiredPos = getScalePos(requiredRatio);

  return (
    <div className={`space-y-1.5 font-mono ${className}`}>
      {/* Header with Ratio and Status */}
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <span className="font-bold text-white tabular-nums text-sm">
            {displayRatio.toFixed(1)}:1
          </span>
          <span className="text-[11px] text-muted">
            (Required ≥ {requiredRatio.toFixed(1)}:1)
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {passes ? (
            <span className="flex items-center gap-1 text-success text-xs font-semibold">
              <CheckCircle2 size={13} />
              <span>Passes AA</span>
            </span>
          ) : (
            <span className="flex items-center gap-1 text-high text-xs font-semibold">
              <XCircle size={13} />
              <span>Fails AA</span>
            </span>
          )}
        </div>
      </div>

      {/* Bar container */}
      <div className="relative h-2.5 w-full bg-[#0E0E0B] border border-white/10 rounded-full overflow-hidden">
        {/* Filled ratio bar */}
        <div
          className={`h-full transition-all duration-300 rounded-full ${
            passes ? "bg-success" : "bg-high"
          }`}
          style={{ width: `${ratioPos}%` }}
        />

        {/* Required threshold tick marker */}
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-white shadow-sm z-10"
          style={{ left: `${requiredPos}%` }}
          title={`WCAG AA Threshold: ${requiredRatio}:1`}
        />
      </div>

      {/* Worst-case ratio if busy background */}
      {worstCaseRatio != null && (
        <div className="text-[10px] text-muted flex items-center justify-between pt-0.5">
          <span>Worst-case measured: {worstCaseRatio.toFixed(1)}:1</span>
          <span>Max: 21:1</span>
        </div>
      )}
    </div>
  );
};
