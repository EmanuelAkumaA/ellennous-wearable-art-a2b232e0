import { useEffect, useState } from "react";

/**
 * Extracts the dominant, vivid color from an image URL and returns it as
 * an HSL string (e.g. "hsl(274 90% 65%)") suitable for CSS.
 *
 * - Loads the image with `crossOrigin="anonymous"` (Supabase public bucket
 *   sets the appropriate CORS headers).
 * - Renders a 32×32 thumbnail to a canvas, then quantizes pixels to a
 *   coarse HSL bucket (12 hues × 4 sat × 4 lum), ignoring near-black,
 *   near-white, and dull pixels.
 * - Caches per URL in two layers:
 *     1. Module-level `Map` (instant hits across re-renders).
 *     2. `localStorage` (persists across reloads, TTL 30 days, cap 200).
 * - Debounces the canvas computation by 150 ms — if the component unmounts
 *   (filter change, fast scroll) before the timeout fires, no canvas is
 *   ever created.
 *
 * Returns `null` while loading, then the color string. Falls back silently
 * to `null` on CORS/decoding failure (caller can use a default).
 */

const CACHE = new Map<string, { color: string | null; ts: number }>();
const PENDING = new Map<string, Promise<string | null>>();

const STORAGE_KEY = "ellennous:dominantColor:v1";
const TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const MAX_ENTRIES = 200;
const TRIM_TO = 150;
const COMPUTE_DEBOUNCE_MS = 150;
const PERSIST_DEBOUNCE_MS = 400;

let hydrated = false;
const hydrate = () => {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const obj = JSON.parse(raw) as Record<string, { color: string | null; ts: number }>;
    const now = Date.now();
    for (const [url, v] of Object.entries(obj)) {
      if (v && typeof v.ts === "number" && now - v.ts < TTL_MS) {
        CACHE.set(url, { color: v.color, ts: v.ts });
      }
    }
  } catch {
    /* ignore */
  }
};

let persistTimer: ReturnType<typeof setTimeout> | null = null;
const flushPersist = () => {
  persistTimer = null;
  if (typeof window === "undefined") return;
  try {
    // Trim if over capacity, dropping the oldest entries first.
    if (CACHE.size > MAX_ENTRIES) {
      const sorted = [...CACHE.entries()].sort((a, b) => a[1].ts - b[1].ts);
      const drop = sorted.slice(0, sorted.length - TRIM_TO);
      for (const [k] of drop) CACHE.delete(k);
    }
    const obj: Record<string, { color: string | null; ts: number }> = {};
    for (const [k, v] of CACHE.entries()) obj[k] = v;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(obj));
  } catch {
    /* quota or serialization failure — drop silently */
  }
};
const schedulePersist = () => {
  if (typeof window === "undefined") return;
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(flushPersist, PERSIST_DEBOUNCE_MS);
};

const computeColor = (url: string): Promise<string | null> =>
  new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.referrerPolicy = "no-referrer";
    img.decoding = "async";
    img.onload = () => {
      try {
        const size = 32;
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) return resolve(null);
        ctx.drawImage(img, 0, 0, size, size);
        const { data } = ctx.getImageData(0, 0, size, size);
        const buckets = new Map<string, { count: number; h: number; s: number; l: number }>();
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i] / 255;
          const g = data[i + 1] / 255;
          const b = data[i + 2] / 255;
          const a = data[i + 3] / 255;
          if (a < 0.5) continue;
          const max = Math.max(r, g, b);
          const min = Math.min(r, g, b);
          const l = (max + min) / 2;
          if (l < 0.18 || l > 0.92) continue; // skip near-black / near-white
          const d = max - min;
          const s = d === 0 ? 0 : l > 0.5 ? d / (2 - max - min) : d / (max + min);
          if (s < 0.28) continue; // skip greys
          let h = 0;
          if (d !== 0) {
            switch (max) {
              case r: h = ((g - b) / d + (g < b ? 6 : 0)); break;
              case g: h = ((b - r) / d + 2); break;
              case b: h = ((r - g) / d + 4); break;
            }
            h *= 60;
          }
          // Quantize: 12 hue buckets (30°), 4 sat, 4 lum
          const hb = Math.round(h / 30);
          const sb = Math.round(s * 4);
          const lb = Math.round(l * 4);
          const key = `${hb}-${sb}-${lb}`;
          const prev = buckets.get(key);
          if (prev) {
            prev.count += 1;
            prev.h += h;
            prev.s += s;
            prev.l += l;
          } else {
            buckets.set(key, { count: 1, h, s, l });
          }
        }
        if (buckets.size === 0) return resolve(null);
        let best: { count: number; h: number; s: number; l: number } | null = null;
        for (const v of buckets.values()) {
          // weight by saturation to prefer vivid colors
          const score = v.count * (1 + (v.s / v.count) * 1.4);
          const bestScore = best ? best.count * (1 + (best.s / best.count) * 1.4) : -1;
          if (score > bestScore) best = v;
        }
        if (!best) return resolve(null);
        const h = Math.round(best.h / best.count);
        const s = Math.min(100, Math.round((best.s / best.count) * 100 * 1.05));
        const l = Math.min(70, Math.max(45, Math.round((best.l / best.count) * 100)));
        resolve(`hsl(${h} ${s}% ${l}%)`);
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });

export const useDominantColor = (url: string | null | undefined): string | null => {
  const [color, setColor] = useState<string | null>(() => {
    if (!url) return null;
    hydrate();
    return CACHE.get(url)?.color ?? null;
  });

  useEffect(() => {
    if (!url) {
      setColor(null);
      return;
    }
    hydrate();
    const cached = CACHE.get(url);
    if (cached) {
      setColor(cached.color);
      return;
    }
    let cancelled = false;
    const handle = setTimeout(() => {
      let promise = PENDING.get(url);
      if (!promise) {
        promise = computeColor(url).then((c) => {
          CACHE.set(url, { color: c, ts: Date.now() });
          PENDING.delete(url);
          schedulePersist();
          return c;
        });
        PENDING.set(url, promise);
      }
      promise.then((c) => {
        if (!cancelled) setColor(c);
      });
    }, COMPUTE_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [url]);

  return color;
};
