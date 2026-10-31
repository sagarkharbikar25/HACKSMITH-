/**
 * Round 3 interim hand-typed types — matches Contract v3 exactly.
 * At R3-G1: replace bodies with generated aliases from `./api` and delete these bodies.
 */

export type Severity = "critical" | "high" | "medium" | "low";

export type VerificationStatus =
  | "confirmed_contradiction"
  | "unsupported_claim"
  | "style_issue"
  | "needs_human_verification";

export type Resolution = "open" | "accepted" | "edited" | "dismissed";

/* ---------- additive changes to existing Finding/Engine objects ---------- */

export type FindingSource = "rules" | "llm" | "semantic";

export interface FindingR3Extension {
  /** 0..1, only when match_type === 'semantic' */
  similarity?: number | null;
  match_type?: "exact" | "semantic";
  source_engine: FindingSource;
}

export interface EnginesR3Extension {
  semantic?: "ran" | "disabled" | "unavailable";
  semantic_reason?: string | null;
}

export interface Round3Health {
  ingestion: boolean;
  vision: boolean;
  semantic: boolean;
  embeddings_indexed: number;
}

/* ---------- ingestion ---------- */

export interface SourceRef {
  document_id: number;
  document_title: string;
  page: number | null;
  section: string | null;
  /** e.g. "Brand Book 2026, Page 14" */
  citation: string;
  /** verbatim excerpt from the document */
  excerpt: string;
}

export type DocumentStatus =
  | "queued"
  | "parsing"
  | "extracting"
  | "ready"
  | "partial"
  | "failed";

export interface DocumentOut {
  id: number;
  title: string;
  filename: string;
  mime: string;
  page_count: number | null;
  status: DocumentStatus;
  stage: string;
  chunks_total: number;
  chunks_done: number;
  error_code: string | null;
  error_message: string | null;
  generator: "ai" | "heuristic" | null;
  proposal_counts: Partial<Record<"pending" | "accepted" | "rejected", number>>;
  uploaded_by: string;
  created_at: string;
  finished_at: string | null;
}

export type ProposalType = "rule" | "fact";

export interface ProposalOut {
  id: number;
  document_id: number;
  proposal_type: ProposalType;
  /** RuleCreate | FactCreate — use existing editor types for form fields */
  payload: Record<string, unknown>;
  source: SourceRef;
  extraction_confidence: "high" | "medium" | "low";
  duplicate_of: string | null;
  conflicts_with: string | null;
  status: "pending" | "accepted" | "rejected";
  edited: boolean;
  decision_note: string | null;
  reject_reason: string | null;
  published_id: string | null;
  decided_by: string | null;
  decided_at: string | null;
  created_at: string;
}

export interface AcceptProposalIn {
  payload?: Record<string, unknown>;
  note?: string;
}

export type RejectReason =
  | "not_a_rule"
  | "duplicate"
  | "incorrect_extraction"
  | "out_of_scope"
  | "other";

export interface RejectProposalIn {
  reason: RejectReason;
  note?: string;
}

/* ---------- visual / accessibility ---------- */

/** Normalized bounding box — fractions 0..1, origin top-left */
export interface BBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface PaletteColorOut {
  name: string;
  hex: string;
  role: "primary" | "secondary" | "accent" | "neutral";
}

export interface SwatchOut {
  hex: string;
  share: number;
  nearest_hex: string | null;
  nearest_name: string | null;
  delta_e: number | null;
  status: "on_palette" | "off_palette" | "neutral_allowed" | "minor";
}

export interface PaletteMeasured {
  kind: "palette";
  found_hex: string;
  found_share: number;
  nearest_hex: string;
  nearest_name: string;
  delta_e: number;
  max_delta_e: number;
}

export interface ContrastMeasured {
  kind: "contrast";
  foreground_hex: string;
  background_hex: string;
  ratio: number;
  required_ratio: number;
  worst_case_ratio: number | null;
  busy_background: boolean;
  text_sample: string;
}

export interface AssetEvidenceRef {
  id: string;
  kind: "rule" | "fact";
  label: string;
  last_reviewed: string | null;
}

export interface AssetFindingOut {
  id: number;
  issue_id: string;
  asset_id: number;
  check_type: "palette" | "contrast";
  category: "visual" | "accessibility";
  severity: Severity;
  bbox: BBox;
  measured: PaletteMeasured | ContrastMeasured;
  explanation: string;
  evidence: AssetEvidenceRef;
  suggested_correction: string | null;
  verification_status: VerificationStatus;
  source_engine: "vision";
  resolution: Resolution;
  resolution_reason: string | null;
}

export interface AssetEngines {
  palette: "ran" | "disabled";
  contrast: "ran" | "unavailable" | "disabled";
  contrast_reason: string | null;
  text_detector: "gemini" | "mock" | "none";
}

export interface AssetOut {
  id: number;
  submission_id: number;
  version_id: number | null;
  filename: string;
  mime: string;
  width: number;
  height: number;
  size_bytes: number;
  active: boolean;
  created_at: string;
  engines: AssetEngines;
  dominant_colors: SwatchOut[];
  brand_palette: PaletteColorOut[];
  summary: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    total: number;
  };
  findings: AssetFindingOut[];
}

export interface ResolveAssetFindingIn {
  resolution: Exclude<Resolution, "open">;
  reason?: string;
}

/* ---------- guideline gaps ---------- */

export interface GapCluster {
  label: string;
  count: number;
  examples: string[];
  reasons: string[];
}

export interface RuleWording {
  message: string;
  suggestion: string | null;
  patterns: Record<string, unknown>;
  added_exceptions: string[];
}

export interface GapSuggestionOut {
  id: number;
  rule_id: string;
  rule_label: string;
  stats: {
    fired: number;
    dismissed: number;
    overridden: number;
    dismissal_rate: number;
  };
  clusters: GapCluster[];
  current_wording: RuleWording;
  proposed_wording: RuleWording;
  rationale: string;
  generator: "ai" | "heuristic";
  status: "pending" | "adopted" | "dismissed" | "undone" | "stale";
  created_at: string;
}

export interface AdoptWordingIn {
  proposed_wording?: RuleWording;
}
