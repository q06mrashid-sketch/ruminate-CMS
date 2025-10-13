import { serve } from "https://deno.land/std/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Inline production config (authorized to handle secrets)
const SQUARE_ENV = 'production' as const;
const SQUARE_APPLICATION_ID = 'sq0idp-KwQWyhSNMu2P3VFPjyDGLA';
const SQUARE_ACCESS_TOKEN   = 'EAAAl3rZTymb0OTipgts3mRGlznU4lYxTArnxx9G5Blw6HR7I4yHbuKh-IBBhaEC';
const SQUARE_APPLICATION_SECRET = 'sq0csp-3_EwTtH0OJKM2UNJfSPXjs3J_PXwnx5JLVPoNFzgfmE';
const SQUARE_LOCATION_ID    = 'LGV05CNHKZJE6';
const SQUARE_BASE           = 'https://connect.squareup.com';

void [SQUARE_ENV, SQUARE_APPLICATION_ID, SQUARE_APPLICATION_SECRET];

const SUPABASE_URL = 'https://eamewialuovzguldcdcf.supabase.co';
const SERVICE_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const db = createClient(SUPABASE_URL, SERVICE_KEY);

function sqHeaders(): HeadersInit {
  return {
    'Authorization': `Bearer ${SQUARE_ACCESS_TOKEN}`,
    'Square-Version': '2023-12-13',
    'Content-Type': 'application/json',
  };
}
async function sq(path: string, init: RequestInit = {}) {
  const res = await fetch(`${SQUARE_BASE}${path}`, { ...init, headers: { ...(init.headers||{}), ...sqHeaders() } });
  const text = await res.text();
  let body: any; try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  if (!res.ok) throw new Error(`${res.status} ${path} → ${JSON.stringify(body)}`);
  return body;
}

type Receipt = {
  orderId: string;
  items: Array<{ id: string; quantity: number; unitFinalPrice: number }>;
  totals: { currency: 'GBP'; grandTotal: number };
};

serve(async (req) => {
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });
  try {
    const receipt: Receipt = await req.json();
    const cmsKeys = Array.from(new Set(receipt.items.map(i => i.id)));
    const { data: mapRows, error: mapErr } = await db.from('pos_map').select('cms_key, square_id').in('cms_key', cmsKeys);
    if (mapErr) throw mapErr;
    const idMap = Object.fromEntries((mapRows||[]).map(r => [r.cms_key, r.square_id]));

    const lineItems = receipt.items.map((it) => {
      const catalogObjectId = idMap[it.id];
      if (!catalogObjectId) throw new Error(`No Square mapping for item id ${it.id}`);
      return {
        catalogObjectId,
        quantity: String(it.quantity),
        basePriceMoney: { amount: Math.round(it.unitFinalPrice * 100), currency: receipt.totals.currency },
      };
    });

    const orderReq = {
      idempotency_key: receipt.orderId,
      order: { locationId: SQUARE_LOCATION_ID, referenceId: receipt.orderId, lineItems },
    };
    const orderRes = await sq('/v2/orders', { method: 'POST', body: JSON.stringify(orderReq) });
    const orderId: string | undefined = orderRes?.order?.id;
    if (!orderId) throw new Error('Square order not returned');

    const payReq = {
      source_id: 'EXTERNAL',
      idempotency_key: `${receipt.orderId}-pay`,
      amount_money: { amount: Math.round(receipt.totals.grandTotal * 100), currency: receipt.totals.currency },
      order_id: orderId,
      external_details: { type: 'CARD', source: 'Ruminate App' },
    };
    const payRes = await sq('/v2/payments', { method: 'POST', body: JSON.stringify(payReq) });
    const paymentId: string | undefined = payRes?.payment?.id;

    await db.from('orders')
      .update({ square_order_id: orderId, square_payment_id: paymentId ?? null })
      .eq('order_id', receipt.orderId);

    return new Response(JSON.stringify({ ok: true, orderId, paymentId }), { headers: { 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
});
