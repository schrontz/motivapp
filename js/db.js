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
  if (isDemo) return structuredClone(demo);
  const [profiles, categories, habits, logs, pauses] = await Promise.all([
    client.from('profiles').select('*').then(check),
    fetchAll('categories', 'sort_order'),
    fetchAll('habits', 'sort_order'),
    fetchAll('habit_logs', 'day'),
    fetchAll('pauses', 'start_day')
  ]);
  return { profile: profiles[0] || null, categories, habits, logs, pauses };
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

export async function setLog(habitId, day, status, value = null) {
  if (isDemo) return { habit_id: habitId, day, status, value };
  return check(await client.from('habit_logs')
    .upsert({ habit_id: habitId, day, status, value }, { onConflict: 'habit_id,day' })
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
    { id: 'h-push', category_id: 'c-sport', name: 'Liegestütze', icon: 'dumbbell', color: 'blue', kind: 'count', target: 22, unit: 'Wdh.', mini_value: 10, schedule: 'daily', start_day: start, archived: false, sort_order: 4 }
  ];
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
  return {
    profile: { id: 'demo', display_name: 'Jan', modules: ['habits'] },
    categories: cats, habits, logs, pauses
  };
})();
