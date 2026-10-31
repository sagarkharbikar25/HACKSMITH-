/**
 * api/ingestion.ts — Knowledge document ingestion endpoints (Round 3)
 */

import { apiUpload, apiDelete } from "./client";
import type {
  DocumentOut,
  ProposalOut,
  AcceptProposalIn,
  RejectProposalIn,
  ProposalType,
} from "../types/round3";

const BASE_URL = (import.meta.env.VITE_API_URL || "/api")
  .trim()
  .replace(/\/+$/, "");

async function apiFetch<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const token = sessionStorage.getItem("brandguard_token");
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options?.headers as Record<string, string>),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    const code = data?.error?.code ?? "UNKNOWN_ERROR";
    const message = data?.error?.message ?? res.statusText;
    const { ApiError } = await import("./client");
    throw new ApiError(res.status, message, code, data?.error?.details);
  }
  return res.json() as Promise<T>;
}

/** Upload a brand-guideline PDF or DOCX for automatic rule/fact extraction. Returns 202. */
export function ingestDocument(file: File, title: string): Promise<DocumentOut> {
  const form = new FormData();
  form.append("file", file);
  form.append("title", title);
  return apiUpload<DocumentOut>("/knowledge/ingest-document", form);
}

/** List all ingested documents for this workspace. */
export const listDocuments = (): Promise<DocumentOut[]> =>
  apiFetch<DocumentOut[]>("/knowledge/documents");

/** Get a single document (use with polling hook while status is queued/parsing/extracting). */
export const getDocument = (id: number): Promise<DocumentOut> =>
  apiFetch<DocumentOut>(`/knowledge/documents/${id}`);

/** Delete an ingested document and all its proposals. */
export const deleteDocument = (id: number): Promise<void> =>
  apiDelete(`/knowledge/documents/${id}`);

/** List proposals for a document, optionally filtered by status/type. */
export function listProposals(params: {
  status?: "pending" | "accepted" | "rejected";
  document_id?: number;
  type?: ProposalType;
} = {}): Promise<ProposalOut[]> {
  const clean: Record<string, string> = {};
  if (params.status) clean.status = params.status;
  if (params.document_id != null)
    clean.document_id = String(params.document_id);
  if (params.type) clean.type = params.type;
  const qs = new URLSearchParams(clean).toString();
  return apiFetch<ProposalOut[]>(
    `/knowledge/pending-proposals${qs ? `?${qs}` : ""}`
  );
}

/** Accept a proposal, optionally with edited payload and a decision note. */
export const acceptProposal = (
  id: number,
  body: AcceptProposalIn = {}
): Promise<ProposalOut> =>
  apiFetch<ProposalOut>(`/knowledge/pending-proposals/${id}/accept`, {
    method: "POST",
    body: JSON.stringify(body),
  });

/** Reject a proposal with a required reason and optional note. */
export const rejectProposal = (
  id: number,
  body: RejectProposalIn
): Promise<ProposalOut> =>
  apiFetch<ProposalOut>(`/knowledge/pending-proposals/${id}/reject`, {
    method: "POST",
    body: JSON.stringify(body),
  });
