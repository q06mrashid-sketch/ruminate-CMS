// supabase/functions/cms-list/index.ts
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
  if (req.method !== "GET") return json({ error: "Method Not Allowed" }, { status: 405 });

  try {
    const like = new URL(req.url).searchParams.get("like") ?? "%";
    const tables = ["cms_texts", "cms_kv", "cms"];
    let keys: string[] = [];
    for (const table of tables) {
      const { data, error } = await db
        .from(table)
        .select("key")
        .ilike("key", like)
        .order("key", { ascending: true });
      if (!error && data && data.length > 0) {
        keys = data.map((r: any) => r.key);
        break;
      }
    }
    return json({ count: keys.length, keys });
  } catch (e) {
    return json({ error: String(e) }, { status: 500 });
  }
});
