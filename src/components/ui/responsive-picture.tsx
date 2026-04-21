import type { CSSProperties } from "react";
import type { OptimizedVariant } from "@/lib/imageSnippet";

interface ResponsivePictureProps {
  src: string;
  variants: OptimizedVariant[] | null | undefined;
  alt: string;
  /** sizes attribute tuned to the layout where this image renders. */
  sizes: string;
  loading?: "eager" | "lazy";
  fetchPriority?: "high" | "low" | "auto";
  decoding?: "async" | "sync" | "auto";
  width?: number;
  height?: number;
  className?: string;
  style?: CSSProperties;
  onClick?: () => void;
}

const buildSrcset = (variants: OptimizedVariant[], format: OptimizedVariant["format"]) =>
  variants
    .filter((v) => v.format === format)
    .sort((a, b) => a.width - b.width)
    .map((v) => `${v.url} ${v.width}w`)
    .join(", ");

/**
 * Renders a <picture> with AVIF/WebP/JPEG variants when available, falling back
 * to a plain <img> when the image hasn't been optimized.
 */
export const ResponsivePicture = ({
  src,
  variants,
  alt,
  sizes,
  loading = "lazy",
  fetchPriority = "auto",
  decoding = "async",
  width,
  height,
  className,
  style,
  onClick,
}: ResponsivePictureProps) => {
  if (!variants || variants.length === 0) {
    return (
      <img
        src={src}
        alt={alt}
        loading={loading}
        decoding={decoding}
        fetchPriority={fetchPriority}
        width={width}
        height={height}
        className={className}
        style={style}
        onClick={onClick}
      />
    );
  }

  const avifSet = buildSrcset(variants, "avif");
  const webpSet = buildSrcset(variants, "webp");
  const jpegVariants = variants.filter((v) => v.format === "jpeg").sort((a, b) => a.width - b.width);
  const jpegSet = jpegVariants.map((v) => `${v.url} ${v.width}w`).join(", ");
  const fallback =
    jpegVariants.find((v) => v.width === 800) ??
    jpegVariants[Math.floor(jpegVariants.length / 2)] ??
    jpegVariants[0];

  return (
    <picture>
      {avifSet && <source type="image/avif" srcSet={avifSet} sizes={sizes} />}
      {webpSet && <source type="image/webp" srcSet={webpSet} sizes={sizes} />}
      <img
        src={fallback?.url ?? src}
        srcSet={jpegSet || undefined}
        sizes={sizes}
        alt={alt}
        loading={loading}
        decoding={decoding}
        fetchPriority={fetchPriority}
        width={width}
        height={height}
        className={className}
        style={style}
        onClick={onClick}
      />
    </picture>
  );
};
