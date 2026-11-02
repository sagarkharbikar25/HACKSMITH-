import React, { useState, useEffect, useCallback } from "react";
import {
  ShieldCheck,
  FileText,
  Search,
  UploadCloud,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Plus,
  CheckCircle2,
} from "lucide-react";
import { CreateRuleModal } from "../components/knowledge/CreateRuleModal";
import { api } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { useRound3Flags } from "../hooks/useRound3Flags";
import { listDocuments } from "../api/ingestion";
import { mockDocuments } from "../api/mocks/round3";
import { IngestionDropzone } from "../components/ingestion/IngestionDropzone";
import { DocumentStatusCard } from "../components/ingestion/DocumentStatusCard";
import { StagingReviewDrawer } from "../components/ingestion/StagingReviewDrawer";
import { SourceBadge } from "../components/ingestion/SourceBadge";
import type { Rule, Fact } from "../types";
import type { DocumentOut } from "../types/round3";

export const KnowledgeBase: React.FC = () => {
  const { user } = useAuth();
  const { flags } = useRound3Flags();

  const [activeTab, setActiveTab] = useState<"rules" | "facts">("rules");
  const [rules, setRules] = useState<Rule[]>([]);
  const [facts, setFacts] = useState<Fact[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // Ingestion panel state
  const isPrivileged = user?.role === "brand_manager" || user?.role === "admin";
  const [isIngestionOpen, setIsIngestionOpen] = useState(true);
  const [documents, setDocuments] = useState<DocumentOut[]>([]);
  const [activeReviewDocId, setActiveReviewDocId] = useState<number | null>(null);
  const [isCreateRuleOpen, setIsCreateRuleOpen] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Ingestion enabled if flag is set, or default true for development
  const ingestionEnabled = flags.ingestion || true;

  const loadDocuments = useCallback(async () => {
    try {
      const docs = await listDocuments();
      setDocuments(docs);
    } catch {
      // Fallback to mock documents for local offline resilience
      setDocuments(mockDocuments);
    }
  }, []);

  const loadData = useCallback(async () => {
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
  }, []);

  useEffect(() => {
    loadData();
    if (isPrivileged) {
      loadDocuments();
    }
  }, [isPrivileged, loadData, loadDocuments]);

  const handleDocumentUploaded = (newDoc: DocumentOut) => {
    setDocuments((prev) => [newDoc, ...prev]);
    // Auto-open review drawer for the new document
    setActiveReviewDocId(newDoc.id);
  };

  const filteredRules = rules.filter(
    (r) =>
      (r.id || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (r.message || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (r.tags || []).some((t) => (t || '').toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const filteredFacts = facts.filter(
    (f) =>
      (f.id || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (f.subject || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (f.statement || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (f.tags || []).some((t) => (t || '').toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      {/* ── TOP HEADER ────────────────────────────────────────────────── */}
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

      {/* ── SECTION 5.1: GUIDELINE INGESTION COLLAPSIBLE PANEL ────────── */}
      {isPrivileged && (
        <section className="rounded-2xl bg-[#12120E] border border-white/10 overflow-hidden shadow-lg">
          <button
            type="button"
            onClick={() => setIsIngestionOpen(!isIngestionOpen)}
            className="w-full p-4 sm:px-6 flex items-center justify-between bg-[#151511] hover:bg-white/5 transition-colors border-b border-white/5 text-left"
          >
            <div className="flex items-center gap-3">
              <span className="p-2 rounded-xl bg-ai/15 text-ai">
                <UploadCloud size={18} />
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-bold font-display text-white">
                    Guideline Ingestion & Rule Staging
                  </h2>
                  <span className="px-2 py-0.5 rounded-md bg-ai/10 border border-ai/20 text-[10px] font-mono text-ai font-semibold flex items-center gap-1">
                    <Sparkles size={10} /> Round 3 AI
                  </span>
                </div>
                <p className="text-xs text-muted font-sans mt-0.5">
                  Drop brand guideline PDFs or Word documents to automatically extract rules and facts.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 text-muted">
              <span className="text-xs font-mono hidden sm:inline">
                {documents.length} ingested documents
              </span>
              {isIngestionOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
            </div>
          </button>

          {isIngestionOpen && (
            <div className="p-6 space-y-6">
              {!ingestionEnabled ? (
                <div className="p-8 text-center text-muted font-mono text-xs">
                  Guideline ingestion isn't enabled in this environment.
                </div>
              ) : (
                <>
                  {/* Dropzone */}
                  <IngestionDropzone onUploaded={handleDocumentUploaded} />

                  {/* Recent Ingested Documents List */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-mono uppercase tracking-wider text-muted font-bold">
                        Ingested Guideline Documents ({documents.length})
                      </h3>
                    </div>

                    {documents.length === 0 ? (
                      <div className="p-8 rounded-xl bg-[#0E0E0B] border border-white/5 text-center text-muted font-mono text-xs">
                        No guideline documents yet. Drop a PDF or Word file to extract rules automatically.
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 gap-3">
                        {documents.map((doc) => (
                          <DocumentStatusCard
                            key={doc.id}
                            initialDocument={doc}
                            onReviewProposals={(docId) => setActiveReviewDocId(docId)}
                            onRetryUpload={(docId) => setActiveReviewDocId(docId)}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </section>
      )}

      {/* ── SEARCH BAR & ACTIONS ────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
          <input
            type="text"
            placeholder={`Search ${activeTab === "rules" ? "rules by pattern, directive or tag" : "facts by subject or statement"}...`}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-card border border-line rounded-xl text-xs text-white placeholder-muted/60 focus:outline-none focus:border-primary font-mono"
          />
        </div>

        {isPrivileged && activeTab === "rules" && (
          <button
            onClick={() => setIsCreateRuleOpen(true)}
            className="px-4 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-black font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-md shrink-0"
          >
            <Plus size={15} strokeWidth={2.5} />
            <span>Create Custom Rule</span>
          </button>
        )}
      </div>

      {/* ── CONTENT GRID: RULES / FACTS ───────────────────────────────── */}
      <div>
        {isLoading ? (
          <div className="py-20 text-center text-muted font-mono text-xs animate-pulse">
            Loading knowledge items...
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
                    <div className="flex items-center gap-2">
                      {rule.source_citation && (
                        <SourceBadge citation={rule.source_citation} />
                      )}
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
                    {(rule.tags || []).map((t) => (
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
                    <div className="flex items-center gap-2">
                      {fact.source_citation && (
                        <SourceBadge citation={fact.source_citation} />
                      )}
                      <span className="text-[10px] font-mono text-muted uppercase px-2 py-0.5 rounded bg-white/5 border border-line">
                        {fact.kind}
                      </span>
                    </div>
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
                    {(fact.tags || []).map((t) => (
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

      {/* ── STAGING REVIEW DRAWER ─────────────────────────────────────── */}
      {activeReviewDocId != null && (
        <StagingReviewDrawer
          documentId={activeReviewDocId}
          open={activeReviewDocId != null}
          onClose={() => setActiveReviewDocId(null)}
          onProposalDecided={() => {
            loadDocuments();
            loadData();
          }}
        />
      )}

      {/* ── CREATE CUSTOM RULE MODAL ──────────────────────────────────── */}
      <CreateRuleModal
        isOpen={isCreateRuleOpen}
        onClose={() => setIsCreateRuleOpen(false)}
        onRuleCreated={(newRule) => {
          setRules((prev) => [newRule, ...prev]);
          setToastMsg(`Published custom rule ${newRule.id} (${newRule.type}) successfully!`);
          setTimeout(() => setToastMsg(null), 5000);
          loadData();
        }}
      />

      {/* ── TOAST NOTIFICATION ────────────────────────────────────────── */}
      {toastMsg && (
        <div className="fixed bottom-6 right-6 z-50 p-4 rounded-xl bg-success text-black font-semibold text-xs shadow-2xl flex items-center gap-2 animate-bounce">
          <CheckCircle2 size={16} />
          <span>{toastMsg}</span>
        </div>
      )}
    </div>
  );
};
