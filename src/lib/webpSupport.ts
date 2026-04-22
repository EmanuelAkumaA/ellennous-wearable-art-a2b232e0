/**
 * Lightweight WebP-support detector for the browser.
 *
 * Most modern browsers (97%+) support WebP. This is a defensive check
 * for the rare cases (old Safari < 14, IE) where the new pipeline's
 * WebP-only variants would not load. When unsupported, callers should
 * fall back to the original (JPEG/PNG) file preserved in storage.
 */

let cached: boolean | null = null;
let inflight: Promise<boolean> | null = null;
let warned = false;

const detect = (): Promise<boolean> => {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return Promise.resolve(false);
  }

  // Canvas-based check is synchronous and fast.
  try {
    const canvas = document.createElement("canvas");
    if (canvas.getContext && canvas.getContext("2d") && canvas.toDataURL) {
      const dataUrl = canvas.toDataURL("image/webp");
      const ok = dataUrl.startsWith("data:image/webp");
      return Promise.resolve(ok);
    }
  } catch {
    /* ignore */
  }
  return Promise.resolve(false);
};

export const supportsWebP = async (): Promise<boolean> => {
  if (cached !== null) return cached;
  if (!inflight) {
    inflight = detect().then((ok) => {
      cached = ok;
      if (!ok && !warned) {
        warned = true;
        // Single, low-noise warning to ease debugging on legacy browsers.
        console.warn("[webpSupport] WebP unsupported, using original fallback");
      }
      return ok;
    });
  }
  return inflight;
};

/** Synchronous accessor — returns null if detection hasn't resolved yet. */
export const supportsWebPSync = (): boolean | null => cached;

/** Test-only helper so suites can stub the cache. Not exported in d.ts intent. */
export const __setWebpSupportForTests = (value: boolean | null) => {
  cached = value;
  inflight = null;
  warned = false;
};
