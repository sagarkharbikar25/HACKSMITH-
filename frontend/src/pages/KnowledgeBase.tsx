import React, { useState, useEffect } from "react";
import { ShieldCheck, FileText, Search } from "lucide-react";
import { api } from "../api/client";
import type { Rule, Fact } from "../types";

export const KnowledgeBase: React.FC = () => {
  const [activeTab, setActiveTab] = useState<"rules" | "facts">("rules");
  const [rules, setRules] = useState<Rule[]>([]);
  const [facts, setFacts] = useState<Fact[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      try {
        const [rData, fData] = await Promise.all([
          api.knowledge.getRules(),
          api.knowledge.getFacts(),
        ]);
        setRules(rData);
        setFacts(fData);
      } catch (err) {
        console.error("Failed to load knowledge base:", err);
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, []);

  const filteredRules = rules.filter(
    (r) =>
      r.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.message.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.tags.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const filteredFacts = facts.filter(
    (f) =>
      f.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.statement.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.tags.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-6 border-b border-line">
        <div>
          <h1 className="text-2xl font-bold font-display text-white tracking-tight">
            Brand Knowledge Base & Governance
          </h1>
          <p className="text-xs text-muted mt-1">
            Deterministic rules and ground-truth specifications governing content verification.
          </p>
        </div>

        {/* Tab Controls */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-card border border-line">
          <button
            onClick={() => setActiveTab("rules")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
              activeTab === "rules"
                ? "bg-primary text-black shadow-sm"
                : "text-muted hover:text-white"
            }`}
          >
            <ShieldCheck size={14} />
            <span>Rules ({rules.length})</span>
          </button>
          <button
            onClick={() => setActiveTab("facts")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
              activeTab === "facts"
                ? "bg-primary text-black shadow-sm"
                : "text-muted hover:text-white"
            }`}
          >
            <FileText size={14} />
            <span>Facts ({facts.length})</span>
          </button>
        </div>
      </div>

      {/* Search Input */}
      <div className="mt-6 flex items-center gap-3">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
          <input
            type="text"
            placeholder={`Search ${activeTab === "rules" ? "rules by pattern or message" : "facts by subject or statement"}...`}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-card border border-line rounded-xl text-xs text-white placeholder-muted/60 focus:outline-none focus:border-primary font-mono"
          />
        </div>
      </div>

      {/* Content Grid */}
      <div className="mt-6">
        {isLoading ? (
          <div className="py-20 text-center text-muted font-mono text-xs animate-pulse">
            Loading knowledge items from Supabase...
          </div>
        ) : activeTab === "rules" ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredRules.map((rule) => (
              <div
                key={rule.id}
                className="p-5 rounded-2xl bg-card border border-line hover:border-primary/40 transition-colors flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-mono text-xs font-bold text-primary">{rule.id}</span>
                    <span
                      className={`text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded border ${
                        rule.severity === "critical"
                          ? "bg-critical/20 text-critical border-critical/40"
                          : rule.severity === "high"
                          ? "bg-high/20 text-high border-high/40"
                          : "bg-medium/20 text-medium border-medium/40"
                      }`}
                    >
                      {rule.severity}
                    </span>
                  </div>

                  <p className="text-xs text-white leading-relaxed font-sans">{rule.message}</p>

                  {rule.suggestion && (
                    <div className="mt-3 p-2.5 rounded-lg bg-success/10 border border-success/20 text-[11px] font-mono text-success">
                      <span className="text-[9px] uppercase block font-semibold">Recommended Alternative:</span>
                      {rule.suggestion}
                    </div>
                  )}

                  <div className="mt-3">
                    <pre className="p-2.5 rounded-lg bg-[#0E0E0B] border border-line text-[11px] font-mono text-muted overflow-x-auto">
                      {JSON.stringify(rule.pattern, null, 2)}
                    </pre>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-line flex flex-wrap items-center justify-between gap-2 text-[10px] font-mono text-muted">
                  <div className="flex items-center gap-1">
                    {rule.tags.map((t) => (
                      <span key={t} className="px-1.5 py-0.5 rounded bg-white/5">
                        #{t}
                      </span>
                    ))}
                  </div>
                  <span>Reviewed: {rule.last_reviewed || "Active"}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredFacts.map((fact) => (
              <div
                key={fact.id}
                className="p-5 rounded-2xl bg-card border border-line hover:border-primary/40 transition-colors flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-mono text-xs font-bold text-ai">{fact.id}</span>
                    <span className="text-[10px] font-mono text-muted uppercase px-2 py-0.5 rounded bg-white/5 border border-line">
                      {fact.kind}
                    </span>
                  </div>

                  <h3 className="text-sm font-bold text-white mb-1">
                    {fact.subject} <span className="text-xs text-muted font-normal">({fact.topic})</span>
                  </h3>

                  <p className="text-xs text-muted leading-relaxed font-sans mt-2">
                    {fact.statement}
                  </p>

                  {fact.structured_value && Object.keys(fact.structured_value).length > 0 && (
                    <div className="mt-3">
                      <pre className="p-2.5 rounded-lg bg-[#0E0E0B] border border-line text-[11px] font-mono text-primary overflow-x-auto">
                        {JSON.stringify(fact.structured_value, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>

                <div className="mt-4 pt-3 border-t border-line flex flex-wrap items-center justify-between gap-2 text-[10px] font-mono text-muted">
                  <div className="flex items-center gap-1">
                    {fact.tags.map((t) => (
                      <span key={t} className="px-1.5 py-0.5 rounded bg-white/5">
                        #{t}
                      </span>
                    ))}
                  </div>
                  <span>Status: {fact.status}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
