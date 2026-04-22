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

/**
 * Picks WebP variants for the new pipeline (mobile/tablet/desktop),
 * with a graceful fallback to legacy AVIF/WebP/JPEG sets.
 */
const pickWebps = (variants: OptimizedVariant[]) => {
  const tagged = variants.filter((v) => v.format === "webp" && v.device_label);
  if (tagged.length) {
    return ["mobile", "tablet", "desktop"]
      .map((label) => tagged.find((v) => v.device_label === label))
      .filter((v): v is OptimizedVariant => !!v)
      .sort((a, b) => a.width - b.width);
  }
  return variants.filter((v) => v.format === "webp").sort((a, b) => a.width - b.width);
};

/**
 * Renders an <img> with a WebP srcset when variants are available, falling
 * back to a plain <img> when the image hasn't been optimized.
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

  const webps = pickWebps(variants);

  if (!webps.length) {
    // Legacy: try jpeg fallback if no webps at all
    const jpegs = variants.filter((v) => v.format === "jpeg").sort((a, b) => a.width - b.width);
    const fallback = jpegs[jpegs.length - 1]?.url ?? src;
    return (
      <img
        src={fallback}
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

  const srcSet = webps.map((v) => `${v.url} ${v.width}w`).join(", ");
  const fallback = webps[webps.length - 1];

  return (
    <img
      src={fallback.url}
      srcSet={srcSet}
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
  );
};
