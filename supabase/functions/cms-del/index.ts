// supabase/functions/cms-del/index.ts
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { preflight, json } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY =
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ??
  Deno.env.get("SERVICE_ROLE_KEY") ??
  Deno.env.get("SB_SERVICE_ROLE_KEY");

const CMS_WRITE_SECRET =
  Deno.env.get("CMS_SECRET") ?? Deno.env.get("CMS_WRITE_SECRET") ?? "";

const db = createClient(SUPABASE_URL, SERVICE_KEY);
const TABLES = ["cms_texts", "cms_kv", "cms"];

serve(async (req) => {
  const pf = preflight(req);
  if (pf) return pf;
  if (req.method !== "DELETE") return json({ error: "Method Not Allowed" }, { status: 405 });

  const url = new URL(req.url);
  const rawKey = url.searchParams.get("key");
  const key = (rawKey ?? "").trim().replace(/\/$/, "");
  if (!key) return json({ error: "Missing key" }, { status: 400 });

  try {
    let deleted = 0;
    const tables = ["cms_texts", "cms_kv", "cms"];
    const debug: Array<{ table: string; removed: number }> = [];

    for (const table of tables) {
      const { error, data } = await db
        .from(table)
        .delete()
        .eq("key", key)
        // chaining select forces returning=representation so we can count rows
        .select("key");

      if (error) {
        // ignore tables that don't exist or have a different shape
        continue;
      }
      const removed = Array.isArray(data) ? data.length : 0;
      deleted += removed;
      debug.push({ table, removed });
    }

    // optional: fire-and-forget POS sync
    const posBase = Deno.env.get("PROJECT_REF")
      ? `https://${Deno.env.get("PROJECT_REF")}.functions.supabase.co`
      : "https://eamewialuovzguldcdcf.functions.supabase.co";
    fetch(`${posBase}/pos-sync`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "cms-delete", key }),
    }).catch(() => {});

    return json({ ok: true, key, deleted, debug });
  } catch (e) {
    return json({ error: String(e) }, { status: 500 });
  }
});
