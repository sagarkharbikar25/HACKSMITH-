/**
 * hooks/useDocumentPolling.ts
 * Polls a document's status every 2 s while it's still processing.
 * Stops polling automatically when status reaches 'ready', 'partial', or 'failed'.
 */

import { useQuery } from "@tanstack/react-query";
import { getDocument } from "../api/ingestion";
import type { DocumentOut } from "../types/round3";

const PROCESSING_STATUSES = new Set(["queued", "parsing", "extracting"]);

export function useDocumentPolling(id?: number) {
  return useQuery<DocumentOut>({
    queryKey: ["document", id],
    queryFn: () => getDocument(id!),
    enabled: !!id,
    refetchInterval: (query) => {
      const status = query.state.data?.status ?? "";
      return PROCESSING_STATUSES.has(status) ? 2000 : false;
    },
  });
}
