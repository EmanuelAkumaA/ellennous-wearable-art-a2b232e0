/**
 * Client-side image compression using the native Canvas API.
 *
 * Used before uploading to Supabase Storage to dramatically reduce file size
 * (typical 3-5MB phone photos → 200-400KB) without visible quality loss.
 *
 * No external dependencies. Skips formats that should not be re-encoded
 * (SVG, GIF). Preserves PNG when transparency may matter.
 */

export interface CompressOptions {
  /** Maximum width in pixels. Image is downscaled proportionally if larger. */
  maxWidth?: number;
  /** JPEG quality 0..1 (ignored for PNG). */
  quality?: number;
}

const SKIP_TYPES = new Set(["image/svg+xml", "image/gif"]);

/**
 * Compress an image file. Returns a new File ready to upload.
 * If the input cannot/should not be compressed, returns the original file.
 */
export const compressImage = async (
  file: File,
  { maxWidth = 2000, quality = 0.85 }: CompressOptions = {},
): Promise<File> => {
  if (!file.type.startsWith("image/") || SKIP_TYPES.has(file.type)) {
    return file;
  }

  const isPng = file.type === "image/png";
  const outType = isPng ? "image/png" : "image/jpeg";

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    // Decoder failed (corrupt/unsupported) — fall back to original.
    return file;
  }

  const ratio = Math.min(1, maxWidth / bitmap.width);
  const targetW = Math.round(bitmap.width * ratio);
  const targetH = Math.round(bitmap.height * ratio);

  // If no resize needed AND already small, skip work.
  if (ratio === 1 && file.size < 500 * 1024) {
    bitmap.close?.();
    return file;
  }

  const canvas = document.createElement("canvas");
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close?.();
    return file;
  }
  ctx.drawImage(bitmap, 0, 0, targetW, targetH);
  bitmap.close?.();

  const blob: Blob | null = await new Promise((resolve) =>
    canvas.toBlob(resolve, outType, isPng ? undefined : quality),
  );
  if (!blob || blob.size >= file.size) {
    // Compression made it bigger (rare) — keep original.
    return file;
  }

  const baseName = file.name.replace(/\.[^.]+$/, "");
  const ext = isPng ? "png" : "jpg";
  return new File([blob], `${baseName}.${ext}`, {
    type: outType,
    lastModified: Date.now(),
  });
};
