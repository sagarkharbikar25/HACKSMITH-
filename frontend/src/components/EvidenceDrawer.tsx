import React, { useEffect, useState } from "react";
import { X, ShieldAlert, FileText, AlertCircle } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import type { EvidenceRef, Rule, Fact } from "../types";
import { api } from "../api/client";

interface Props {
  evidence: EvidenceRef | null;
  onClose: () => void;
}

export const EvidenceDrawer: React.FC<Props> = ({ evidence, onClose }) => {
  const [data, setData] = useState<{ rule?: Rule; fact?: Fact } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Close on Esc key per Section 5.3: P0-5
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    if (!evidence) {
      setData(null);
      return;
    }

    async function fetchDetail() {
      if (!evidence) return;
      setLoading(true);
      setError(null);
      try {
        if (evidence.kind === "rule") {
          const rule = await api.knowledge.getRule(evidence.id);
          setData({ rule });
        } else if (evidence.kind === "fact") {
          const fact = await api.knowledge.getFact(evidence.id);
          setData({ fact });
        }
      } catch (err: any) {
        setError(err.message || "Failed to load evidence metadata");
      } finally {
        setLoading(false);
      }
    }

    fetchDetail();
  }, [evidence]);

  return (
    <AnimatePresence>
      {evidence && (
        <div className="fixed inset-0 z-50 flex justify-end">
          {/* Dim Overlay with fade 160ms */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
          />

          {/* Drawer: width 420px, bg-raised (#1D1D18), slide from right 280ms */}
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="relative w-full max-w-[420px] h-full bg-raised border-l border-line p-6 overflow-y-auto text-ink shadow-2xl flex flex-col justify-between z-10"
          >
            <div>
              {/* Header with Mono Evidence ID per Section 4 */}
              <div className="flex items-center justify-between pb-4 border-b border-line">
                <div className="flex items-center gap-2.5">
                  <span className="p-2 rounded-xl bg-primary/20 text-primary">
                    {evidence.kind === "rule" ? <ShieldAlert size={18} /> : <FileText size={18} />}
                  </span>
                  <div>
                    <span className="font-mono text-sm font-bold text-white tracking-tight block">
                      {evidence.id}
                    </span>
                    <span className="text-[11px] text-muted font-sans">
                      {evidence.label}
                    </span>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="p-1 rounded-md text-muted hover:text-white hover:bg-white/10 transition-colors"
                  aria-label="Close drawer"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Status and Last Reviewed Date Banner */}
              <div className="mt-4 p-3 rounded-xl bg-card border border-line flex items-center justify-between text-xs font-mono">
                <span className="text-muted">Status: Active</span>
                <span className="text-primary tabular-nums">
                  Last Reviewed: {evidence.last_reviewed || "2026-Q1"}
                </span>
              </div>

              {/* Content Body */}
              <div className="mt-4 space-y-4">
                {loading && (
                  <div className="py-12 text-center text-muted font-mono text-xs animate-pulse">
                    Retrieving source evidence...
                  </div>
                )}

                {error && (
                  <div className="p-3.5 rounded-xl bg-critical/10 border border-critical/30 text-critical text-xs flex items-center gap-2">
                    <AlertCircle size={15} />
                    <span>{error}</span>
                  </div>
                )}

                {!loading && data?.rule && (
                  <div className="space-y-4">
                    <div className="p-4 rounded-xl bg-card border border-line">
                      <span className="text-[10px] uppercase font-mono text-muted block mb-1">
                        Severity Classification
                      </span>
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-bold uppercase font-mono ${
                          data.rule.severity === "critical"
                            ? "bg-critical/20 text-critical border border-critical/40"
                            : data.rule.severity === "high"
                            ? "bg-high/20 text-high border border-high/40"
                            : "bg-medium/20 text-medium border border-medium/40"
                        }`}
                      >
                        {data.rule.severity}
                      </span>
                    </div>

                    <div className="p-4 rounded-xl bg-card border border-line">
                      <span className="text-[10px] uppercase font-mono text-muted block mb-1">
                        Guideline Directive
                      </span>
                      <p className="text-xs text-white leading-relaxed font-sans">
                        {data.rule.message}
                      </p>
                    </div>

                    {data.rule.suggestion && (
                      <div className="p-4 rounded-xl bg-success/10 border border-success/30">
                        <span className="text-[10px] uppercase font-mono text-success font-semibold block mb-1">
                          Approved Brand Alternative
                        </span>
                        <p className="text-xs font-mono text-success">
                          {data.rule.suggestion}
                        </p>
                      </div>
                    )}

                    <div className="p-4 rounded-xl bg-card border border-line">
                      <span className="text-[10px] uppercase font-mono text-muted block mb-1">
                        Pattern Configuration
                      </span>
                      <pre className="p-2.5 rounded-lg bg-[#0E0E0B] border border-line text-[11px] font-mono text-muted overflow-x-auto">
                        {JSON.stringify(data.rule.pattern, null, 2)}
                      </pre>
                    </div>
                  </div>
                )}

                {!loading && data?.fact && (
                  <div className="space-y-4">
                    <div className="p-4 rounded-xl bg-card border border-line">
                      <span className="text-[10px] uppercase font-mono text-muted block mb-1">
                        Subject & Topic
                      </span>
                      <h4 className="text-xs font-bold text-white font-sans">
                        {data.fact.subject} <span className="text-muted font-normal">({data.fact.topic})</span>
                      </h4>
                    </div>

                    <div className="p-4 rounded-xl bg-card border border-line">
                      <span className="text-[10px] uppercase font-mono text-muted block mb-1">
                        Factual Ground Truth Statement
                      </span>
                      <p className="text-xs text-white leading-relaxed font-sans">
                        {data.fact.statement}
                      </p>
                    </div>

                    {data.fact.structured_value && Object.keys(data.fact.structured_value).length > 0 && (
                      <div className="p-4 rounded-xl bg-card border border-line">
                        <span className="text-[10px] uppercase font-mono text-muted block mb-1">
                          Structured Specifications
                        </span>
                        <pre className="p-2.5 rounded-lg bg-[#0E0E0B] border border-line text-[11px] font-mono text-primary overflow-x-auto">
                          {JSON.stringify(data.fact.structured_value, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-line flex justify-end">
              <button
                onClick={onClose}
                className="px-3.5 py-2 rounded-xl bg-card hover:bg-white/10 border border-line text-xs font-semibold text-white transition-colors"
              >
                Close Inspector
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
