// pos-sync: Upsert/delete Square objects based on CMS keys
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { upsertCatalogObject, deleteObject, retrieveObject, batchUpsert } from "../_shared/square.ts";

const ALLOWED_ORIGIN = Deno.env.get("ALLOWED_ORIGIN") ?? "https://q06mrashid-sketch.github.io";
const CORS = { "Access-Control-Allow-Origin": ALLOWED_ORIGIN, "Vary":"Origin", "Access-Control-Allow-Methods":"POST,OPTIONS", "Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type", "Access-Control-Max-Age":"86400" };

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY   = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SERVICE_ROLE_KEY")!;
const SQUARE_ACCESS_TOKEN = Deno.env.get("SQUARE_ACCESS_TOKEN")!;
const SQUARE_API_BASE     = (Deno.env.get("SQUARE_API_BASE") && atob(Deno.env.get("SQUARE_API_BASE")!)) || "https://connect.squareupsandbox.com";
const SQUARE_LOCATION_ID  = Deno.env.get("SQUARE_LOCATION_ID") || undefined;

const db = createClient(SUPABASE_URL, SERVICE_KEY);

function env() {
  return { base:SQUARE_API_BASE, token:SQUARE_ACCESS_TOKEN, locationId:SQUARE_LOCATION_ID };
}

// Helpers: derive CMS key parts
function parseCmsKey(key: string) {
  // menu.<category>.<suffix>[.drink] etc.
  const parts = key.split('.');
  return { root: parts[0], category: parts[1], suffix: parts.slice(2).join('.'), isDrink: key.endsWith('.drink') };
}

async function ensureModifierList(name: "SYRUPS" | "COFFEE_BLEND") {
  const { data } = await db.from('cms_square_lists').select('*').eq('name', name).maybeSingle();
  if (data?.square_modifier_list_id) return data.square_modifier_list_id;

  const idList = '#ml-' + name.toLowerCase();
  const body = {
    idempotency_key: `ml-${name}-${crypto.randomUUID()}`,
    object: {
      type: 'MODIFIER_LIST',
      id: idList,
      modifier_list_data: { name }
    }
  };
  const res = await upsertCatalogObject(env(), body);
  const modListId = res?.catalog_object?.id;
  await db.from('cms_square_lists').upsert({ name, square_modifier_list_id: modListId });
  return modListId;
}

async function upsertSyrupModifier(suffix: string, label: string, pricePence = 50) {
  const listId = await ensureModifierList('SYRUPS');
  const modId = `#syrup-${suffix}`;
  const obj = {
    idempotency_key: `syrup-${suffix}-${crypto.randomUUID()}`,
    object: {
      type: 'MODIFIER',
      id: modId,
      present_at_all_locations: true,
      modifier_data: {
        name: label,
        price_money: { amount: pricePence, currency: 'GBP' }
      }
    }
  };
  const res = await upsertCatalogObject(env(), obj);
  const squareId = res?.catalog_object?.id;

  // Attach to list (Square auto-attaches modifiers to a list by passing "modifier_list_id" in modifier_data, but older API needed separate step; for safety we store mapping only)
  await db.from('cms_square_map').upsert({
    cms_kind:'syrup', cms_suffix:suffix, cms_category:'', drink:false,
    square_object_id: squareId, square_object_type:'MODIFIER'
  }, { onConflict: 'cms_kind,cms_category,cms_suffix,drink' });

  return { listId, squareId };
}

async function upsertCoffeeBlendModifier(suffix: string, label: string) {
  const listId = await ensureModifierList('COFFEE_BLEND');
  const modId = `#blend-${suffix}`;
  const obj = {
    idempotency_key: `blend-${suffix}-${crypto.randomUUID()}`,
    object: {
      type: 'MODIFIER',
      id: modId,
      present_at_all_locations: true,
      modifier_data: {
        name: label
      }
    }
  };
  const res = await upsertCatalogObject(env(), obj);
  const squareId = res?.catalog_object?.id;
  await db.from('cms_square_map').upsert({
    cms_kind:'coffee_blend', cms_suffix:suffix, cms_category:'', drink:false,
    square_object_id: squareId, square_object_type:'MODIFIER'
  }, { onConflict: 'cms_kind,cms_category,cms_suffix,drink' });
  return { listId, squareId };
}

async function upsertItemFromCms(category: string, suffix: string, isDrink: boolean) {
  // read CMS values
  const nameKey  = isDrink ? `menu.${category}.${suffix}.drink` : `menu.${category}.${suffix}`;
  const priceKey = isDrink ? `price.${category}.${suffix}.drink` : `price.${category}.${suffix}`;
  const descKey  = isDrink ? `desc.${category}.${suffix}.drink`  : `desc.${category}.${suffix}`;
  const syrupOn  = isDrink ? `syrups-on.${category}.${suffix}.drink` : `syrups-on.${category}.${suffix}`;
  const coffeeOn = isDrink ? `coffee-on.${category}.${suffix}.drink` : `coffee-on.${category}.${suffix}`;

  const keys = [nameKey, priceKey, descKey, syrupOn, coffeeOn];
  const { data: texts } = await db.from('cms_texts').select('key,value').in('key', keys);
  const lookup = Object.fromEntries((texts||[]).map(r => [r.key, r.value]));
  const name   = lookup[nameKey]  || suffix;
  const price  = Math.round(parseFloat(lookup[priceKey] || '0') * 100); // pence
  const desc   = lookup[descKey]  || '';

  // Square object IDs we keep stable using deterministic temp IDs (#item-<category>-<suffix>[.drink])
  const tmpId = `#item-${category}-${suffix}${isDrink ? '-drink' : ''}`;
  const idempotency = `item-${category}-${suffix}${isDrink ? '-drink' : ''}-${crypto.randomUUID()}`;

  const modifiersToAttach: string[] = [];
  if ((lookup[syrupOn]||'').toString().toLowerCase() === 'true') {
    const listId = await ensureModifierList('SYRUPS');
    modifiersToAttach.push(listId);
  }
  if (category === 'coffee' || (lookup[coffeeOn]||'').toString().toLowerCase() === 'true') {
    const listId = await ensureModifierList('COFFEE_BLEND');
    modifiersToAttach.push(listId);
  }

  const obj = {
    idempotency_key: idempotency,
    object: {
      type: 'ITEM',
      id: tmpId,
      present_at_all_locations: true,
      item_data: {
        name,
        description: desc,
        // attach lists as item_data.modifier_list_info
        modifier_list_info: modifiersToAttach.map(id => ({ modifier_list_id: id })),
        variations: [{
          type: 'ITEM_VARIATION',
          id: `${tmpId}-var`,
          item_variation_data: {
            name: 'Default',
            pricing_type: 'FIXED_PRICING',
            price_money: { amount: price, currency: 'GBP' }
          }
        }]
      }
    }
  };

  const res = await upsertCatalogObject(env(), obj);
  const sqId = res?.catalog_object?.id;

  await db.from('cms_square_map').upsert({
    cms_kind:'item',
    cms_category: category,
    cms_suffix: suffix,
    drink: isDrink,
    square_object_id: sqId,
    square_object_type:'ITEM'
  }, { onConflict: 'cms_kind,cms_category,cms_suffix,drink' });

  return sqId;
}

async function deleteItemFromCms(category: string, suffix: string, isDrink: boolean) {
  const { data } = await db.from('cms_square_map').select('*')
    .eq('cms_kind','item').eq('cms_category',category).eq('cms_suffix',suffix).eq('drink',isDrink).maybeSingle();
  if (data?.square_object_id) {
    await deleteObject(env(), data.square_object_id);
    await db.from('cms_square_map').delete()
      .eq('cms_kind','item').eq('cms_category',category).eq('cms_suffix',suffix).eq('drink',isDrink);
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { status:200, headers: CORS });
  if (req.method !== 'POST')   return new Response('Method Not Allowed', { status:405, headers: CORS });

  try {
    const { action, key, value } = await req.json();

    if (action === 'cms-upsert') {
      // menu/price/desc/syrups-on/coffee-on
      const { root, category } = parseCmsKey(key);
      if (['menu','price','desc','syrups-on','coffee-on'].includes(root) && category) {
        // normalize target and write the ITEM
        const isDrink = key.includes('.drink');
        const suffix = key.split('.').slice(2).filter(p => p !== 'drink').join('.');
        const id = await upsertItemFromCms(category, suffix, isDrink);
        return new Response(JSON.stringify({ ok:true, squareId:id }), { status:200, headers: { ...CORS, 'Content-Type':'application/json' } });
      }

      // syrups.<suffix> and coffee.<suffix>
      if (key.startsWith('syrups.')) {
        const suffix = key.split('.').slice(1).join('.');
        const label = String(value ?? suffix);
        const { squareId } = await upsertSyrupModifier(suffix, label, /*default pence*/ 50);
        return new Response(JSON.stringify({ ok:true, squareId }), { status:200, headers: { ...CORS, 'Content-Type':'application/json' } });
      }

      if (key.startsWith('coffee.')) {
        const suffix = key.split('.').slice(1).join('.');
        const label = String(value ?? suffix);
        const { squareId } = await upsertCoffeeBlendModifier(suffix, label);
        return new Response(JSON.stringify({ ok:true, squareId }), { status:200, headers: { ...CORS, 'Content-Type':'application/json' } });
      }
    }

    if (action === 'cms-delete') {
      // delete ITEM mapping
      if (key.startsWith('menu.') || key.startsWith('price.') || key.startsWith('desc.')) {
        const { category } = parseCmsKey(key);
        const isDrink = key.includes('.drink');
        const suffix = key.split('.').slice(2).filter(p => p !== 'drink').join('.');
        await deleteItemFromCms(category!, suffix, isDrink);
        return new Response(JSON.stringify({ ok:true }), { status:200, headers: { ...CORS, 'Content-Type':'application/json' } });
      }
      // deleting syrups/coffee blend entries is optional; keep CMS authoritative for now
    }

    return new Response(JSON.stringify({ ok:false, ignored:true }), { status:200, headers: { ...CORS, 'Content-Type':'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status:500, headers: { ...CORS, 'Content-Type':'application/json' } });
  }
});
