/**
 * lib/errors.ts — Error code → user-friendly message map (Round 3)
 * Unknown codes fall back to the server `message` field.
 */

export const ERROR_MESSAGES: Record<string, string> = {
  FILE_TOO_LARGE:
    "That file is too big. Documents: up to 15 MB. Images: up to 5 MB.",
  UNSUPPORTED_FILE_TYPE:
    "We can read PDF or Word (.docx) guidelines, and PNG, JPG or WebP images.",
  DOCUMENT_UNREADABLE:
    "We couldn't read any text in this file. Try a text-based PDF or a .docx.",
  DOCUMENT_ENCRYPTED:
    "This PDF is password-protected. Remove the password and upload again.",
  DOCUMENT_TOO_LONG:
    "This document is longer than 60 pages. Split it and upload the relevant sections.",
  ASSET_INVALID_IMAGE:
    "This image looks damaged or too large in pixels. Export it again and retry.",
  ASSET_LIMIT_REACHED:
    "You can keep up to 5 images per submission. Remove one to add another.",
  PROPOSAL_ALREADY_DECIDED:
    "Someone already decided this suggestion. Refreshing the list.",
  PROPOSAL_INVALID: "Some fields need fixing before this can be published.",
  GAP_SUGGESTION_STALE:
    "This rule changed after the suggestion was made. Generate fresh suggestions.",
  FEATURE_DISABLED: "This feature isn't enabled in this environment.",
  SUBMISSION_LOCKED:
    "This submission is locked and cannot be modified right now.",
};

/**
 * Returns a friendly message for an error code.
 * Falls back to the provided server message or a generic fallback.
 */
export function getFriendlyError(
  code: string,
  serverMessage?: string
): string {
  return (
    ERROR_MESSAGES[code] ??
    serverMessage ??
    "Something went wrong. Please try again."
  );
}
