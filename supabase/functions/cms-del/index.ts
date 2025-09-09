// supabase/functions/cms-del/index.ts
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
  if (req.method !== "DELETE") {
    return json({ error: "Method Not Allowed" }, { status: 405 });
  }

  const url = new URL(req.url);
  const rawKey = url.searchParams.get("key");
  const key = (rawKey ?? "").trim().replace(/\/$/, "");
  if (!key) return json({ error: "Missing key" }, { status: 400 });

  try {
    let deleted = 0;
    const debug: Array<{ table: string; removed: number }> = [];

    for (const table of ["cms_texts", "cms_kv", "cms"]) {
      const { error, data } = await db
        .from(table)
        .delete()
        .eq("key", key)
        .select("key"); // forces returning so we can count

      if (error) continue;
      const removed = Array.isArray(data) ? data.length : 0;
      deleted += removed;
      debug.push({ table, removed });
    }

    // Notify POS sync with proper auth (best-effort)
    const posBase = Deno.env.get("PROJECT_REF")
      ? `https://${Deno.env.get("PROJECT_REF")}.functions.supabase.co`
      : "https://eamewialuovzguldcdcf.functions.supabase.co";
    await fetch(`${posBase}/pos-sync`, {
      method: "POST",
      headers: INTERNAL_HEADERS,
      body: JSON.stringify({ action: "cms-delete", key }),
    }).catch(() => {});

    return json({ ok: true, key, deleted, debug });
  } catch (e) {
    return json({ error: String(e) }, { status: 500 });
  }
});
