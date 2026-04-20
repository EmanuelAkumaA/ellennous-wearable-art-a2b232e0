import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface SubmitBody {
  token?: string;
  client_name?: string;
  client_role?: string | null;
  rating?: number;
  content?: string;
  photo_url?: string | null;
  photo_storage_path?: string | null;
  city?: string | null;
  state?: string | null;
  instagram?: string | null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    if (req.method === "GET") {
      // Validar token (usado pela página pública para conferir antes de mostrar form)
      const url = new URL(req.url);
      const token = url.searchParams.get("token");
      if (!token) {
        return new Response(JSON.stringify({ valid: false, reason: "missing_token" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data, error } = await supabase
        .from("review_invites")
        .select("id, expires_at, used_at, revoked, note")
        .eq("token", token)
        .maybeSingle();

      if (error || !data) {
        return new Response(JSON.stringify({ valid: false, reason: "not_found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (data.revoked) {
        return new Response(JSON.stringify({ valid: false, reason: "revoked" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (data.used_at) {
        return new Response(JSON.stringify({ valid: false, reason: "used" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (new Date(data.expires_at).getTime() < Date.now()) {
        return new Response(JSON.stringify({ valid: false, reason: "expired" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ valid: true, expires_at: data.expires_at }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "method_not_allowed" }), {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = (await req.json()) as SubmitBody;
    const token = (body.token ?? "").trim();
    const client_name = (body.client_name ?? "").trim();
    const client_role = body.client_role?.trim() || null;
    const rating = Number(body.rating);
    const content = (body.content ?? "").trim();
    const photo_url = body.photo_url?.trim() || null;
    const photo_storage_path = body.photo_storage_path?.trim() || null;
    const city = body.city?.trim().slice(0, 80) || null;
    const state = body.state?.trim().slice(0, 40) || null;
    const rawIg = body.instagram?.trim().replace(/^@+/, "").slice(0, 60) || null;
    const instagram = rawIg ? `@${rawIg}` : null;

    if (
      !token ||
      !client_name ||
      client_name.length > 120 ||
      !content ||
      content.length > 2000 ||
      !Number.isInteger(rating) ||
      rating < 1 ||
      rating > 5
    ) {
      return new Response(JSON.stringify({ error: "invalid_payload" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: invite, error: invErr } = await supabase
      .from("review_invites")
      .select("id, expires_at, used_at, revoked")
      .eq("token", token)
      .maybeSingle();

    if (invErr || !invite) {
      return new Response(JSON.stringify({ error: "invite_not_found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (invite.revoked) {
      return new Response(JSON.stringify({ error: "invite_revoked" }), {
        status: 410,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (invite.used_at) {
      return new Response(JSON.stringify({ error: "invite_used" }), {
        status: 410,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (new Date(invite.expires_at).getTime() < Date.now()) {
      return new Response(JSON.stringify({ error: "invite_expired" }), {
        status: 410,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { error: insertErr } = await supabase.from("reviews").insert({
      invite_id: invite.id,
      client_name,
      client_role,
      rating,
      content,
      photo_url,
      photo_storage_path,
      city,
      state,
      instagram,
      status: "pending",
    });
    if (insertErr) {
      return new Response(JSON.stringify({ error: "insert_failed", details: insertErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await supabase
      .from("review_invites")
      .update({ used_at: new Date().toISOString() })
      .eq("id", invite.id);

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: "server_error", details: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
