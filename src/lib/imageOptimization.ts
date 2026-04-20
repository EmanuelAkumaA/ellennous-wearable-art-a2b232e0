/**
 * Image optimization helpers for Supabase Storage.
 *
 * Rewrites public Supabase Storage URLs to use the on-the-fly image
 * transformation endpoint (`/storage/v1/render/image/public/...`),
 * which serves WebP automatically and dramatically reduces file size.
 *
 * External URLs are returned unchanged.
 */

const OBJECT_PATH = "/storage/v1/object/public/";
const RENDER_PATH = "/storage/v1/render/image/public/";

export interface OptimizeOptions {
  width: number;
  quality?: number;
  resize?: "cover" | "contain" | "fill";
}

/**
 * Convert a Supabase public object URL into an optimized render URL.
 * Returns the original URL untouched if it's not a Supabase storage URL.
 */
export const getOptimizedImageUrl = (
  url: string | null | undefined,
  { width, quality = 75, resize = "cover" }: OptimizeOptions
): string => {
  if (!url) return "";
  if (!url.includes(OBJECT_PATH)) return url;

  const rendered = url.replace(OBJECT_PATH, RENDER_PATH);
  // Stable param order = stable cache key.
  const params = new URLSearchParams({
    width: String(width),
    quality: String(quality),
    resize,
  });
  return `${rendered}?${params.toString()}`;
};

/**
 * Build a srcset string with multiple widths for responsive images.
 */
export const getOptimizedSrcSet = (
  url: string | null | undefined,
  widths: number[],
  quality = 70
): string => {
  if (!url || !url.includes(OBJECT_PATH)) return "";
  return widths
    .map((w) => `${getOptimizedImageUrl(url, { width: w, quality })} ${w}w`)
    .join(", ");
};

/**
 * Programmatically preload an image (used for next/prev carousel slides).
 */
export const preloadImage = (url: string): void => {
  if (!url || typeof window === "undefined") return;
  const img = new Image();
  img.src = url;
};
