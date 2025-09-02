// supabase/functions/cms-get/index.ts
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ALLOWED_ORIGIN = Deno.env.get("ALLOWED_ORIGIN") ?? "https://q06mrashid-sketch.github.io";
const CORS = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Vary": "Origin",
  "Access-Control-Allow-Methods": "GET,OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-requested-with",
  "Access-Control-Max-Age": "86400",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY =
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ??
  Deno.env.get("SERVICE_ROLE_KEY") ??
  Deno.env.get("SB_SERVICE_ROLE_KEY");

const db = createClient(SUPABASE_URL, SERVICE_KEY);

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { status: 200, headers: CORS });
  if (req.method !== "GET")   return new Response("Method Not Allowed", { status: 405, headers: CORS });

  const url = new URL(req.url);
  const key = url.searchParams.get("key");
  if (!key) {
    return new Response(JSON.stringify({ error: "Missing key" }), {
      status: 400, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  async function grab(table: string) {
    const { data, error } = await db.from(table)
      .select("value").eq("key", key).limit(1).maybeSingle();
    if (error) {
      if (/relation .* does not exist/i.test(error.message)) return undefined;
      throw error;
    }
    return data?.value;
  }

  try {
    const value =
      (await grab("cms_texts")) ??
      (await grab("cms_kv")) ??
      (await grab("cms"));

    return new Response(JSON.stringify({ key, value: value ?? null }), {
      status: 200, headers: { ...CORS, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});
