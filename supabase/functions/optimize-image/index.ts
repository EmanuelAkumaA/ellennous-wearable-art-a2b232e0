// Edge function: optimize-image
// Generates 3 WebP variants (mobile/tablet/desktop) — fast pipeline.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

// @ts-ignore — Deno types not present in this client repo
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
// @ts-ignore
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
// @ts-ignore
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const BUCKET = "optimized-images";

type DeviceLabel = "mobile" | "tablet" | "desktop";

const TARGET_VARIANTS: Array<{ label: DeviceLabel; width: number; quality: number }> = [
  { label: "mobile", width: 480, quality: 78 },
  { label: "tablet", width: 1024, quality: 80 },
  { label: "desktop", width: 1600, quality: 82 },
];

type Variant = {
  width: number;
  format: "webp";
  device_label: DeviceLabel;
  path: string;
  url: string;
  size_bytes: number;
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

// Lazy WASM loaders (initialised once per warm invocation)
let _decodeJpeg: ((b: ArrayBuffer) => Promise<ImageData>) | null = null;
let _decodePng: ((b: ArrayBuffer) => Promise<ImageData>) | null = null;
let _decodeWebp: ((b: ArrayBuffer) => Promise<ImageData>) | null = null;
let _resize: ((img: ImageData, opts: { width: number; height: number }) => Promise<ImageData>) | null = null;
let _encWebp: ((img: ImageData, opts?: { quality: number }) => Promise<ArrayBuffer>) | null = null;

async function loadCodecs() {
  if (_decodeJpeg && _decodePng && _decodeWebp && _resize && _encWebp) return;
  const [jpegMod, pngMod, webpMod, resizeMod] = await Promise.all([
    import("https://esm.sh/@jsquash/jpeg@1.5.0?bundle"),
    import("https://esm.sh/@jsquash/png@3.0.1?bundle"),
    import("https://esm.sh/@jsquash/webp@1.4.0?bundle"),
    import("https://esm.sh/@jsquash/resize@2.1.0?bundle"),
  ]);
  // @ts-ignore
  _decodeJpeg = jpegMod.decode;
  // @ts-ignore
  _decodePng = pngMod.decode;
  // @ts-ignore
  _decodeWebp = webpMod.decode;
  // @ts-ignore
  _encWebp = webpMod.encode;
  // @ts-ignore
  _resize = resizeMod.default ?? resizeMod.resize;
}

async function decodeAny(bytes: ArrayBuffer, mime: string): Promise<ImageData> {
  const lower = mime.toLowerCase();
  if (lower.includes("jpeg") || lower.includes("jpg")) return _decodeJpeg!(bytes);
  if (lower.includes("png")) return _decodePng!(bytes);
  if (lower.includes("webp")) return _decodeWebp!(bytes);
  return _decodeJpeg!(bytes);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // Auth: must be admin
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData?.user?.id) return json({ error: "Unauthorized" }, 401);

  const userId = userData.user.id;
  const { data: isAdminRow, error: roleErr } = await userClient.rpc("has_role", {
    _user_id: userId,
    _role: "admin",
  });
  if (roleErr || !isAdminRow) return json({ error: "Forbidden" }, 403);

  let body: { imageId?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }
  const imageId = body.imageId;
  if (!imageId || typeof imageId !== "string") return json({ error: "imageId required" }, 400);

  // Service role for storage + db writes (bypass RLS for the worker)
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  // Fetch row
  const { data: row, error: rowErr } = await admin
    .from("optimized_images")
    .select("id, original_path, name, piece_id")
    .eq("id", imageId)
    .maybeSingle();
  if (rowErr || !row) return json({ error: "Image not found" }, 404);

  // Mark as processing (clear previous variants/error)
  await admin
    .from("optimized_images")
    .update({ status: "processing", error_message: null, variants: [], total_optimized_bytes: null })
    .eq("id", imageId);

  // Kick off async pipeline; respond immediately so the client doesn't hang
  (async () => {
    try {
      await loadCodecs();

      // Download original
      const { data: file, error: dlErr } = await admin.storage.from(BUCKET).download(row.original_path);
      if (dlErr || !file) throw new Error(`Download failed: ${dlErr?.message ?? "no file"}`);
      const buf = await file.arrayBuffer();
      const mime = file.type || "image/jpeg";

      const decoded = await decodeAny(buf, mime);
      const srcW = decoded.width;
      const srcH = decoded.height;

      const folder = row.original_path.split("/").slice(0, -1).join("/");

      const variants: Variant[] = [];
      let totalBytes = 0;

      for (const target of TARGET_VARIANTS) {
        // Don't upscale: cap at source width
        const width = Math.min(target.width, srcW);
        const height = Math.max(1, Math.round((srcH / srcW) * width));
        try {
          const resized = width === srcW ? decoded : await _resize!(decoded, { width, height });
          const out = await _encWebp!(resized, { quality: target.quality });
          const path = `${folder}/${target.label}.webp`;
          const { error: upErr } = await admin.storage
            .from(BUCKET)
            .upload(path, out, { contentType: "image/webp", upsert: true });
          if (upErr) throw upErr;
          const { data: pub } = admin.storage.from(BUCKET).getPublicUrl(path);
          const size = out.byteLength;
          totalBytes += size;
          variants.push({
            width,
            format: "webp",
            device_label: target.label,
            path,
            url: pub.publicUrl,
            size_bytes: size,
          });
        } catch (e) {
          console.error(`Encode/upload failed for ${target.label}:`, e);
        }
      }

      const update: Record<string, unknown> = {
        status: variants.length ? "ready" : "error",
        variants,
        total_optimized_bytes: totalBytes,
        original_width: srcW,
        original_height: srcH,
      };
      if (!variants.length) update.error_message = "No variants generated";

      await admin.from("optimized_images").update(update).eq("id", imageId);
    } catch (e) {
      console.error("optimize-image failed:", e);
      const message = (e as Error).message?.slice(0, 500) ?? "Unknown error";
      await admin.from("optimization_error_log").insert({
        optimized_image_id: imageId,
        piece_id: row.piece_id ?? null,
        stage: "processing",
        error_message: message,
        meta: { name: row.name, original_path: row.original_path },
      });
      await admin
        .from("optimized_images")
        .update({ status: "error", error_message: message })
        .eq("id", imageId);
    }
  })();

  return json({ ok: true, imageId });
});
