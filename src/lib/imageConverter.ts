/**
 * Client-side image converter.
 *
 * Decodes any browser-readable image (JPEG/PNG/WebP) — and HEIC via the
 * lazy-loaded `heic2any` module — and re-encodes it as WebP with optional
 * resizing. Designed to power both the standalone "Conversor de imagens"
 * tool and the upload pipeline used by PiecesManager.
 */

export type ResponsivePresetName = "mobile" | "tablet" | "desktop" | "original";

export interface ConvertOptions {
  /** WebP quality between 0 and 100. */
  quality: number;
  /** If set, the longest side of the image is capped to this width (keeps aspect). */
  maxWidth?: number;
}

export interface ConvertResult {
  blob: Blob;
  width: number;
  height: number;
  ms: number;
}

export interface ResponsivePresetResult {
  mobile: ConvertResult;
  tablet: ConvertResult;
  desktop: ConvertResult;
  original: ConvertResult;
}

const PRESET_WIDTHS: Record<Exclude<ResponsivePresetName, "original">, number> = {
  mobile: 480,
  tablet: 768,
  desktop: 1200,
};

const isHeic = (file: File): boolean => {
  if (file.type === "image/heic" || file.type === "image/heif") return true;
  const name = file.name.toLowerCase();
  return name.endsWith(".heic") || name.endsWith(".heif");
};

const decodeBitmap = async (source: Blob): Promise<ImageBitmap> => {
  // createImageBitmap is the fastest path; fall back to <img> if unavailable.
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(source);
    } catch {
      // fall through
    }
  }
  return await new Promise<ImageBitmap>((resolve, reject) => {
    const url = URL.createObjectURL(source);
    const img = new Image();
    img.onload = async () => {
      try {
        const bmp = await createImageBitmap(img);
        URL.revokeObjectURL(url);
        resolve(bmp);
      } catch (e) {
        URL.revokeObjectURL(url);
        reject(e);
      }
    };
    img.onerror = (e) => {
      URL.revokeObjectURL(url);
      reject(e);
    };
    img.src = url;
  });
};

const computeTargetSize = (
  srcW: number,
  srcH: number,
  maxWidth: number | undefined,
): { w: number; h: number } => {
  if (!maxWidth || srcW <= maxWidth) return { w: srcW, h: srcH };
  const scale = maxWidth / srcW;
  return { w: maxWidth, h: Math.round(srcH * scale) };
};

const encodeWebpFromBitmap = async (
  bmp: ImageBitmap,
  targetW: number,
  targetH: number,
  quality: number,
): Promise<Blob> => {
  // Prefer OffscreenCanvas when the browser supports convertToBlob.
  if (typeof OffscreenCanvas !== "undefined") {
    try {
      const off = new OffscreenCanvas(targetW, targetH);
      const ctx = off.getContext("2d");
      if (!ctx) throw new Error("OffscreenCanvas 2D context unavailable");
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(bmp, 0, 0, targetW, targetH);
      const blob: Blob = await off.convertToBlob({
        type: "image/webp",
        quality: Math.max(0, Math.min(1, quality / 100)),
      });
      return blob;
    } catch {
      // fall through to HTMLCanvasElement
    }
  }
  const canvas = document.createElement("canvas");
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bmp, 0, 0, targetW, targetH);
  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("toBlob returned null"))),
      "image/webp",
      Math.max(0, Math.min(1, quality / 100)),
    );
  });
};

const heicToBlob = async (file: File): Promise<Blob> => {
  const mod = await import("heic2any");
  type Heic2Any = (opts: {
    blob: Blob;
    toType?: string;
    quality?: number;
  }) => Promise<Blob | Blob[]>;
  const heic2any = (mod as unknown as { default: Heic2Any }).default;
  const out = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.92 });
  return Array.isArray(out) ? out[0] : out;
};

/**
 * Converts any supported image to WebP. HEIC inputs are decoded via heic2any.
 */
export const convertImage = async (
  file: File,
  opts: ConvertOptions,
): Promise<ConvertResult> => {
  const t0 = performance.now();
  const source: Blob = isHeic(file) ? await heicToBlob(file) : file;
  const bmp = await decodeBitmap(source);
  try {
    const { w, h } = computeTargetSize(bmp.width, bmp.height, opts.maxWidth);
    const blob = await encodeWebpFromBitmap(bmp, w, h, opts.quality);
    return { blob, width: w, height: h, ms: Math.round(performance.now() - t0) };
  } finally {
    bmp.close?.();
  }
};

/**
 * Generates the 4 standard variants used across the project (mobile/tablet/
 * desktop/original) in a single decode pass to keep memory pressure low.
 */
export const convertResponsivePreset = async (
  file: File,
  quality: number,
): Promise<ResponsivePresetResult> => {
  const tStart = performance.now();
  const source: Blob = isHeic(file) ? await heicToBlob(file) : file;
  const bmp = await decodeBitmap(source);
  try {
    const buildAt = async (maxWidth: number | undefined): Promise<ConvertResult> => {
      const t0 = performance.now();
      const { w, h } = computeTargetSize(bmp.width, bmp.height, maxWidth);
      const blob = await encodeWebpFromBitmap(bmp, w, h, quality);
      return { blob, width: w, height: h, ms: Math.round(performance.now() - t0) };
    };
    const [mobile, tablet, desktop, original] = await Promise.all([
      buildAt(PRESET_WIDTHS.mobile),
      buildAt(PRESET_WIDTHS.tablet),
      buildAt(PRESET_WIDTHS.desktop),
      buildAt(undefined),
    ]);
    // Adjust the 'ms' of original to reflect total wall time so callers can
    // show a meaningful "convertido em Xs" toast for the whole bundle.
    original.ms = Math.round(performance.now() - tStart);
    return { mobile, tablet, desktop, original };
  } finally {
    bmp.close?.();
  }
};

/** Reads dimensions and bytes of an arbitrary image file (used for the picker preview). */
export const readImageMeta = async (
  file: File,
): Promise<{ width: number; height: number; size: number }> => {
  const source: Blob = isHeic(file) ? await heicToBlob(file) : file;
  const bmp = await decodeBitmap(source);
  try {
    return { width: bmp.width, height: bmp.height, size: file.size };
  } finally {
    bmp.close?.();
  }
};

export const ACCEPTED_INPUT_MIME = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
];

export const ACCEPTED_INPUT_EXT = [".jpg", ".jpeg", ".png", ".webp", ".heic", ".heif"];
