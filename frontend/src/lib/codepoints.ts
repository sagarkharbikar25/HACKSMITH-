/**
 * Unicode code-point aware text slicing.
 * Python string indices count Unicode code points (characters).
 * JavaScript string indices count UTF-16 code units (causing emojis and surrogate pairs to drift).
 * Array.from(str) accurately decomposes into code points.
 */

export function sliceByCodePoints(text: string, start: number, end: number): string {
  if (!text) return "";
  const chars = Array.from(text);
  return chars.slice(start, end).join("");
}

export function replaceByCodePoints(
  original: string,
  start: number,
  end: number,
  replacement: string
): string {
  if (!original) return replacement;
  const chars = Array.from(original);
  chars.splice(start, end - start, replacement);
  return chars.join("");
}
