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

// Parse cms key like: menu.coffee.latte.drink / price.coffee.latte.drink
function parseKey(key: string) {
  const parts = key.split(".");
  const root = parts[0];
  const supported = ["menu", "price", "desc", "alt", "extra", "syrups-on", "coffee-on"];
  if (!supported.includes(root)) return null;

  const category = parts[1];
  if (!category) return null;

  let suffixParts = parts.slice(2);
  let drink = false;
  if (suffixParts[suffixParts.length - 1] === "drink") {
    drink = true;
    suffixParts = suffixParts.slice(0, -1);
  }
  const suffix = suffixParts.join(".");
  if (!suffix) return null;

  const baseKey = `menu.${category}.${suffix}${drink ? ".drink" : ""}`;
  return { root, category, suffix, drink, baseKey };
}

serve(async (req) => {
  const pf = preflight(req);
  if (pf) return pf;
  if (req.method !== "POST") return json({ error: "Method Not Allowed" }, { status: 405 });

  try {
    const body = await req.json().catch(() => ({}));
    const { action, key, value } = body ?? {};
    if (!action || !key) return json({ error: "Missing fields" }, { status: 400 });

    const parsed = parseKey(String(key));
    if (!parsed) return json({ ok: true }); // ignore unrelated keys

    const env = squareEnvFromEnv();

    if (action === "cms-upsert") {
      // 1) fetch existing mapping
      const { data: mapRow } = await db
        .from("pos_map")
        .select("square_id")
        .eq("cms_key", parsed.baseKey)
        .maybeSingle();
      let squareId: string | undefined = mapRow?.square_id ?? undefined;

      // 2) collect CMS values we care about
      const nameKey  = parsed.baseKey;
      const priceKey = `price.${parsed.category}.${parsed.suffix}${parsed.drink ? ".drink" : ""}`;
      const descKey  = `desc.${parsed.category}.${parsed.suffix}${parsed.drink ? ".drink" : ""}`;

      const keys = [nameKey, priceKey, descKey];
      const { data: rows = [] } = await db.from("cms_texts").select("key,value").in("key", keys);
      const lookup: Record<string, any> = {};
      for (const r of rows) lookup[r.key] = r.value;
      if (typeof value !== "undefined") lookup[key] = value; // include current write

      const name = String(lookup[nameKey] ?? parsed.suffix);
      const priceStr = String(lookup[priceKey] ?? "");
      const desc = String(lookup[descKey] ?? "");

      // normalise price → pennies
      const numeric = parseFloat(priceStr.replace(/[^\d.]/g, ""));
      const amount = Number.isFinite(numeric) ? Math.round(numeric * 100) : 0;
      const pricingType = amount > 0 ? "FIXED_PRICING" : "VARIABLE_PRICING";

      // 3) determine IDs (temp IDs when creating)
      const tmpItemId = `#${parsed.category}-${parsed.suffix}${parsed.drink ? "-drink" : ""}`;
      let itemIdForPayload = squareId || tmpItemId;

      let variationId = `${tmpItemId}-var`;
      if (squareId) {
        // try to read the existing variation id to avoid creating duplicates
        const existing = await sqFetch(env, `/v2/catalog/object/${squareId}`).catch(() => null);
        variationId = existing?.object?.item_data?.variations?.[0]?.id || variationId;
        itemIdForPayload = squareId;
      }

      // 4) build correct CatalogUpsert payload
      const catalogObject: any = {
        type: "ITEM",
        id: itemIdForPayload,
        present_at_all_locations: true,
        item_data: {
          name,
          description: desc,
          product_type: "REGULAR",
          variations: [
            {
              type: "ITEM_VARIATION",
              id: variationId,
              present_at_all_locations: true,
              item_variation_data: {
                item_id: itemIdForPayload,   // link var → parent
                name: "Default",
                pricing_type: pricingType,
                ...(pricingType === "FIXED_PRICING"
                  ? { price_money: { amount, currency: "GBP" } }
                  : {}),
              },
            },
          ],
        },
      };

      const upsertBody = {
        idempotency_key: `cms-${parsed.category}-${parsed.suffix}-${parsed.drink ? "drink" : "food"}`,
        object: catalogObject,
      };

      const res = await sqFetch(env, "/v2/catalog/upsert", {
        method: "POST",
        body: JSON.stringify(upsertBody),
      });

      squareId = res?.catalog_object?.id || squareId;

      if (squareId) {
        await db.from("pos_map").upsert({ cms_key: parsed.baseKey, square_id: squareId });
      }
      return json({ ok: true, squareId, pricingType, amount });
    }

    if (action === "cms-delete") {
      const { data: mapRow } = await db
        .from("pos_map")
        .select("square_id")
        .eq("cms_key", parsed.baseKey)
        .maybeSingle();
      const squareId = mapRow?.square_id as string | undefined;
      if (squareId) {
        await sqFetch(env, `/v2/catalog/object/${squareId}`, { method: "DELETE" }).catch(() => {});
        await db.from("pos_map").delete().eq("cms_key", parsed.baseKey);
      }
      return json({ ok: true, deleted: !!squareId });
    }

    // ignore other actions
    return json({ ok: true });
  } catch (e) {
    // surface Square errors clearly
    return json({ error: String(e) }, { status: 500 });
  }
});
