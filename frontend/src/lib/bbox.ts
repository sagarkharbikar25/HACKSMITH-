/**
 * lib/bbox.ts — Normalized bounding box helpers
 * Bounding boxes from the API use fractions 0..1 (origin top-left).
 * These helpers convert them to SVG (0–1000 viewBox) or CSS (percent) coordinates.
 */

import type { BBox } from "../types/round3";

/** Scale from 0..1 fraction to a 0..1000 SVG viewBox coordinate */
export function bboxToSvg(bbox: BBox) {
  return {
    x: bbox.x * 1000,
    y: bbox.y * 1000,
    w: bbox.w * 1000,
    h: bbox.h * 1000,
  };
}

/** Scale from 0..1 fraction to CSS percentage strings (for absolute positioning) */
export function bboxToCss(bbox: BBox): {
  left: string;
  top: string;
  width: string;
  height: string;
} {
  return {
    left: `${bbox.x * 100}%`,
    top: `${bbox.y * 100}%`,
    width: `${bbox.w * 100}%`,
    height: `${bbox.h * 100}%`,
  };
}

/** Center point of a bbox (fractions) */
export function bboxCenter(bbox: BBox): { cx: number; cy: number } {
  return {
    cx: bbox.x + bbox.w / 2,
    cy: bbox.y + bbox.h / 2,
  };
}

/** Area of a bbox (fraction of total image area) */
export function bboxArea(bbox: BBox): number {
  return bbox.w * bbox.h;
}
