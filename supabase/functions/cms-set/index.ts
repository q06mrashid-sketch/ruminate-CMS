// supabase/functions/cms-set/index.ts
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ALLOWED_ORIGIN = "https://q06mrashid-sketch.github.io";
const base = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Vary": "Origin",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-requested-with",
  "Access-Control-Max-Age": "86400",
};

function missingTable(msg: string) {
  return /relation .* does not exist/i.test(msg) || /schema cache/i.test(msg) || /Could not find the table/i.test(msg);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { status: 200, headers: base });
  if (req.method !== "POST")    return new Response("Method Not Allowed", { status: 405, headers: base });

  let payload: any = {};
  try { payload = await req.json(); } catch {}
  const key = payload?.key;
  const value = payload?.value;
  if (!key) {
    return new Response(JSON.stringify({ error: "Missing key" }), {
      status: 400,
      headers: { ...base, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")! // bypasses RLS inside the function only
  );

  async function upsertInto(table: string) {
    const { error } = await supabase
      .from(table)
      .upsert({ key, value }, { onConflict: "key" });
    return error;
  }

  let err = await upsertInto("cms_kv");
  if (err && missingTable(err.message)) {
    err = await upsertInto("cms"); // fallback table name
  }
  if (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...base, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { ...base, "Content-Type": "application/json" },
  });
});
