// _shared/square.ts
export type SquareEnv = {
  base: string;   // e.g. https://connect.squareupsandbox.com
  token: string;  // SQUARE_ACCESS_TOKEN
  locationId?: string;
  version?: string;
};

export function sqHeaders(env: SquareEnv): HeadersInit {
  return {
    'Authorization': `Bearer ${env.token}`,
    'Square-Version': env.version ?? '2023-12-13',
    'Content-Type': 'application/json'
  };
}

export async function sqFetch(env: SquareEnv, path: string, init: RequestInit = {}) {
  const url = `${env.base}${path}`;
  const res = await fetch(url, { ...init, headers: { ...(init.headers||{}), ...sqHeaders(env) } });
  const text = await res.text();
  let body: any; try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  if (!res.ok) {
    throw new Error(`${res.status} ${path} → ${JSON.stringify(body)}`);
  }
  return body;
}

export async function upsertCatalogObject(env: SquareEnv, obj: any) {
  return sqFetch(env, '/v2/catalog/object', { method:'POST', body: JSON.stringify(obj) });
}

export async function batchUpsert(env: SquareEnv, idempotencyKey: string, objects: any[]) {
  return sqFetch(env, '/v2/catalog/batch-upsert', {
    method:'POST',
    body: JSON.stringify({ idempotency_key: idempotencyKey, batches: [{ objects }] })
  });
}

export async function deleteObject(env: SquareEnv, objectId: string) {
  return sqFetch(env, `/v2/catalog/object/${objectId}`, { method:'DELETE' });
}

export async function retrieveObject(env: SquareEnv, objectId: string) {
  return sqFetch(env, `/v2/catalog/object/${objectId}`);
}
