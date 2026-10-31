/**
 * hooks/useRound3Flags.ts
 * Reads /api/health and /api/health.round3 to detect which R3 features are enabled.
 * Cached for 60 s. Returns safe defaults (all false) while loading or on error.
 *
 * Rule R0: if a feature is off, related UI must show an "not enabled" empty state
 * instead of erroring.
 */

import { useQuery } from "@tanstack/react-query";
import type { Round3Health } from "../types/round3";

const BASE_URL = (import.meta.env.VITE_API_URL || "/api")
  .trim()
  .replace(/\/+$/, "");

const DEFAULT_FLAGS: Round3Health = {
  ingestion: false,
  vision: false,
  semantic: false,
  embeddings_indexed: 0,
};

async function fetchRound3Health(): Promise<Round3Health> {
  const token = sessionStorage.getItem("brandguard_token");
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;

  // Try the dedicated R3 health endpoint first; fall back to defaults if not deployed yet
  try {
    const res = await fetch(`${BASE_URL}/health.round3`, { headers });
    if (res.ok) return res.json() as Promise<Round3Health>;
  } catch {
    // endpoint doesn't exist yet — safe fallback
  }

  // Secondary: parse /health for feature flags if available
  try {
    const res = await fetch(`${BASE_URL}/health`, { headers });
    if (res.ok) {
      const data = await res.json();
      if (data?.round3) return data.round3 as Round3Health;
    }
  } catch {
    // ignore
  }

  return DEFAULT_FLAGS;
}

export function useRound3Flags() {
  const { data, isLoading } = useQuery<Round3Health>({
    queryKey: ["round3-health"],
    queryFn: fetchRound3Health,
    staleTime: 60_000,   // cache for 60 s
    retry: false,        // don't retry — safe defaults are fine
  });

  return {
    flags: data ?? DEFAULT_FLAGS,
    isLoading,
  };
}
