// supabase/functions/cms-list/index.ts
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
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

  try {
    const like = new URL(req.url).searchParams.get("like") ?? "%";
    const { data, error } = await db
      .from("cms_texts")
      .select("key")
      .ilike("key", like)
      .order("key", { ascending: true });
    if (error) throw error;
    const keys = (data ?? []).map((r: any) => r.key);

    return new Response(JSON.stringify({ count: keys.length, keys }), {
      status: 200, headers: { ...CORS, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});
