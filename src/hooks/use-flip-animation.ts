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
 * Animation runs ONLY when the order of ids actually changes between renders.
 * Re-renders triggered by scrolling, focus, hover, or unrelated state updates
 * will NOT cause any animation — even though `getBoundingClientRect()` returns
 * viewport-relative coordinates that shift on scroll.
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
  const prevOrder = useRef<string[]>([]);
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
    const currentIds = items.map(getId);

    // Snapshot helper — always runs to keep refs fresh
    const snapshot = () => {
      const next = new Map<string, DOMRect>();
      for (const id of currentIds) {
        const el = nodes.current.get(id);
        if (el) next.set(id, el.getBoundingClientRect());
      }
      prevRects.current = next;
      prevOrder.current = currentIds;
    };

    // Detect whether the id order actually changed (ignoring add/remove only).
    const prev = prevOrder.current;
    let orderChanged = false;
    if (prev.length === currentIds.length) {
      for (let i = 0; i < prev.length; i++) {
        if (prev[i] !== currentIds[i]) {
          orderChanged = true;
          break;
        }
      }
    } else {
      // Length changed (add/remove) — refresh snapshot but do not animate.
      snapshot();
      return;
    }

    if (!orderChanged || prefersReduced) {
      snapshot();
      return;
    }

    // Order changed — run FLIP for nodes whose previous rect is known.
    for (const id of currentIds) {
      const el = nodes.current.get(id);
      if (!el) continue;
      const newRect = el.getBoundingClientRect();
      const oldRect = prevRects.current.get(id);
      if (!oldRect) continue;

      const dx = oldRect.left - newRect.left;
      const dy = oldRect.top - newRect.top;
      if (dx === 0 && dy === 0) continue;

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
        anim.cancel(); // clear fill so CSS transforms (e.g. dnd-kit) aren't blocked
        if (inFlight.current.get(id) === anim) inFlight.current.delete(id);
      };
    }

    snapshot();
  }, [items, getId, duration, easing, prefersReduced]);

  return { registerNode };
}
