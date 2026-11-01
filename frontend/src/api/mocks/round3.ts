/**
 * api/mocks/round3.ts - Mock fixtures for VITE_MOCK_API=true
 * All handlers simulate 400-900 ms network delay to exercise loading states.
 * Matches section 3 types exactly.
 */

import type {
  DocumentOut,
  ProposalOut,
  AssetOut,
  GapSuggestionOut,
  Round3Health,
} from "../../types/round3";
import type { Finding } from "../../types";

// ---- Helpers ----------------------------------------------------------------

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function randomDelay(): Promise<void> {
  return delay(400 + Math.random() * 500);
}

// ---- Round 3 Health flags ---------------------------------------------------

export const mockRound3Health: Round3Health = {
  ingestion: true,
  vision: true,
  semantic: true,
  embeddings_indexed: 42,
};

// ---- Documents --------------------------------------------------------------

let _pollCount = 0;

export const mockDocuments: DocumentOut[] = [
  {
    id: 1,
    title: "Lumora Brand Book 2026",
    filename: "lumora_brand_book_2026.pdf",
    mime: "application/pdf",
    page_count: 16,
    status: "ready",
    stage: "Done",
    chunks_total: 7,
    chunks_done: 7,
    error_code: null,
    error_message: null,
    generator: "ai",
    proposal_counts: { pending: 11, accepted: 0, rejected: 0 },
    uploaded_by: "sk@test.com",
    created_at: new Date(Date.now() - 3600_000).toISOString(),
    finished_at: new Date(Date.now() - 3000_000).toISOString(),
  },
  {
    id: 2,
    title: "Lumora Tone of Voice Guide",
    filename: "tone_of_voice.docx",
    mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    page_count: null,
    status: "extracting",
    stage: "Extracting rules (3/7)",
    chunks_total: 7,
    chunks_done: 3,
    error_code: null,
    error_message: null,
    generator: "ai",
    proposal_counts: { pending: 0, accepted: 0, rejected: 0 },
    uploaded_by: "sk@test.com",
    created_at: new Date(Date.now() - 600_000).toISOString(),
    finished_at: null,
  },
];

/** Simulates document 2 progressing from extracting to ready after 3 polls */
export async function mockGetDocument(id: number): Promise<DocumentOut> {
  await randomDelay();
  const doc = mockDocuments.find((d) => d.id === id);
  if (!doc) throw new Error("Document " + id + " not found");

  if (id === 2) {
    _pollCount++;
    if (_pollCount >= 3) {
      return {
        ...doc,
        status: "ready",
        stage: "Done",
        chunks_done: 7,
        finished_at: new Date().toISOString(),
        proposal_counts: { pending: 6, accepted: 0, rejected: 0 },
      };
    }
    const done = Math.min(3 + _pollCount, 7);
    return {
      ...doc,
      chunks_done: done,
      stage: "Extracting rules (" + done + "/7)",
    };
  }

  return doc;
}

// ---- Proposals --------------------------------------------------------------

export const mockProposals: ProposalOut[] = [
  {
    id: 101,
    document_id: 1,
    proposal_type: "rule",
    payload: {
      type: "claim",
      severity: "high",
      message: "Do not describe Lumora as the world's best without verifiable proof.",
      suggestion: "Remove superlative or cite a third-party award.",
      phrases: ["world's best", "number one", "unmatched"],
    },
    source: {
      document_id: 1,
      document_title: "Lumora Brand Book 2026",
      page: 7,
      section: null,
      citation: "Lumora Brand Book 2026, Page 7",
      excerpt:
        "Never describe Lumora as the world's best lighting solution unless you can cite a verified, independent award or study.",
    },
    extraction_confidence: "high",
    duplicate_of: "CLAIM-01",
    conflicts_with: null,
    status: "pending",
    edited: false,
    decision_note: null,
    reject_reason: null,
    published_id: null,
    decided_by: null,
    decided_at: null,
    created_at: new Date(Date.now() - 3000_000).toISOString(),
  },
  {
    id: 102,
    document_id: 1,
    proposal_type: "rule",
    payload: {
      type: "tone",
      severity: "medium",
      message: "Lumora copy must be warm and approachable, never corporate or cold.",
      suggestion: "Rewrite in a conversational, human tone.",
      phrases: ["synergise", "leverage", "utilise", "facilitate"],
    },
    source: {
      document_id: 1,
      document_title: "Lumora Brand Book 2026",
      page: 3,
      section: "Tone of Voice",
      citation: "Lumora Brand Book 2026, Page 3",
      excerpt:
        "Our voice is warm, human and direct. Avoid jargon, corporate buzzwords or anything that feels distant.",
    },
    extraction_confidence: "high",
    duplicate_of: null,
    conflicts_with: null,
    status: "pending",
    edited: false,
    decision_note: null,
    reject_reason: null,
    published_id: null,
    decided_by: null,
    decided_at: null,
    created_at: new Date(Date.now() - 2900_000).toISOString(),
  },
  {
    id: 103,
    document_id: 1,
    proposal_type: "rule",
    payload: {
      type: "claim",
      severity: "critical",
      message:
        "All energy-efficiency claims must reference a specific tested standard (e.g. ENERGY STAR 2026).",
      suggestion: "Add the tested standard name and year, or remove the claim.",
      phrases: ["energy efficient", "energy saving", "eco-friendly"],
    },
    source: {
      document_id: 1,
      document_title: "Lumora Brand Book 2026",
      page: 11,
      section: "Product Claims",
      citation: "Lumora Brand Book 2026, Page 11",
      excerpt:
        "Any energy or efficiency claim must be linked to a named, current standard. Do not use vague descriptors such as eco-friendly alone.",
    },
    extraction_confidence: "high",
    duplicate_of: null,
    conflicts_with: null,
    status: "pending",
    edited: false,
    decision_note: null,
    reject_reason: null,
    published_id: null,
    decided_by: null,
    decided_at: null,
    created_at: new Date(Date.now() - 2800_000).toISOString(),
  },
  {
    id: 104,
    document_id: 1,
    proposal_type: "fact",
    payload: {
      topic: "product",
      subject: "Lumora Aura 3",
      statement:
        "The Lumora Aura 3 is available in Midnight Navy, Chalk White and Lumora Amber.",
      structured_value: {
        product: "Lumora Aura 3",
        available_colours: ["Midnight Navy", "Chalk White", "Lumora Amber"],
      },
    },
    source: {
      document_id: 1,
      document_title: "Lumora Brand Book 2026",
      page: 14,
      section: "Product Availability",
      citation: "Lumora Brand Book 2026, Page 14",
      excerpt:
        "The Aura 3 is currently available in three colourways: Midnight Navy, Chalk White and Lumora Amber.",
    },
    extraction_confidence: "high",
    duplicate_of: null,
    conflicts_with: "AF-014",
    status: "pending",
    edited: false,
    decision_note: null,
    reject_reason: null,
    published_id: null,
    decided_by: null,
    decided_at: null,
    created_at: new Date(Date.now() - 2700_000).toISOString(),
  },
  {
    id: 105,
    document_id: 1,
    proposal_type: "fact",
    payload: {
      topic: "brand",
      subject: "Lumora",
      statement: "Lumora was founded in 2019 and is headquartered in Copenhagen, Denmark.",
      structured_value: { founded: 2019, headquarters: "Copenhagen, Denmark" },
    },
    source: {
      document_id: 1,
      document_title: "Lumora Brand Book 2026",
      page: 2,
      section: "About Us",
      citation: "Lumora Brand Book 2026, Page 2",
      excerpt:
        "Lumora was founded in 2019 in Copenhagen, Denmark, with a mission to make great lighting accessible to every home.",
    },
    extraction_confidence: "high",
    duplicate_of: null,
    conflicts_with: null,
    status: "pending",
    edited: false,
    decision_note: null,
    reject_reason: null,
    published_id: null,
    decided_by: null,
    decided_at: null,
    created_at: new Date(Date.now() - 2600_000).toISOString(),
  },
  {
    id: 106,
    document_id: 1,
    proposal_type: "rule",
    payload: {
      type: "style",
      severity: "low",
      message: "Use Lumora not lumora or LUMORA in body copy.",
      suggestion: "Capitalise as Lumora throughout.",
      phrases: ["lumora", "LUMORA"],
    },
    source: {
      document_id: 1,
      document_title: "Lumora Brand Book 2026",
      page: 9,
      section: "Brand Name Usage",
      citation: "Lumora Brand Book 2026, Page 9",
      excerpt: "Always write our name as Lumora with an initial capital letter.",
    },
    extraction_confidence: "medium",
    duplicate_of: null,
    conflicts_with: null,
    status: "pending",
    edited: false,
    decision_note: null,
    reject_reason: null,
    published_id: null,
    decided_by: null,
    decided_at: null,
    created_at: new Date(Date.now() - 2500_000).toISOString(),
  },
];

// ---- Visual Assets ----------------------------------------------------------

export const mockAssets: AssetOut[] = [
  {
    id: 1,
    submission_id: 1,
    version_id: 1,
    filename: "lumora_bad_palette.png",
    mime: "image/png",
    width: 1200,
    height: 628,
    size_bytes: 410_000,
    active: true,
    created_at: new Date(Date.now() - 1800_000).toISOString(),
    engines: {
      palette: "ran",
      contrast: "ran",
      contrast_reason: null,
      text_detector: "gemini",
    },
    dominant_colors: [
      {
        hex: "#E63946",
        share: 0.34,
        nearest_hex: "#F2A93B",
        nearest_name: "Lumora Amber",
        delta_e: 38.2,
        status: "off_palette",
      },
      {
        hex: "#14213D",
        share: 0.42,
        nearest_hex: "#14213D",
        nearest_name: "Midnight Navy",
        delta_e: 0.0,
        status: "on_palette",
      },
      {
        hex: "#F4F6F0",
        share: 0.24,
        nearest_hex: null,
        nearest_name: null,
        delta_e: null,
        status: "neutral_allowed",
      },
    ],
    brand_palette: [
      { name: "Midnight Navy", hex: "#14213D", role: "primary" },
      { name: "Lumora Amber", hex: "#F2A93B", role: "accent" },
      { name: "Chalk White", hex: "#F4F6F0", role: "neutral" },
    ],
    summary: { critical: 0, high: 0, medium: 1, low: 0, total: 1 },
    findings: [
      {
        id: 1001,
        issue_id: "V-1",
        asset_id: 1,
        check_type: "palette",
        category: "visual",
        severity: "medium",
        bbox: { x: 0.08, y: 0.55, w: 0.5, h: 0.35 },
        measured: {
          kind: "palette",
          found_hex: "#E63946",
          found_share: 0.34,
          nearest_hex: "#F2A93B",
          nearest_name: "Lumora Amber",
          delta_e: 38.2,
          max_delta_e: 25,
        },
        explanation:
          "About 34% of this image uses #E63946 (a vivid red), which is not in the Lumora approved palette. The nearest approved colour is Lumora Amber (#F2A93B), but the difference (delta-E 38.2) exceeds the allowed threshold of 25.",
        evidence: {
          id: "VIS-01",
          kind: "rule",
          label: "Approved palette enforcement",
          last_reviewed: "2026-10-01T00:00:00Z",
        },
        suggested_correction:
          "Use Lumora Amber (#F2A93B) instead of #E63946 in this region.",
        verification_status: "style_issue",
        source_engine: "vision",
        resolution: "open",
        resolution_reason: null,
      },
    ],
  },
  {
    id: 2,
    submission_id: 1,
    version_id: 1,
    filename: "lumora_low_contrast.png",
    mime: "image/png",
    width: 1200,
    height: 628,
    size_bytes: 380_000,
    active: true,
    created_at: new Date(Date.now() - 1200_000).toISOString(),
    engines: {
      palette: "ran",
      contrast: "ran",
      contrast_reason: null,
      text_detector: "gemini",
    },
    dominant_colors: [
      {
        hex: "#FFFFFF",
        share: 0.7,
        nearest_hex: null,
        nearest_name: null,
        delta_e: null,
        status: "neutral_allowed",
      },
      {
        hex: "#14213D",
        share: 0.3,
        nearest_hex: "#14213D",
        nearest_name: "Midnight Navy",
        delta_e: 0.0,
        status: "on_palette",
      },
    ],
    brand_palette: [
      { name: "Midnight Navy", hex: "#14213D", role: "primary" },
      { name: "Lumora Amber", hex: "#F2A93B", role: "accent" },
      { name: "Chalk White", hex: "#F4F6F0", role: "neutral" },
    ],
    summary: { critical: 0, high: 1, medium: 0, low: 0, total: 1 },
    findings: [
      {
        id: 1002,
        issue_id: "V-2",
        asset_id: 2,
        check_type: "contrast",
        category: "accessibility",
        severity: "high",
        bbox: { x: 0.1, y: 0.12, w: 0.62, h: 0.14 },
        measured: {
          kind: "contrast",
          foreground_hex: "#C9C9C9",
          background_hex: "#FFFFFF",
          ratio: 2.8,
          required_ratio: 4.5,
          worst_case_ratio: 2.1,
          busy_background: false,
          text_sample: "Summer Sale",
        },
        explanation:
          "The text Summer Sale uses #C9C9C9 on a #FFFFFF background, giving a contrast ratio of 2.8:1. This fails WCAG AA 4.5:1 for normal text.",
        evidence: {
          id: "ACC-01",
          kind: "rule",
          label: "WCAG AA contrast minimum",
          last_reviewed: "2026-10-01T00:00:00Z",
        },
        suggested_correction:
          "Use Midnight Navy (#14213D) for this text. That pair achieves 11.8:1.",
        verification_status: "confirmed_contradiction",
        source_engine: "vision",
        resolution: "open",
        resolution_reason: null,
      },
    ],
  },
];

// ---- Semantic finding (text) -------------------------------------------------

export const mockSemanticFinding: Finding & {
  match_type: "semantic";
  similarity: number;
} = {
  id: 900,
  issue_id: "F-4",
  version_id: 1,
  category: "claim",
  severity: "high",
  excerpt: {
    text: "nothing on earth compares to this lamp",
    start: 0,
    end: 38,
  },
  explanation:
    "This sentence implies Lumora products are unrivalled without verifiable proof. It is semantically very similar to the approved rule CLAIM-01 (No superlatives without proof).",
  evidence: {
    id: "CLAIM-01",
    kind: "rule",
    label: "No superlatives without proof",
  },
  suggested_correction:
    "Remove the superlative claim, or cite a third-party award or study.",
  verification_status: "unsupported_claim" as any,
  source_engine: "rules" as any,
  resolution: "open",
  resolution_reason: null,
  match_type: "semantic",
  similarity: 0.94,
};

// ---- Gap Suggestions --------------------------------------------------------

export const mockGapSuggestions: GapSuggestionOut[] = [
  {
    id: 1,
    rule_id: "CLAIM-01",
    rule_label: "No superlatives without proof",
    stats: {
      fired: 12,
      dismissed: 7,
      overridden: 2,
      dismissal_rate: 0.583,
    },
    clusters: [
      {
        label: "best practices",
        count: 4,
        examples: [
          "We follow best practices in sustainable design",
          "Using best practices from leading consultancies",
          "Built on industry best practices",
          "Applying best practices across our range",
        ],
        reasons: ["Industry term", "Not a product claim", "Common usage"],
      },
      {
        label: "best-in-class design process",
        count: 3,
        examples: [
          "Lumora uses a best-in-class design process",
          "Our best-in-class process ensures quality",
          "Recognised for our best-in-class methodology",
        ],
        reasons: [
          "Process claim, not product claim",
          "Ambiguous",
          "Industry standard phrase",
        ],
      },
    ],
    current_wording: {
      message:
        "Avoid superlatives about Lumora or its products without citing a verifiable, independent source.",
      suggestion:
        "Remove the superlative, or add a citation (e.g. Awarded Best Smart Light 2026 - TechReview).",
      patterns: {
        banned_phrases: ["best in class", "world's best", "number one", "unmatched"],
      },
      added_exceptions: [],
    },
    proposed_wording: {
      message:
        "Avoid superlatives about Lumora products without citing a verifiable, independent source. Does not apply to process or methodology phrases such as best practices.",
      suggestion:
        "Remove the superlative, or add a citation. For general industry phrases like best practices, no action needed.",
      patterns: {
        banned_phrases: ["world's best", "number one", "unmatched"],
        allowed_exceptions: ["best practices", "best-in-class process"],
      },
      added_exceptions: ["best practices", "best-in-class process"],
    },
    rationale:
      "This rule fires frequently but 58% of decisions are dismissals. The most common dismissed phrases - best practices and best-in-class design process - describe general methodology, not product superiority. Adding explicit exceptions should reduce false positives while keeping the core rule intact.",
    generator: "ai",
    status: "pending",
    created_at: new Date(Date.now() - 86400_000).toISOString(),
  },
];

// ---- Mock API router (used when VITE_MOCK_API=true) -------------------------

export const round3MockHandlers = {
  "GET /health.round3": async (): Promise<Round3Health> => {
    await randomDelay();
    return mockRound3Health;
  },
  "GET /knowledge/documents": async (): Promise<DocumentOut[]> => {
    await randomDelay();
    return mockDocuments;
  },
  "GET /knowledge/documents/:id": async (id: number): Promise<DocumentOut> => {
    return mockGetDocument(id);
  },
  "POST /knowledge/ingest-document": async (): Promise<DocumentOut> => {
    await delay(800);
    return { ...mockDocuments[1], id: 99 };
  },
  "GET /knowledge/pending-proposals": async (): Promise<ProposalOut[]> => {
    await randomDelay();
    return mockProposals;
  },
  "POST /knowledge/pending-proposals/:id/accept": async (
    id: number
  ): Promise<ProposalOut> => {
    await randomDelay();
    const p = mockProposals.find((p) => p.id === id);
    if (!p) throw new Error("Not found");
    return { ...p, status: "accepted", published_id: "CLAIM-0" + id };
  },
  "POST /knowledge/pending-proposals/:id/reject": async (
    id: number
  ): Promise<ProposalOut> => {
    await randomDelay();
    const p = mockProposals.find((p) => p.id === id);
    if (!p) throw new Error("Not found");
    return { ...p, status: "rejected" };
  },
  "GET /submissions/:id/assets": async (): Promise<AssetOut[]> => {
    await randomDelay();
    return mockAssets;
  },
  "GET /insights/guideline-gaps": async (): Promise<GapSuggestionOut[]> => {
    await randomDelay();
    return mockGapSuggestions;
  },
  "POST /insights/guideline-gaps/generate": async (): Promise<GapSuggestionOut[]> => {
    await delay(900);
    return mockGapSuggestions;
  },
};

