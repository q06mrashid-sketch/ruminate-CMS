import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ALLOWED_ORIGIN = "https://q06mrashid-sketch.github.io";
const base = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Vary": "Origin",
  "Access-Control-Allow-Methods": "DELETE,OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-requested-with",
  "Access-Control-Max-Age": "86400",
  "Content-Type": "application/json",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { status: 200, headers: base });
  if (req.method !== "DELETE")  return new Response(JSON.stringify({ error:"Method Not Allowed"}), { status: 405, headers: base });

  const key = new URL(req.url).searchParams.get("key");
  if (!key) return new Response(JSON.stringify({ error:"Missing key"}), { status: 400, headers: base });

  // SERVICE ROLE here (not anon)
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  let deleted = 0;

  // try 'cms' then 'cms_kv' (support either table name)
  for (const table of ["cms","cms_kv"]) {
    const { error, count } = await supabase
      .from(table)
      .delete()
      .eq("key", key)
      .select("key", { count: "exact" });

    if (error) {
      // ignore “relation does not exist” flavors; bubble up real errors
      if (!/relation .* does not exist|schema cache|Could not find the table/i.test(error.message)) {
        return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: base });
      }
    } else {
      deleted += count ?? 0;
    }
  }

  return new Response(JSON.stringify({ ok: true, key, deleted }), { status: 200, headers: base });
});
