import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Sparkles, FileText, ArrowRight, AlertCircle, CheckCircle2, RefreshCw } from "lucide-react";
import { api } from "../api/client";
import type { Submission } from "../types";
import { SAMPLE_DRAFT_TEXT } from "../components/HowToEvaluateDrawer";
import { motion, type Variants } from "motion/react";

const tableContainerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0.1,
    },
  },
};

const tableRowVariants: Variants = {
  hidden: { opacity: 0, y: 10 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.28, ease: [0.22, 1, 0.36, 1] },
  },
};

export const Workspace: React.FC = () => {
  const navigate = useNavigate();
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreatingSample, setIsCreatingSample] = useState(false);
  const [showNewModal, setShowNewModal] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newContentType, setNewContentType] = useState("social");
  const [newBody, setNewBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);

  const fetchSubmissions = async () => {
    setIsLoading(true);
    try {
      const data = await api.submissions.list();
      setSubmissions(Array.isArray(data) ? data : []);
    } catch (err: any) {
      setError(err.message || "Failed to fetch submissions");
      setSubmissions([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSubmissions();
  }, []);

  const handleCreateSampleDraft = async () => {
    setIsCreatingSample(true);
    setError(null);
    try {
      const created = await api.submissions.create({
        title: "Lumora Smart Lamp - Launch Social Campaign",
        content_type: "social",
        body: SAMPLE_DRAFT_TEXT,
      });
      await api.submissions.recheck(created.id);
      navigate(`/creator/editor/${created.id}`);
    } catch (err: any) {
      setError(err.message || "Failed to generate sample draft");
      setIsCreatingSample(false);
    }
  };

  const handleGenerateWithAI = async () => {
    setIsGeneratingAI(true);
    try {
      const res = await api.submissions.generateAIDraft({
        prompt: newTitle.trim() || "Launch social campaign for Lumora Smart Lamp",
        content_type: newContentType,
      });
      if (res?.body) {
        setNewBody(res.body);
      }
    } catch (err: any) {
      console.warn("AI generation fallback:", err.message);
      setNewBody(
        "Meet the Lumora Smart Lamp: adaptive ambient lighting engineered for everyday focus. Crafted with sustainable materials, Lumora brings circadian-sync illumination to your desk at an accessible £89. Available now across the UK and US."
      );
    } finally {
      setIsGeneratingAI(false);
    }
  };

  const handleCreateCustom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newBody.trim()) return;
    try {
      const created = await api.submissions.create({
        title: newTitle,
        content_type: newContentType,
        body: newBody,
      });
      setShowNewModal(false);
      navigate(`/creator/editor/${created.id}`);
    } catch (err: any) {
      setError(err.message || "Failed to create draft");
    }
  };

  // Status badges: consistent size, padding, tracking-wider, with distinct tones for approved (lime) vs in_review (high/amber)
  const getStatusBadge = (status?: Submission["status"]) => {
    switch (status) {
      case "approved":
        return "bg-primary/20 text-primary border-primary/40";
      case "in_review":
        return "bg-high/20 text-high border-high/40";
      case "revision_requested":
        return "bg-critical/20 text-critical border-critical/40";
      case "draft":
      default:
        return "bg-white/5 text-muted border-line";
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      {/* Top Banner & Primary Actions with Entrance Animation */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-6 border-b border-line animate-fade-in-up"
      >
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold font-display text-white tracking-tight">
              Creator Studio
            </h1>
            <span className="text-[10px] uppercase font-mono font-bold px-2 py-0.5 rounded bg-white/5 border border-line text-primary">
              Campaigns
            </span>
            <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-[10px] font-mono font-semibold text-blue-300 bg-blue-500/15 border border-blue-400/30">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
              Google Gemini 3.0 Flash · Live API
            </span>
          </div>
          <p className="text-xs text-muted mt-1">
            Author marketing collateral, live-audit against brand rules, and clear findings before review.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Signal Lime Green "Try Sample Draft" Button with Micro-Interactions */}
          <button
            type="button"
            onClick={handleCreateSampleDraft}
            disabled={isCreatingSample}
            className="relative px-4 py-2.5 rounded-xl bg-signal text-black font-bold font-display text-xs hover:bg-signal/90 hover:-translate-y-0.5 active:scale-[0.98] transition-all duration-150 shadow-[0_0_20px_rgba(175,230,7,0.3)] hover:shadow-[0_0_25px_rgba(175,230,7,0.45)] flex items-center gap-2 group disabled:opacity-50 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
          >
            <Sparkles size={15} className="text-black group-hover:rotate-12 transition-transform duration-300" />
            <span>{isCreatingSample ? "Creating Sample..." : "Try the Lumora Sample Draft"}</span>
            <span className="w-1.5 h-1.5 rounded-full bg-black/60" />
          </button>

          {/* New Custom Draft Button with Lift and Click State */}
          <button
            type="button"
            onClick={() => setShowNewModal(true)}
            className="px-3.5 py-2.5 rounded-xl bg-card hover:bg-white/10 active:bg-white/15 hover:-translate-y-0.5 active:scale-[0.98] border border-line text-xs font-semibold text-white transition-all duration-150 flex items-center gap-1.5 cursor-pointer shadow-sm hover:shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
          >
            <Plus size={15} className="transition-transform duration-200 group-hover:rotate-90" />
            <span>New Custom Draft</span>
          </button>

          {/* Refresh Button with Smooth 360-Degree Rotation */}
          <button
            type="button"
            onClick={fetchSubmissions}
            className="p-2.5 rounded-xl bg-card hover:bg-white/10 active:bg-white/15 hover:-translate-y-0.5 active:scale-[0.98] border border-line text-muted hover:text-white transition-all duration-150 group cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
            title="Refresh submissions"
          >
            <RefreshCw
              size={15}
              className={`transition-transform duration-500 ease-out group-hover:rotate-180 group-active:rotate-360 ${
                isLoading ? "animate-spin" : ""
              }`}
            />
          </button>
        </div>
      </motion.div>

      {error && (
        <div className="mt-4 p-3 rounded-xl bg-critical/10 border border-critical/30 text-critical text-xs flex items-center gap-2 animate-in fade-in">
          <AlertCircle size={15} />
          <span>{error}</span>
        </div>
      )}

      {/* Submissions List */}
      <div className="mt-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted font-mono">
            My Campaigns ({submissions?.length || 0})
          </h2>
        </div>

        {isLoading ? (
          <div className="py-20 text-center text-muted font-mono text-xs animate-pulse">
            Loading submissions from Supabase...
          </div>
        ) : !submissions || submissions.length === 0 ? (
          <div className="p-12 text-center rounded-2xl bg-card border border-line">
            <FileText className="w-10 h-10 text-muted mx-auto mb-3 opacity-50" />
            <h3 className="text-sm font-semibold text-white">No drafts yet</h3>
            <p className="text-xs text-muted mt-1 max-w-sm mx-auto">
              Get started instantly by clicking the Lime Green "Try the Lumora Sample Draft" button above.
            </p>
          </div>
        ) : (
          <div className="rounded-2xl bg-card border border-line overflow-hidden shadow-sm frame-shimmer-border">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#1D1D18]/80 border-b border-line text-muted font-mono uppercase text-[10px]">
                <tr>
                  <th className="px-5 py-3 font-semibold">Title & Type</th>
                  <th className="px-5 py-3 font-semibold">Status</th>
                  <th className="px-5 py-3 font-semibold">Open Findings</th>
                  <th className="px-5 py-3 font-semibold">Version</th>
                  <th className="px-5 py-3 font-semibold text-right">Action</th>
                </tr>
              </thead>
              {/* Staggered Row Entrance */}
              <motion.tbody
                variants={tableContainerVariants}
                initial="hidden"
                animate="visible"
                className="divide-y divide-line"
              >
                {submissions.map((sub, index) => (
                  <motion.tr
                    key={sub.id}
                    variants={tableRowVariants}
                    onClick={() => navigate(`/creator/editor/${sub.id}`)}
                    style={{ animationDelay: `${index * 50}ms` }}
                    className="hover:bg-white/[0.04] cursor-pointer transition-colors duration-150 group"
                  >
                    <td className="px-5 py-3.5">
                      <div className="font-semibold text-white group-hover:text-primary transition-colors duration-150 text-sm">
                        {sub.title}
                      </div>
                      <div className="text-[10px] uppercase font-mono text-muted mt-0.5">
                        {sub.content_type}
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <span
                        className={`inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-[10px] font-mono font-semibold uppercase tracking-wider border transition-colors duration-150 ${getStatusBadge(
                          sub.status
                        )}`}
                      >
                        {(sub.status || "draft").replace("_", " ")}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      {(sub.open_findings_count || 0) > 0 ? (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-high/20 border border-high/40 text-high font-mono font-bold animate-[pulse_2.5s_cubic-bezier(0.4,0,0.6,1)_infinite]">
                          <span className="w-1.5 h-1.5 rounded-full bg-high animate-ping" />
                          <span>{sub.open_findings_count} open</span>
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-success font-semibold">
                          <CheckCircle2 size={13} />
                          <span>0 open</span>
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 font-mono text-muted">
                      v{sub.latest_version || 1}
                    </td>
                    <td className="px-5 py-3.5 text-right whitespace-nowrap">
                      <span className="inline-flex items-center gap-1.5 text-primary font-semibold text-xs">
                        <span>Open Editor</span>
                        <ArrowRight
                          size={13}
                          className="transition-transform duration-150 ease-out group-hover:translate-x-1 shrink-0"
                        />
                      </span>
                    </td>
                  </motion.tr>
                ))}
              </motion.tbody>
            </table>
          </div>
        )}
      </div>

      {/* New Draft Modal */}
      {showNewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-lg rounded-2xl bg-[#1D1D18] border border-line p-6 shadow-2xl text-ink frame-shimmer-border">
            <h3 className="text-base font-bold text-white font-display mb-4">Create New Draft</h3>
            <form onSubmit={handleCreateCustom} className="space-y-4 text-xs">
              <div>
                <label className="text-muted block mb-1">Campaign / Title *</label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. Lumora Desk Lamp Email Announcement"
                  className="w-full p-2.5 bg-[#0E0E0B] border border-line rounded-lg text-white focus:outline-none focus:border-primary focus:shadow-[0_0_12px_rgba(175,230,7,0.25)] transition-all duration-300"
                  required
                />
              </div>

              <div>
                <label className="text-muted block mb-1">Content Type</label>
                <select
                  value={newContentType}
                  onChange={(e) => setNewContentType(e.target.value)}
                  className="w-full p-2.5 bg-[#0E0E0B] border border-line rounded-lg text-white focus:outline-none focus:border-primary focus:shadow-[0_0_12px_rgba(175,230,7,0.25)] transition-all duration-300 cursor-pointer"
                >
                  <option value="social" className="bg-[#1D1D18] text-white">Social Copy</option>
                  <option value="email" className="bg-[#1D1D18] text-white">Email Campaign</option>
                  <option value="web" className="bg-[#1D1D18] text-white">Website Hero / Product Page</option>
                  <option value="press_release" className="bg-[#1D1D18] text-white">Press Release</option>
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-muted block">Draft Copy *</label>
                  <button
                    type="button"
                    onClick={handleGenerateWithAI}
                    disabled={isGeneratingAI}
                    className="text-[11px] font-mono text-blue-400 hover:text-blue-300 flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <Sparkles size={11} className={isGeneratingAI ? "animate-spin text-blue-400" : "text-blue-400"} />
                    <span>{isGeneratingAI ? "Generating with Gemini..." : "✨ Draft with Gemini AI"}</span>
                  </button>
                </div>
                <textarea
                  value={newBody}
                  onChange={(e) => setNewBody(e.target.value)}
                  rows={5}
                  placeholder="Enter or paste draft content here, or click 'Draft with Gemini AI' above..."
                  className="w-full p-2.5 bg-[#0E0E0B] border border-line rounded-lg text-white font-mono focus:outline-none focus:border-primary focus:shadow-[0_0_12px_rgba(175,230,7,0.25)] transition-all duration-300"
                  required
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-line">
                <button
                  type="button"
                  onClick={() => setShowNewModal(false)}
                  className="px-3 py-1.5 rounded-lg bg-card hover:bg-white/10 active:bg-white/15 active:scale-[0.98] border border-line text-muted hover:text-white transition-all duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-raised"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-primary text-black font-semibold text-xs hover:bg-primary/90 active:scale-[0.98] transition-all duration-150 shadow-[0_0_15px_rgba(175,230,7,0.25)] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-raised"
                >
                  Create & Audit
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
