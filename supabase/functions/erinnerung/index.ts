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

async function openText(db: any, userId: string, day: string) {
  const from = minusDays(day, 31);
  const [habits, logs, pauses] = await Promise.all([
    db.from('habits').select('*').eq('user_id', userId).eq('archived', false).order('sort_order'),
    db.from('habit_logs').select('habit_id, day, status').eq('user_id', userId).gte('day', from).lte('day', day),
    db.from('pauses').select('habit_id, start_day, end_day').eq('user_id', userId).gte('end_day', from)
  ]);
  for (const r of [habits, logs, pauses]) if (r.error) throw r.error;
  return reminderText(openForReminder(habits.data, logs.data, pauses.data, day));
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
  const report = { checked: (people || []).length, sent: 0, quiet: 0 };
  for (const p of people || []) {
    const local = zonedNow(now, p.remind_tz || 'Europe/Berlin');
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

var DEFAULT_TIME = 20 * 60;
var MIN_USUAL = 5;
var USUAL_DAYS = 14;
var isAuto = (h) => !!h.auto_metric || Array.isArray(h.auto_categories) && h.auto_categories.length > 0;
var remindable = (h) => !h.archived && !isAuto(h) && h.remind !== false;
var hasMini = (h) => !!(h.mini_text || h.mini_value != null);
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
    if (!isPeriodic(h)) {
      out.push({ habit: h, name: h.name });
      continue;
    }
    const need = it.period.min - it.period.n;
    if (need <= 0) continue;
    let free = 0;
    for (const d of eachDay(day, periodEnd(h, day))) if (!isPaused(h, d, pauses)) free += 1;
    if (free > need) continue;
    out.push({ habit: h, name: h.name, need, word: h.schedule === "per_week" ? "diese Woche" : "diesen Monat" });
  }
  return out;
}
var listNames = (names) => {
  if (names.length <= 4) return names.join(", ");
  return `${names.slice(0, 3).join(", ")} und ${names.length - 3} weitere`;
};
function reminderText(open) {
  if (!open.length) return null;
  const daily = open.filter((o) => !o.need);
  const periodic = open.filter((o) => o.need);
  const parts = [];
  if (daily.length) parts.push(listNames(daily.map((o) => o.name)) + (periodic.length ? " heute" : ""));
  for (const o of periodic) parts.push(`${o.name} \u2013 noch ${o.need}\xD7 ${o.word}`);
  let body = parts.join(" \xB7 ");
  if (!/[.!?]$/.test(body)) body += ".";
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
