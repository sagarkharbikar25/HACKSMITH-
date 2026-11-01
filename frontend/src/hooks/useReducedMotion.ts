/**
 * hooks/useReducedMotion.ts
 * Returns true when the user has requested reduced motion via OS/browser settings.
 * Use this to disable all new animations in Round 3 components.
 */

import { useState, useEffect } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";

export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState<boolean>(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia(QUERY).matches
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia(QUERY);
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  return reduced;
}

