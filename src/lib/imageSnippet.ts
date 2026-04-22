export type DeviceLabel = "mobile" | "tablet" | "desktop";

export type OptimizedVariant = {
  width: number;
  /** New pipeline emits "webp" only. Legacy rows may still contain "avif" / "jpeg". */
  format: "avif" | "webp" | "jpeg";
  /** New pipeline tags variants by device. Legacy rows won't have this. */
  device_label?: DeviceLabel;
  path: string;
  url: string;
  size_bytes: number;
};

const SIZES_DEFAULT = "(max-width:640px) 480px, (max-width:1024px) 1024px, 1600px";

/**
 * Picks the 3 device-tagged WebP variants if available, otherwise falls back
 * to the largest WebP/JPEG variants from a legacy run.
 */
const pickWebpByDevice = (variants: OptimizedVariant[]) => {
  const tagged = variants.filter((v) => v.format === "webp" && v.device_label);
  if (tagged.length) {
    return ["mobile", "tablet", "desktop"]
      .map((label) => tagged.find((v) => v.device_label === label))
      .filter((v): v is OptimizedVariant => !!v);
  }
  // Legacy fallback: any webp by width ascending
  return variants
    .filter((v) => v.format === "webp")
    .sort((a, b) => a.width - b.width);
};

export const buildPictureSnippet = (variants: OptimizedVariant[], alt = ""): string => {
  if (!variants.length) return "";
  const webps = pickWebpByDevice(variants);
  if (!webps.length) {
    // Legacy snippet (no webp). Fall back to largest jpeg.
    const jpegs = variants.filter((v) => v.format === "jpeg").sort((a, b) => a.width - b.width);
    const fallback = jpegs[jpegs.length - 1] ?? variants[variants.length - 1];
    return `<img\n  src="${fallback?.url ?? ""}"\n  loading="lazy"\n  decoding="async"\n  alt="${alt.replace(/"/g, "&quot;")}" />`;
  }

  const srcset = webps.map((v) => `${v.url} ${v.width}w`).join(",\n          ");
  const fallback = webps[webps.length - 1];

  return `<img
  src="${fallback.url}"
  srcset="${srcset}"
  sizes="${SIZES_DEFAULT}"
  loading="lazy"
  decoding="async"
  alt="${alt.replace(/"/g, "&quot;")}" />`;
};

export const formatBytes = (bytes: number | null | undefined): string => {
  if (!bytes && bytes !== 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

export const computeSavings = (original: number, optimized: number | null | undefined): number => {
  if (!optimized || !original) return 0;
  return Math.max(0, Math.round(((original - optimized) / original) * 100));
};

/** Helper to find a variant by device label, with a sensible fallback. */
export const findByDevice = (
  variants: OptimizedVariant[] | null | undefined,
  label: DeviceLabel,
): OptimizedVariant | undefined => {
  if (!variants?.length) return undefined;
  return variants.find((v) => v.format === "webp" && v.device_label === label);
};

/**
 * Returns true when the variants array does NOT contain the new pipeline output
 * (3 device-tagged WebPs). Used to flag images that should be reprocessed.
 * Empty/missing variants are NOT considered "legacy" — they're just unprocessed.
 */
export const isLegacyFormat = (
  variants: OptimizedVariant[] | null | undefined,
): boolean => {
  if (!variants?.length) return false;
  return !variants.some((v) => v.format === "webp" && v.device_label === "desktop");
};

/**
 * Broader "at-risk of fallback" check used by auto-optimize flows.
 * Flags any "ready" image that the frontend would have to fall back from
 * (no usable WebP-by-device), plus any image that previously errored.
 *
 * - status === "error" → always at risk
 * - status === "ready" + no variants → orphan, at risk
 * - status === "ready" + variants but no webp+desktop → legacy, at risk
 * - status === "processing" or other → not at risk yet (in flight)
 */
export const isAtRiskOfFallback = (
  status: string,
  variants: OptimizedVariant[] | null | undefined,
): boolean => {
  if (status === "error") return true;
  if (status !== "ready") return false;
  if (!variants?.length) return true;
  return !variants.some((v) => v.format === "webp" && v.device_label === "desktop");
};
