// supabase/functions/cms-del/index.ts
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ALLOWED_ORIGIN = "https://q06mrashid-sketch.github.io";
const base = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Vary": "Origin",
  "Access-Control-Allow-Methods": "GET,POST,DELETE,OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-requested-with",
  "Access-Control-Max-Age": "86400",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: base });
  }
  if (req.method !== "DELETE") {
    return new Response("Method Not Allowed", { status: 405, headers: base });
  }

  const url = new URL(req.url);
  const key = url.searchParams.get("key");
  if (!key) {
    return new Response(JSON.stringify({ error: "Missing key" }), {
      status: 400,
      headers: { ...base, "Content-Type": "application/json" },
    });
  }

  // Use service key if present to bypass RLS (no db push needed).
  const service =
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ??
    Deno.env.get("SERVICE_ROLE_KEY") ??
    Deno.env.get("SUPABASE_ANON_KEY")!;

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, service);

  let deleted = 0;

  // Try cms_kv first
  const d1 = await supabase.from("cms_kv").delete().eq("key", key)
    .select("key", { count: "exact" });
  if (!d1.error) {
    deleted += d1.count ?? 0;
  } else if (!/relation .* does not exist/i.test(d1.error.message)) {
    return new Response(JSON.stringify({ error: d1.error.message }), {
      status: 500, headers: { ...base, "Content-Type": "application/json" },
    });
  }

  // Fallback to legacy "cms" table
  if (deleted === 0) {
    const d2 = await supabase.from("cms").delete().eq("key", key)
      .select("key", { count: "exact" });
    if (!d2.error) {
      deleted += d2.count ?? 0;
    } else if (!/relation .* does not exist/i.test(d2.error.message)) {
      return new Response(JSON.stringify({ error: d2.error.message }), {
        status: 500, headers: { ...base, "Content-Type": "application/json" },
      });
    }
  }

  return new Response(JSON.stringify({ ok: true, key, deleted }), {
    status: 200, headers: { ...base, "Content-Type": "application/json" },
  });
});

