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
  if (req.method !== "DELETE") {
    return json({ error: "Method Not Allowed" }, { status: 405 });
  }

  // Optional write secret gate (enabled only if set in env)
  if (CMS_WRITE_SECRET) {
    const hdr = req.headers.get("x-cms-secret") ?? "";
    if (hdr !== CMS_WRITE_SECRET) {
      return json({ error: "unauthorized" }, { status: 401 });
    }
  }

  const url = new URL(req.url);
  const key = (url.searchParams.get("key") ?? "").toString().trim();
  if (!key) {
    return json({ error: "Missing key" }, { status: 400 });
  }

  try {
    let deleted = 0;

    for (const table of TABLES) {
      const { error, count } = await db
        .from(table)
        .delete()
        .eq("key", key)
        .select("key", { count: "exact", head: true });

      if (!error) {
        deleted += count ?? 0;
      } else {
        // ignore "relation does not exist" so we can try the other tables
        const msg = String(error?.message || "");
        if (!/relation .* does not exist/i.test(msg)) {
          return json({ error: `Delete failed on ${table}: ${msg}` }, { status: 500 });
        }
      }
    }

    // Fire-and-forget POS sync
    const posBase = Deno.env.get("PROJECT_REF")
      ? `https://${Deno.env.get("PROJECT_REF")}.functions.supabase.co`
      : "https://eamewialuovzguldcdcf.functions.supabase.co";

    fetch(`${posBase}/pos-sync`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "cms-delete", key }),
    }).catch(() => {});

    return json({ ok: true, key, deleted });
  } catch (e) {
    return json({ error: String(e) }, { status: 500 });
  }
});
