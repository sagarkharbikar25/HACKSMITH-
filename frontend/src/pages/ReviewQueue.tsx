import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { CheckSquare, ArrowRight, AlertTriangle, CheckCircle2, RefreshCw } from "lucide-react";
import { api } from "../api/client";
import type { Submission } from "../types";
import { DecisionModal } from "../components/DecisionModal";

export const ReviewQueue: React.FC = () => {
  const [queue, setQueue] = useState<Submission[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedSubForDecision, setSelectedSubForDecision] = useState<Submission | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fetchQueue = async () => {
    setIsLoading(true);
    try {
      const data = await api.review.queue();
      setQueue(data);
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to load review queue");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchQueue();
  }, []);

  const handleDecisionSubmit = async (
    decision: "approve" | "request_revision",
    comment: string,
    overrideReason?: string
  ) => {
    if (!selectedSubForDecision) return;
    try {
      await api.review.decide(selectedSubForDecision.id, {
        decision,
        comment,
        override_reason: overrideReason,
      });
      setSuccessMessage(
        `Decision '${decision.toUpperCase()}' recorded successfully for '${selectedSubForDecision.title}'.`
      );
      setSelectedSubForDecision(null);
      await fetchQueue();
    } catch (err: any) {
      throw err;
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-6 border-b border-line">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold font-display text-white tracking-tight">
              Compliance Review Queue
            </h1>
            <span className="px-2 py-0.5 rounded-full bg-primary/20 text-primary border border-primary/30 font-mono text-xs font-bold">
              {queue.length} Pending
            </span>
          </div>
          <p className="text-xs text-muted mt-1">
            Review submitted marketing copy, verify factual accuracy, and record governance decisions.
          </p>
        </div>

        <button
          onClick={fetchQueue}
          className="p-2.5 rounded-xl bg-card hover:bg-white/10 border border-line text-muted hover:text-white transition-all self-start md:self-auto"
          title="Refresh queue"
        >
          <RefreshCw size={15} className={isLoading ? "animate-spin" : ""} />
        </button>
      </div>

      {successMessage && (
        <div className="mt-4 p-3 rounded-xl bg-success/10 border border-success/30 text-success text-xs flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 size={15} />
          <span>{successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="mt-4 p-3 rounded-xl bg-critical/10 border border-critical/30 text-critical text-xs flex items-center gap-2 animate-in fade-in">
          <AlertTriangle size={15} />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Queue List */}
      <div className="mt-6">
        {isLoading ? (
          <div className="py-20 text-center text-muted font-mono text-xs animate-pulse">
            Loading review queue from Supabase...
          </div>
        ) : queue.length === 0 ? (
          <div className="p-12 text-center rounded-2xl bg-card border border-line">
            <CheckSquare className="w-10 h-10 text-muted mx-auto mb-3 opacity-50" />
            <h3 className="text-sm font-semibold text-white">Queue is clear!</h3>
            <p className="text-xs text-muted mt-1 max-w-sm mx-auto">
              No submissions currently waiting for reviewer approval.
            </p>
          </div>
        ) : (
          <div className="rounded-2xl bg-card border border-line overflow-hidden shadow-sm">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#1D1D18]/80 border-b border-line text-muted font-mono uppercase text-[10px]">
                <tr>
                  <th className="px-5 py-3 font-semibold">Submission</th>
                  <th className="px-5 py-3 font-semibold">Author ID</th>
                  <th className="px-5 py-3 font-semibold">Open Findings</th>
                  <th className="px-5 py-3 font-semibold">Submitted</th>
                  <th className="px-5 py-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {queue.map((sub) => (
                  <tr key={sub.id} className="hover:bg-white/5 transition-colors">
                    <td className="px-5 py-4">
                      <Link
                        to={`/reviewer/evaluate/${sub.id}`}
                        className="font-semibold text-white hover:text-primary transition-colors text-sm block"
                      >
                        {sub.title}
                      </Link>
                      <div className="text-[10px] uppercase font-mono text-muted mt-0.5">
                        {sub.content_type} · Version {sub.latest_version || 1}
                      </div>
                    </td>
                    <td className="px-5 py-4 font-mono text-muted">
                      User #{sub.author_id}
                    </td>
                    <td className="px-5 py-4">
                      {sub.open_findings_count > 0 ? (
                        <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-high/20 border border-high/40 text-high text-[11px] font-mono font-bold">
                          <AlertTriangle size={12} />
                          <span>{sub.open_findings_count} Open Findings</span>
                        </div>
                      ) : (
                        <span className="flex items-center gap-1 text-success font-semibold">
                          <CheckCircle2 size={13} />
                          <span>Clean</span>
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-muted text-[11px]">
                      {new Date(sub.updated_at).toLocaleDateString()}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          to={`/reviewer/evaluate/${sub.id}`}
                          className="px-3 py-1.5 rounded-lg bg-card hover:bg-white/10 border border-line text-xs font-semibold text-white transition-colors"
                        >
                          Inspect Copy
                        </Link>
                        <button
                          onClick={() => setSelectedSubForDecision(sub)}
                          className="px-3 py-1.5 rounded-lg bg-primary hover:bg-primary/90 text-black text-xs font-bold transition-all shadow-sm flex items-center gap-1"
                        >
                          <span>Make Decision</span>
                          <ArrowRight size={12} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Decision Modal */}
      {selectedSubForDecision && (
        <DecisionModal
          isOpen={!!selectedSubForDecision}
          onClose={() => setSelectedSubForDecision(null)}
          onSubmit={handleDecisionSubmit}
          hasOpenFindings={selectedSubForDecision.open_findings_count > 0}
          submissionTitle={selectedSubForDecision.title}
        />
      )}
    </div>
  );
};
