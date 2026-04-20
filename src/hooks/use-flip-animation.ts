import { useCallback, useLayoutEffect, useRef } from "react";

/**
 * FLIP (First-Last-Invert-Play) animation hook for list reordering.
 *
 * Usage:
 *   const { registerNode } = useFlipAnimation(items, (item) => item.id);
 *   ...
 *   {items.map(item => (
 *     <Card key={item.id} ref={(el) => registerNode(item.id, el)} />
 *   ))}
 *
 * Whenever `items` changes order, each tracked node smoothly slides from its
 * previous position to its new one — no jumping.
 */
export function useFlipAnimation<T>(
  items: T[],
  getId: (item: T) => string,
  options?: { duration?: number; easing?: string },
) {
  const duration = options?.duration ?? 350;
  const easing = options?.easing ?? "cubic-bezier(0.22, 1, 0.36, 1)";

  const nodes = useRef<Map<string, HTMLElement>>(new Map());
  const prevRects = useRef<Map<string, DOMRect>>(new Map());
  // Tracks running animations so we can cancel before re-applying
  const inFlight = useRef<Map<string, Animation>>(new Map());

  const registerNode = useCallback((id: string, el: HTMLElement | null) => {
    if (el) {
      nodes.current.set(id, el);
    } else {
      nodes.current.delete(id);
      prevRects.current.delete(id);
      inFlight.current.delete(id);
    }
  }, []);

  // Reduced motion: skip animation entirely
  const prefersReduced =
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

  useLayoutEffect(() => {
    if (prefersReduced) {
      // Still record positions so future moves work if pref toggles
      const snapshot = new Map<string, DOMRect>();
      for (const item of items) {
        const id = getId(item);
        const el = nodes.current.get(id);
        if (el) snapshot.set(id, el.getBoundingClientRect());
      }
      prevRects.current = snapshot;
      return;
    }

    const next = new Map<string, DOMRect>();
    for (const item of items) {
      const id = getId(item);
      const el = nodes.current.get(id);
      if (!el) continue;
      const newRect = el.getBoundingClientRect();
      next.set(id, newRect);

      const oldRect = prevRects.current.get(id);
      if (!oldRect) continue;

      const dx = oldRect.left - newRect.left;
      const dy = oldRect.top - newRect.top;
      if (dx === 0 && dy === 0) continue;

      // Cancel any animation already running for this node
      const existing = inFlight.current.get(id);
      if (existing) existing.cancel();

      const anim = el.animate(
        [
          { transform: `translate(${dx}px, ${dy}px)` },
          { transform: "translate(0, 0)" },
        ],
        { duration, easing, fill: "both" },
      );
      inFlight.current.set(id, anim);
      anim.onfinish = () => {
        anim.cancel(); // clear fill so transforms from CSS (e.g. dnd-kit) are not blocked
        if (inFlight.current.get(id) === anim) inFlight.current.delete(id);
      };
    }
    prevRects.current = next;
  }, [items, getId, duration, easing, prefersReduced]);

  return { registerNode };
}
