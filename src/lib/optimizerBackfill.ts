import { supabase } from "@/integrations/supabase/client";
import { uploadToOptimizer, getBestUrlForPiece, type ImageRole } from "./optimizerUpload";
import type { OptimizedVariant } from "./imageSnippet";

export interface LegacyImageItem {
  /** "image" row id from gallery_piece_images, or "cover-{piece_id}" sentinel for piece covers. */
  id: string;
  kind: "image" | "cover";
  pieceId: string;
  pieceName: string;
  /** url currently stored on the row (used to fetch the blob) */
  url: string;
  storagePath: string | null;
  /** name we'll give the recreated File (filename only) */
  filename: string;
}

export interface BackfillProgressItem extends LegacyImageItem {
  status: "pending" | "downloading" | "uploading" | "optimizing" | "done" | "skipped" | "error";
  error?: string;
  optimizedImageId?: string;
}

/**
 * A row is "legacy" when its storage_path doesn't live in optimized-images
 * (i.e. anything that's not "images/<uuid>/...").
 */
const isLegacyPath = (path: string | null | undefined): boolean => {
  if (!path) return true;
  return !path.startsWith("images/");
};

const filenameFromUrl = (url: string, fallback: string): string => {
  try {
    const u = new URL(url);
    const last = u.pathname.split("/").pop();
    if (last && last.includes(".")) return decodeURIComponent(last);
  } catch {
    /* ignore */
  }
  return fallback;
};

/**
 * Detect all gallery images and covers that haven't been routed through the
 * Optimizer pipeline yet. Used by the BackfillRunner UI.
 */
export const detectLegacyImages = async (): Promise<LegacyImageItem[]> => {
  const [piecesRes, imagesRes] = await Promise.all([
    supabase
      .from("gallery_pieces")
      .select("id, nome, cover_url, cover_storage_path")
      .order("ordem", { ascending: true }),
    supabase
      .from("gallery_piece_images")
      .select("id, piece_id, url, storage_path, ordem")
      .order("ordem", { ascending: true }),
  ]);

  const pieces = piecesRes.data ?? [];
  const images = imagesRes.data ?? [];
  const pieceById = new Map(pieces.map((p) => [p.id, p]));

  const out: LegacyImageItem[] = [];

  // Piece covers
  for (const p of pieces) {
    if (!p.cover_url) continue;
    if (!isLegacyPath(p.cover_storage_path)) continue;
    out.push({
      id: `cover-${p.id}`,
      kind: "cover",
      pieceId: p.id,
      pieceName: p.nome,
      url: p.cover_url,
      storagePath: p.cover_storage_path,
      filename: filenameFromUrl(p.cover_url, `${p.nome}-cover.jpg`),
    });
  }

  // Gallery images
  for (const img of images) {
    if (!isLegacyPath(img.storage_path)) continue;
    const piece = pieceById.get(img.piece_id);
    if (!piece) continue;
    out.push({
      id: img.id,
      kind: "image",
      pieceId: img.piece_id,
      pieceName: piece.nome,
      url: img.url,
      storagePath: img.storage_path,
      filename: filenameFromUrl(img.url, `${piece.nome}-${img.id.slice(0, 6)}.jpg`),
    });
  }

  return out;
};

const guessMime = (filename: string): string => {
  const ext = filename.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "png":
      return "image/png";
    case "webp":
      return "image/webp";
    case "jpg":
    case "jpeg":
    default:
      return "image/jpeg";
  }
};

const waitForOptimization = async (
  optimizedImageId: string,
  timeoutMs = 90000,
): Promise<{ variants: OptimizedVariant[] | null; status: string }> => {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const { data } = await supabase
      .from("optimized_images")
      .select("status, variants")
      .eq("id", optimizedImageId)
      .maybeSingle();
    if (data && (data.status === "ready" || data.status === "error")) {
      return {
        status: data.status,
        variants: (data.variants as unknown as OptimizedVariant[]) ?? null,
      };
    }
    await new Promise((r) => setTimeout(r, 1500));
  }
  return { variants: null, status: "timeout" };
};

/**
 * Migrates one legacy item:
 *  1. fetches its blob from the public gallery URL
 *  2. uploads through `uploadToOptimizer` (which inserts an `optimized_images`
 *     row + dispatches the optimize-image edge function)
 *  3. waits for optimization to complete
 *  4. updates `gallery_piece_images` (or `gallery_pieces.cover_url`) to point
 *     at the new JPEG-1200w URL and the `images/<uuid>` storage path.
 *
 * The original `gallery/seed/...` file is NOT deleted (kept as a safety net).
 */
export const migrateLegacyImage = async (
  item: LegacyImageItem,
  onStatus: (status: BackfillProgressItem["status"], extra?: Partial<BackfillProgressItem>) => void,
): Promise<void> => {
  onStatus("downloading");
  const resp = await fetch(item.url);
  if (!resp.ok) throw new Error(`Falha ao baixar (${resp.status})`);
  const blob = await resp.blob();
  const file = new File([blob], item.filename, { type: blob.type || guessMime(item.filename) });

  onStatus("uploading");
  const role: ImageRole = item.kind === "cover" ? "cover" : "gallery";
  const uploaded = await uploadToOptimizer({ file, pieceId: item.pieceId, role });
  onStatus("optimizing", { optimizedImageId: uploaded.optimizedImageId });

  const opt = await waitForOptimization(uploaded.optimizedImageId);
  if (opt.status === "error") throw new Error("Falha na otimização");
  const newUrl = getBestUrlForPiece(opt.variants ?? [], uploaded.originalUrl);

  if (item.kind === "cover") {
    const { error } = await supabase
      .from("gallery_pieces")
      .update({ cover_url: newUrl, cover_storage_path: uploaded.originalPath })
      .eq("id", item.pieceId);
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from("gallery_piece_images")
      .update({ url: newUrl, storage_path: uploaded.originalPath })
      .eq("id", item.id);
    if (error) throw error;
  }

  onStatus("done");
};

/**
 * Run the migration with bounded concurrency. Skips items that fail and
 * continues with the rest. Emits progress per item.
 */
export const runBackfill = async (
  items: LegacyImageItem[],
  onItemUpdate: (id: string, patch: Partial<BackfillProgressItem>) => void,
  concurrency = 2,
): Promise<{ done: number; failed: number }> => {
  let cursor = 0;
  let done = 0;
  let failed = 0;
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (cursor < items.length) {
      const i = cursor++;
      const it = items[i];
      try {
        await migrateLegacyImage(it, (status, extra) => {
          onItemUpdate(it.id, { status, ...extra });
        });
        done++;
      } catch (e) {
        failed++;
        onItemUpdate(it.id, { status: "error", error: e instanceof Error ? e.message : String(e) });
      }
    }
  });
  await Promise.all(workers);
  return { done, failed };
};
