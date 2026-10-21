// Motivator – Supabase Edge Function „openfoodfacts“
// Fragt Open Food Facts (https://world.openfoodfacts.org, Daten unter ODbL) und meldet sich dabei mit dem Namen der App –
// das verlangt OFF, und ein Browser darf den User-Agent nicht selbst setzen.
//
// Aktionen (POST, JSON):
//   { action: 'search', q }       → { products: [...] }  (höchstens 20, nur die Felder, die die App braucht)
//   { action: 'product', code }   → { product: {...} | null }
//
// Keine Secrets nötig. „Verify JWT“ kann AN bleiben (die App schickt den Login mit).
// Grenzen von OFF: 10 Suchen und 15 Produkte pro Minute – darum ein kleiner Zwischenspeicher.

const UA = 'Motivator/1.0 (https://github.com/schrontz/motivapp)';
const FIELDS = 'code,product_name,product_name_de,brands,nutriments,ingredients_text_de,ingredients_text,serving_quantity';
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
}

// Nur die Nährwerte je 100 g mitschicken – die Antworten von OFF sind sonst sehr groß
export function slim(p: any) {
  if (!p || !p.code) return null;
  const n = p.nutriments || {};
  const keep: Record<string, unknown> = {};
  for (const k of Object.keys(n)) if (k.endsWith('_100g')) keep[k] = n[k];
  return {
    code: String(p.code), product_name: p.product_name || '', product_name_de: p.product_name_de || '', brands: p.brands || '',
    ingredients_text_de: p.ingredients_text_de || '', ingredients_text: p.ingredients_text || '',
    serving_quantity: p.serving_quantity ?? null, nutriments: keep
  };
}

const cache = new Map<string, { at: number; data: unknown }>();
const TTL = 6 * 60 * 60 * 1000;

async function offGet(url: string, fetcher: typeof fetch) {
  const hit = cache.get(url);
  if (hit && Date.now() - hit.at < TTL) return hit.data;
  const res = await fetcher(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } });
  if (res.status === 429 || res.status === 503) throw new Error('Open Food Facts ist gerade ausgelastet – in einer Minute nochmal.');
  if (!res.ok) throw new Error(`Open Food Facts antwortet nicht (${res.status})`);
  const data = await res.json();
  cache.set(url, { at: Date.now(), data });
  if (cache.size > 300) cache.delete(cache.keys().next().value as string);
  return data;
}

export async function handle(req: Request, deps: { fetch?: typeof fetch } = {}): Promise<Response> {
  if (req.method === 'OPTIONS') {
    const asked = req.headers.get('Access-Control-Request-Headers');
    return new Response('ok', { headers: { ...CORS, ...(asked ? { 'Access-Control-Allow-Headers': asked } : {}) } });
  }
  if (req.method !== 'POST') return json({ error: 'Nur POST' }, 405);
  const fetcher = deps.fetch || fetch;
  let payload: any = {};
  try { payload = await req.json(); } catch (_) { /* leer */ }
  try {
    if (payload.action === 'search') {
      const q = String(payload.q || '').trim().slice(0, 80);
      if (q.length < 2) return json({ products: [] });
      const url = 'https://world.openfoodfacts.org/cgi/search.pl?' + new URLSearchParams({
        search_terms: q, search_simple: '1', action: 'process', json: '1', page_size: '20', lc: 'de', fields: FIELDS, sort_by: 'unique_scans_n'
      });
      const data: any = await offGet(url, fetcher);
      return json({ products: (data.products || []).map(slim).filter(Boolean) });
    }
    if (payload.action === 'product') {
      const code = String(payload.code || '').replace(/\D/g, '');
      if (code.length < 6 || code.length > 14) return json({ error: 'Das sieht nicht nach einem Strichcode aus.' }, 400);
      const data: any = await offGet(`https://world.openfoodfacts.org/api/v2/product/${code}.json?fields=${FIELDS}`, fetcher);
      return json({ product: data && data.status === 1 ? slim(data.product) : null });
    }
    return json({ error: 'Unbekannte Aktion' }, 400);
  } catch (e: any) {
    console.error(e);
    return json({ error: String(e?.message || e) }, 502);
  }
}

if (typeof Deno !== 'undefined' && Deno.serve && !(globalThis as any).__MOTIVATOR_TEST__) {
  Deno.serve((req) => handle(req));
}
