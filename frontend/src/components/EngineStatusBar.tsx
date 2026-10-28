import React from "react";
import { CheckCircle2, Cpu, Sparkles } from "lucide-react";
import type { AuditEngines, AuditSummary } from "../types";

interface Props {
  engines?: AuditEngines;
  summary?: AuditSummary;
  isScanning?: boolean;
}

export const EngineStatusBar: React.FC<Props> = ({
  engines = { rules: "ran", llm: "disabled", llm_reason: "deterministic rule engine active" },
  summary = { critical: 0, high: 0, medium: 0, low: 0, total: 0 },
  isScanning = false,
}) => {
  const isClean = summary.total === 0;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl bg-card border border-line text-xs">
      {/* Engine Run Status */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5">
          <span className="relative flex h-2 w-2">
            <span
              className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                isScanning ? "bg-ai" : "bg-success"
              }`}
            ></span>
            <span
              className={`relative inline-flex rounded-full h-2 w-2 ${
                isScanning ? "bg-ai" : "bg-success"
              }`}
            ></span>
          </span>
          <span className="font-semibold text-white">
            {isScanning ? "Multi-Engine Audit in Progress..." : "Engine Status:"}
          </span>
        </div>

        {/* BrandGuard Engine Pill */}
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-white/5 border border-line font-mono text-[11px] text-muted">
          <Cpu size={12} className="text-primary" />
          <span>BrandGuard Module:</span>
          <span className="text-success font-semibold">Active</span>
        </div>

        {/* Google Gemini Pill */}
        <div
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded border font-mono text-[11px] ${
            engines.llm === "ran"
              ? "bg-blue-500/15 border-blue-400/40 text-blue-300 shadow-[0_0_10px_rgba(59,130,246,0.2)]"
              : "bg-white/5 border-line text-muted"
          }`}
        >
          <Sparkles size={12} className={engines.llm === "ran" ? "text-blue-400" : "text-ai"} />
          <span className="font-semibold">Google Gemini:</span>
          <span className={engines.llm === "ran" ? "text-blue-300 font-bold" : "text-muted"}>
            {engines.llm === "ran" ? "Active (Watermarked)" : engines.llm}
          </span>
          {engines.llm_reason && (
            <span className="text-[10px] text-muted/70">({engines.llm_reason})</span>
          )}
        </div>
      </div>

      {/* Findings Breakdown Counters */}
      <div className="flex items-center gap-2">
        {isClean ? (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-success/15 border border-success/30 text-success font-semibold">
            <CheckCircle2 size={13} />
            <span>All Clear · 0 Findings</span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5">
            {summary.critical > 0 && (
              <span className="px-2 py-0.5 rounded bg-critical/20 border border-critical/40 text-critical font-bold font-mono">
                {summary.critical} Critical
              </span>
            )}
            {summary.high > 0 && (
              <span className="px-2 py-0.5 rounded bg-high/20 border border-high/40 text-high font-bold font-mono">
                {summary.high} High
              </span>
            )}
            {summary.medium > 0 && (
              <span className="px-2 py-0.5 rounded bg-medium/20 border border-medium/40 text-medium font-bold font-mono">
                {summary.medium} Medium
              </span>
            )}
            {summary.low > 0 && (
              <span className="px-2 py-0.5 rounded bg-low/20 border border-low/40 text-low font-bold font-mono">
                {summary.low} Low
              </span>
            )}
            <span className="text-muted font-mono">
              ({summary.total} total)
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
