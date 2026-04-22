import { useEffect, useRef, useState, type CSSProperties, type SyntheticEvent } from "react";
import type { OptimizedVariant } from "@/lib/imageSnippet";
import { supportsWebP, supportsWebPSync } from "@/lib/webpSupport";
import { trackClientEvent } from "@/lib/clientTelemetry";

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
 * Resolves the browser's WebP support. Defaults optimistically to `true`
 * (97%+ of browsers) so the first paint isn't blocked. Resolves to `false`
 * only on legacy browsers, in which case the original (JPEG/PNG) src is used.
 */
const useWebpSupport = (): boolean => {
  const initial = supportsWebPSync();
  const [supported, setSupported] = useState<boolean>(initial ?? true);
  useEffect(() => {
    if (initial !== null) return;
    let cancelled = false;
    supportsWebP().then((ok) => {
      if (!cancelled) setSupported(ok);
    });
    return () => {
      cancelled = true;
    };
  }, [initial]);
  return supported;
};

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
  const webpOk = useWebpSupport();

  // Browser doesn't support WebP — serve the original JPEG/PNG.
  if (!webpOk) {
    // If we had optimized variants but can't use them, log it once per session
    // so admins can quantify the lost optimization opportunity.
    if (variants && variants.length > 0) {
      void trackClientEvent("webp_fallback_used", { variantCount: variants.length });
    }
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
