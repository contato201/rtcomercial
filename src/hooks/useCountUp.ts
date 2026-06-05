import { useEffect, useRef, useState } from 'react';

/**
 * Animates a number from the current display value to `value` over `duration` ms.
 * Uses requestAnimationFrame with an ease-out cubic curve.
 * Guarantees the final displayed value equals `value` exactly (no float drift).
 */
export const useCountUp = (value: number, duration = 900): number => {
  const [display, setDisplay] = useState(value);
  const displayRef = useRef(value);
  const rafRef = useRef<number | null>(null);

  // Keep a ref of the latest display so we always animate from the current value.
  useEffect(() => {
    displayRef.current = display;
  }, [display]);

  useEffect(() => {
    // Respect reduced motion or invalid values — snap immediately.
    if (
      typeof window === 'undefined' ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
      !Number.isFinite(value)
    ) {
      setDisplay(value);
      return;
    }

    const from = displayRef.current;
    if (from === value) {
      return;
    }

    let start: number | null = null;

    const step = (ts: number) => {
      if (start === null) start = ts;
      const elapsed = ts - start;
      const t = elapsed / duration;

      if (t >= 1) {
        // Snap to the exact target value to avoid floating-point drift.
        setDisplay(value);
        rafRef.current = null;
        return;
      }

      const eased = 1 - Math.pow(1 - t, 3); // easeOutCubic
      setDisplay(from + (value - from) * eased);
      rafRef.current = requestAnimationFrame(step);
    };

    rafRef.current = requestAnimationFrame(step);

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      // Ensure we always end on the latest target if a new animation supersedes us.
      setDisplay(value);
    };
  }, [value, duration]);

  return display;
};
