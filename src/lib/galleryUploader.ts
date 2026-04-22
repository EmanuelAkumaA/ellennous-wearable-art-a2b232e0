/**
 * Uploads gallery images using the new client-side WebP pipeline.
 *
 * Each upload generates 3 responsive WebP variants (mobile/tablet/desktop)
 * directly in the browser and stores them under `gallery/{pieceId}/{uuid}-{preset}.webp`.
 * The desktop variant is used as the primary URL persisted in
 * `gallery_pieces.cover_*` and `gallery_piece_images.url`.
 */

import { supabase } from "@/integrations/supabase/client";
import { convertResponsivePreset } from "./imageConverter";
import type { OptimizedVariant } from "./imageSnippet";

export const GALLERY_BUCKET = "gallery";

export interface GalleryUploadResult {
  /** Public URL of the desktop variant (canonical URL stored in DB). */
  desktopUrl: string;
  /** Storage path of the desktop variant (canonical path stored in DB). */
  desktopPath: string;
  /** Three responsive WebP variants for client-side rendering. */
  variants: OptimizedVariant[];
  /** Total wall-clock time spent converting + uploading. */
  ms: number;
  /** Original byte count + final bundle byte count for delta reporting. */
  originalSize: number;
  optimizedSize: number;
}

const PRESET_WIDTHS = { mobile: 480, tablet: 768, desktop: 1200 } as const;

export type UploadStage = "converting" | "uploading" | "done";

interface UploadParams {
  file: File;
  pieceId: string;
  /** Defaults to 82 — matches the converter UI default. */
  quality?: number;
  /** Receives progress updates (0–100) during conversion + upload. */
  onProgress?: (percent: number, stage: UploadStage) => void;
}

export const uploadGalleryImage = async ({
  file,
  pieceId,
  quality = 82,
  onProgress,
}: UploadParams): Promise<GalleryUploadResult> => {
  const tStart = performance.now();
  onProgress?.(5, "converting");
  const preset = await convertResponsivePreset(file, quality);
  onProgress?.(55, "uploading");
  const id = crypto.randomUUID();
  const folder = `${pieceId}/${id}`;

  const items: Array<{ key: keyof typeof PRESET_WIDTHS; blob: Blob; w: number; h: number }> = [
    { key: "mobile", blob: preset.mobile.blob, w: preset.mobile.width, h: preset.mobile.height },
    { key: "tablet", blob: preset.tablet.blob, w: preset.tablet.width, h: preset.tablet.height },
    { key: "desktop", blob: preset.desktop.blob, w: preset.desktop.width, h: preset.desktop.height },
  ];

  let completed = 0;
  const uploads = await Promise.all(
    items.map(async (item) => {
      const path = `${folder}/${item.key}.webp`;
      const { error } = await supabase.storage
        .from(GALLERY_BUCKET)
        .upload(path, item.blob, { contentType: "image/webp", upsert: false });
      if (error) throw error;
      const { data } = supabase.storage.from(GALLERY_BUCKET).getPublicUrl(path);
      completed += 1;
      onProgress?.(55 + Math.round((completed / items.length) * 40), "uploading");
      return { ...item, path, url: data.publicUrl };
    }),
  );
  onProgress?.(100, "done");

  const desktop = uploads.find((u) => u.key === "desktop")!;
  const variants: OptimizedVariant[] = uploads.map((u) => ({
    width: u.w,
    format: "webp",
    device_label: u.key,
    path: u.path,
    url: u.url,
    size_bytes: u.blob.size,
  }));

  const optimizedSize = uploads.reduce((sum, u) => sum + u.blob.size, 0);

  return {
    desktopUrl: desktop.url,
    desktopPath: desktop.path,
    variants,
    ms: Math.round(performance.now() - tStart),
    originalSize: file.size,
    optimizedSize,
  };
};

/**
 * Given a desktop variant URL like `…/{pieceId}/{uuid}/desktop.webp`,
 * returns the 3 responsive variants the public gallery should use.
 * Returns null when the URL doesn't match the new convention (legacy images).
 */
export const deriveGalleryVariants = (url: string): OptimizedVariant[] | null => {
  if (!url) return null;
  const match = url.match(/^(.*)\/desktop\.webp(\?.*)?$/);
  if (!match) return null;
  const base = match[1];
  const query = match[2] ?? "";
  const make = (label: "mobile" | "tablet" | "desktop"): OptimizedVariant => ({
    width: PRESET_WIDTHS[label],
    format: "webp",
    device_label: label,
    path: "",
    url: `${base}/${label}.webp${query}`,
    size_bytes: 0,
  });
  return [make("mobile"), make("tablet"), make("desktop")];
};

/** Removes all 3 variants from storage. Best-effort; ignores missing files. */
export const removeGalleryVariants = async (desktopPath: string): Promise<void> => {
  if (!desktopPath || !desktopPath.endsWith("/desktop.webp")) {
    if (desktopPath) await supabase.storage.from(GALLERY_BUCKET).remove([desktopPath]);
    return;
  }
  const folder = desktopPath.slice(0, -"/desktop.webp".length);
  await supabase.storage
    .from(GALLERY_BUCKET)
    .remove([
      `${folder}/mobile.webp`,
      `${folder}/tablet.webp`,
      `${folder}/desktop.webp`,
    ]);
};
