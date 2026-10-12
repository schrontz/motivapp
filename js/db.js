// Datenzugriff. Zwei Varianten mit derselben Schnittstelle:
// - Supabase (echt)
// - Demo (?demo in der Adresse): Beispieldaten im Speicher, nichts wird gespeichert.

import { SUPABASE_URL, SUPABASE_KEY, SUPABASE_JS } from './config.js';
import { today, addDays } from './dates.js';

export const isDemo = new URLSearchParams(location.search).has('demo');

let client = null;

export async function initDb() {
  if (isDemo) return;
  const { createClient } = await import(SUPABASE_JS);
  client = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });
}

function check({ data, error }) {
  if (error) throw error;
  return data;
}

// Supabase liefert max. 1000 Zeilen pro Anfrage – darum seitenweise laden.
async function fetchAll(table, order) {
  const rows = [];
  const size = 1000;
  for (let from = 0; ; from += size) {
    const page = check(await client.from(table).select('*').order(order).range(from, from + size - 1));
    rows.push(...page);
    if (page.length < size) break;
  }
  return rows;
}

// ───────────── Login ─────────────

export async function getSession() {
  if (isDemo) return { user: { id: 'demo', email: 'demo@motivator' } };
  return check(await client.auth.getSession()).session;
}

export function onAuthChange(cb) {
  if (isDemo) return;
  client.auth.onAuthStateChange((_event, session) => cb(session));
}

export async function signIn(email, password) {
  if (isDemo) return;
  check(await client.auth.signInWithPassword({ email, password }));
}

export async function signOut() {
  if (isDemo) { location.href = location.pathname; return; }
  await client.auth.signOut();
}

// ───────────── Daten ─────────────

export async function loadAll() {
  if (isDemo) return { ...structuredClone(demo), hasWithingsSchema: true };
  const [profiles, categories, habits, logs, pauses, extra] = await Promise.all([
    client.from('profiles').select('*').then(check),
    fetchAll('categories', 'sort_order'),
    fetchAll('habits', 'sort_order'),
    fetchAll('habit_logs', 'day'),
    fetchAll('pauses', 'start_day'),
    loadWithingsData()
  ]);
  return { profile: profiles[0] || null, categories, habits, logs, pauses, ...extra };
}

// Withings-Daten. Fehlt das Datenbank-Update 003 noch, läuft die App ohne Withings weiter.
export async function loadWithingsData() {
  if (isDemo) {
    const { activity, workouts, dismissals, withings } = structuredClone(demo);
    return { activity, workouts, dismissals, withings, hasWithingsSchema: true };
  }
  try {
    const since = new Date(Date.now() - 400 * 86400000).toISOString().slice(0, 10);
    const [status, activity, workouts, dismissals] = await Promise.all([
      client.rpc('withings_status').then(check),
      client.from('daily_activity').select('*').gte('day', since).order('day').then(check),
      client.from('workouts').select('*').gte('day', since).order('start_at').then(check),
      fetchAll('auto_dismissals', 'day')
    ]);
    const s = status && status[0];
    return {
      activity, workouts, dismissals, hasWithingsSchema: true,
      withings: s ? { connected: true, last_sync_at: s.last_sync_at, connected_at: s.connected_at } : { connected: false }
    };
  } catch (err) {
    console.warn('Withings-Daten nicht verfügbar (Datenbank-Update 003 schon ausgeführt?)', err);
    return { activity: [], workouts: [], dismissals: [], withings: { connected: false }, hasWithingsSchema: false };
  }
}

export async function withings(action, extra = {}) {
  if (isDemo) {
    if (action === 'sync') return { connected: true, last_sync_at: new Date().toISOString() };
    return { connected: action !== 'disconnect' };
  }
  // Funktionsnamen unterscheiden Groß-/Kleinschreibung – beide probieren, den funktionierenden merken
  let remembered = null;
  try { remembered = localStorage.getItem('motivator.withings.fn'); } catch { /* egal */ }
  const names = [...new Set([remembered, 'withings', 'Withings'].filter(Boolean))];
  let data = null;
  let error = null;
  for (const name of names) {
    ({ data, error } = await client.functions.invoke(name, { body: { action, ...extra } }));
    const notFound = error && (error.name === 'FunctionsFetchError' || (error.context && error.context.status === 404));
    if (!notFound) {
      if (!error) { try { localStorage.setItem('motivator.withings.fn', name); } catch { /* egal */ } }
      break;
    }
  }
  if (error && error.name === 'FunctionsFetchError') {
    throw new Error('Die Server-Funktion ist nicht erreichbar (Name „withings“? Deployt? „Verify JWT“ aus?).');
  }
  if (error) {
    let detail = '';
    try { detail = (await error.context.json()).error || ''; } catch { /* egal */ }
    const e = new Error(detail || error.message || 'Withings-Abgleich fehlgeschlagen');
    throw e;
  }
  if (data && data.error && !data.connected) throw new Error(data.error);
  return data;
}

export async function addDismissal(habitId, day) {
  if (isDemo) return;
  check(await client.from('auto_dismissals').upsert({ habit_id: habitId, day }, { onConflict: 'habit_id,day' }));
}

function demoId() {
  return 'demo-' + Math.random().toString(36).slice(2, 10);
}

export async function saveHabit(habit) {
  if (isDemo) return { ...habit, id: habit.id || demoId() };
  const { id, user_id, created_at, ...fields } = habit;
  if (id) return check(await client.from('habits').update(fields).eq('id', id).select().single());
  return check(await client.from('habits').insert(fields).select().single());
}

export async function archiveHabit(id) {
  if (isDemo) return;
  check(await client.from('habits').update({ archived: true }).eq('id', id));
}

// source wird nur mitgeschickt, wenn die Spalte existiert (Datenbank-Update 003)
export async function setLog(habitId, day, status, value = null, source = null) {
  const row = { habit_id: habitId, day, status, value };
  if (source) row.source = source;
  if (isDemo) return row;
  return check(await client.from('habit_logs')
    .upsert(row, { onConflict: 'habit_id,day' })
    .select().single());
}

export async function deleteLog(habitId, day) {
  if (isDemo) return;
  check(await client.from('habit_logs').delete().eq('habit_id', habitId).eq('day', day));
}

export async function addPause(habitId, startDay, endDay) {
  const row = { habit_id: habitId, start_day: startDay, end_day: endDay };
  if (isDemo) return { ...row, id: demoId() };
  return check(await client.from('pauses').insert(row).select().single());
}

export async function deletePause(id) {
  if (isDemo) return;
  check(await client.from('pauses').delete().eq('id', id));
}

export async function saveCategory(cat) {
  if (isDemo) return { ...cat, id: cat.id || demoId() };
  const { id, user_id, created_at, ...fields } = cat;
  if (id) return check(await client.from('categories').update(fields).eq('id', id).select().single());
  return check(await client.from('categories').insert(fields).select().single());
}

export async function deleteCategory(id) {
  if (isDemo) return;
  check(await client.from('categories').delete().eq('id', id));
}

export async function updateProfile(id, patch) {
  if (isDemo) return;
  check(await client.from('profiles').update(patch).eq('id', id));
}

// ───────────── Demo-Daten ─────────────

const demo = (() => {
  const t = today();
  const cats = [
    { id: 'c-sport', name: 'Sport', color: 'blue', sort_order: 0 },
    { id: 'c-kopf', name: 'Kopf', color: 'orange', sort_order: 1 },
    { id: 'c-pflege', name: 'Pflege', color: 'teal', sort_order: 2 }
  ];
  const start = addDays(t, -60);
  const habits = [
    { id: 'h-sport', category_id: 'c-sport', name: 'Sport', icon: 'dumbbell', color: 'blue', kind: 'check', schedule: 'per_week', schedule_count: 5, schedule_min: 3, mini_text: '15 Minuten Bewegung', start_day: start, archived: false, sort_order: 0 },
    { id: 'h-skin', category_id: 'c-pflege', name: 'Hautpflege', icon: 'drop', color: 'teal', kind: 'check', schedule: 'daily', start_day: start, archived: false, sort_order: 1 },
    { id: 'h-duo', category_id: 'c-kopf', name: 'Duolingo', icon: 'chat', color: 'orange', kind: 'check', schedule: 'daily', mini_text: 'Eine Lektion', start_day: start, archived: false, sort_order: 2 },
    { id: 'h-brain', category_id: 'c-kopf', name: 'Hirntraining', icon: 'spark', color: 'orange', kind: 'check', schedule: 'per_week', schedule_count: 5, schedule_min: 3, mini_text: '5 Minuten', start_day: start, archived: false, sort_order: 3 },
    { id: 'h-push', category_id: 'c-sport', name: 'Liegestütze', icon: 'dumbbell', color: 'blue', kind: 'count', target: 22, unit: 'Wdh.', mini_value: 10, schedule: 'daily', start_day: start, archived: false, sort_order: 4 },
    { id: 'h-steps', category_id: 'c-sport', name: '5.000 Schritte', icon: 'steps', color: 'blue', kind: 'count', target: 5000, unit: 'Schritte', mini_value: 2000, schedule: 'daily', auto_metric: 'steps', start_day: addDays(t, -10), archived: false, sort_order: 5 }
  ];
  habits[0].auto_categories = [16, 17];
  habits[0].auto_min_minutes = 20;
  // deterministische Zufallsfolge, damit die Demo immer gleich aussieht
  let seed = 7;
  const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
  const logs = [];
  for (let i = 60; i >= 1; i -= 1) {
    const d = addDays(t, -i);
    const r = () => rnd();
    if (r() < 0.45) logs.push({ habit_id: 'h-sport', day: d, status: 'done' });
    if (r() < 0.85) logs.push({ habit_id: 'h-skin', day: d, status: 'done' });
    const duo = r();
    if (duo < 0.7) logs.push({ habit_id: 'h-duo', day: d, status: 'done' });
    else if (duo < 0.85) logs.push({ habit_id: 'h-duo', day: d, status: 'mini' });
    // Hirntraining: immer genau Mo, Mi, Fr → lauter Mini-Wochen (zeigt den freundlichen Hinweis)
    if ([1, 3, 5].includes(new Date(d + 'T12:00').getDay())) logs.push({ habit_id: 'h-brain', day: d, status: 'done' });
    r();
    const p = r();
    if (p < 0.6) logs.push({ habit_id: 'h-push', day: d, status: 'done', value: 22 });
    else if (p < 0.75) logs.push({ habit_id: 'h-push', day: d, status: 'mini', value: 10 });
  }
  logs.push({ habit_id: 'h-skin', day: t, status: 'done' });
  logs.push({ habit_id: 'h-duo', day: t, status: 'mini' });
  const pauses = [{ id: 'p1', habit_id: null, start_day: addDays(t, -20), end_day: addDays(t, -18) }];
  // Withings-Beispieldaten: Schritte täglich, Krafttraining Mo/Mi/Fr (+ heute früh), Spaziergänge
  const activity = [];
  const workouts = [];
  for (let i = 30; i >= 0; i -= 1) {
    const d = addDays(t, -i);
    activity.push({ day: d, steps: i === 0 ? 6240 : 3000 + Math.round(rnd() * 7000), distance_m: 4810, active_minutes: 20 + Math.round(rnd() * 40) });
    const wd = new Date(d + 'T12:00').getDay();
    if ([1, 3, 5].includes(wd) || i === 0) {
      const startAt = new Date(d + (i === 0 ? 'T07:30:00' : 'T18:05:00'));
      const mins = 45 + Math.round(rnd() * 12);
      const z = mins * 60;
      workouts.push({ id: 'w' + i, ext_id: 'w' + i, day: d, start_at: startAt.toISOString(), end_at: new Date(startAt.getTime() + mins * 60000).toISOString(), category: 16, duration_min: mins, calories: 280 + Math.round(rnd() * 60), hr_avg: 112 + Math.round(rnd() * 12), hr_max: 145 + Math.round(rnd() * 15), data: { hr_zone_0: Math.round(z * 0.12), hr_zone_1: Math.round(z * 0.33), hr_zone_2: Math.round(z * 0.4), hr_zone_3: Math.round(z * 0.15) } });
      // wie bei Jans Uhr: gleichzeitig automatisch erkanntes „Sonstiges“ – darf nicht doppelt zählen
      if (i % 3 === 0) workouts.push({ id: 's' + i, ext_id: 's' + i, day: d, start_at: new Date(startAt.getTime() - 120000).toISOString(), end_at: new Date(startAt.getTime() + (mins + 2) * 60000).toISOString(), category: 36, duration_min: mins + 4, calories: 300, hr_avg: 114, hr_max: 150, data: {} });
    }
    if (rnd() < 0.4) {
      const startAt = new Date(d + 'T12:40:00');
      workouts.push({ id: 'g' + i, ext_id: 'g' + i, day: d, start_at: startAt.toISOString(), end_at: new Date(startAt.getTime() + 24 * 60000).toISOString(), category: 1, duration_min: 24, calories: 90, hr_avg: 96, hr_max: 112, data: {} });
    }
  }
  return {
    profile: { id: 'demo', display_name: 'Jan', modules: ['habits'], tiles: ['steps', 'training'] },
    categories: cats, habits, logs, pauses,
    activity, workouts, dismissals: [],
    withings: { connected: true, last_sync_at: new Date().toISOString(), connected_at: addDays(t, -30) + 'T10:00:00Z' }
  };
})();
