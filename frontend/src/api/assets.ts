/**
 * api/assets.ts — Creative asset upload & visual finding endpoints (Round 3)
 */

import { apiUpload, apiBlob, apiDelete, ApiError } from "./client";
import type { AssetOut, AssetFindingOut, ResolveAssetFindingIn } from "../types/round3";

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

/** Upload a creative image asset to a submission. Returns 201 with findings. */
export function uploadAsset(submissionId: number, file: File): Promise<AssetOut> {
  const form = new FormData();
  form.append("file", file);
  return apiUpload<AssetOut>(`/submissions/${submissionId}/assets`, form);
}

/** List all active assets attached to a submission. */
export const listAssets = (submissionId: number): Promise<AssetOut[]> =>
  apiFetch<AssetOut[]>(`/submissions/${submissionId}/assets`);

/** Delete an asset and all its findings. Shows confirm dialog before calling. */
export const deleteAsset = (id: number): Promise<void> =>
  apiDelete(`/assets/${id}`);

/** Trigger a re-check of an asset's brand compliance (after palette rules change). */
export const recheckAsset = (id: number): Promise<AssetOut> =>
  apiFetch<AssetOut>(`/assets/${id}/recheck`, { method: "POST" });

/**
 * Fetch the binary content of an asset image using auth.
 * Use the `useAssetBlobUrl` hook instead of calling this directly in components.
 */
export const assetContent = (id: number): Promise<Blob> =>
  apiBlob(`/assets/${id}/content`);

/** Resolve (accept or dismiss) a visual finding on an asset. */
export const resolveAssetFinding = (
  id: number,
  body: ResolveAssetFindingIn
): Promise<AssetFindingOut> =>
  apiFetch<AssetFindingOut>(`/asset-findings/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });

