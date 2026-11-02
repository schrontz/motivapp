// Motivator – Supabase Edge Function „erinnerung“
// Schickt einmal am Tag eine Nachricht (Web Push), wenn noch etwas offen ist.
//
// Aktionen (POST, JSON):
//   { action: 'run' }    → vom Zeitplan (pg_cron, alle 5 Min.), mit Kopfzeile x-motivator-cron – siehe 017_erinnerung.sql
//   { action: 'key' }    → öffentlicher Schlüssel für pushManager.subscribe (mit Login)
//   { action: 'test' }   → Probe-Nachricht an die eigenen Geräte (mit Login)
//
// „Verify JWT“ für diese Funktion AUS – der Login bzw. das Zeitplan-Geheimnis wird unten im Code geprüft.
// Keine Secrets nötig: Das Schlüsselpaar (VAPID) erzeugt die Funktion beim ersten Aufruf selbst und legt es
// in der Tabelle push_keys ab (nur mit Server-Schlüssel lesbar).
//
// Welche Gewohnheiten offen sind, entscheidet js/remind.js – dieselbe Logik wie in der App.
// Sie steht als Kopie ganz unten in dieser Datei (Supabase erlaubt keine Importe von GitHub Pages).
// Nach Änderungen an js/remind.js: node supabase/functions/erinnerung/einbetten.mjs, dann neu bereitstellen.
// @ts-nocheck

import { createClient } from 'npm:@supabase/supabase-js@2.117.2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};
const APP_URL = 'https://schrontz.github.io/motivapp/';
const SUBJECT = 'https://github.com/schrontz/motivapp';

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
}

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

// ───────────── Web Push (RFC 8291 + VAPID RFC 8292), nur mit WebCrypto ─────────────

const enc = new TextEncoder();
export function b64u(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
export function unb64u(text: string): Uint8Array {
  const s = atob(text.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((text.length + 3) % 4));
  return Uint8Array.from(s, (c) => c.charCodeAt(0));
}
function concat(...parts: Uint8Array[]) {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}
async function hmac(key: Uint8Array, data: Uint8Array) {
  const k = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', k, data));
}

export async function newKeys() {
  const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const pub = new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey));
  const jwk = await crypto.subtle.exportKey('jwk', pair.privateKey);
  return { public_key: b64u(pub), private_jwk: jwk };
}

export async function vapidHeader(endpoint: string, keys: { public_key: string; private_jwk: JsonWebKey }, now = Date.now()) {
  const aud = new URL(endpoint).origin;
  const head = b64u(enc.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const claims = b64u(enc.encode(JSON.stringify({ aud, exp: Math.floor(now / 1000) + 12 * 3600, sub: SUBJECT })));
  const key = await crypto.subtle.importKey('jwk', keys.private_jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const sig = new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, enc.encode(`${head}.${claims}`)));
  return `vapid t=${head}.${claims}.${b64u(sig)}, k=${keys.public_key}`;
}

// Inhalt verschlüsseln (aes128gcm, ein Datensatz)
export async function encryptPayload(text: string, p256dh: string, authSecret: string, salt = crypto.getRandomValues(new Uint8Array(16))) {
  const uaPub = unb64u(p256dh);
  const auth = unb64u(authSecret);
  const local = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const asPub = new Uint8Array(await crypto.subtle.exportKey('raw', local.publicKey));
  const peer = await crypto.subtle.importKey('raw', uaPub, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: peer }, local.privateKey, 256));
  const prkKey = await hmac(auth, shared);
  const ikm = await hmac(prkKey, concat(enc.encode('WebPush: info\0'), uaPub, asPub, new Uint8Array([1])));
  const prk = await hmac(salt, ikm);
  const cek = (await hmac(prk, concat(enc.encode('Content-Encoding: aes128gcm\0'), new Uint8Array([1])))).slice(0, 16);
  const nonce = (await hmac(prk, concat(enc.encode('Content-Encoding: nonce\0'), new Uint8Array([1])))).slice(0, 12);
  const aes = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, aes, concat(enc.encode(text), new Uint8Array([2]))));
  const rs = new Uint8Array([0, 0, 16, 0]); // 4096
  return concat(salt, rs, new Uint8Array([asPub.length]), asPub, cipher);
}

export async function sendPush(sub: { endpoint: string; p256dh: string; auth: string }, message: unknown, keys: any, fetcher: typeof fetch = fetch) {
  const body = await encryptPayload(JSON.stringify(message), sub.p256dh, sub.auth);
  const res = await fetcher(sub.endpoint, {
    method: 'POST',
    headers: {
      Authorization: await vapidHeader(sub.endpoint, keys),
      'Content-Encoding': 'aes128gcm',
      'Content-Type': 'application/octet-stream',
      TTL: String(4 * 3600), // eine Abend-Erinnerung am nächsten Morgen wäre sinnlos
      Urgency: 'normal'
    },
    body
  });
  return { status: res.status, gone: res.status === 404 || res.status === 410, ok: res.ok, text: res.ok ? '' : (await res.text().catch(() => '')).slice(0, 200) };
}

// ───────────── Daten ─────────────

async function appKeys(db: any) {
  const { data } = await db.from('push_keys').select('public_key, private_jwk').eq('id', 1).maybeSingle();
  if (data) return data;
  const fresh = await newKeys();
  await db.from('push_keys').upsert({ id: 1, ...fresh }, { onConflict: 'id', ignoreDuplicates: true });
  // falls zwei Aufrufe gleichzeitig Schlüssel erzeugt haben: es gilt, was in der Tabelle steht
  const { data: stored, error } = await db.from('push_keys').select('public_key, private_jwk').eq('id', 1).single();
  if (error) throw error;
  return stored;
}

function minusDays(day: string, n: number) {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

async function loadDay(db: any, userId: string, day: string) {
  const from = minusDays(day, 31);
  const [habits, logs, pauses] = await Promise.all([
    db.from('habits').select('*').eq('user_id', userId).eq('archived', false).order('sort_order'),
    db.from('habit_logs').select('habit_id, day, status, created_at, source').eq('user_id', userId).gte('day', from).lte('day', day),
    db.from('pauses').select('habit_id, start_day, end_day').eq('user_id', userId).gte('end_day', from)
  ]);
  for (const r of [habits, logs, pauses]) if (r.error) throw r.error;
  return { habits: habits.data || [], logs: logs.data || [], pauses: pauses.data || [] };
}

// Steigerungspläne (Alpha Progression): „↑ Diese Woche höher: …“ – fehlt das Modul, einfach ohne
async function planChanges(db: any, userId: string, day: string) {
  try {
    const plans = await db.from('exercise_plans').select('*').eq('user_id', userId);
    if (plans.error || !(plans.data || []).length) return [];
    const since = minusDays((plans.data as any[]).map((p) => p.started_on).sort()[0] || day, 7);
    const sessions = await db.from('strength_sessions').select('day, started_at, exercises').eq('user_id', userId).gte('day', since);
    return sessions.error ? [] : weekChanges(plans.data, sessions.data || [], day);
  } catch (e) {
    console.warn('Steigerung nicht verfügbar', e);
    return [];
  }
}

async function openText(db: any, userId: string, day: string) {
  const d = await loadDay(db, userId, day);
  const open = openForReminder(d.habits, d.logs, d.pauses, day);
  return reminderText(open, open.length ? await planChanges(db, userId, day) : []);
}

// Eigene Erinnerungen 30 Minuten vor „meist gegen …“ – je Gewohnheit einmal am Tag
async function usualRound(db: any, userId: string, tz: string, local: { day: string; min: number }, keys: any, fetcher: typeof fetch) {
  const d = await loadDay(db, userId, local.day);
  // Training mit Auto-Abhaken: Startzeiten der Trainings (fehlt Withings, eben ohne)
  const w = await db.from('workouts').select('day, start_at, category, duration_min').eq('user_id', userId).gte('day', minusDays(local.day, 15));
  const workouts = w.error ? [] : w.data || [];
  const due = usualDueNow(d.habits, d.logs, d.pauses, local.day, local.min, (iso: string) => zonedNow(new Date(iso), tz), workouts);
  let sent = 0;
  for (const o of due) {
    let claim = db.from('habits').update({ remind_last: local.day }).eq('id', o.habit.id);
    claim = o.habit.remind_last ? claim.eq('remind_last', o.habit.remind_last) : claim.is('remind_last', null);
    const { data: claimed, error } = await claim.select('id');
    if (error) throw error;
    if (!claimed || !claimed.length) continue;
    const text = usualText(o, await planChanges(db, userId, local.day));
    await deliver(db, userId, { ...text, url: APP_URL, tag: `erinnerung-${o.habit.id}` }, keys, fetcher);
    sent += 1;
  }
  return sent;
}

async function deliver(db: any, userId: string, message: unknown, keys: any, fetcher: typeof fetch) {
  const { data: subs, error } = await db.from('push_subscriptions').select('id, endpoint, p256dh, auth').eq('user_id', userId);
  if (error) throw error;
  const results = [];
  for (const s of subs || []) {
    try {
      const r = await sendPush(s, message, keys, fetcher);
      if (r.gone) await db.from('push_subscriptions').delete().eq('id', s.id);
      else if (r.ok) await db.from('push_subscriptions').update({ last_ok_at: new Date().toISOString() }).eq('id', s.id);
      results.push(r);
    } catch (e) {
      results.push({ status: 0, ok: false, gone: false, text: String((e as any)?.message || e) });
    }
  }
  return results;
}

export async function runRound(db: any, keys: any, now: Date, fetcher: typeof fetch) {
  const { data: people, error } = await db.from('profiles').select('id, remind_at, remind_tz, remind_last').eq('remind_on', true);
  if (error) throw error;
  const report = { checked: (people || []).length, sent: 0, quiet: 0, usual: 0 };
  // Wer hat Gewohnheiten mit eigener Erinnerung? (fehlt die Spalte noch – 022 nicht ausgeführt –, eben keine)
  const usual = await db.from('habits').select('user_id, remind_last').eq('remind_mode', 'usual').eq('archived', false);
  if (usual.error) console.warn('Eigene Erinnerungen nicht verfügbar', usual.error.message);
  const usualRows: any[] = usual.error ? [] : usual.data || [];
  for (const p of people || []) {
    const tz = p.remind_tz || 'Europe/Berlin';
    const local = zonedNow(now, tz);
    if (usualRows.some((r) => r.user_id === p.id && r.remind_last !== local.day)) {
      report.usual += await usualRound(db, p.id, tz, local, keys, fetcher);
    }
    if (!isDue(p.remind_at, local.min, p.remind_last, local.day)) continue;
    // Tag zuerst „belegen“ – überlappende Läufe schicken so nichts doppelt
    let claim = db.from('profiles').update({ remind_last: local.day }).eq('id', p.id);
    claim = p.remind_last ? claim.eq('remind_last', p.remind_last) : claim.is('remind_last', null);
    const { data: claimed, error: claimError } = await claim.select('id');
    if (claimError) throw claimError;
    if (!claimed || !claimed.length) continue;
    const text = await openText(db, p.id, local.day);
    if (!text) { report.quiet += 1; continue; }
    await deliver(db, p.id, { ...text, url: APP_URL, tag: 'erinnerung' }, keys, fetcher);
    report.sent += 1;
  }
  return report;
}

export async function handle(req: Request, deps: { fetch?: typeof fetch; db?: any; now?: Date } = {}): Promise<Response> {
  if (req.method === 'OPTIONS') {
    const asked = req.headers.get('Access-Control-Request-Headers');
    return new Response('ok', { headers: { ...CORS, ...(asked ? { 'Access-Control-Allow-Headers': asked } : {}) } });
  }
  if (req.method !== 'POST') return json({ error: 'Nur POST' }, 405);
  const fetcher = deps.fetch || fetch;
  let payload: any = {};
  try { payload = await req.json(); } catch (_) { /* leer */ }

  try {
    const db: any = deps.db || (() => {
      const key = serviceKey();
      if (!key) throw new Error('Kein Server-Schlüssel gefunden (SUPABASE_SERVICE_ROLE_KEY / SUPABASE_SECRET_KEYS).');
      return createClient(Deno.env.get('SUPABASE_URL') ?? '', key, { auth: { persistSession: false } });
    })();

    if (payload.action === 'run') {
      const token = req.headers.get('x-motivator-cron') || '';
      const { data: ok, error } = await db.rpc('remind_secret_ok', { token });
      if (error) throw error;
      if (!ok) return json({ error: 'Nicht erlaubt' }, 403);
      const keys = await appKeys(db);
      return json(await runRound(db, keys, deps.now || new Date(), fetcher));
    }

    // Ab hier: nur mit Login
    const jwt = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
    if (!jwt) return json({ error: 'Nicht angemeldet' }, 401);
    const { data: userData, error: userError } = await db.auth.getUser(jwt);
    if (userError || !userData || !userData.user) return json({ error: 'Nicht angemeldet' }, 401);
    const userId = userData.user.id;

    if (payload.action === 'key') {
      const keys = await appKeys(db);
      return json({ key: keys.public_key });
    }
    if (payload.action === 'test') {
      const keys = await appKeys(db);
      const { data: prof } = await db.from('profiles').select('remind_tz').eq('id', userId).maybeSingle();
      const local = zonedNow(deps.now || new Date(), (prof && prof.remind_tz) || 'Europe/Berlin');
      const text = (await openText(db, userId, local.day)) || { title: 'Probe', body: 'Gerade ist alles erledigt – so sähe die Erinnerung aus 🎉' };
      const results = await deliver(db, userId, { ...text, url: APP_URL, tag: 'erinnerung-probe' }, keys, fetcher);
      return json({ devices: results.length, ok: results.filter((r) => r.ok).length, errors: results.filter((r) => !r.ok).map((r) => `${r.status} ${r.text}`) });
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

// ── BEGIN Kopie von js/remind.js (nicht hier ändern – einbetten.mjs) ──
function toDay(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
function parseDay(day) {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(y, m - 1, d, 12);
}
function addDays(day, n) {
  const dt = parseDay(day);
  dt.setDate(dt.getDate() + n);
  return toDay(dt);
}
function weekday(day) {
  const wd = parseDay(day).getDay();
  return wd === 0 ? 7 : wd;
}
function weekStart(day) {
  return addDays(day, 1 - weekday(day));
}
function monthStart(day) {
  return day.slice(0, 8) + "01";
}
function daysInMonth(day) {
  const dt = parseDay(day);
  return new Date(dt.getFullYear(), dt.getMonth() + 1, 0).getDate();
}
function* eachDay(from, to) {
  for (let d = from; d <= to; d = addDays(d, 1)) yield d;
}

function isHit(log) {
  return !!log && (log.status === "done" || log.status === "mini");
}
function indexLogs(logs) {
  const idx = /* @__PURE__ */ new Map();
  for (const l of logs) {
    if (!idx.has(l.habit_id)) idx.set(l.habit_id, /* @__PURE__ */ new Map());
    idx.get(l.habit_id).set(l.day, l);
  }
  return idx;
}
function logOf(idx, habitId, day) {
  const m = idx.get(habitId);
  return m ? m.get(day) || null : null;
}
function isPaused(habit, day, pauses) {
  for (const p of pauses) {
    if ((p.habit_id == null || p.habit_id === habit.id) && p.start_day <= day && day <= p.end_day) return true;
  }
  return false;
}
function isPeriodic(habit) {
  return habit.schedule === "per_week" || habit.schedule === "per_month";
}
function periodTarget(h) {
  return h.schedule_count || 1;
}
function periodMin(h) {
  const t = periodTarget(h);
  return h.schedule_min && h.schedule_min < t ? h.schedule_min : t;
}
function hasMiniPeriod(h) {
  return isPeriodic(h) && periodMin(h) < periodTarget(h);
}
function miniPeriodName(h) {
  return h.schedule === "per_month" ? "Mini-Monat" : "Mini-Woche";
}
function periodNeeds(h, from, to, pauses) {
  let length = 0;
  let active = 0;
  for (const d of eachDay(from, to)) {
    length += 1;
    if (d >= h.start_day && !isPaused(h, d, pauses)) active += 1;
  }
  const scale = length ? active / length : 1;
  const target = active === 0 ? 0 : Math.max(1, Math.ceil(periodTarget(h) * scale - 1e-9));
  const min = active === 0 ? 0 : Math.max(1, Math.min(target, Math.ceil(periodMin(h) * scale - 1e-9)));
  return { target, min, active, length };
}
function periodState(h, n, needs = { target: periodTarget(h), min: periodMin(h) }) {
  if (n >= needs.target) return "goal";
  if (hasMiniPeriod(h) && n >= needs.min) return "mini";
  return "open";
}
function isDueOn(habit, day) {
  if (day < habit.start_day) return false;
  if (habit.schedule === "daily") return true;
  if (habit.schedule === "weekdays") return (habit.schedule_days || []).includes(weekday(day));
  return false;
}
function periodBounds(habit, day) {
  if (habit.schedule === "per_week") return [weekStart(day), addDays(weekStart(day), 6)];
  const start = monthStart(day);
  return [start, addDays(start, daysInMonth(day) - 1)];
}
function periodHits(habit, idx, day, { before = false } = {}) {
  const [from, to] = periodBounds(habit, day);
  const m = idx.get(habit.id);
  if (!m) return 0;
  let n = 0;
  for (const [d, log] of m) {
    if (d < from || d > to || d < habit.start_day) continue;
    if (before && d >= day) continue;
    if (isHit(log)) n += 1;
  }
  return n;
}
function stateOf(log) {
  if (!log) return "open";
  return log.status;
}
function todayItems(habits, idx, pauses, day) {
  const items = [];
  for (const h of habits) {
    if (h.archived || day < h.start_day) continue;
    const log = logOf(idx, h.id, day);
    const paused = isPaused(h, day, pauses);
    let counted = false;
    let sub = null;
    let period = null;
    if (isPeriodic(h)) {
      const [from, to] = periodBounds(h, day);
      const needs = periodNeeds(h, from, to, pauses);
      const target = needs.target;
      const min = needs.min;
      const before = periodHits(h, idx, day, { before: true });
      const word = h.schedule === "per_week" ? "diese Woche" : "diesen Monat";
      const n = before + (isHit(log) ? 1 : 0);
      const state = periodState(h, n, needs);
      sub = `${word} ${n} von ${target}`;
      if (state === "goal") sub += " \xB7 Ziel erreicht";
      else if (state === "mini") sub += ` \xB7 noch ${target - n} bis zum Ziel`;
      else if (hasMiniPeriod(h)) sub += ` \xB7 noch ${min - n} bis zur ${miniPeriodName(h)}`;
      counted = !paused && (isHit(log) || before < min);
      period = { n, target, min, state };
    } else {
      if (!isDueOn(h, day)) continue;
      counted = !paused;
    }
    items.push({ habit: h, log, state: stateOf(log), hit: isHit(log), counted, paused, sub, period });
  }
  return items;
}

var CATEGORY_GROUPS = [
  { id: "kraft", label: "Krafttraining", cats: [16, 17] },
  { id: "run", label: "Laufen", cats: [2, 307] },
  { id: "bike", label: "Radfahren", cats: [6, 308] },
  { id: "swim", label: "Schwimmen", cats: [7] },
  { id: "walk", label: "Gehen & Wandern", cats: [1, 306, 3] },
  { id: "other", label: "Sonstiges", cats: [-1] }
];
var GROUPED = new Set(CATEGORY_GROUPS.flatMap((g) => g.cats).filter((c) => c > 0));
function matchesCategories(cat, list) {
  if (!list || list.length === 0) return false;
  if (list.includes(cat)) return true;
  return list.includes(-1) && !GROUPED.has(cat);
}
function workoutCounts(habit, w) {
  return matchesCategories(w.category, habit.auto_categories) && Number(w.duration_min) >= (habit.auto_min_minutes || 0);
}

function exerciseKey(e) {
  return `${e.name}|${e.equipment || ""}`;
}
function exerciseHistory(sessions, key) {
  const out = [];
  for (const s of sessions) {
    for (const e of s.exercises || []) {
      if (exerciseKey(e) === key) out.push({ session: s, day: s.day, started_at: s.started_at, ex: e });
    }
  }
  return out.sort((a, b) => a.started_at < b.started_at ? -1 : 1);
}
var MATCH_WINDOW = 20 * 6e4;
function planMode(history) {
  const last = history.length ? history[history.length - 1].ex : null;
  if (!last) return "kg";
  if (last.kind === "time") return "sec";
  if (last.kind === "reps") return "reps";
  return "kg";
}
function setValue(s, mode) {
  return mode === "sec" ? s.sec ?? 0 : s.reps ?? 0;
}
function weekOk(entries, target, mode = "kg") {
  return entries.some((h) => {
    const good = (h.ex.sets || []).filter((s) => (mode !== "kg" || (s.kg ?? 0) >= target.kg - 1e-9) && setValue(s, mode) >= target.reps).length;
    return good >= target.sets;
  });
}
function round1(n) {
  return Math.round(n * 100) / 100;
}
function planStart(plan) {
  const s = weekStart(plan.started_on);
  if (!plan.created_at) return s;
  const c = weekStart(toLocalDay(plan.created_at));
  return c > s ? c : s;
}
function toLocalDay(iso) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function progress(plan, history, T, mode = planMode(history)) {
  const p = {
    sets: Number(plan.sets),
    start: Number(plan.start_reps),
    kg: Number(plan.kg),
    plus: Number(plan.plus_reps),
    every: Math.max(1, Number(plan.every_weeks)),
    max: Number(plan.max_reps),
    kgStep: Number(plan.kg_step),
    mode
  };
  const step = (st2) => {
    const o = { ...st2, streak: st2.streak + 1 };
    if (o.streak >= p.every) {
      o.streak = 0;
      if (mode === "kg") {
        o.reps += p.plus;
        if (o.reps > p.max) {
          o.reps = p.start;
          o.kg = round1(o.kg + p.kgStep);
        }
      } else if (o.reps < p.max) {
        o.reps = Math.min(p.max, o.reps + p.plus);
      }
    }
    return o;
  };
  const byWeek = /* @__PURE__ */ new Map();
  for (const h of history) {
    const wk = weekStart(h.day);
    if (!byWeek.has(wk)) byWeek.set(wk, []);
    byWeek.get(wk).push(h);
  }
  let st = { reps: p.start, kg: mode === "kg" ? p.kg : 0, streak: 0 };
  const weeks = /* @__PURE__ */ new Map();
  const nowWeek = weekStart(T);
  const first = planStart(plan);
  for (let wk = first; wk <= nowWeek; wk = addDays(wk, 7)) {
    const target = { reps: st.reps, kg: st.kg, sets: p.sets, consolidating: st.streak > 0 };
    const entries = byWeek.get(wk) || [];
    const result = entries.length ? weekOk(entries, target, mode) ? "done" : "missed" : "none";
    weeks.set(wk, { ...target, result });
    if (wk === nowWeek) break;
    if (result === "done") st = step(st);
  }
  const current = weeks.get(nowWeek) || { reps: st.reps, kg: st.kg, sets: p.sets, consolidating: st.streak > 0, result: "none" };
  const nx = step(st);
  return {
    mode,
    weeks,
    current: { ...current, done: current.result === "done", atMax: mode !== "kg" && current.reps >= p.max },
    next: { reps: nx.reps, kg: nx.kg, consolidating: nx.streak > 0 },
    ladder: ladder(p, current.reps, st.streak, current.kg),
    weeksToNextKg: weeksLeft(p, current.reps, st.streak)
  };
}
function weeksLeft(p, reps, streak) {
  if (p.mode && p.mode !== "kg" && reps >= p.max) return 0;
  const levels = Math.floor((p.max - reps) / p.plus);
  if (p.mode && p.mode !== "kg") return Math.ceil((p.max - reps) / p.plus) * p.every - streak;
  return levels * p.every + (p.every - streak);
}
function ladder(p, reps, streak, kg) {
  const unit = p.mode === "sec" ? " s" : "";
  const all = [];
  for (let r = p.start; r <= p.max; r += p.plus) for (let i = 0; i < p.every; i += 1) all.push(r);
  if (p.mode && p.mode !== "kg" && all[all.length - 1] !== p.max) for (let i = 0; i < p.every; i += 1) all.push(p.max);
  let pos = Math.round((reps - p.start) / p.plus * p.every + streak);
  if (p.mode && p.mode !== "kg" && reps >= p.max) pos = all.indexOf(p.max) + Math.min(streak, p.every - 1);
  let items = all.map((r, i) => ({ txt: String(r) + (i === all.length - 1 ? unit : ""), state: i < pos ? "done" : i === pos ? "now" : "next" }));
  if (items.length > 10) {
    const from = Math.max(0, pos - 2);
    const to = Math.min(items.length - 1, pos + 4);
    const mid = items.slice(from, to + 1);
    items = [
      ...from > 0 ? [{ txt: "\u2026", state: "done" }] : [],
      ...mid,
      ...to < items.length - 2 ? [{ txt: "\u2026", state: "next" }] : [],
      ...to < items.length - 1 ? [items[items.length - 1]] : []
    ];
  }
  if (!p.mode || p.mode === "kg") {
    const stepTxt = String(round1(p.kgStep)).replace(".", ",");
    items.push({ txt: `+${stepTxt} kg`, state: "next", kg: round1(kg + p.kgStep) });
  }
  return items;
}
function weekChanges(plans, sessions, T) {
  const now = weekStart(T);
  const prevWeek = addDays(now, -7);
  const out = [];
  for (const plan of plans || []) {
    const hist = exerciseHistory(sessions || [], exerciseKey({ name: plan.exercise, equipment: plan.equipment }));
    const res = progress(plan, hist, T);
    const cur = res.weeks.get(now);
    const prev = res.weeks.get(prevWeek);
    if (!cur || !prev || cur.result === "done") continue;
    if (cur.reps === prev.reps && cur.kg === prev.kg) continue;
    out.push({ name: plan.exercise, mode: res.mode, sets: cur.sets, reps: cur.reps, kg: cur.kg, from: { reps: prev.reps, kg: prev.kg } });
  }
  return out;
}
var kgTxt = (n) => `${String(n).replace(".", ",")} kg`;
function changeText(c) {
  if (c.mode === "sec") return `${c.name} ${c.sets} \xD7 ${c.reps} s (statt ${c.from.reps} s)`;
  if (c.mode === "reps") return `${c.name} ${c.sets} \xD7 ${c.reps} (statt ${c.from.reps})`;
  if (c.kg !== c.from.kg) return `${c.name} ${c.sets} \xD7 ${c.reps} mit ${kgTxt(c.kg)} (statt ${kgTxt(c.from.kg)})`;
  return `${c.name} ${c.sets} \xD7 ${c.reps} (statt ${c.from.reps})`;
}
function isStrengthHabit(h) {
  const cats = Array.isArray(h.auto_categories) ? h.auto_categories : [];
  if (cats.includes(16) || cats.includes(17)) return true;
  return !cats.length && /(^|[^a-zäöüß])(sport|training|kraft|gym|fitness)/i.test(h.name || "");
}
function changesShort(changes, n = 2) {
  const list = changes.slice(0, n).map(changeText);
  if (changes.length > n) list.push(`und ${changes.length - n} weitere`);
  return list.join(", ");
}

var DEFAULT_TIME = 20 * 60;
var MIN_USUAL = 5;
var USUAL_DAYS = 14;
var isAuto = (h) => !!h.auto_metric;
var remindable = (h) => !h.archived && !isAuto(h) && h.remind !== false;
var hasMini = (h) => !!(h.mini_text || h.mini_value != null);
var USUAL_LEAD = 30;
var remindsUsual = (h) => remindable(h) && h.remind_mode === "usual";
function allPaused(pauses, day) {
  return pauses.some((p) => p.habit_id == null && p.start_day <= day && day <= p.end_day);
}
function periodEnd(h, day) {
  if (h.schedule === "per_week") return addDays(weekStart(day), 6);
  return addDays(monthStart(day), daysInMonth(day) - 1);
}
function openForReminder(habits, logs, pauses, day) {
  if (allPaused(pauses, day)) return [];
  const idx = indexLogs(logs);
  const out = [];
  for (const it of todayItems(habits.filter(remindable), idx, pauses, day)) {
    const h = it.habit;
    if (it.paused || it.hit) continue;
    if (h.remind_mode === "usual" && h.remind_last === day) continue;
    if (!isPeriodic(h)) {
      out.push({ habit: h, name: h.name });
      continue;
    }
    const p = periodOpen(h, it, pauses, day);
    if (p && p.tight) out.push({ habit: h, name: h.name, need: p.need, word: p.word });
  }
  return out;
}
function periodOpen(h, it, pauses, day) {
  const need = it.period.min - it.period.n;
  if (need <= 0) return null;
  let free = 0;
  for (const d of eachDay(day, periodEnd(h, day))) if (!isPaused(h, d, pauses)) free += 1;
  return { need, tight: free <= need, word: h.schedule === "per_week" ? "diese Woche" : "diesen Monat" };
}
function usualWeekday(idx, habitId, day) {
  let n = 0;
  for (let k = 1; k <= 4; k += 1) if (isHit(logOf(idx, habitId, addDays(day, -7 * k)))) n += 1;
  return n >= 2;
}
function usualDueNow(habits, logs, pauses, day, nowMin, localOf = browserLocal, workouts = []) {
  if (allPaused(pauses, day)) return [];
  const idx = indexLogs(logs);
  const out = [];
  for (const it of todayItems(habits.filter(remindsUsual), idx, pauses, day)) {
    const h = it.habit;
    if (h.remind_last === day || it.paused || it.hit) continue;
    const u = usualFor(h, logs, workouts, day, localOf);
    if (u.min == null) continue;
    const at = Math.max(0, u.min - USUAL_LEAD);
    if (nowMin < at || nowMin >= at + 90) continue;
    if (!isPeriodic(h)) {
      out.push({ habit: h, name: h.name, at, usual: u.min });
      continue;
    }
    const p = periodOpen(h, it, pauses, day);
    if (!p || !(p.tight || usualWeekday(idx, h.id, day))) continue;
    out.push({ habit: h, name: h.name, at, usual: u.min, need: p.need, word: p.word });
  }
  return out;
}
function usualText(o, changes = []) {
  let body = o.need ? `Meist um diese Zeit \u2013 noch ${o.need}\xD7 ${o.word}.` : `Meist machst du das gegen ${timeText(o.usual)}.`;
  const note = trainingNote([o], changes);
  if (note) body += ` ${note}.`;
  if (hasMini(o.habit)) body += " Mini z\xE4hlt auch \u{1F642}";
  return { title: o.name, body };
}
var listNames = (names) => {
  if (names.length <= 4) return names.join(", ");
  return `${names.slice(0, 3).join(", ")} und ${names.length - 3} weitere`;
};
function trainingNote(open, changes = []) {
  if (!changes.length || !open.some((o) => isStrengthHabit(o.habit))) return "";
  return `\u2191 Diese Woche h\xF6her: ${changesShort(changes)}`;
}
function reminderText(open, changes = []) {
  if (!open.length) return null;
  const daily = open.filter((o) => !o.need);
  const periodic = open.filter((o) => o.need);
  const parts = [];
  if (daily.length) parts.push(listNames(daily.map((o) => o.name)) + (periodic.length ? " heute" : ""));
  for (const o of periodic) parts.push(`${o.name} \u2013 noch ${o.need}\xD7 ${o.word}`);
  let body = parts.join(" \xB7 ");
  if (!/[.!?]$/.test(body)) body += ".";
  const note = trainingNote(open, changes);
  if (note) body += ` ${note}.`;
  if (open.some((o) => hasMini(o.habit))) body += " Mini z\xE4hlt auch \u{1F642}";
  return { title: periodic.length ? "Noch offen" : "Noch offen heute", body };
}
function timeText(min) {
  const m = (Math.round(min) % 1440 + 1440) % 1440;
  return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")}`;
}
function parseTime(text) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(text || "").trim());
  if (!m) return null;
  const h = Number(m[1]);
  const mm = Number(m[2]);
  if (h > 23 || mm > 59) return null;
  return h * 60 + mm;
}
function isDue(remindAt, nowMin, lastDay, today) {
  if (remindAt == null || lastDay === today) return false;
  return nowMin >= remindAt && nowMin < remindAt + 180;
}
function usualTime(logs, habitId, today, localOf = browserLocal) {
  const from = addDays(today, -(USUAL_DAYS - 1));
  const mins = [];
  for (const l of logs) {
    if (l.habit_id !== habitId || !l.created_at || l.source) continue;
    if (l.day < from || l.day > today) continue;
    if (l.status !== "done" && l.status !== "mini") continue;
    const at = localOf(l.created_at);
    if (!at || at.day !== l.day) continue;
    mins.push(at.min);
  }
  if (mins.length < MIN_USUAL) return { n: mins.length, min: null };
  mins.sort((a, b) => a - b);
  const mid = Math.floor(mins.length / 2);
  const median = mins.length % 2 ? mins[mid] : (mins[mid - 1] + mins[mid]) / 2;
  return { n: mins.length, min: Math.round(median / 10) * 10 };
}
var isTrainingAuto = (h) => !h.auto_metric && Array.isArray(h.auto_categories) && h.auto_categories.length > 0;
function usualFor(h, logs, workouts = [], today, localOf = browserLocal) {
  if (!isTrainingAuto(h) || !workouts || !workouts.length) return usualTime(logs, h.id, today, localOf);
  const first = /* @__PURE__ */ new Map();
  for (const w of workouts) {
    if (!w.start_at || !workoutCounts(h, w)) continue;
    const f = first.get(w.day);
    if (!f || w.start_at < f.start_at) first.set(w.day, w);
  }
  const samples = [...first.values()].map((w) => ({ habit_id: h.id, day: w.day, status: "done", created_at: w.start_at }));
  const manual = logs.filter((l) => l.habit_id === h.id && !l.source && !first.has(l.day));
  return usualTime([...samples, ...manual], h.id, today, localOf);
}
function browserLocal(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const day = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return { day, min: d.getHours() * 60 + d.getMinutes() };
}
function zonedNow(date, tz) {
  try {
    const parts = Object.fromEntries(new Intl.DateTimeFormat("en-GB", {
      timeZone: tz || "Europe/Berlin",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23"
    }).formatToParts(date).map((p) => [p.type, p.value]));
    return { day: `${parts.year}-${parts.month}-${parts.day}`, min: Number(parts.hour) * 60 + Number(parts.minute) };
  } catch (_) {
    return zonedNow(date, "Europe/Berlin");
  }
}
// ── END Kopie von js/remind.js ──
