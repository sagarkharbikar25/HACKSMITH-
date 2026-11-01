/**
 * lib/format.ts — Formatting utilities (Round 3 additions)
 * Additive: does not break existing usage.
 */

/** Format a contrast ratio as "4.5:1" with tabular numerics */
export function formatRatio(ratio: number, decimals = 1): string {
  return `${ratio.toFixed(decimals)}:1`;
}

/** Format a fraction (0..1) as a percentage string e.g. "87%" */
export function formatPercent(fraction: number, decimals = 0): string {
  return `${(fraction * 100).toFixed(decimals)}%`;
}

/** Format bytes into human-readable string e.g. "1.4 MB" */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

/** Format a delta-E value as "38.2 ΔE" */
export function formatDeltaE(value: number): string {
  return `${value.toFixed(1)} ΔE`;
}

/** Format a date string to a readable locale string */
export function formatDate(isoString: string): string {
  try {
    return new Date(isoString).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return isoString;
  }
}

