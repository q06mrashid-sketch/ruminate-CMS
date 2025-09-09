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

// Parse CMS key → {root, category, suffix, drink, baseKey}
function parseKey(key: string) {
  const parts = key.split(".");
  const root = parts[0];
  const supported = [
    "menu",
    "price",
    "desc",
    "alt",
    "extra",
    "syrups-on",
    "syrup-on",
    "coffee-on",
  ];
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

// Fetch latest Square object (and first variation) to get required version fields
async function fetchSquareVersions(
  env: ReturnType<typeof squareEnvFromEnv>,
  squareId: string,
): Promise<{
  itemVersion?: number;
  variationId?: string;
  variationVersion?: number;
}> {
  try {
    const res = await sqFetch(
      env,
      `/v2/catalog/object/${squareId}?include_related_objects=true`,
    );
    const obj = res?.object;
    const itemVersion = obj?.version as number | undefined;
    let variationId: string | undefined;
    let variationVersion: number | undefined;

    // Prefer the first declared variation on the item itself
    const v = obj?.item_data?.variations?.[0];
    if (v?.id) {
      variationId = v.id;
      variationVersion = v.version;
    } else {
      // Fallback: try related objects
      const rel = (res?.related_objects ?? []) as Array<any>;
      const firstVar = rel.find((r) => r?.type === "ITEM_VARIATION");
      if (firstVar) {
        variationId = firstVar.id;
        variationVersion = firstVar.version;
      }
    }
    return { itemVersion, variationId, variationVersion };
  } catch {
    return {};
  }
}

// Load current CMS values needed to build the Square payload
async function collectCmsValues(
  baseKey: string,
  category: string,
  suffix: string,
  drink: boolean,
  incoming: { key: string; value: unknown },
) {
  const nameKey = baseKey;
  const priceKey = `price.${category}.${suffix}${drink ? ".drink" : ""}`;
  const descKey = `desc.${category}.${suffix}${drink ? ".drink" : ""}`;
  const altKey = `alt.${category}.${suffix}${drink ? ".drink" : ""}`;
  const extraKey = `extra.${category}.${suffix}${drink ? ".drink" : ""}`;
  // Accept either historical `syrup-on` or current `syrups-on`
  const syrKey1 = `syrups-on.${category}.${suffix}${drink ? ".drink" : ""}`;
  const syrKey2 = `syrup-on.${category}.${suffix}${drink ? ".drink" : ""}`;
  const coffeeKey = `coffee-on.${category}.${suffix}${drink ? ".drink" : ""}`;

  const keys = [nameKey, priceKey, descKey, altKey, extraKey, syrKey1, syrKey2, coffeeKey];

  // Pull from cms_texts (your canonical table)
  const { data: rows } = await db.from("cms_texts").select("key,value").in("key", keys);

  const lookup: Record<string, any> = {};
  for (const r of rows || []) lookup[r.key] = r.value;
  // Make sure the just-updated key/value is reflected
  lookup[incoming.key] = incoming.value;

  // Name / fallback
  const name = String(lookup[nameKey] ?? suffix);
  // Price in minor units (pence). Accept "3.50" or "350"
  const rawPrice = String(lookup[priceKey] ?? "0").trim();
  const price =
    rawPrice.includes(".")
      ? Math.round(parseFloat(rawPrice) * 100)
      : Number.isFinite(Number(rawPrice))
      ? parseInt(rawPrice, 10)
      : 0;

  const desc = String(lookup[descKey] ?? "");

  // Square metadata keys must be [a-z0-9_]. Use underscores.
  const metadata: Record<string, string> = {};
  if (lookup[altKey] !== undefined) metadata.alt = String(lookup[altKey]);
  if (lookup[extraKey] !== undefined) metadata.extra = String(lookup[extraKey]);
  if (lookup[syrKey1] !== undefined) metadata.syrups_on = String(lookup[syrKey1]);
  if (lookup[syrKey2] !== undefined) metadata.syrup_on = String(lookup[syrKey2]); // legacy
  if (lookup[coffeeKey] !== undefined) metadata.coffee_on = String(lookup[coffeeKey]);

  return { name, price, desc, metadata };
}

serve(async (req) => {
  const pf = preflight(req);
  if (pf) return pf;
  if (req.method !== "POST") return json({ error: "Method Not Allowed" }, { status: 405 });

  try {
    const body = await req.json().catch(() => ({}));
    const action = body?.action as string | undefined;
    const key = (body?.key ?? "").toString();
    const value = body?.value;

    if (!action || !key) return json({ error: "Missing fields" }, { status: 400 });

    const parsed = parseKey(key);
    if (!parsed) return json({ ok: true, skipped: "unsupported_key" });

    const env = squareEnvFromEnv();

    if (action === "cms-upsert") {
      // 1) mapping lookup
      const { data: mapRow } = await db
        .from("pos_map")
        .select("square_id")
        .eq("cms_key", parsed.baseKey)
        .maybeSingle();

      let squareId = mapRow?.square_id as string | undefined;

      // 2) collect CMS values for payload
      const { name, price, desc, metadata } = await collectCmsValues(
        parsed.baseKey,
        parsed.category,
        parsed.suffix,
        parsed.drink,
        { key, value },
      );

      // 3) When updating, Square requires the current `version` on the object (and variation)
      let itemVersion: number | undefined;
      let variationId: string | undefined;
      let variationVersion: number | undefined;

      if (squareId) {
        const vrs = await fetchSquareVersions(env, squareId);
        itemVersion = vrs.itemVersion;
        variationId = vrs.variationId;
        variationVersion = vrs.variationVersion;
      }

      // 4) Build upsert payload. Use temporary client IDs on create (prefixed with "#")
      const clientItemId = `#${parsed.category}-${parsed.suffix}${parsed.drink ? "-drink" : ""}`;
      const itemId = squareId ?? clientItemId;
      const clientVarId = `${clientItemId}-var`;
      const varId = variationId ?? clientVarId;

      // Generate an idempotency key
      const idem = (globalThis.crypto?.randomUUID?.() ??
        `${Date.now()}-${Math.random().toString(36).slice(2)}`);

      // Only include version fields if we actually have them
      const object: any = {
        type: "ITEM",
        id: itemId,
        present_at_all_locations: true,
        item_data: {
          name,
          description: desc,
          metadata,
          variations: [
            {
              type: "ITEM_VARIATION",
              id: varId,
              item_variation_data: {
                item_id: itemId,
                name: "Default",
                pricing_type: "FIXED_PRICING",
                price_money: { amount: price, currency: "GBP" },
              },
            },
          ],
        },
      };
      if (itemVersion !== undefined) object.version = itemVersion;
      if (variationVersion !== undefined) {
        object.item_data.variations[0].version = variationVersion;
      }

      const upsertBody = { idempotency_key: `cms-${parsed.category}-${parsed.suffix}-${idem}`, object };

      const res = await sqFetch(env, "/v2/catalog/object", {
        method: "POST",
        body: JSON.stringify(upsertBody),
      });

      squareId = res?.catalog_object?.id || squareId;

      // 5) persist mapping
      if (squareId) {
        await db.from("pos_map").upsert({ cms_key: parsed.baseKey, square_id: squareId });
      }

      return json({ ok: true, squareId, synced: parsed.baseKey });
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
      return json({ ok: true, deleted: parsed.baseKey });
    }

    return json({ ok: true, ignored: "unknown_action" });
  } catch (e) {
    return json({ error: String(e) }, { status: 500 });
  }
});
