// supabase/functions/cms-set/index.ts
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ALLOWED_ORIGIN = "https://q06mrashid-sketch.github.io";
const base = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Vary": "Origin",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-requested-with",
  "Access-Control-Max-Age": "86400",
};

const SUPABASE_URL =
  Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY =
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
  ?? Deno.env.get("SERVICE_ROLE_KEY")
  ?? Deno.env.get("SERVICE_KEY");

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: base });
  }
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405, headers: base });
  }

  try {
    const { key, value } = await req.json();
    if (!key) {
      return new Response(JSON.stringify({ error: "Missing key" }), {
        status: 400, headers: { ...base, "Content-Type": "application/json" },
      });
    }

    // upsert into cms_kv (or your table name)
    const { error } = await supabase
      .from("cms_kv")
      .upsert({ key, value }, { onConflict: "key" });

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500, headers: { ...base, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true, key }), {
      status: 200, headers: { ...base, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 400, headers: { ...base, "Content-Type": "application/json" },
    });
  }
});
