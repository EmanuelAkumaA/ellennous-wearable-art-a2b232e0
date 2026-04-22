/**
 * Staging area for images converted by the standalone converter that
 * are not yet associated with a piece. Files live in
 * `gallery/staging/{uuid}/{mobile,tablet,desktop}.webp` and are tracked
 * by the `gallery_staging_images` table.
 */

import { supabase } from "@/integrations/supabase/client";
import { GALLERY_BUCKET } from "./galleryUploader";
import type { ResponsivePresetResult } from "./imageConverter";

export interface StagingRow {
  id: string;
  user_id: string;
  original_filename: string;
  desktop_url: string;
  desktop_path: string;
  tablet_path: string;
  mobile_path: string;
  sizes: Record<string, number>;
  created_at: string;
}

interface UploadStagingParams {
  originalFilename: string;
  preset: ResponsivePresetResult;
}

export const uploadStaging = async ({
  originalFilename,
  preset,
}: UploadStagingParams): Promise<StagingRow> => {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) throw new Error("Sessão inválida — faça login novamente.");

  const folderId = crypto.randomUUID();
  const folder = `staging/${folderId}`;
  const items: Array<{ key: "mobile" | "tablet" | "desktop"; blob: Blob }> = [
    { key: "mobile",  blob: preset.mobile.blob },
    { key: "tablet",  blob: preset.tablet.blob },
    { key: "desktop", blob: preset.desktop.blob },
  ];

  const uploaded = await Promise.all(
    items.map(async (item) => {
      const path = `${folder}/${item.key}.webp`;
      const { error } = await supabase.storage
        .from(GALLERY_BUCKET)
        .upload(path, item.blob, { contentType: "image/webp", upsert: false });
      if (error) throw error;
      const { data } = supabase.storage.from(GALLERY_BUCKET).getPublicUrl(path);
      return { ...item, path, url: data.publicUrl };
    }),
  );

  const desktop = uploaded.find((u) => u.key === "desktop")!;
  const sizes = uploaded.reduce<Record<string, number>>((acc, u) => {
    acc[u.key] = u.blob.size;
    return acc;
  }, {});

  const { data, error } = await supabase
    .from("gallery_staging_images")
    .insert({
      user_id: userId,
      original_filename: originalFilename.slice(0, 240),
      desktop_url: desktop.url,
      desktop_path: desktop.path,
      tablet_path: uploaded.find((u) => u.key === "tablet")!.path,
      mobile_path: uploaded.find((u) => u.key === "mobile")!.path,
      sizes,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as StagingRow;
};

export const listStaging = async (): Promise<StagingRow[]> => {
  const { data, error } = await supabase
    .from("gallery_staging_images")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data as StagingRow[]) ?? [];
};

const removeStagingFiles = async (row: StagingRow): Promise<void> => {
  await supabase.storage.from(GALLERY_BUCKET).remove([
    row.mobile_path,
    row.tablet_path,
    row.desktop_path,
  ]);
};

export const discardStaging = async (id: string): Promise<void> => {
  const { data: row, error: fetchErr } = await supabase
    .from("gallery_staging_images")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (fetchErr) throw fetchErr;
  if (row) await removeStagingFiles(row as StagingRow);
  const { error } = await supabase.from("gallery_staging_images").delete().eq("id", id);
  if (error) throw error;
};

export interface AttachOptions {
  /** Promote as cover; otherwise appended to gallery_piece_images. */
  asCover?: boolean;
}

/**
 * Moves a staged image into a real piece. The files stay in the bucket
 * (we just rewire the database row) so URLs remain stable.
 */
export const attachStagingToPiece = async (
  stagingId: string,
  pieceId: string,
  opts: AttachOptions = {},
): Promise<void> => {
  const { data: row, error: fetchErr } = await supabase
    .from("gallery_staging_images")
    .select("*")
    .eq("id", stagingId)
    .maybeSingle();
  if (fetchErr) throw fetchErr;
  if (!row) throw new Error("Imagem de staging não encontrada.");
  const staging = row as StagingRow;

  if (opts.asCover) {
    const { error } = await supabase
      .from("gallery_pieces")
      .update({
        cover_url: staging.desktop_url,
        cover_storage_path: staging.desktop_path,
      })
      .eq("id", pieceId);
    if (error) throw error;
  } else {
    // append to gallery_piece_images at the end
    const { data: existing } = await supabase
      .from("gallery_piece_images")
      .select("ordem")
      .eq("piece_id", pieceId)
      .order("ordem", { ascending: false })
      .limit(1);
    const nextOrdem = ((existing?.[0]?.ordem as number | undefined) ?? -1) + 1;
    const { error } = await supabase.from("gallery_piece_images").insert({
      piece_id: pieceId,
      url: staging.desktop_url,
      storage_path: staging.desktop_path,
      ordem: nextOrdem,
    });
    if (error) throw error;
  }

  // Only delete the DB row; files now belong to the piece.
  await supabase.from("gallery_staging_images").delete().eq("id", stagingId);
};
