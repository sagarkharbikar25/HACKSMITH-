import React from "react";
import { ShieldCheck, FileText, Copy, GitFork } from "lucide-react";
import { SourceBadge } from "./SourceBadge";
import type { ProposalOut } from "../../types/round3";

interface ProposalListItemProps {
  proposal: ProposalOut;
  isSelected: boolean;
  onSelect: (p: ProposalOut) => void;
}

export const ProposalListItem: React.FC<ProposalListItemProps> = ({
  proposal,
  isSelected,
  onSelect,
}) => {
  const isRule = proposal.proposal_type === "rule";
  const title =
    (proposal.payload?.message as string) ||
    (proposal.payload?.statement as string) ||
    (proposal.payload?.subject as string) ||
    `Proposal #${proposal.id}`;

  const severity = (proposal.payload?.severity as string) || null;

  return (
    <div
      role="button"
      tabIndex={0}
      aria-current={isSelected ? "true" : undefined}
      onClick={() => onSelect(proposal)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect(proposal);
        }
      }}
      className={`p-3.5 rounded-xl border transition-all text-left cursor-pointer outline-none ${
        isSelected
          ? "bg-[#1D1D18] border-ai shadow-md ring-1 ring-ai/40"
          : "bg-[#151511] border-white/5 hover:border-white/20 hover:bg-[#1A1A14]"
      }`}
    >
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <div className="flex items-center gap-1.5 min-w-0">
          <span
            className={`p-1 rounded-md shrink-0 ${
              isRule ? "bg-primary/20 text-primary" : "bg-ai/20 text-ai"
            }`}
          >
            {isRule ? <ShieldCheck size={13} /> : <FileText size={13} />}
          </span>
          <span className="text-[10px] font-mono font-bold uppercase text-muted tracking-wider">
            {proposal.proposal_type}
          </span>
          {severity && (
            <span
              className={`text-[9px] font-mono uppercase px-1.5 py-0.2 rounded font-bold ${
                severity === "critical"
                  ? "bg-critical/20 text-critical"
                  : severity === "high"
                  ? "bg-high/20 text-high"
                  : "bg-medium/20 text-medium"
              }`}
            >
              {severity}
            </span>
          )}
        </div>

        {/* Status indicator dot & duplicate/conflict icons */}
        <div className="flex items-center gap-1.5 shrink-0">
          {proposal.duplicate_of && (
            <span title={`Duplicate of ${proposal.duplicate_of}`}>
              <Copy size={12} className="text-high animate-pulse" />
            </span>
          )}
          {proposal.conflicts_with && (
            <span title={`Conflicts with ${proposal.conflicts_with}`}>
              <GitFork size={12} className="text-critical animate-pulse" />
            </span>
          )}
          <span
            className={`w-2 h-2 rounded-full ${
              proposal.status === "accepted"
                ? "bg-success"
                : proposal.status === "rejected"
                ? "bg-critical"
                : "bg-high"
            }`}
            title={`Status: ${proposal.status}`}
          />
        </div>
      </div>

      <p className="text-xs text-ink font-sans line-clamp-2 leading-relaxed">
        {title}
      </p>

      <div className="mt-2 flex items-center justify-between gap-2 pt-2 border-t border-white/5">
        <SourceBadge source={proposal.source} />
        <span className="text-[10px] font-mono text-muted/70 shrink-0">
          Conf: {proposal.extraction_confidence}
        </span>
      </div>
    </div>
  );
};
