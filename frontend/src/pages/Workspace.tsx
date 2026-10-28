import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Sparkles, FileText, ArrowRight, AlertCircle, CheckCircle2, RefreshCw } from "lucide-react";
import { api } from "../api/client";
import type { Submission } from "../types";
import { SAMPLE_DRAFT_TEXT } from "../components/HowToEvaluateDrawer";

import { motion } from "motion/react";

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

  const fetchSubmissions = async () => {
    setIsLoading(true);
    try {
      const data = await api.submissions.list();
      setSubmissions(data);
    } catch (err: any) {
      setError(err.message || "Failed to fetch submissions");
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

  // Section 4: Status badges: Draft (muted), In review (primary), Approved (success), Revision requested (high)
  const getStatusBadge = (status: Submission["status"]) => {
    switch (status) {
      case "approved":
        return "bg-success/20 text-success border-success/40";
      case "in_review":
        return "bg-primary/20 text-primary border-primary/40";
      case "revision_requested":
        return "bg-high/20 text-high border-high/40";
      case "draft":
      default:
        return "bg-white/10 text-muted border-line";
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
      className="max-w-7xl mx-auto px-4 sm:px-6 py-8"
    >
      {/* Top Banner & Primary Actions */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-6 border-b border-line">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold font-display text-white tracking-tight">
              Creator Studio
            </h1>
            <span className="text-[10px] uppercase font-mono font-bold px-2 py-0.5 rounded bg-white/5 border border-line text-primary">
              Campaigns
            </span>
          </div>
          <p className="text-xs text-muted mt-1">
            Author marketing collateral, live-audit against brand rules, and clear findings before review.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Signal Lime Green "Try Sample Draft" Button (Section 1 & 4: only lime element) with P0-2 motion */}
          <motion.button
            whileHover={{ y: -1 }}
            whileTap={{ scale: 0.98 }}
            transition={{ duration: 0.12 }}
            onClick={handleCreateSampleDraft}
            disabled={isCreatingSample}
            className="relative px-4 py-2.5 rounded-xl bg-signal text-black font-bold font-display text-xs hover:bg-signal/90 shadow-[0_0_20px_rgba(175,230,7,0.3)] flex items-center gap-2 group disabled:opacity-50"
          >
            <Sparkles size={15} className="text-black group-hover:rotate-12 transition-transform" />
            <span>{isCreatingSample ? "Creating Sample..." : "Try the Lumora Sample Draft"}</span>
            <span className="w-1.5 h-1.5 rounded-full bg-black/60" />
          </motion.button>

          <button
            onClick={() => setShowNewModal(true)}
            className="px-3.5 py-2.5 rounded-xl bg-card hover:bg-white/10 border border-line text-xs font-semibold text-white transition-all flex items-center gap-1.5"
          >
            <Plus size={15} />
            <span>New Custom Draft</span>
          </button>

          <button
            onClick={fetchSubmissions}
            className="p-2.5 rounded-xl bg-card hover:bg-white/10 border border-line text-muted hover:text-white transition-all"
            title="Refresh submissions"
          >
            <RefreshCw size={15} className={isLoading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {error && (
        <div className="mt-4 p-3 rounded-xl bg-critical/10 border border-critical/30 text-critical text-xs flex items-center gap-2">
          <AlertCircle size={15} />
          <span>{error}</span>
        </div>
      )}

      {/* Submissions List */}
      <div className="mt-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted font-mono">
            My Campaigns ({submissions.length})
          </h2>
        </div>

        {isLoading ? (
          <div className="py-20 text-center text-muted font-mono text-xs animate-pulse">
            Loading submissions from Supabase...
          </div>
        ) : submissions.length === 0 ? (
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
              <tbody className="divide-y divide-line">
                {submissions.map((sub) => (
                  <tr
                    key={sub.id}
                    onClick={() => navigate(`/creator/editor/${sub.id}`)}
                    className="hover:bg-white/5 cursor-pointer transition-colors group"
                  >
                    <td className="px-5 py-3.5">
                      <div className="font-semibold text-white group-hover:text-primary transition-colors text-sm">
                        {sub.title}
                      </div>
                      <div className="text-[10px] uppercase font-mono text-muted mt-0.5">
                        {sub.content_type}
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-mono font-semibold uppercase border ${getStatusBadge(
                          sub.status
                        )}`}
                      >
                        {sub.status.replace("_", " ")}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      {sub.open_findings_count > 0 ? (
                        <span className="px-2 py-0.5 rounded bg-high/20 border border-high/40 text-high font-mono font-bold">
                          {sub.open_findings_count} open
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
                    <td className="px-5 py-3.5 text-right">
                      <span className="inline-flex items-center gap-1 text-primary group-hover:translate-x-1 transition-transform font-semibold text-xs">
                        Open Editor <ArrowRight size={13} />
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* New Draft Modal */}
      {showNewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
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
                  className="w-full p-2.5 bg-[#0E0E0B] border border-line rounded-lg text-white focus:outline-none focus:border-primary"
                  required
                />
              </div>

              <div>
                <label className="text-muted block mb-1">Content Type</label>
                <select
                  value={newContentType}
                  onChange={(e) => setNewContentType(e.target.value)}
                  className="w-full p-2.5 bg-[#0E0E0B] border border-line rounded-lg text-white focus:outline-none focus:border-primary"
                >
                  <option value="social" className="bg-[#1D1D18] text-white">Social Copy</option>
                  <option value="email" className="bg-[#1D1D18] text-white">Email Campaign</option>
                  <option value="web" className="bg-[#1D1D18] text-white">Website Hero / Product Page</option>
                  <option value="press_release" className="bg-[#1D1D18] text-white">Press Release</option>
                </select>
              </div>

              <div>
                <label className="text-muted block mb-1">Draft Copy *</label>
                <textarea
                  value={newBody}
                  onChange={(e) => setNewBody(e.target.value)}
                  rows={5}
                  placeholder="Enter or paste draft content here..."
                  className="w-full p-2.5 bg-[#0E0E0B] border border-line rounded-lg text-white font-mono focus:outline-none focus:border-primary"
                  required
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-line">
                <button
                  type="button"
                  onClick={() => setShowNewModal(false)}
                  className="px-3 py-1.5 rounded-lg bg-card hover:bg-white/10 border border-line text-muted hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-primary text-black font-semibold text-xs hover:bg-primary/90"
                >
                  Create & Audit
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </motion.div>
  );
};
