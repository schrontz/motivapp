// Motivator – Supabase Edge Function „withings“
// Spricht mit der Withings-API, damit das Client Secret und die Tokens nie im Browser landen.
//
// Aktionen (POST, JSON):
//   { action: 'connect', code, redirect_uri }  → Code gegen Tokens tauschen (direkt nach dem Withings-Login)
//   { action: 'sync', days? }                  → Schritte, Trainings, Puls und Schlaf abholen und speichern
//   { action: 'disconnect' }                   → Verbindung trennen (Tokens löschen, Daten bleiben)
//
// Benötigte Secrets (Supabase → Edge Functions → Secrets):
//   WITHINGS_CLIENT_ID, WITHINGS_CLIENT_SECRET
// „Verify JWT“ für diese Funktion AUS – der Login wird unten im Code geprüft.

import { createClient } from 'npm:@supabase/supabase-js@2.117.2';

const WBS = 'https://wbsapi.withings.net';
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
}

// Server-Schlüssel: je nach Projekt-Generation unter einem anderen Namen
function serviceKey(): string | null {
  const direct = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('MOTIVATOR_SECRET_KEY');
  if (direct) return direct;
  const many = Deno.env.get('SUPABASE_SECRET_KEYS');
  if (many) {
    try {
      const parsed = JSON.parse(many);
      return (parsed.default || Object.values(parsed)[0]) as string;
    } catch (_) { /* weiter unten Fehler */ }
  }
  return null;
}

export async function withingsPost(path: string, params: Record<string, string>, accessToken: string | null, fetcher: typeof fetch = fetch): Promise<any> {
  const headers: Record<string, string> = { 'Content-Type': 'application/x-www-form-urlencoded' };
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  const res = await fetcher(`${WBS}${path}`, { method: 'POST', headers, body: new URLSearchParams(params).toString() });
  const data = await res.json();
  if (data.status !== 0) {
    const err: any = new Error(`Withings-Fehler ${data.status}${data.error ? ': ' + data.error : ''}`);
    err.withingsStatus = data.status;
    throw err;
  }
  return data.body;
}

export function ymd(date: Date) {
  return date.toISOString().slice(0, 10);
}

// Lokales Datum eines Zeitpunkts in einer Zeitzone (z. B. „Europe/Berlin“)
export function localDay(unixSeconds: number, timezone?: string) {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: timezone || 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit' })
      .format(new Date(unixSeconds * 1000));
  } catch (_) {
    return ymd(new Date(unixSeconds * 1000));
  }
}

export function mapActivity(userId: string, a: any) {
  const activeSec = (Number(a.moderate) || 0) + (Number(a.intense) || 0);
  return {
    user_id: userId,
    day: a.date,
    steps: a.steps != null ? Math.round(a.steps) : null,
    distance_m: a.distance != null ? Number(a.distance) : null,
    active_minutes: Math.round(activeSec / 60),
    calories: a.calories != null ? Number(a.calories) : null,
    hr_avg: a.hr_average != null ? Math.round(a.hr_average) : null,
    hr_min: a.hr_min != null ? Math.round(a.hr_min) : null,
    hr_max: a.hr_max != null ? Math.round(a.hr_max) : null,
    updated_at: new Date().toISOString()
  };
}

// Schlaf: pro Tag nur die längste Schlafphase (Nickerchen zählen nicht als Ruhepuls)
export function mapSleep(userId: string, series: any[]) {
  const best = new Map<string, any>();
  for (const s of series || []) {
    if (!s || !s.date) continue;
    const len = (Number(s.enddate) || 0) - (Number(s.startdate) || 0);
    const cur = best.get(s.date);
    if (!cur || len > cur.len) best.set(s.date, { s, len });
  }
  return [...best.values()].map(({ s }) => {
    const d = s.data || {};
    const r = (v: any) => (v != null && Number(v) > 0 ? Math.round(Number(v)) : null);
    return {
      user_id: userId,
      day: s.date,
      hr_avg: r(d.hr_average),
      hr_min: r(d.hr_min),
      hr_max: r(d.hr_max),
      sleep_min: d.total_sleep_time != null ? Math.round(Number(d.total_sleep_time) / 60) : null,
      data: d,
      updated_at: new Date().toISOString()
    };
  });
}

export function mapWorkout(userId: string, s: any) {
  const d = s.data || {};
  const pause = Number(d.pause_duration) || 0;
  const minutes = Math.max(0, (Number(s.enddate) - Number(s.startdate) - pause) / 60);
  return {
    user_id: userId,
    ext_id: String(s.id ?? `${s.startdate}-${s.category}`),
    day: s.date || localDay(Number(s.startdate), s.timezone),
    start_at: new Date(Number(s.startdate) * 1000).toISOString(),
    end_at: new Date(Number(s.enddate) * 1000).toISOString(),
    category: Number(s.category),
    duration_min: Math.round(minutes * 10) / 10,
    calories: d.calories != null ? Number(d.calories) : null,
    hr_avg: d.hr_average != null ? Math.round(d.hr_average) : null,
    hr_min: d.hr_min != null ? Math.round(d.hr_min) : null,
    hr_max: d.hr_max != null ? Math.round(d.hr_max) : null,
    data: d
  };
}

// Alle Seiten einer Withings-Liste abholen (more/offset)
async function fetchPaged(action: string, params: Record<string, string>, key: string, token: string, fetcher: typeof fetch, path = '/v2/measure') {
  const out: any[] = [];
  let offset = 0;
  for (let i = 0; i < 20; i += 1) {
    const body = await withingsPost(path, { action, ...params, ...(offset ? { offset: String(offset) } : {}) }, token, fetcher);
    out.push(...(body[key] || []));
    if (!body.more) break;
    offset = body.offset;
  }
  return out;
}

export async function fetchWithingsData(token: string, startDay: string, endDay: string, fetcher: typeof fetch = fetch, activityStart = startDay) {
  const activities = await fetchPaged('getactivity', {
    startdateymd: activityStart, enddateymd: endDay,
    data_fields: 'steps,distance,soft,moderate,intense,active,calories,hr_average,hr_min,hr_max'
  }, 'activities', token, fetcher);
  const series = await fetchPaged('getworkouts', {
    startdateymd: startDay, enddateymd: endDay,
    data_fields: 'calories,intensity,hr_average,hr_min,hr_max,hr_zone_0,hr_zone_1,hr_zone_2,hr_zone_3,pause_duration,steps,distance'
  }, 'series', token, fetcher);
  return { activities, series };
}

export async function fetchSleep(token: string, startDay: string, endDay: string, fetcher: typeof fetch = fetch) {
  return fetchPaged('getsummary', {
    startdateymd: startDay, enddateymd: endDay,
    data_fields: 'hr_average,hr_min,hr_max,total_sleep_time'
  }, 'series', token, fetcher, '/v2/sleep');
}

// Fehlt eine Spalte (Datenbank-Update noch nicht ausgeführt)?
const missingColumn = (e: any) => /column|schema cache|does not exist|relation/i.test(String(e?.message || e));

async function tokenRequest(params: Record<string, string>, fetcher: typeof fetch = fetch) {
  const clientId = Deno.env.get('WITHINGS_CLIENT_ID');
  const clientSecret = Deno.env.get('WITHINGS_CLIENT_SECRET');
  if (!clientId || !clientSecret) throw new Error('WITHINGS_CLIENT_ID / WITHINGS_CLIENT_SECRET fehlen in den Secrets.');
  return withingsPost('/v2/oauth2', { action: 'requesttoken', client_id: clientId, client_secret: clientSecret, ...params }, null, fetcher);
}

function tokenRow(userId: string, body: any) {
  return {
    user_id: userId,
    withings_userid: String(body.userid ?? ''),
    access_token: body.access_token,
    refresh_token: body.refresh_token,
    expires_at: new Date(Date.now() + (Number(body.expires_in) || 10800) * 1000 - 60000).toISOString(),
    scope: body.scope || null
  };
}

export async function handle(req: Request, deps: { fetch?: typeof fetch; db?: any } = {}): Promise<Response> {
  // Vorab-Anfrage des Browsers: alle angefragten Kopfzeilen erlauben (neuere supabase-js-Versionen schicken ggf. weitere)
  if (req.method === 'OPTIONS') {
    const asked = req.headers.get('Access-Control-Request-Headers');
    return new Response('ok', { headers: { ...CORS, ...(asked ? { 'Access-Control-Allow-Headers': asked } : {}) } });
  }
  if (req.method !== 'POST') return json({ error: 'Nur POST' }, 405);

  const fetcher = deps.fetch || fetch;
  const db: any = deps.db || (() => {
    const key = serviceKey();
    if (!key) throw new Error('Kein Server-Schlüssel gefunden (SUPABASE_SERVICE_ROLE_KEY / SUPABASE_SECRET_KEYS).');
    return createClient(Deno.env.get('SUPABASE_URL') ?? '', key, { auth: { persistSession: false } });
  })();

  // Wer ruft an? Login-Token aus dem Header prüfen.
  const jwt = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  if (!jwt) return json({ error: 'Nicht angemeldet' }, 401);
  const { data: userData, error: userError } = await db.auth.getUser(jwt);
  if (userError || !userData || !userData.user) return json({ error: 'Nicht angemeldet' }, 401);
  const userId = userData.user.id;

  let payload: any = {};
  try { payload = await req.json(); } catch (_) { /* leer */ }

  try {
    if (payload.action === 'connect') {
      if (!payload.code || !payload.redirect_uri) return json({ error: 'code und redirect_uri nötig' }, 400);
      const body = await tokenRequest({ grant_type: 'authorization_code', code: payload.code, redirect_uri: payload.redirect_uri }, fetcher);
      const { error } = await db.from('withings_tokens').upsert({ ...tokenRow(userId, body), connected_at: new Date().toISOString() });
      if (error) throw error;
      return json({ connected: true });
    }

    if (payload.action === 'disconnect') {
      const { error } = await db.from('withings_tokens').delete().eq('user_id', userId);
      if (error) throw error;
      return json({ connected: false });
    }

    if (payload.action === 'sync') {
      const { data: tok, error } = await db.from('withings_tokens').select('*').eq('user_id', userId).maybeSingle();
      if (error) throw error;
      if (!tok) return json({ connected: false });

      // Token abgelaufen? Erneuern. Withings gibt dabei einen NEUEN Refresh-Token aus – der alte wird ungültig.
      let accessToken = tok.access_token;
      if (new Date(tok.expires_at).getTime() <= Date.now()) {
        let body;
        try {
          body = await tokenRequest({ grant_type: 'refresh_token', refresh_token: tok.refresh_token }, fetcher);
        } catch (e: any) {
          return json({ connected: true, needsReconnect: true, error: String(e?.message || e) }, 200);
        }
        const row = tokenRow(userId, body);
        const { error: upErr } = await db.from('withings_tokens').update(row).eq('user_id', userId);
        if (upErr) throw upErr;
        accessToken = row.access_token;
      }

      // Zeitraum: erstes Mal 30 Tage, danach ab 3 Tage vor dem letzten Abgleich (Nachträge der Uhr)
      const days = Math.min(Math.max(Number(payload.days) || 0, 0), 400);
      const now = new Date();
      let start;
      if (days) start = new Date(now.getTime() - days * 86400000);
      else if (tok.last_sync_at) start = new Date(new Date(tok.last_sync_at).getTime() - 3 * 86400000);
      else start = new Date(now.getTime() - 30 * 86400000);
      const startDay = ymd(start);
      const endDay = ymd(new Date(now.getTime() + 86400000));

      // Puls pro Tag gibt es erst seit Update 010: beim ersten Mal die Tage ein Jahr rückwirkend neu holen
      let activityStart = startDay;
      try {
        const { count, error: hErr } = await db.from('daily_activity').select('day', { count: 'exact', head: true }).eq('user_id', userId).not('hr_min', 'is', null);
        if (!hErr && !count) activityStart = ymd(new Date(now.getTime() - 365 * 86400000));
      } catch (_) { /* Spalte fehlt noch – dann eben ohne */ }
      if (activityStart > startDay) activityStart = startDay;

      const { activities, series } = await fetchWithingsData(accessToken, startDay, endDay, fetcher, activityStart);
      const actRows = activities.filter((a: any) => a.date).map((a: any) => mapActivity(userId, a));
      const woRows = series.filter((s: any) => s.startdate && s.enddate).map((s: any) => mapWorkout(userId, s));
      if (actRows.length) {
        let { error: e1 } = await db.from('daily_activity').upsert(actRows, { onConflict: 'user_id,day' });
        if (e1 && missingColumn(e1)) {
          // Update 010 fehlt noch: ohne Puls speichern, damit Schritte weiter ankommen
          const plain = actRows.map(({ hr_avg, hr_min, hr_max, ...rest }: any) => rest);
          ({ error: e1 } = await db.from('daily_activity').upsert(plain, { onConflict: 'user_id,day' }));
        }
        if (e1) throw e1;
      }
      if (woRows.length) {
        const { error: e2 } = await db.from('workouts').upsert(woRows, { onConflict: 'user_id,ext_id' });
        if (e2) throw e2;
      }
      // Schlaf + Ruhepuls: Fehler hier sollen den Abgleich nicht kaputt machen.
      // Beim ersten Mal (noch keine Nächte gespeichert) ein Jahr rückwirkend holen.
      let sleepNights = 0;
      let sleepError: string | null = null;
      try {
        const { count, error: cErr } = await db.from('sleep_summary').select('day', { count: 'exact', head: true }).eq('user_id', userId);
        if (cErr) throw cErr;
        const sleepStart = count ? startDay : ymd(new Date(now.getTime() - 365 * 86400000));
        const sleepRows = mapSleep(userId, await fetchSleep(accessToken, sleepStart, endDay, fetcher));
        if (sleepRows.length) {
          const { error: e3 } = await db.from('sleep_summary').upsert(sleepRows, { onConflict: 'user_id,day' });
          if (e3) throw e3;
        }
        sleepNights = sleepRows.length;
      } catch (e: any) {
        console.error(e);
        sleepError = missingColumn(e) ? 'Datenbank-Update 010 fehlt' : String(e?.message || e);
      }

      const lastSync = new Date().toISOString();
      await db.from('withings_tokens').update({ last_sync_at: lastSync }).eq('user_id', userId);
      return json({ connected: true, last_sync_at: lastSync, from: startDay, activity_from: activityStart, activity_days: actRows.length, workouts: woRows.length, sleep_nights: sleepNights, sleep_error: sleepError });
    }

    return json({ error: 'Unbekannte Aktion' }, 400);
  } catch (e: any) {
    console.error(e);
    return json({ error: String(e?.message || e) }, 500);
  }
}

if (typeof Deno !== 'undefined' && Deno.serve && !(globalThis as any).__MOTIVATOR_TEST__) {
  Deno.serve((req) => handle(req));
}
