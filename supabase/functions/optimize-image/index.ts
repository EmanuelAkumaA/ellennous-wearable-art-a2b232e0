// Edge function: optimize-image
// Pre-generates AVIF / WebP / JPEG variants in 4 widths from a previously
// uploaded original image.
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
const TARGET_WIDTHS = [400, 800, 1200, 1600] as const;

type Variant = {
  width: number;
  format: "avif" | "webp" | "jpeg";
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
let _encJpeg: ((img: ImageData, opts?: { quality: number }) => Promise<ArrayBuffer>) | null = null;
let _encWebp: ((img: ImageData, opts?: { quality: number }) => Promise<ArrayBuffer>) | null = null;
let _encAvif: ((img: ImageData, opts?: { quality: number }) => Promise<ArrayBuffer>) | null = null;

async function loadCodecs() {
  if (_decodeJpeg && _decodePng && _decodeWebp && _resize && _encJpeg && _encWebp && _encAvif) return;
  const [jpegMod, pngMod, webpMod, avifMod, resizeMod] = await Promise.all([
    import("https://esm.sh/@jsquash/jpeg@1.5.0?bundle"),
    import("https://esm.sh/@jsquash/png@3.0.1?bundle"),
    import("https://esm.sh/@jsquash/webp@1.4.0?bundle"),
    import("https://esm.sh/@jsquash/avif@1.4.0?bundle"),
    import("https://esm.sh/@jsquash/resize@2.1.0?bundle"),
  ]);
  // @ts-ignore
  _decodeJpeg = jpegMod.decode;
  // @ts-ignore
  _encJpeg = jpegMod.encode;
  // @ts-ignore
  _decodePng = pngMod.decode;
  // @ts-ignore
  _decodeWebp = webpMod.decode;
  // @ts-ignore
  _encWebp = webpMod.encode;
  // @ts-ignore
  _encAvif = avifMod.encode;
  // @ts-ignore
  _resize = resizeMod.default ?? resizeMod.resize;
}

async function decodeAny(bytes: ArrayBuffer, mime: string): Promise<ImageData> {
  const lower = mime.toLowerCase();
  if (lower.includes("jpeg") || lower.includes("jpg")) return _decodeJpeg!(bytes);
  if (lower.includes("png")) return _decodePng!(bytes);
  if (lower.includes("webp")) return _decodeWebp!(bytes);
  // try jpeg as last resort
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
  const token = authHeader.replace("Bearer ", "");
  const { data: claimsData, error: claimsErr } = await userClient.auth.getClaims(token);
  if (claimsErr || !claimsData?.claims?.sub) return json({ error: "Unauthorized" }, 401);

  const userId = claimsData.claims.sub as string;
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
    .select("id, original_path, name")
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

      const widths = TARGET_WIDTHS.filter((w) => w <= srcW);
      // Always include at least the original width if all targets are larger
      if (widths.length === 0) widths.push(srcW as 400);

      const variants: Variant[] = [];
      let totalBytes = 0;

      for (const width of widths) {
        const height = Math.max(1, Math.round((srcH / srcW) * width));
        const resized = width === srcW ? decoded : await _resize!(decoded, { width, height });

        const formats: Array<{ ext: "avif" | "webp" | "jpeg"; mime: string; encode: () => Promise<ArrayBuffer> }> = [
          { ext: "avif", mime: "image/avif", encode: () => _encAvif!(resized, { quality: 60 }) },
          { ext: "webp", mime: "image/webp", encode: () => _encWebp!(resized, { quality: 75 }) },
          { ext: "jpeg", mime: "image/jpeg", encode: () => _encJpeg!(resized, { quality: 85 }) },
        ];

        for (const fmt of formats) {
          try {
            const out = await fmt.encode();
            const ext = fmt.ext === "jpeg" ? "jpg" : fmt.ext;
            const path = `${folder}/${width}.${ext}`;
            const { error: upErr } = await admin.storage
              .from(BUCKET)
              .upload(path, out, { contentType: fmt.mime, upsert: true });
            if (upErr) throw upErr;
            const { data: pub } = admin.storage.from(BUCKET).getPublicUrl(path);
            const size = out.byteLength;
            totalBytes += size;
            variants.push({ width, format: fmt.ext, path, url: pub.publicUrl, size_bytes: size });
          } catch (e) {
            console.error(`Encode/upload failed for ${width}.${fmt.ext}:`, e);
          }
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
      await admin
        .from("optimized_images")
        .update({ status: "error", error_message: (e as Error).message?.slice(0, 500) ?? "Unknown error" })
        .eq("id", imageId);
    }
  })();

  return json({ ok: true, imageId });
});
