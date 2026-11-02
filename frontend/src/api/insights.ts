/**
 * api/insights.ts — Insights + Guideline Gap Suggestions endpoints (Round 3 additions)
 * Extends the existing insights.getSummary call in client.ts.
 */

import { ApiError } from "./client";
import type { GapSuggestionOut, AdoptWordingIn } from "../types/round3";
import type { InsightsData } from "../types";

const BASE_URL = (import.meta.env.VITE_API_URL || "/api")
  .trim()
  .replace(/\/+$/, "");

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
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
    throw new ApiError(res.status, message, code, data?.error?.details);
  }
  return res.json() as Promise<T>;
}

/** Existing summary endpoint — re-exported for convenience from this module. */
export const getInsightsSummary = (): Promise<InsightsData> =>
  apiFetch<InsightsData>("/insights/summary");

/** List current guideline gap suggestions. */
export const listGapSuggestions = (): Promise<GapSuggestionOut[]> =>
  apiFetch<GapSuggestionOut[]>("/insights/guideline-gaps");

/** Trigger AI analysis to generate fresh guideline gap suggestions (up to ~20 s). */
export const generateGapSuggestions = (): Promise<GapSuggestionOut[]> =>
  apiFetch<GapSuggestionOut[]>("/insights/guideline-gaps/generate", {
    method: "POST",
  });

/** Adopt an AI-suggested improved wording for a rule. */
export const adoptGapSuggestion = (
  id: number,
  body: AdoptWordingIn = {}
): Promise<GapSuggestionOut> =>
  apiFetch<GapSuggestionOut>(`/insights/guideline-gaps/${id}/adopt`, {
    method: "POST",
    body: JSON.stringify(body),
  });

/** Dismiss a gap suggestion (won't appear again unless re-generated). */
export const dismissGapSuggestion = (id: number): Promise<GapSuggestionOut> =>
  apiFetch<GapSuggestionOut>(`/insights/guideline-gaps/${id}/dismiss`, {
    method: "POST",
  });

/** Undo a previously adopted gap suggestion wording. Available for ~10 s via toast. */
export const undoGapSuggestion = (id: number): Promise<GapSuggestionOut> =>
  apiFetch<GapSuggestionOut>(`/insights/guideline-gaps/${id}/undo`, {
    method: "POST",
  });

