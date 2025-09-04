// supabase/functions/cms-set/index.ts
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ALLOWED_ORIGIN = Deno.env.get("ALLOWED_ORIGIN") ?? "https://q06mrashid-sketch.github.io";
const CORS = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Vary": "Origin",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
  // 👇 add x-cms-secret here
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-requested-with, x-cms-secret",
  "Access-Control-Max-Age": "86400",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY =
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ??
  Deno.env.get("SERVICE_ROLE_KEY") ??
  Deno.env.get("SB_SERVICE_ROLE_KEY");
const WRITE_SECRET = Deno.env.get("CMS_WRITE_SECRET") ?? "Misterbignose12!"; // match your UI

const db = createClient(SUPABASE_URL, SERVICE_KEY);

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { status: 200, headers: CORS });
  if (req.method !== "POST")    return new Response("Method Not Allowed", { status: 405, headers: CORS });

  // simple secret check
  const got = req.headers.get("x-cms-secret") ?? "";
  if (got !== WRITE_SECRET) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  let body: { key?: string; value?: unknown };
  try { body = await req.json(); } catch { body = {}; }
  const key = (body.key ?? "").toString().trim();
  const value = body.value ?? "";

  if (!key) {
    return new Response(JSON.stringify({ error: "Missing key" }), {
      status: 400, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  async function upsert(table: string) {
    const { error } = await db.from(table)
      .upsert({ key, value }, { onConflict: "key" })
      .select("key").limit(1);
    if (error) {
      if (/relation .* does not exist/i.test(error.message)) return false;
      throw error;
    }
    return true;
  }

  try {
    await upsert("cms_texts") || await upsert("cms_kv") || await upsert("cms");
    return new Response(JSON.stringify({ ok: true, key }), {
      status: 200, headers: { ...CORS, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});
