// supabase/functions/cms-list/index.ts
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ALLOWED_ORIGIN = Deno.env.get("ALLOWED_ORIGIN") ?? "*";
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

  try {
    const like = new URL(req.url).searchParams.get("like") ?? "%";
    const keys: string[] = [];

    async function pull(table: string): Promise<boolean> {
      const { data, error } = await db
        .from(table)
        .select("key")
        .ilike("key", like)
        .order("key", { ascending: true });

      if (error) {
        if (/relation .* does not exist/i.test(error.message)) return false; // table doesn't exist, try next
        throw error;
      }
      (data ?? []).forEach((r: any) => keys.push(r.key));
      return true;
    }

    // Prefer cms_texts, then fallback to cms_kv, then legacy "cms"
    await pull("cms_texts") || await pull("cms_kv") || await pull("cms");

    return new Response(JSON.stringify({ count: keys.length, keys }), {
      status: 200, headers: { ...CORS, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});
