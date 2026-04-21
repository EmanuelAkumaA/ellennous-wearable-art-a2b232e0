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
 * jpeg 1200w if ready, otherwise the original public URL.
 */
export const getBestUrlForPiece = (
  variants: Array<{ format: string; width: number; url: string }> | null | undefined,
  fallback: string,
): string => {
  if (!variants?.length) return fallback;
  const jpeg1200 =
    variants.find((v) => v.format === "jpeg" && v.width === 1200) ??
    variants.find((v) => v.format === "jpeg" && v.width === 800) ??
    variants.find((v) => v.format === "jpeg");
  return jpeg1200?.url ?? fallback;
};
