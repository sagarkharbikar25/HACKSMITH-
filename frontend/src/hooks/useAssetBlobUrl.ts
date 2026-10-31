/**
 * hooks/useAssetBlobUrl.ts
 * Fetches an auth-gated image asset as a Blob and converts it to an object URL.
 * Revokes the object URL on unmount to prevent memory leaks.
 * Returns undefined while loading, or a string URL when ready.
 */

import { useState, useEffect } from "react";
import { assetContent } from "../api/assets";

export function useAssetBlobUrl(assetId?: number): string | undefined {
  const [url, setUrl] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!assetId) {
      setUrl(undefined);
      return;
    }

    let objectUrl: string | undefined;
    let cancelled = false;

    assetContent(assetId)
      .then((blob) => {
        if (!cancelled) {
          objectUrl = URL.createObjectURL(blob);
          setUrl(objectUrl);
        }
      })
      .catch(() => {
        if (!cancelled) setUrl(undefined);
      });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [assetId]);

  return url;
}
