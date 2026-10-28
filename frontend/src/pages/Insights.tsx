import React, { useState, useEffect } from "react";
import { AlertTriangle, CheckCircle2, RefreshCw } from "lucide-react";
import { api } from "../api/client";
import type { InsightsData } from "../types";

export const Insights: React.FC = () => {
  const [data, setData] = useState<InsightsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchInsights = async () => {
    setIsLoading(true);
    try {
      const res = await api.insights.getSummary();
      setData(res);
    } catch (err) {
      console.error("Failed to load insights:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchInsights();
  }, []);

  const totalFired = data?.rules ? data.rules.reduce((acc, r) => acc + (r.fired || 0), 0) : 0;
  const totalDismissed = data?.rules ? data.rules.reduce((acc, r) => acc + (r.dismissed || 0), 0) : 0;
  const totalOverridden = data?.rules ? data.rules.reduce((acc, r) => acc + (r.overridden || 0), 0) : 0;
  const displayFindings = data?.totals?.total_findings ?? data?.totals?.findings ?? totalFired;
  const displayDismissed = data?.totals?.dismissed ?? totalDismissed;
  const displayOverridden = data?.totals?.overridden ?? totalOverridden;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-6 border-b border-line">
        <div>
          <h1 className="text-2xl font-bold font-display text-white tracking-tight">
            Compliance Engine Insights & Health
          </h1>
          <p className="text-xs text-muted mt-1">
            Analyze rule efficacy, identify over-triggering patterns, and eliminate review friction.
          </p>
        </div>

        <button
          onClick={fetchInsights}
          className="p-2.5 rounded-xl bg-card hover:bg-white/10 border border-line text-muted hover:text-white transition-all self-start md:self-auto"
          title="Refresh insights"
        >
          <RefreshCw size={15} className={isLoading ? "animate-spin" : ""} />
        </button>
      </div>

      {isLoading ? (
        <div className="py-20 text-center text-muted font-mono text-xs animate-pulse">
          Computing rule analytics from Supabase...
        </div>
      ) : !data ? (
        <div className="py-12 text-center text-muted text-xs">Failed to load analytics data.</div>
      ) : (
        <div className="mt-6 space-y-6">
            {/* Top KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-5 rounded-2xl bg-card border border-line">
                <span className="text-[10px] uppercase font-mono text-muted">Total Findings</span>
                <div className="mt-2 text-2xl font-extrabold font-display text-white">
                  {displayFindings}
                </div>
                <span className="text-[10px] text-muted font-mono mt-1 block">Triggered by engine</span>
              </div>

              <div className="p-5 rounded-2xl bg-card border border-line">
                <span className="text-[10px] uppercase font-mono text-muted">Dismissals</span>
                <div className="mt-2 text-2xl font-extrabold font-display text-primary">
                  {displayDismissed}
                </div>
                <span className="text-[10px] text-muted font-mono mt-1 block">Exceptions authorized</span>
              </div>

              <div className="p-5 rounded-2xl bg-card border border-line">
                <span className="text-[10px] uppercase font-mono text-muted">Review Overrides</span>
                <div className="mt-2 text-2xl font-extrabold font-display text-high">
                  {displayOverridden}
                </div>
                <span className="text-[10px] text-muted font-mono mt-1 block">Approved with warnings</span>
              </div>

              <div className="p-5 rounded-2xl bg-card border border-line">
                <span className="text-[10px] uppercase font-mono text-muted">Tracked Rules</span>
                <div className="mt-2 text-2xl font-extrabold font-display text-success">
                  {data.rules.length}
                </div>
                <span className="text-[10px] text-muted font-mono mt-1 block">Active guidelines</span>
              </div>
            </div>

          {/* Rules Health Table */}
          <div className="rounded-2xl bg-card border border-line overflow-hidden">
            <div className="p-4 bg-[#1D1D18]/80 border-b border-line flex items-center justify-between">
              <h2 className="text-xs font-bold uppercase font-mono text-white tracking-wider">
                Rule Efficacy & False-Positive Rate
              </h2>
              <span className="text-[10px] text-muted font-mono">
                Flag threshold: Dismissal &gt; 35%
              </span>
            </div>

            <table className="w-full text-left text-xs">
              <thead className="border-b border-line text-muted font-mono uppercase text-[10px]">
                <tr>
                  <th className="px-5 py-3 font-semibold">Rule / Guideline</th>
                  <th className="px-5 py-3 font-semibold">Fired</th>
                  <th className="px-5 py-3 font-semibold">Dismissed</th>
                  <th className="px-5 py-3 font-semibold">Dismissal Rate</th>
                  <th className="px-5 py-3 font-semibold">Governance Flag</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {data.rules.map((rule) => {
                  const ratePercent = Math.round(rule.dismissal_rate * 100);
                  const isHighRate = ratePercent > 35;
                  return (
                    <tr key={rule.evidence_id} className="hover:bg-white/5 transition-colors">
                      <td className="px-5 py-4">
                        <div className="font-semibold text-white font-mono text-xs">
                          {rule.evidence_id}
                        </div>
                        <div className="text-[11px] text-muted mt-0.5">{rule.label}</div>
                      </td>
                      <td className="px-5 py-4 font-mono text-white">{rule.fired}</td>
                      <td className="px-5 py-4 font-mono text-muted">{rule.dismissed}</td>
                      <td className="px-5 py-4 font-mono">
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-1.5 rounded-full bg-white/10 overflow-hidden">
                            <div
                              className={`h-full ${
                                isHighRate ? "bg-critical" : "bg-primary"
                              }`}
                              style={{ width: `${Math.min(ratePercent, 100)}%` }}
                            />
                          </div>
                          <span
                            className={
                              isHighRate ? "text-critical font-bold" : "text-muted"
                            }
                          >
                            {ratePercent}%
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        {rule.flag ? (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-high/20 border border-high/40 text-high font-mono text-[10px] font-bold">
                            <AlertTriangle size={12} />
                            <span>{rule.flag}</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-success text-[11px] font-mono">
                            <CheckCircle2 size={12} />
                            <span>Calibrated</span>
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Category Breakdown */}
          {data.by_category && (
            <div className="p-5 rounded-2xl bg-card border border-line">
              <h3 className="text-xs font-bold uppercase font-mono text-white mb-3">
                Violations by Category
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {Object.entries(data.by_category).map(([cat, count]) => (
                  <div key={cat} className="p-3 rounded-xl bg-[#0E0E0B] border border-line">
                    <span className="text-[10px] uppercase font-mono text-muted">
                      {cat.replace(/_/g, " ")}
                    </span>
                    <div className="mt-1 text-lg font-bold font-mono text-primary">{count}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
