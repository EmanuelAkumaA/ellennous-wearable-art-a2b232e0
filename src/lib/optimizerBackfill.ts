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

export type DeviceLabel = "mobile" | "tablet" | "desktop";

export interface BackfillProgressItem extends LegacyImageItem {
  status: "pending" | "downloading" | "uploading" | "optimizing" | "done" | "skipped" | "error";
  /** 0–100 progress within the current run */
  progress: number;
  error?: string;
  /** Stage where the current error occurred (download/upload/optimize/persist) */
  errorStage?: string;
  optimizedImageId?: string;
  /** Devices whose WebP variant is already available (incremental) */
  readyDevices?: DeviceLabel[];
}

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

type StatusEmitter = (
  status: BackfillProgressItem["status"],
  extra?: Partial<BackfillProgressItem>,
) => void;

const downloadWithProgress = async (
  url: string,
  contentTypeFallback: string,
  onProgress: (pct: number) => void,
): Promise<Blob> => {
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Falha ao baixar (${resp.status})`);
  const total = Number(resp.headers.get("content-length")) || 0;
  const ct = resp.headers.get("content-type") || contentTypeFallback;

  if (!resp.body) {
    return await resp.blob();
  }

  const reader = resp.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      chunks.push(value);
      received += value.length;
      if (total) {
        onProgress(Math.min(40, Math.round((received / total) * 40)));
      }
    }
  }
  return new Blob(chunks as BlobPart[], { type: ct });
};

const waitForOptimization = async (
  optimizedImageId: string,
  onPoll: (elapsedMs: number) => void,
  timeoutMs = 30000,
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
    onPoll(Date.now() - start);
    await new Promise((r) => setTimeout(r, 800));
  }
  return { variants: null, status: "timeout" };
};

export const migrateLegacyImage = async (
  item: LegacyImageItem,
  onStatus: StatusEmitter,
): Promise<void> => {
  onStatus("downloading", { progress: 0 });
  const blob = await downloadWithProgress(item.url, guessMime(item.filename), (pct) => {
    onStatus("downloading", { progress: pct });
  });
  onStatus("downloading", { progress: 40 });

  const file = new File([blob], item.filename, { type: blob.type || guessMime(item.filename) });

  onStatus("uploading", { progress: 50 });
  const role: ImageRole = item.kind === "cover" ? "cover" : "gallery";
  const uploaded = await uploadToOptimizer({ file, pieceId: item.pieceId, role });
  onStatus("optimizing", { progress: 60, optimizedImageId: uploaded.optimizedImageId });

  const opt = await waitForOptimization(uploaded.optimizedImageId, (elapsed) => {
    // New pipeline ~3-5s per image: ramp to 98% in ~10s
    const pct = 60 + Math.min(38, Math.round(elapsed / 260));
    onStatus("optimizing", { progress: pct });
  });
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

  onStatus("done", { progress: 100 });
};

export const runBackfill = async (
  items: LegacyImageItem[],
  onItemUpdate: (id: string, patch: Partial<BackfillProgressItem>) => void,
  concurrency = 4,
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
        onItemUpdate(it.id, {
          status: "error",
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }
  });
  await Promise.all(workers);
  return { done, failed };
};
