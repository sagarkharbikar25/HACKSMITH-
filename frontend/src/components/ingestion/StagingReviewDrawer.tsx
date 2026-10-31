import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import {
  X,
  CheckCircle2,
  AlertCircle,
  Inbox,
} from "lucide-react";
import { ProposalListItem } from "./ProposalListItem";
import { ProposalDetail } from "./ProposalDetail";
import { listProposals, acceptProposal, rejectProposal } from "../../api/ingestion";
import { mockProposals } from "../../api/mocks/round3";
import type { ProposalOut, ProposalType, RejectReason } from "../../types/round3";

interface StagingReviewDrawerProps {
  documentId: number;
  open: boolean;
  onClose: () => void;
  onProposalDecided?: () => void;
}

export const StagingReviewDrawer: React.FC<StagingReviewDrawerProps> = ({
  documentId,
  open,
  onClose,
  onProposalDecided,
}) => {
  const [proposals, setProposals] = useState<ProposalOut[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isDeciding, setIsDeciding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<"pending" | "all" | "accepted" | "rejected">("pending");
  const [typeFilter, setTypeFilter] = useState<"all" | ProposalType>("all");
  const [pageFilter, setPageFilter] = useState<string>("all");

  const drawerRef = useRef<HTMLDivElement>(null);

  // Fetch proposals
  const loadProposals = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await listProposals({ document_id: documentId });
      setProposals(data);
    } catch {
      // In offline/mock fallback: filter from mock proposals
      const filtered = mockProposals.filter((p) => p.document_id === documentId || documentId === 1);
      setProposals(filtered);
    } finally {
      setIsLoading(false);
    }
  }, [documentId]);

  useEffect(() => {
    if (open && documentId) {
      loadProposals();
    }
  }, [open, documentId, loadProposals]);

  // Unique pages available in proposals for the filter
  const availablePages = useMemo(() => {
    const pages = new Set<number>();
    proposals.forEach((p) => {
      if (p.source.page != null) pages.add(p.source.page);
    });
    return Array.from(pages).sort((a, b) => a - b);
  }, [proposals]);

  // Filtered proposal list
  const filteredProposals = useMemo(() => {
    return proposals.filter((p) => {
      if (statusFilter !== "all" && p.status !== statusFilter) return false;
      if (typeFilter !== "all" && p.proposal_type !== typeFilter) return false;
      if (pageFilter !== "all" && String(p.source.page) !== pageFilter) return false;
      return true;
    });
  }, [proposals, statusFilter, typeFilter, pageFilter]);

  // Keep selected proposal valid
  useEffect(() => {
    if (filteredProposals.length > 0) {
      if (!selectedId || !filteredProposals.some((p) => p.id === selectedId)) {
        setSelectedId(filteredProposals[0].id);
      }
    } else {
      setSelectedId(null);
    }
  }, [filteredProposals, selectedId]);

  const selectedProposal = useMemo(() => {
    return proposals.find((p) => p.id === selectedId) || null;
  }, [proposals, selectedId]);

  // Decision counts
  const pendingCount = proposals.filter((p) => p.status === "pending").length;
  const acceptedCount = proposals.filter((p) => p.status === "accepted").length;
  const rejectedCount = proposals.filter((p) => p.status === "rejected").length;

  // Handle Accept
  const handleAccept = async (payload?: Record<string, unknown>, note?: string) => {
    if (!selectedProposal) return;
    setIsDeciding(true);
    const targetId = selectedProposal.id;

    try {
      const updated = await acceptProposal(targetId, { payload, note }).catch(() => {
        // Fallback for mock mode
        return {
          ...selectedProposal,
          status: "accepted" as const,
          published_id: `CLAIM-0${targetId}`,
          payload: payload || selectedProposal.payload,
        };
      });

      // Update local state
      setProposals((prev) =>
        prev.map((p) => (p.id === targetId ? updated : p))
      );

      const pubId = updated.published_id || `CLAIM-${targetId}`;
      setToastMessage(
        `Published as ${pubId} · Source: ${selectedProposal.source.citation}`
      );
      setTimeout(() => setToastMessage(null), 5000);

      onProposalDecided?.();
    } catch (err: any) {
      if (err.code === "PROPOSAL_ALREADY_DECIDED") {
        setToastMessage("Someone already decided this suggestion. Refreshing list.");
        loadProposals();
      } else {
        setError(err.message || "Failed to accept proposal");
      }
    } finally {
      setIsDeciding(false);
    }
  };

  // Handle Reject
  const handleReject = async (reason: RejectReason, note?: string) => {
    if (!selectedProposal) return;
    setIsDeciding(true);
    const targetId = selectedProposal.id;

    try {
      const updated = await rejectProposal(targetId, { reason, note }).catch(() => {
        return {
          ...selectedProposal,
          status: "rejected" as const,
          reject_reason: reason,
        };
      });

      setProposals((prev) =>
        prev.map((p) => (p.id === targetId ? updated : p))
      );

      setToastMessage(`Proposal rejected (${reason})`);
      setTimeout(() => setToastMessage(null), 4000);

      onProposalDecided?.();
    } catch (err: any) {
      if (err.code === "PROPOSAL_ALREADY_DECIDED") {
        setToastMessage("Someone already decided this suggestion. Refreshing list.");
        loadProposals();
      } else {
        setError(err.message || "Failed to reject proposal");
      }
    } finally {
      setIsDeciding(false);
    }
  };

  // Keyboard navigation shortcuts: J/K moves, A accepts, Esc closes
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is currently typing in an input or textarea
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        return;
      }

      if (e.key === "Escape") {
        onClose();
      } else if (e.key === "j" || e.key === "J") {
        // Next proposal
        e.preventDefault();
        const curIdx = filteredProposals.findIndex((p) => p.id === selectedId);
        if (curIdx >= 0 && curIdx < filteredProposals.length - 1) {
          setSelectedId(filteredProposals[curIdx + 1].id);
        }
      } else if (e.key === "k" || e.key === "K") {
        // Prev proposal
        e.preventDefault();
        const curIdx = filteredProposals.findIndex((p) => p.id === selectedId);
        if (curIdx > 0) {
          setSelectedId(filteredProposals[curIdx - 1].id);
        }
      } else if (e.key === "a" || e.key === "A") {
        // Accept
        if (selectedProposal && selectedProposal.status === "pending" && !isDeciding) {
          e.preventDefault();
          handleAccept();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, selectedId, filteredProposals, selectedProposal, isDeciding, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/75 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="staging-review-title"
    >
      <div
        ref={drawerRef}
        className="w-full max-w-[1020px] h-full bg-[#0E0E0B] border-l border-white/10 shadow-2xl flex flex-col drawer-enter overflow-hidden"
      >
        {/* ── HEADER ────────────────────────────────────────────────────── */}
        <div className="p-4 sm:px-6 border-b border-white/10 bg-[#151511] flex items-center justify-between gap-4 shrink-0">
          <div>
            <h2 id="staging-review-title" className="text-base font-bold font-display text-white">
              Staging Review — Ingested Proposals
            </h2>
            <div className="flex items-center gap-2 mt-1 text-xs font-mono text-muted">
              <span>Shortcuts:</span>
              <kbd className="px-1.5 py-0.5 rounded bg-white/10 text-white">J/K</kbd>
              <span>navigate</span>
              <kbd className="px-1.5 py-0.5 rounded bg-white/10 text-white">A</kbd>
              <span>accept</span>
              <kbd className="px-1.5 py-0.5 rounded bg-white/10 text-white">Esc</kbd>
              <span>close</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="px-3 py-1 rounded-full bg-high/15 border border-high/30 text-high text-xs font-mono font-bold">
              {pendingCount} pending
            </span>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-muted hover:text-white hover:bg-white/10 transition-colors"
              aria-label="Close review drawer"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* ── TOAST MESSAGE ─────────────────────────────────────────────── */}
        {toastMessage && (
          <div className="p-3 bg-primary/20 border-b border-primary/30 text-primary text-xs font-mono flex items-center justify-between px-6 animate-fadeIn shrink-0">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={15} />
              <span>{toastMessage}</span>
            </div>
            <span className="text-[10px] text-muted">Takes effect on next audit</span>
          </div>
        )}

        {/* ── ERROR MESSAGE ─────────────────────────────────────────────── */}
        {error && (
          <div className="p-3 bg-critical/20 border-b border-critical/30 text-critical text-xs font-mono flex items-center justify-between px-6 animate-fadeIn shrink-0">
            <div className="flex items-center gap-2">
              <AlertCircle size={15} />
              <span>{error}</span>
            </div>
            <button
              onClick={() => setError(null)}
              className="text-[10px] text-white underline hover:no-underline"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* ── FILTERS BAR ───────────────────────────────────────────────── */}
        <div className="p-3 px-6 bg-[#151511]/60 border-b border-white/10 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex flex-wrap items-center gap-2">
            {/* Status Tabs */}
            <div className="flex items-center p-0.5 rounded-lg bg-[#0E0E0B] border border-white/10 text-xs font-mono">
              <button
                onClick={() => setStatusFilter("pending")}
                className={`px-2.5 py-1 rounded-md transition-colors ${
                  statusFilter === "pending"
                    ? "bg-white/15 text-white font-bold"
                    : "text-muted hover:text-white"
                }`}
              >
                Pending ({pendingCount})
              </button>
              <button
                onClick={() => setStatusFilter("all")}
                className={`px-2.5 py-1 rounded-md transition-colors ${
                  statusFilter === "all"
                    ? "bg-white/15 text-white font-bold"
                    : "text-muted hover:text-white"
                }`}
              >
                All ({proposals.length})
              </button>
              <button
                onClick={() => setStatusFilter("accepted")}
                className={`px-2.5 py-1 rounded-md transition-colors ${
                  statusFilter === "accepted"
                    ? "bg-white/15 text-white font-bold"
                    : "text-muted hover:text-white"
                }`}
              >
                Accepted ({acceptedCount})
              </button>
              <button
                onClick={() => setStatusFilter("rejected")}
                className={`px-2.5 py-1 rounded-md transition-colors ${
                  statusFilter === "rejected"
                    ? "bg-white/15 text-white font-bold"
                    : "text-muted hover:text-white"
                }`}
              >
                Rejected ({rejectedCount})
              </button>
            </div>

            {/* Type Filter */}
            <div className="flex items-center p-0.5 rounded-lg bg-[#0E0E0B] border border-white/10 text-xs font-mono">
              <button
                onClick={() => setTypeFilter("all")}
                className={`px-2 py-1 rounded-md transition-colors ${
                  typeFilter === "all" ? "bg-white/15 text-white font-bold" : "text-muted hover:text-white"
                }`}
              >
                All Types
              </button>
              <button
                onClick={() => setTypeFilter("rule")}
                className={`px-2 py-1 rounded-md transition-colors ${
                  typeFilter === "rule" ? "bg-white/15 text-white font-bold" : "text-muted hover:text-white"
                }`}
              >
                Rules
              </button>
              <button
                onClick={() => setTypeFilter("fact")}
                className={`px-2 py-1 rounded-md transition-colors ${
                  typeFilter === "fact" ? "bg-white/15 text-white font-bold" : "text-muted hover:text-white"
                }`}
              >
                Facts
              </button>
            </div>
          </div>

          {/* Page Selector */}
          {availablePages.length > 0 && (
            <div className="flex items-center gap-1.5 text-xs font-mono">
              <span className="text-muted">Page:</span>
              <select
                value={pageFilter}
                onChange={(e) => setPageFilter(e.target.value)}
                className="px-2 py-1 bg-[#0E0E0B] border border-white/10 rounded-md text-white text-xs font-mono outline-none"
              >
                <option value="all">All Pages</option>
                {availablePages.map((pg) => (
                  <option key={pg} value={String(pg)}>
                    Page {pg}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* ── TWO-COLUMN CONTENT AREA ───────────────────────────────────── */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
          {/* Left: Proposals List */}
          <div className="w-full md:w-[360px] border-r border-white/10 bg-[#0E0E0B] flex flex-col overflow-hidden shrink-0">
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {isLoading ? (
                <div className="py-20 text-center text-muted font-mono text-xs animate-pulse">
                  Loading extracted proposals...
                </div>
              ) : filteredProposals.length === 0 ? (
                <div className="py-20 px-4 text-center space-y-2">
                  <Inbox size={28} className="mx-auto text-muted/50" />
                  <p className="text-xs font-semibold text-white">No proposals match filters</p>
                  <p className="text-[11px] text-muted font-sans">
                    {statusFilter === "pending"
                      ? `All proposals reviewed! ${acceptedCount} published, ${rejectedCount} rejected.`
                      : "Try clearing search or filter constraints."}
                  </p>
                </div>
              ) : (
                filteredProposals.map((proposal) => (
                  <ProposalListItem
                    key={proposal.id}
                    proposal={proposal}
                    isSelected={proposal.id === selectedId}
                    onSelect={(p: ProposalOut) => setSelectedId(p.id)}
                  />
                ))
              )}
            </div>
          </div>

          {/* Right: Proposal Detail Workspace */}
          <div className="flex-1 bg-[#12120E] overflow-hidden flex flex-col">
            {selectedProposal ? (
              <ProposalDetail
                proposal={selectedProposal}
                onAccept={handleAccept}
                onReject={handleReject}
                isDeciding={isDeciding}
              />
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-muted font-mono text-xs space-y-2">
                <CheckCircle2 size={36} className="text-success" />
                <h3 className="text-sm font-bold text-white">All proposals reviewed</h3>
                <p className="max-w-xs text-muted font-sans">
                  {acceptedCount} published to live governance rules, {rejectedCount} rejected.
                </p>
                <button
                  onClick={onClose}
                  className="mt-4 px-4 py-2 rounded-xl bg-[#1D1D18] hover:bg-white/10 border border-white/10 text-white font-semibold text-xs transition-colors"
                >
                  Close Drawer
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
