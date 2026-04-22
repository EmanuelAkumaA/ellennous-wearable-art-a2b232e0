import { supabase } from "@/integrations/supabase/client";

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
}

/**
 * Uploads an image to the optimizer pipeline:
 *  - stores the original in the optimized-images bucket
 *  - inserts a row in optimized_images with piece_id + image_role
 *  - fires the optimize-image edge function (fire-and-forget)
 * Returns the new optimized_images id and the public URL of the original
 * (used as a temporary preview / fallback while variants are being generated).
 */
export const uploadToOptimizer = async ({
  file,
  pieceId,
  role,
}: UploadParams): Promise<OptimizerUploadResult> => {
  if (!OPTIMIZER_ACCEPTED.includes(file.type)) {
    throw new Error(`Formato não suportado: ${file.type}`);
  }
  if (file.size > OPTIMIZER_MAX_BYTES) {
    throw new Error("Arquivo maior que 10MB");
  }

  const ext = file.name.split(".").pop()?.toLowerCase() || (file.type.split("/")[1] ?? "jpg");
  const id = crypto.randomUUID();
  const path = `images/${id}/original.${ext}`;

  const { error: upErr } = await supabase.storage
    .from(OPTIMIZER_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });
  if (upErr) throw upErr;

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
