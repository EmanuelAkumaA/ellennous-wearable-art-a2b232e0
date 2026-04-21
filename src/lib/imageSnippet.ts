export type OptimizedVariant = {
  width: number;
  format: "avif" | "webp" | "jpeg";
  path: string;
  url: string;
  size_bytes: number;
};

const SIZES_DEFAULT = "(max-width:640px) 400px, (max-width:1024px) 800px, 1200px";

const buildSrcset = (variants: OptimizedVariant[], format: OptimizedVariant["format"]) =>
  variants
    .filter((v) => v.format === format)
    .sort((a, b) => a.width - b.width)
    .map((v) => `${v.url} ${v.width}w`)
    .join(", ");

export const buildPictureSnippet = (variants: OptimizedVariant[], alt = ""): string => {
  if (!variants.length) return "";
  const avifSet = buildSrcset(variants, "avif");
  const webpSet = buildSrcset(variants, "webp");
  const jpegVariants = variants.filter((v) => v.format === "jpeg").sort((a, b) => a.width - b.width);
  const jpegSet = jpegVariants.map((v) => `${v.url} ${v.width}w`).join(", ");
  const fallback = jpegVariants.find((v) => v.width === 800) ?? jpegVariants[Math.floor(jpegVariants.length / 2)] ?? jpegVariants[0];

  const sources: string[] = [];
  if (avifSet) {
    sources.push(
      `  <source type="image/avif"\n    srcset="${avifSet}"\n    sizes="${SIZES_DEFAULT}" />`,
    );
  }
  if (webpSet) {
    sources.push(
      `  <source type="image/webp"\n    srcset="${webpSet}"\n    sizes="${SIZES_DEFAULT}" />`,
    );
  }

  return `<picture>\n${sources.join("\n")}\n  <img\n    src="${fallback?.url ?? ""}"\n    srcset="${jpegSet}"\n    sizes="${SIZES_DEFAULT}"\n    loading="lazy"\n    decoding="async"\n    alt="${alt.replace(/"/g, "&quot;")}" />\n</picture>`;
};

export const formatBytes = (bytes: number | null | undefined): string => {
  if (!bytes && bytes !== 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

export const computeSavings = (original: number, optimized: number | null | undefined): number => {
  if (!optimized || !original) return 0;
  // Compare to weight of one fallback (avg jpeg 800) instead of sum of all variants
  // Better metric: assume browser picks one per page load; show vs. original.
  return Math.max(0, Math.round(((original - optimized) / original) * 100));
};
