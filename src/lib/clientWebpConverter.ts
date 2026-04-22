import { trackClientEvent } from "./clientTelemetry";

/**
 * Client-side image → WebP converter.
 *
 * Pre-converting in the browser shifts the heaviest decode/encode work off
 * the edge function (which has tight memory limits and was OOM'ing on big
 * JPGs). The edge only needs to resize an already-WebP master into 3
 * variants — much faster and far less error-prone.
 *
 * Strategy:
 *  - Already image/webp → return original file (no-op).
 *  - createImageBitmap → OffscreenCanvas (fallback HTMLCanvasElement) →
 *    canvas.convertToBlob({ type: 'image/webp' }).
 *  - Cap longest side at MAX_DIMENSION to keep conversion under ~3s.
 *  - Any failure → return original (graceful fallback; edge still accepts
 *    JPG/PNG and the legacy decoder will run).
 */

const MAX_DIMENSION = 3200;
const DEFAULT_QUALITY = 0.9;

export type WebpConversionResult = {
  blob: Blob;
  contentType: string;
  width: number;
  height: number;
  ms: number;
  /** True when we successfully encoded WebP; false when we fell back to original. */
  converted: boolean;
};

const isWebpAlreadySupported = (): boolean => {
  if (typeof document === "undefined") return false;
  try {
    const c = document.createElement("canvas");
    c.width = c.height = 1;
    return c.toDataURL("image/webp").startsWith("data:image/webp");
  } catch {
    return false;
  }
};

const computeTarget = (w: number, h: number) => {
  const longest = Math.max(w, h);
  if (longest <= MAX_DIMENSION) return { width: w, height: h };
  const scale = MAX_DIMENSION / longest;
  return { width: Math.round(w * scale), height: Math.round(h * scale) };
};

const encodeOffscreen = async (
  bitmap: ImageBitmap,
  width: number,
  height: number,
  quality: number,
): Promise<Blob | null> => {
  if (typeof OffscreenCanvas === "undefined") return null;
  try {
    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(bitmap, 0, 0, width, height);
    const blob = await canvas.convertToBlob({ type: "image/webp", quality });
    return blob && blob.type === "image/webp" ? blob : null;
  } catch {
    return null;
  }
};

const encodeDom = (
  bitmap: ImageBitmap,
  width: number,
  height: number,
  quality: number,
): Promise<Blob | null> =>
  new Promise((resolve) => {
    try {
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return resolve(null);
      ctx.drawImage(bitmap, 0, 0, width, height);
      canvas.toBlob(
        (b) => resolve(b && b.type === "image/webp" ? b : null),
        "image/webp",
        quality,
      );
    } catch {
      resolve(null);
    }
  });

export const convertToWebp = async (
  file: File,
  quality = DEFAULT_QUALITY,
): Promise<WebpConversionResult> => {
  const startedAt = performance.now();

  // No-op if already WebP
  if (file.type === "image/webp") {
    return {
      blob: file,
      contentType: "image/webp",
      width: 0,
      height: 0,
      ms: 0,
      converted: false,
    };
  }

  // Bail early on browsers that can't encode WebP at all
  if (!isWebpAlreadySupported() || typeof createImageBitmap === "undefined") {
    return {
      blob: file,
      contentType: file.type,
      width: 0,
      height: 0,
      ms: Math.round(performance.now() - startedAt),
      converted: false,
    };
  }

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return {
      blob: file,
      contentType: file.type,
      width: 0,
      height: 0,
      ms: Math.round(performance.now() - startedAt),
      converted: false,
    };
  }

  const { width, height } = computeTarget(bitmap.width, bitmap.height);

  let blob = await encodeOffscreen(bitmap, width, height, quality);
  if (!blob) blob = await encodeDom(bitmap, width, height, quality);

  bitmap.close?.();

  const ms = Math.round(performance.now() - startedAt);

  if (!blob) {
    return {
      blob: file,
      contentType: file.type,
      width: 0,
      height: 0,
      ms,
      converted: false,
    };
  }

  // Fire-and-forget telemetry for the timings panel
  void trackClientEvent(
    "webp_client_conversion",
    {
      conversionMs: ms,
      originalBytes: file.size,
      webpBytes: blob.size,
      width,
      height,
      mime: file.type,
    },
    { oncePerSession: false },
  );

  return {
    blob,
    contentType: "image/webp",
    width,
    height,
    ms,
    converted: true,
  };
};
