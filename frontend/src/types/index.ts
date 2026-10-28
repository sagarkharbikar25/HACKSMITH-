export type Role = "creator" | "agency" | "reviewer" | "brand_manager" | "admin";

export interface User {
  id: number;
  name: string;
  email: string;
  role: Role;
  created_at: string;
}

export interface Excerpt {
  text: string;
  start: number;
  end: number;
}

export interface EvidenceRef {
  id: string;
  kind: string;
  label: string;
  last_reviewed?: string | null;
}

export interface Finding {
  id: number;
  issue_id: string;
  version_id: number;
  category: string;
  severity: "critical" | "high" | "medium" | "low";
  excerpt: Excerpt;
  explanation: string;
  evidence: EvidenceRef;
  suggested_correction?: string | null;
  verification_status: "verified" | "unverified" | "flagged";
  source_engine: "rules" | "llm" | "hybrid" | "gemini";
  resolution: "open" | "accepted" | "edited" | "dismissed";
  resolution_reason?: string | null;
}

export interface AuditSummary {
  critical: number;
  high: number;
  medium: number;
  low: number;
  total: number;
}

export interface AuditEngines {
  rules: string;
  llm: string;
  llm_reason?: string | null;
}

export interface AuditResult {
  submission_id: number;
  version_id: number;
  version: number;
  engines: AuditEngines;
  summary: AuditSummary;
  findings: Finding[];
}

export interface Version {
  id: number;
  submission_id: number;
  number: number;
  body: string;
  engines: Record<string, any>;
  created_at: string;
}

export interface Review {
  id: number;
  submission_id: number;
  version_id: number;
  reviewer_id: number;
  decision: "approve" | "request_revision";
  comment: string;
  override_reason?: string | null;
  created_at: string;
}

export interface Comment {
  id: number;
  submission_id: number;
  author_id: number;
  body: string;
  created_at: string;
}

export interface Submission {
  id: number;
  title: string;
  content_type: string;
  author_id: number;
  status: "draft" | "in_review" | "approved" | "revision_requested";
  created_at: string;
  updated_at: string;
  latest_version?: number;
  open_findings_count: number;
}

export interface SubmissionDetail extends Submission {
  versions: Version[];
  latest_findings: Finding[];
  reviews: Review[];
  comments: Comment[];
}

export interface Rule {
  id: string;
  type: string;
  pattern: Record<string, any>;
  severity: "critical" | "high" | "medium" | "low";
  message: string;
  suggestion?: string | null;
  tags: string[];
  status: string;
  last_reviewed?: string | null;
}

export interface Fact {
  id: string;
  topic: string;
  subject: string;
  aliases: string[];
  statement: string;
  structured_value: Record<string, any>;
  valid_from?: string | null;
  last_reviewed?: string | null;
  status: string;
  tags: string[];
  kind: string;
}

export interface RuleInsight {
  evidence_id: string;
  label: string;
  fired: number;
  dismissed: number;
  overridden: number;
  dismissal_rate: number;
  flag?: string | null;
}

export interface InsightsData {
  totals: Record<string, number>;
  rules: RuleInsight[];
  by_category: Record<string, number>;
}

export interface AuditLogItem {
  id: number;
  actor_id?: number | null;
  action: string;
  object_type: string;
  object_id?: string | null;
  meta: Record<string, any>;
  created_at: string;
}
