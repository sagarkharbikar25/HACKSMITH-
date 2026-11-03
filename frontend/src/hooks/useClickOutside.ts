import { useEffect, type RefObject } from "react";

interface UseClickOutsideOptions {
  ref: RefObject<HTMLElement | null>;
  onClose: () => void;
  enabled?: boolean;
}

/**
 * Hook that detects clicks or taps outside of the referenced element,
 * as well as Escape key presses, to close dropdowns or popovers cleanly.
 */
export function useClickOutside({
  ref,
  onClose,
  enabled = true,
}: UseClickOutsideOptions): void {
  useEffect(() => {
    if (!enabled) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (!target || !ref.current) return;
      if (!ref.current.contains(target)) {
        onClose();
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [ref, onClose, enabled]);
}

