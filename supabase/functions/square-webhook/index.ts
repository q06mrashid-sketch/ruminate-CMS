import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { retrieveObject } from "../_shared/square.ts";

const ALLOWED_ORIGIN = Deno.env.get("ALLOWED_ORIGIN") ?? "*";
const CORS = { "Access-Control-Allow-Origin": ALLOWED_ORIGIN, "Vary":"Origin", "Access-Control-Allow-Methods":"POST,OPTIONS", "Access-Control-Allow-Headers":"content-type", "Access-Control-Max-Age":"86400" };

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY   = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SERVICE_ROLE_KEY")!;
const SQUARE_ACCESS_TOKEN = Deno.env.get("SQUARE_ACCESS_TOKEN")!;
const SQUARE_API_BASE     = (Deno.env.get("SQUARE_API_BASE") && atob(Deno.env.get("SQUARE_API_BASE")!)) || "https://connect.squareupsandbox.com";

const db = createClient(SUPABASE_URL, SERVICE_KEY);
function env() { return { base:SQUARE_API_BASE, token:SQUARE_ACCESS_TOKEN }; }

// Minimal webhook (skip signature for now; add later with SQUARE_WEBHOOK_SECRET)
serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { status:200, headers: CORS });
  if (req.method !== 'POST')   return new Response('Method Not Allowed', { status:405, headers: CORS });

  try {
    const body = await req.json();
    // We only care about catalog.object.created/updated/deleted
    const type = body?.type || body?.event_type || '';
    const objId = body?.data?.id || body?.data?.object?.id || body?.data?.object?.catalog_object_id;

    if (!objId || !type.startsWith('catalog.')) {
      return new Response(JSON.stringify({ ok:true, ignored:true }), { status:200, headers: { ...CORS, 'Content-Type':'application/json' } });
    }

    if (type.endsWith('deleted')) {
      // find mapping and delete CMS keys
      const { data:m } = await db.from('cms_square_map').select('*').eq('square_object_id', objId).maybeSingle();
      if (m?.cms_kind === 'item') {
        const { cms_category, cms_suffix, drink } = m;
        const suffix = cms_suffix;
        const dot = drink ? '.drink' : '';
        const keys = [
          `menu.${cms_category}.${suffix}${dot}`,
          `price.${cms_category}.${suffix}${dot}`,
          `desc.${cms_category}.${suffix}${dot}`,
        ];
        await db.from('cms_texts').delete().in('key', keys);
        await db.from('cms_square_map').delete().eq('square_object_id', objId);
      }
      return new Response(JSON.stringify({ ok:true }), { status:200, headers: { ...CORS, 'Content-Type':'application/json' } });
    }

    // created/updated → fetch object, write to CMS if we have a mapping row
    const full = await retrieveObject(env(), objId).catch(()=>null);
    const co = full?.object;
    if (co?.type === 'ITEM') {
      const { data:m } = await db.from('cms_square_map').select('*').eq('square_object_id', objId).maybeSingle();
      if (m) {
        const category = m.cms_category;
        const suffix   = m.cms_suffix;
        const dot      = m.drink ? '.drink' : '';
        const name = co?.item_data?.name ?? suffix;
        const desc = co?.item_data?.description ?? '';
        const pence = co?.item_data?.variations?.[0]?.item_variation_data?.price_money?.amount ?? 0;
        const pounds = (Number(pence)/100).toFixed(2);

        await db.from('cms_texts').upsert([
          { key:`menu.${category}.${suffix}${dot}`, value: name },
          { key:`price.${category}.${suffix}${dot}`, value: pounds },
          { key:`desc.${category}.${suffix}${dot}`, value: desc },
        ], { onConflict:'key' });
      }
    }

    return new Response(JSON.stringify({ ok:true }), { status:200, headers: { ...CORS, 'Content-Type':'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status:500, headers: { ...CORS, 'Content-Type':'application/json' } });
  }
});
