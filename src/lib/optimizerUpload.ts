import { supabase } from "@/integrations/supabase/client";
import { toast as sonnerToast } from "sonner";
import { convertToWebp } from "./clientWebpConverter";

export const OPTIMIZER_BUCKET = "optimized-images";
export const OPTIMIZER_ACCEPTED = ["image/jpeg", "image/png", "image/webp"];
export const OPTIMIZER_MAX_BYTES = 10 * 1024 * 1024;

export type ImageRole = "cover" | "gallery";

export type OptimizerUploadResult = {
  optimizedImageId: string;
  name: string;
  originalPath: string;
  originalUrl: string;
};

interface UploadParams {
  file: File;
  pieceId: string;
  role: ImageRole;
  /** Called as soon as client-side WebP conversion finishes (skipped for native WebP). */
  onConversionDone?: (ms: number) => void;
}

const CONVERT_TOAST_ID = (id: string) => `optimizer-convert-${id}`;

/**
 * Uploads an image to the optimizer pipeline:
 *  - converts the original to WebP in the browser (master.webp) when possible
 *  - stores the master in the optimized-images bucket
 *  - inserts a row in optimized_images with piece_id + image_role
 *  - fires the optimize-image edge function (fire-and-forget)
 * Returns the new optimized_images id and the public URL of the master
 * (used as a temporary preview / fallback while variants are being generated).
 *
 * The master is removed from storage by the edge function once the 3 device
 * variants are ready, keeping the bucket lean.
 */
export const uploadToOptimizer = async ({
  file,
  pieceId,
  role,
  onConversionDone,
}: UploadParams): Promise<OptimizerUploadResult> => {
  if (!OPTIMIZER_ACCEPTED.includes(file.type)) {
    throw new Error(`Formato não suportado: ${file.type}`);
  }
  if (file.size > OPTIMIZER_MAX_BYTES) {
    throw new Error("Arquivo maior que 10MB");
  }

  const id = crypto.randomUUID();

  // 1) Client-side WebP conversion (graceful fallback to original on failure)
  let uploadBlob: Blob = file;
  let uploadType = file.type;
  let uploadExt = file.name.split(".").pop()?.toLowerCase() || (file.type.split("/")[1] ?? "jpg");
  let convertedToWebp = false;

  if (file.type !== "image/webp") {
    sonnerToast.loading("Convertendo para WebP…", { id: CONVERT_TOAST_ID(id) });
    try {
      const conv = await convertToWebp(file);
      if (conv.converted) {
        uploadBlob = conv.blob;
        uploadType = "image/webp";
        uploadExt = "webp";
        convertedToWebp = true;
        sonnerToast.success(
          `Convertido para WebP em ${(conv.ms / 1000).toFixed(1)}s, otimizando…`,
          { id: CONVERT_TOAST_ID(id), duration: 2500 },
        );
      } else {
        sonnerToast.dismiss(CONVERT_TOAST_ID(id));
      }
    } catch (e) {
      // Log + fall back to original upload
      void supabase.from("optimization_error_log").insert([
        {
          optimized_image_id: id,
          piece_id: pieceId ?? null,
          stage: "client_convert",
          error_message: ((e as Error).message ?? "Conversão WebP falhou").slice(0, 500),
          meta: { name: file.name, size: file.size, type: file.type } as never,
        },
      ]);
      sonnerToast.dismiss(CONVERT_TOAST_ID(id));
    }
  }

  const path = convertedToWebp || file.type === "image/webp"
    ? `images/${id}/master.webp`
    : `images/${id}/original.${uploadExt}`;

  const { error: upErr } = await supabase.storage
    .from(OPTIMIZER_BUCKET)
    .upload(path, uploadBlob, { contentType: uploadType, upsert: false });
  if (upErr) {
    // Log to error history (non-blocking)
    void supabase.from("optimization_error_log").insert([
      {
        optimized_image_id: id,
        piece_id: pieceId ?? null,
        stage: "upload",
        error_message: upErr.message.slice(0, 500),
        meta: { name: file.name, size: file.size, type: uploadType } as never,
      },
    ]);
    throw upErr;
  }

  const { error: insErr } = await supabase.from("optimized_images").insert({
    id,
    name: file.name,
    original_path: path,
    original_size_bytes: file.size,
    status: "processing",
    piece_id: pieceId,
    image_role: role,
  });
  if (insErr) {
    await supabase.storage.from(OPTIMIZER_BUCKET).remove([path]);
    throw insErr;
  }

  // Fire-and-forget pipeline
  supabase.functions
    .invoke("optimize-image", { body: { imageId: id } })
    .catch((e) => console.error("optimize-image invoke failed:", e));

  const { data: pub } = supabase.storage.from(OPTIMIZER_BUCKET).getPublicUrl(path);

  return {
    optimizedImageId: id,
    name: file.name,
    originalPath: path,
    originalUrl: pub.publicUrl,
  };
};

/**
 * Returns the best URL to use as the gallery_piece_images.url:
 * desktop WebP (1600w) from the new pipeline if ready, otherwise the largest
 * legacy variant, otherwise the original public URL.
 */
export const getBestUrlForPiece = (
  variants:
    | Array<{ format: string; width: number; url: string; device_label?: string }>
    | null
    | undefined,
  fallback: string,
): string => {
  if (!variants?.length) return fallback;
  // New pipeline: prefer desktop > tablet > mobile WebP
  const desktop =
    variants.find((v) => v.format === "webp" && v.device_label === "desktop") ??
    variants.find((v) => v.format === "webp" && v.device_label === "tablet") ??
    variants.find((v) => v.format === "webp" && v.device_label === "mobile");
  if (desktop) return desktop.url;
  // Legacy fallback: largest jpeg/webp
  const legacy =
    [...variants]
      .filter((v) => v.format === "jpeg" || v.format === "webp")
      .sort((a, b) => b.width - a.width)[0];
  return legacy?.url ?? fallback;
};

/**
 * WebP-aware variant resolver. When the browser does not support WebP,
 * skips the WebP variants and returns the largest JPEG (legacy) or the
 * original (JPEG/PNG) fallback URL.
 */
export const getBestUrlForPieceWithWebpSupport = (
  variants:
    | Array<{ format: string; width: number; url: string; device_label?: string }>
    | null
    | undefined,
  fallback: string,
  supportsWebp: boolean,
): string => {
  if (supportsWebp) return getBestUrlForPiece(variants, fallback);
  if (!variants?.length) return fallback;
  const jpegs = [...variants].filter((v) => v.format === "jpeg").sort((a, b) => b.width - a.width);
  return jpegs[0]?.url ?? fallback;
};
