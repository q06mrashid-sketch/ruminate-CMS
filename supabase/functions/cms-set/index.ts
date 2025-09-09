// supabase/functions/cms-set/index.ts
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { preflight, json } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY =
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ??
  Deno.env.get("SERVICE_ROLE_KEY") ??
  Deno.env.get("SB_SERVICE_ROLE_KEY");

const db = createClient(SUPABASE_URL, SERVICE_KEY);

// Internal auth for calling other edge functions in this project
const INTERNAL_TOKEN =
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ??
  Deno.env.get("SERVICE_ROLE_KEY") ??
  Deno.env.get("SB_SERVICE_ROLE_KEY") ??
  Deno.env.get("SUPABASE_ANON_KEY")!;

const INTERNAL_HEADERS = {
  "Content-Type": "application/json",
  "Authorization": `Bearer ${INTERNAL_TOKEN}`,
  "apikey": INTERNAL_TOKEN,
} as const;

serve(async (req) => {
  const pf = preflight(req);
  if (pf) return pf;
  if (req.method !== "POST") {
    return json({ error: "Method Not Allowed" }, { status: 405 });
  }

  let body: { key?: string; value?: unknown } = {};
  try {
    body = await req.json();
  } catch {/* ignore */ }

  const key = (body.key ?? "").toString().trim();
  const value = body.value ?? "";

  if (!key) {
    return json({ error: "Missing key" }, { status: 400 });
  }

  try {
    // Upsert into whichever CMS table exists
    let saved = false;
    for (const table of ["cms_texts", "cms_kv", "cms"]) {
      const { error } = await db
        .from(table)
        .upsert({ key, value }, { onConflict: "key" })
        .select("key")
        .limit(1);
      if (!error) { saved = true; break; }
    }
    if (!saved) throw new Error("Failed to save");

    // Notify POS sync with proper auth
    const posBase = Deno.env.get("PROJECT_REF")
      ? `https://${Deno.env.get("PROJECT_REF")}.functions.supabase.co`
      : "https://eamewialuovzguldcdcf.functions.supabase.co";

    await fetch(`${posBase}/pos-sync`, {
      method: "POST",
      headers: INTERNAL_HEADERS,
      body: JSON.stringify({ action: "cms-upsert", key, value }),
    }).catch(() => { /* non-blocking */ });

    return json({ ok: true, key });
  } catch (e) {
    return json({ error: String(e) }, { status: 500 });
  }
});
