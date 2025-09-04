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

serve(async (req) => {
  const pf = preflight(req);
  if (pf) return pf;
  if (req.method !== "DELETE") return json({ error: "Method Not Allowed" }, { status: 405 });

  const url = new URL(req.url);
  const key = url.searchParams.get("key");
  if (!key) {
    return json({ error: "Missing key" }, { status: 400 });
  }

  try {
    let deleted = 0;
    for (const table of ["cms_texts", "cms_kv", "cms"]) {
      const { error, count } = await db
        .from(table)
        .delete()
        .eq("key", key)
        .select("key", { count: "exact" });
      if (!error) deleted += count ?? 0;
    }
    return json({ ok: true, key, deleted });
  } catch (e) {
    return json({ error: String(e) }, { status: 500 });
  }
});
