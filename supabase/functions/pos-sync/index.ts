// supabase/functions/pos-sync/index.ts
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { preflight, json } from "../_shared/cors.ts";
import { sqFetch, squareEnvFromEnv } from "../_shared/square.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY =
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ??
  Deno.env.get("SERVICE_ROLE_KEY") ??
  Deno.env.get("SB_SERVICE_ROLE_KEY");

const db = createClient(SUPABASE_URL, SERVICE_KEY);

function parseKey(key: string) {
  const parts = key.split('.');
  const root = parts[0];
  const supported = ['menu','price','desc','alt','extra','syrups-on','coffee-on'];
  if (!supported.includes(root)) return null;
  const category = parts[1];
  if (!category) return null;
  let suffixParts = parts.slice(2);
  let drink = false;
  if (suffixParts[suffixParts.length-1] === 'drink') {
    drink = true;
    suffixParts = suffixParts.slice(0,-1);
  }
  const suffix = suffixParts.join('.');
  if (!suffix) return null;
  const baseKey = `menu.${category}.${suffix}${drink ? '.drink' : ''}`;
  return { root, category, suffix, drink, baseKey };
}

serve(async (req) => {
  const pf = preflight(req);
  if (pf) return pf;
  if (req.method !== 'POST') return json({ error: 'Method Not Allowed' }, { status:405 });

  try {
    const { action, key, value } = await req.json();
    if (!key || !action) return json({ error:'Missing fields' }, { status:400 });

    const parsed = parseKey(key);
    if (!parsed) return json({ ok:true });

    const env = squareEnvFromEnv();

    if (action === 'cms-upsert') {
      // fetch existing mapping
      const { data: mapRow } = await db
        .from('pos_map')
        .select('square_id')
        .eq('cms_key', parsed.baseKey)
        .maybeSingle();
      let squareId = mapRow?.square_id as string | undefined;

      // collect CMS values
      const nameKey = parsed.baseKey;
      const priceKey = `price.${parsed.category}.${parsed.suffix}${parsed.drink ? '.drink' : ''}`;
      const descKey = `desc.${parsed.category}.${parsed.suffix}${parsed.drink ? '.drink' : ''}`;
      const altKey = `alt.${parsed.category}.${parsed.suffix}${parsed.drink ? '.drink' : ''}`;
      const extraKey = `extra.${parsed.category}.${parsed.suffix}${parsed.drink ? '.drink' : ''}`;
      const syrKey = `syrups-on.${parsed.category}.${parsed.suffix}${parsed.drink ? '.drink' : ''}`;
      const coffeeKey = `coffee-on.${parsed.category}.${parsed.suffix}${parsed.drink ? '.drink' : ''}`;

      const keys = [nameKey, priceKey, descKey, altKey, extraKey, syrKey, coffeeKey];
      const { data: rows } = await db.from('cms_texts').select('key,value').in('key', keys);
      const lookup: Record<string, any> = {};
      for (const r of rows || []) lookup[r.key] = r.value;
      lookup[key] = value; // include current value

      const name = String(lookup[nameKey] ?? parsed.suffix);
      const price = Math.round(parseFloat(String(lookup[priceKey] ?? '0')) * 100);
      const desc = String(lookup[descKey] ?? '');
      const metadata: Record<string,string> = {};
      if (lookup[altKey] !== undefined) metadata.alt = String(lookup[altKey]);
      if (lookup[extraKey] !== undefined) metadata.extra = String(lookup[extraKey]);
      if (lookup[syrKey] !== undefined) metadata['syrups-on'] = String(lookup[syrKey]);
      if (lookup[coffeeKey] !== undefined) metadata['coffee-on'] = String(lookup[coffeeKey]);

      const tmpId = squareId || `#${parsed.category}-${parsed.suffix}${parsed.drink?'-drink':''}`;
      let variationId = `${tmpId}-var`;
      if (squareId) {
        const existing = await sqFetch(env, `/v2/catalog/object/${squareId}`).catch(() => null);
        variationId = existing?.object?.item_data?.variations?.[0]?.id || variationId;
      }

      const body = {
        idempotency_key: `cms-${parsed.category}-${parsed.suffix}-${crypto.randomUUID()}`,
        object: {
          type: 'ITEM',
          id: squareId || tmpId,
          present_at_all_locations: true,
          item_data: {
            name,
            description: desc,
            metadata,
            variations: [
              {
                type: 'ITEM_VARIATION',
                id: variationId,
                item_variation_data: {
                  item_id: squareId || tmpId,
                  name: 'Default',
                  pricing_type: 'FIXED_PRICING',
                  price_money: { amount: price, currency: 'GBP' }
                }
              }
            ]
          }
        }
      };

      const res = await sqFetch(env, '/v2/catalog/object', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      squareId = res?.catalog_object?.id || squareId;

      await db.from('pos_map').upsert({ cms_key: parsed.baseKey, square_id: squareId! });
      return json({ ok:true, squareId });
    }

    if (action === 'cms-delete') {
      const { data: mapRow } = await db
        .from('pos_map')
        .select('square_id')
        .eq('cms_key', parsed.baseKey)
        .maybeSingle();
      const squareId = mapRow?.square_id as string | undefined;
      if (squareId) {
        await sqFetch(env, `/v2/catalog/object/${squareId}`, { method:'DELETE' }).catch(()=>{});
        await db.from('pos_map').delete().eq('cms_key', parsed.baseKey);
      }
      return json({ ok:true });
    }

    return json({ ok:true });
  } catch (e) {
    return json({ error: String(e) }, { status:500 });
  }
});
