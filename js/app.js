// Motivator – App-Steuerung: Zustand, Navigation, Aktionen.

import * as db from './db.js';
import * as V from './views.js';
import { today, addDays, diffDays } from './dates.js';
import { indexLogs, logOf, lastActivityDay } from './stats.js';
import { autoLogChanges, CATEGORY_GROUPS } from './auto.js';
import { WITHINGS_CLIENT_ID, WITHINGS_REDIRECT } from './config.js';

const root = document.getElementById('app');

const S = {
  session: null,
  profile: null,
  categories: [],
  habits: [],
  logs: [],
  pauses: [],
  activity: [],
  workouts: [],
  dismissals: [],
  withings: { connected: false },
  hasWithingsSchema: false,
  syncing: false,
  idx: new Map(),
  cat: 'all',
  sheet: null,
  form: null,
  welcomePause: true,
  loaded: false,
  loginError: ''
};

// Kleine Merkhilfen pro Gerät (Filter, „Willkommen“ schon gesehen). Darf fehlschlagen.
const local = {
  get(k) { try { return localStorage.getItem('motivator.' + k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem('motivator.' + k, v); } catch { /* egal */ } }
};
const session = {
  get(k) { try { return sessionStorage.getItem('motivator.' + k); } catch { return null; } },
  set(k, v) { try { sessionStorage.setItem('motivator.' + k, v); } catch { /* egal */ } }
};
S.cat = local.get('cat') || 'all';
// „Passt so“ beim Muster-Hinweis: erst wieder zeigen, wenn das Muster 4 weitere Zeiträume anhält
S.hintSeen = (id, count) => {
  const seen = Number(local.get('hint.' + id) || 0);
  return seen > 0 && count < seen + 4;
};

// ───────────── Navigation ─────────────

function route() {
  const parts = location.hash.replace(/^#\/?/, '').split('/');
  return { name: parts[0] || 'overview', id: parts[1] ? decodeURIComponent(parts[1]) : null };
}

function go(hash) {
  if (location.hash === hash) render();
  else location.hash = hash;
}

window.addEventListener('hashchange', () => {
  S.sheet = null;
  S.form = null;
  render();
  window.scrollTo(0, 0);
});

// ───────────── Darstellung ─────────────

let toastTimer = null;
function toast(msg) {
  let el = document.querySelector('.toast');
  if (!el) {
    el = document.createElement('div');
    el.className = 'toast';
    el.setAttribute('role', 'status');
    document.body.appendChild(el);
  }
  el.textContent = msg;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.remove(), 3200);
}

function render() {
  if (!S.session) { root.innerHTML = V.login(S.loginError); return; }
  if (!S.loaded) { root.innerHTML = V.loading(); return; }
  const T = today();
  const r = route();
  let html;
  switch (r.name) {
    case 'habits': html = V.habitsList(S, T); break;
    case 'habit': html = V.detail(S, T, r.id); break;
    case 'new': html = V.habitForm(S, T, null); break;
    case 'edit': html = V.habitForm(S, T, r.id); break;
    case 'profile': html = V.profile(S, S.session.user && S.session.user.email); break;
    case 'welcome': {
      const last = lastActivityDay(S.logs);
      html = last && diffDays(last, T) > 1 ? V.welcome(S, T, last) : V.overview(S, T);
      break;
    }
    default: html = V.overview(S, T);
  }
  root.innerHTML = html;
  if (S.sheet) {
    const input = document.getElementById('sheet-val');
    if (input && S.sheet.focus) { input.focus(); input.select(); S.sheet.focus = false; }
  }
}

function reindex() {
  S.idx = indexLogs(S.logs);
}

async function reload() {
  const data = await db.loadAll();
  Object.assign(S, data);
  reindex();
  S.loaded = true;
}

// Speichern im Hintergrund: Oberfläche ist schon aktualisiert. Bei Fehlern neu laden.
async function persist(fn, errorText = 'Speichern hat nicht geklappt – bitte Verbindung prüfen.') {
  try {
    return await fn();
  } catch (err) {
    console.error(err);
    const msg = String((err && err.message) || '');
    let text = errorText;
    if (/schedule_min/.test(msg)) text = 'Bitte zuerst das Datenbank-Update 002 (Mini-Woche) im SQL-Editor ausführen.';
    else if (/auto_|tiles|source|schema cache/.test(msg)) text = 'Bitte zuerst das Datenbank-Update 003 (Withings) im SQL-Editor ausführen.';
    toast(text);
    try { await reload(); } catch { /* offline */ }
    render();
    return null;
  }
}

// ───────────── Einträge ─────────────

function putLog(habitId, day, status, value = null, source = 'manual') {
  const before = logOf(S.idx, habitId, day);
  S.logs = S.logs.filter((l) => !(l.habit_id === habitId && l.day === day));
  if (status) S.logs.push({ habit_id: habitId, day, status, value, source });
  // Eintrag bei einer Auto-Gewohnheit entfernt → merken, damit Withings ihn nicht wieder setzt
  const h = S.habits.find((x) => x.id === habitId);
  const hasAuto = h && ((h.auto_categories && h.auto_categories.length) || h.auto_metric);
  const dismiss = !status && before && (before.source === 'withings' || hasAuto) && S.hasWithingsSchema;
  if (dismiss) S.dismissals.push({ habit_id: habitId, day });
  reindex();
  render();
  const src = S.hasWithingsSchema ? source : null;
  return persist(async () => {
    if (status) await db.setLog(habitId, day, status, value, src);
    else await db.deleteLog(habitId, day);
    if (dismiss) await db.addDismissal(habitId, day);
  });
}

// ───────────── Withings ─────────────

async function applyAuto() {
  if (!S.hasWithingsSchema) return;
  const changes = autoLogChanges({
    habits: S.habits, logs: S.logs, workouts: S.workouts, activity: S.activity, dismissals: S.dismissals, today: today()
  });
  if (!changes.length) return;
  for (const c of changes) {
    S.logs = S.logs.filter((l) => !(l.habit_id === c.habit_id && l.day === c.day));
    S.logs.push(c);
  }
  reindex();
  render();
  const newToday = changes.filter((c) => c.day === today() && c.value == null)
    .map((c) => (S.habits.find((h) => h.id === c.habit_id) || {}).name).filter(Boolean);
  if (newToday.length) toast(`${newToday.join(', ')} automatisch abgehakt – dank Withings.`);
  for (const c of changes) await persist(() => db.setLog(c.habit_id, c.day, c.status, c.value, 'withings'));
}

async function syncWithings({ manual = false } = {}) {
  if (!S.withings.connected || S.syncing) return;
  const last = S.withings.last_sync_at ? new Date(S.withings.last_sync_at).getTime() : 0;
  if (!manual && Date.now() - last < 10 * 60000) { await applyAuto(); return; }
  S.syncing = true;
  render();
  try {
    const res = await db.withings('sync');
    if (res && res.needsReconnect) {
      toast('Withings bitte neu verbinden (Profil) – der Zugang ist abgelaufen.');
    } else if (res && res.last_sync_at) {
      S.withings.last_sync_at = res.last_sync_at;
      const fresh = await db.loadWithingsData();
      // Ablehnungen zusammenführen – eine gerade erst gemerkte darf nicht durchs Neuladen verloren gehen
      const keys = new Set(fresh.dismissals.map((d) => `${d.habit_id}|${d.day}`));
      fresh.dismissals = [...fresh.dismissals, ...S.dismissals.filter((d) => !keys.has(`${d.habit_id}|${d.day}`))];
      fresh.withings = { ...fresh.withings, last_sync_at: res.last_sync_at };
      Object.assign(S, fresh);
      if (manual) toast('Withings abgeglichen');
    }
  } catch (err) {
    console.error(err);
    if (manual) toast(`Abgleich hat nicht geklappt: ${err.message}`);
  } finally {
    S.syncing = false;
  }
  await applyAuto();
  render();
}

function startWithingsLogin() {
  if (!WITHINGS_CLIENT_ID) { toast('Die Withings Client ID fehlt noch in js/config.js.'); return; }
  const state = Math.random().toString(36).slice(2) + Date.now().toString(36);
  // Geräteweit merken (nicht nur im Tab): Nach dem Withings-Login landet man auf Android oft in einem neuen Tab
  local.set('withings.state', JSON.stringify({ state, at: Date.now() }));
  const url = 'https://account.withings.com/oauth2_user/authorize2?' + new URLSearchParams({
    response_type: 'code', client_id: WITHINGS_CLIENT_ID, scope: 'user.activity,user.metrics',
    redirect_uri: WITHINGS_REDIRECT, state
  }).toString();
  location.href = url;
}

// Rückkehr vom Withings-Login: ?code=…&state=… – der Code ist nur 30 Sekunden gültig, also sofort tauschen.
async function handleWithingsReturn() {
  const params = new URLSearchParams(location.search);
  const code = params.get('code');
  const state = params.get('state');
  if (!code) return;
  history.replaceState(null, '', location.pathname + location.hash);
  let saved = null;
  try { saved = JSON.parse(local.get('withings.state') || 'null'); } catch { saved = null; }
  local.set('withings.state', '');
  const fresh = saved && Date.now() - saved.at < 15 * 60000;
  if (!state || !fresh || state !== saved.state) {
    toast('Withings-Anmeldung konnte nicht bestätigt werden – bitte im Profil noch einmal „Mit Withings verbinden“ tippen.');
    return;
  }
  try {
    await db.withings('connect', { code, redirect_uri: WITHINGS_REDIRECT });
    toast('Withings verbunden – hole deine Daten …');
    S.withings = { connected: true, last_sync_at: null };
  } catch (err) {
    console.error(err);
    toast(`Withings-Verbindung fehlgeschlagen: ${err.message}`);
  }
}

function cycleCheck(habitId, day) {
  const log = logOf(S.idx, habitId, day);
  const next = { open: 'done', done: 'mini', mini: null, partial: 'done' }[log ? log.status : 'open'];
  const h = S.habits.find((x) => x.id === habitId);
  if (next === 'mini' && h && !h.mini_text) return putLog(habitId, day, null); // ohne Mini-Version: an/aus
  return putLog(habitId, day, next);
}

function openSheet(habitId, day) {
  const h = S.habits.find((x) => x.id === habitId);
  const log = logOf(S.idx, habitId, day);
  const value = log && log.value != null ? log.value : (h.target ?? 1);
  S.sheet = { id: habitId, day, value, focus: false };
  render();
}

function sheetValue() {
  const input = document.getElementById('sheet-val');
  const v = input ? parseFloat(String(input.value).replace(',', '.')) : NaN;
  return Number.isFinite(v) && v >= 0 ? v : 0;
}

async function addPauseFor(habitId, start, end) {
  const row = await persist(() => db.addPause(habitId, start, end));
  if (row) { S.pauses.push(row); render(); }
}

async function removePausesOn(habitId, day) {
  const hits = S.pauses.filter((p) => p.habit_id === habitId && p.start_day <= day && day <= p.end_day);
  S.pauses = S.pauses.filter((p) => !hits.includes(p));
  render();
  for (const p of hits) await persist(() => db.deletePause(p.id));
}

// ───────────── Formular Gewohnheit ─────────────

function readHabitForm(form) {
  const fd = new FormData(form);
  return {
    name: (fd.get('name') || '').toString(),
    icon: (fd.get('icon') || 'check').toString(),
    category: (fd.get('category') || '').toString(),
    newcat: (fd.get('newcat') || '').toString(),
    kind: (fd.get('kind') || 'check').toString(),
    target: fd.get('target'),
    unit: fd.get('unit'),
    schedule: (fd.get('schedule') || 'daily').toString(),
    // Wochentage nur übernehmen, wenn die Auswahl schon sichtbar war – sonst gelten die Vorgaben (Mo–Fr)
    days: form.querySelector('input[name="days"]') ? fd.getAll('days').map(Number) : undefined,
    count: fd.get('count'),
    min: fd.get('min'),
    mini_text: fd.get('mini_text'),
    mini_value: fd.get('mini_value'),
    start_day: fd.get('start_day') ? String(fd.get('start_day')) : undefined,
    // Automatik (nur vorhanden, wenn der Abschnitt sichtbar ist)
    auto_on: form.querySelector('[name="auto_on"]') ? fd.get('auto_on') === 'on' : undefined,
    auto_groups: form.querySelector('[name="auto_groups"]') ? fd.getAll('auto_groups').map(String) : undefined,
    auto_min: fd.get('auto_min'),
    auto_metric: form.querySelector('[name="auto_metric"]') ? String(fd.get('auto_metric') || '') : undefined
  };
}

function groupsToCats(groups) {
  return CATEGORY_GROUPS.filter((g) => groups.includes(g.id)).flatMap((g) => g.cats);
}

function num(v) {
  if (v == null || String(v).trim() === '') return null;
  const n = parseFloat(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

async function submitHabit(form) {
  const f = readHabitForm(form);
  const err = (msg) => { const el = document.getElementById('form-error'); if (el) el.textContent = msg; };
  if (!f.name.trim()) return err('Bitte gib der Gewohnheit einen Namen.');
  if (f.kind === 'count' && !(num(f.target) > 0)) return err('Bitte ein Tagesziel größer als 0 eintragen.');
  if (f.schedule === 'weekdays' && !(f.days && f.days.length)) return err('Bitte mindestens einen Wochentag wählen.');
  if (f.category === '__new' && !f.newcat.trim()) return err('Bitte einen Namen für die neue Kategorie eingeben.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(f.start_day || '')) return err('Bitte ein Startdatum wählen.');
  const periodic = f.schedule === 'per_week' || f.schedule === 'per_month';
  const goal = Math.max(1, Math.round(num(f.count) || 1));
  const minRaw = num(f.min);
  if (periodic && minRaw != null && (minRaw < 1 || Math.round(minRaw) > goal)) {
    return err(`Die Mini-Zahl muss zwischen 1 und ${goal} liegen.`);
  }
  const schedMin = periodic && minRaw != null && Math.round(minRaw) < goal ? Math.round(minRaw) : null;
  if (f.kind === 'check' && f.auto_on && !(f.auto_groups && f.auto_groups.length)) {
    return err('Bitte mindestens eine Trainingsart fürs automatische Abhaken wählen.');
  }

  const btn = form.querySelector('button[type="submit"]');
  if (btn) btn.disabled = true;

  let categoryId = f.category || null;
  if (f.category === '__new') {
    const cat = await persist(() => db.saveCategory({ name: f.newcat.trim(), color: nextColor(), sort_order: S.categories.length }));
    if (!cat) { if (btn) btn.disabled = false; return; }
    S.categories.push(cat);
    categoryId = cat.id;
  }

  const id = route().name === 'edit' ? route().id : null;
  const existing = id ? S.habits.find((h) => h.id === id) : null;
  const cat = S.categories.find((c) => c.id === categoryId);
  const habit = {
    ...(existing || {}),
    name: f.name.trim(),
    icon: f.icon,
    category_id: categoryId,
    color: cat ? cat.color : (existing ? existing.color : 'blue'),
    kind: f.kind,
    target: f.kind === 'count' ? num(f.target) : null,
    unit: f.kind === 'count' ? (f.unit || '').toString().trim() || null : null,
    schedule: f.schedule,
    schedule_days: f.schedule === 'weekdays' ? f.days : null,
    schedule_count: periodic ? goal : null,
    schedule_min: schedMin,
    mini_text: f.kind === 'check' ? (f.mini_text || '').toString().trim() || null : null,
    mini_value: f.kind === 'count' ? num(f.mini_value) : null,
    start_day: f.start_day
  };
  if (S.hasWithingsSchema) {
    if (f.kind === 'check') {
      habit.auto_categories = f.auto_on ? groupsToCats(f.auto_groups || []) : null;
      habit.auto_min_minutes = f.auto_on ? Math.max(0, Math.round(num(f.auto_min) || 0)) : null;
      habit.auto_metric = null;
    } else {
      habit.auto_metric = f.auto_metric || null;
      habit.auto_categories = null;
      habit.auto_min_minutes = null;
    }
  } else {
    delete habit.auto_categories; delete habit.auto_min_minutes; delete habit.auto_metric;
  }
  if (!existing) {
    habit.archived = false;
    habit.sort_order = S.habits.length;
  }
  const saved = await persist(() => db.saveHabit(habit));
  if (!saved) { if (btn) btn.disabled = false; return; }
  S.habits = existing ? S.habits.map((h) => (h.id === saved.id ? saved : h)) : [...S.habits, saved];
  S.form = null;
  applyAuto();
  const later = saved.start_day > today();
  toast(existing ? 'Gespeichert' : (later ? 'Angelegt – startet am gewählten Tag.' : 'Angelegt – viel Erfolg!'));
  go(existing ? '#/habit/' + saved.id : '#/');
}

function nextColor() {
  const order = ['blue', 'orange', 'teal', 'purple', 'pink'];
  return order[S.categories.length % order.length];
}

// ───────────── Export ─────────────

function exportData() {
  const data = {
    exportiert_am: new Date().toISOString(),
    profil: S.profile,
    kategorien: S.categories,
    gewohnheiten: S.habits,
    eintraege: S.logs,
    pausen: S.pauses
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `motivator-export-${today()}.json`;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}

// ───────────── Ereignisse ─────────────

root.addEventListener('click', async (e) => {
  const el = e.target.closest('[data-action]');
  if (!el || el.tagName === 'SELECT' || (el.tagName === 'INPUT' && el.type !== 'button')) return;
  const { action, id, day } = el.dataset;
  const T = today();
  switch (action) {
    case 'cat':
      S.cat = id; local.set('cat', id); render(); break;
    case 'toggle':
      cycleCheck(id, T); break;
    case 'open-sheet':
      openSheet(id, T); break;
    case 'cal': {
      const h = S.habits.find((x) => x.id === id);
      if (!h) break;
      if (h.kind === 'count') openSheet(id, day);
      else cycleCheck(id, day);
      break;
    }
    case 'close-sheet':
      S.sheet = null; render(); break;
    case 'sheet-inc':
    case 'sheet-dec': {
      const step = action === 'sheet-inc' ? 1 : -1;
      S.sheet.value = Math.max(0, Math.round((sheetValue() + step) * 100) / 100);
      document.getElementById('sheet-val').value = S.sheet.value;
      break;
    }
    case 'sheet-save': {
      const h = S.habits.find((x) => x.id === S.sheet.id);
      const v = sheetValue();
      const status = h.target && v >= h.target ? 'done' : (h.mini_value != null && v >= h.mini_value ? 'mini' : 'partial');
      const { day: d } = S.sheet;
      S.sheet = null;
      if (v === 0) putLog(h.id, d, null); else putLog(h.id, d, status, v);
      break;
    }
    case 'sheet-mini': {
      const h = S.habits.find((x) => x.id === S.sheet.id);
      const { day: d } = S.sheet;
      S.sheet = null;
      putLog(h.id, d, 'mini', h.mini_value);
      break;
    }
    case 'sheet-pause': {
      const { id: hid, day: d } = S.sheet;
      S.sheet = null;
      await addPauseFor(hid, d, d);
      toast('Pause eingetragen – zählt nicht gegen dich.');
      break;
    }
    case 'sheet-unpause': {
      const { id: hid, day: d } = S.sheet;
      S.sheet = null;
      await removePausesOn(hid, d);
      break;
    }
    case 'sheet-delete': {
      const { id: hid, day: d } = S.sheet;
      S.sheet = null;
      putLog(hid, d, null);
      break;
    }
    case 'archive': {
      if (!confirm('Gewohnheit wirklich entfernen? Bisherige Einträge bleiben in deiner Gesamtzahl.')) break;
      S.habits = S.habits.map((h) => (h.id === id ? { ...h, archived: true } : h));
      go('#/habits');
      await persist(() => db.archiveHabit(id));
      break;
    }
    case 'cat-delete': {
      const c = S.categories.find((x) => x.id === id);
      if (!c || !confirm(`Kategorie „${c.name}“ löschen? Die Gewohnheiten bleiben erhalten, nur ohne Kategorie.`)) break;
      S.categories = S.categories.filter((x) => x.id !== id);
      S.habits = S.habits.map((h) => (h.category_id === id ? { ...h, category_id: null } : h));
      render();
      await persist(() => db.deleteCategory(id));
      break;
    }
    case 'export':
      exportData(); break;
    case 'hint-ok':
      local.set('hint.' + id, el.dataset.count);
      render();
      break;
    case 'withings-connect':
      startWithingsLogin(); break;
    case 'withings-sync':
      await syncWithings({ manual: true }); break;
    case 'withings-disconnect': {
      if (!confirm('Withings trennen? Deine bisherigen Schritte und Trainings bleiben gespeichert.')) break;
      try {
        await db.withings('disconnect');
        S.withings = { connected: false };
        toast('Withings getrennt');
      } catch (err) { toast(`Trennen hat nicht geklappt: ${err.message}`); }
      render();
      break;
    }
    case 'tile-toggle': {
      if (!S.profile) break;
      const tiles = new Set(S.profile.tiles || ['steps', 'training']);
      if (tiles.has(id)) tiles.delete(id); else tiles.add(id);
      S.profile.tiles = ['steps', 'training', 'active', 'distance'].filter((k) => tiles.has(k));
      render();
      if (S.hasWithingsSchema) await persist(() => db.updateProfile(S.profile.id, { tiles: S.profile.tiles }));
      break;
    }
    case 'logout':
      await db.signOut(); break;
    case 'welcome-toggle':
      S.welcomePause = !(S.welcomePause !== false); render(); break;
    case 'welcome-go': {
      session.set('welcomed', '1');
      const last = lastActivityDay(S.logs);
      const yesterday = addDays(T, -1);
      if (S.welcomePause !== false && last && addDays(last, 1) <= yesterday) {
        await addPauseFor(null, addDays(last, 1), yesterday);
      }
      go('#/');
      break;
    }
    default: break;
  }
});

root.addEventListener('change', async (e) => {
  const el = e.target;
  const action = el.dataset && el.dataset.action;
  if (action === 'form-change') {
    S.form = readHabitForm(el.form);
    render();
    return;
  }
  if (action === 'cat-rename') {
    const name = el.value.trim();
    const c = S.categories.find((x) => x.id === el.dataset.id);
    if (!c || !name || name === c.name) { if (c) el.value = c.name; return; }
    c.name = name;
    const saved = await persist(() => db.saveCategory(c));
    if (saved) toast('Kategorie umbenannt');
    return;
  }
  if (action === 'cat-color') {
    const c = S.categories.find((x) => x.id === el.dataset.id);
    if (!c) return;
    c.color = el.value;
    await persist(() => db.saveCategory(c));
    return;
  }
  if (action === 'profile-name') {
    const name = el.value.trim();
    if (!S.profile) return;
    S.profile.display_name = name || null;
    const ok = await persist(() => db.updateProfile(S.profile.id, { display_name: name || null }));
    if (ok !== null) toast('Gespeichert');
  }
});

root.addEventListener('submit', async (e) => {
  const form = e.target;
  const kind = form.dataset.form;
  if (!kind) return;
  e.preventDefault();
  if (kind === 'login') {
    const fd = new FormData(form);
    const btn = form.querySelector('button[type="submit"]');
    btn.disabled = true;
    try {
      await db.signIn(String(fd.get('email')).trim(), String(fd.get('password')));
      S.loginError = '';
    } catch (err) {
      console.error(err);
      S.loginError = 'Anmeldung fehlgeschlagen. E-Mail oder Passwort prüfen.';
      render();
    }
  } else if (kind === 'habit') {
    await submitHabit(form);
  } else if (kind === 'new-cat') {
    const name = String(new FormData(form).get('name') || '').trim();
    if (!name) return;
    const cat = await persist(() => db.saveCategory({ name, color: nextColor(), sort_order: S.categories.length }));
    if (cat) { S.categories.push(cat); render(); toast('Kategorie angelegt'); }
  }
});

// Enter im Wert-Feld speichert
root.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && e.target.id === 'sheet-val') {
    e.preventDefault();
    document.querySelector('[data-action="sheet-save"]').click();
  }
  if (e.key === 'Escape' && S.sheet) { S.sheet = null; render(); }
});

// ───────────── Start ─────────────

async function afterLogin() {
  S.loaded = false;
  render();
  await handleWithingsReturn();
  try {
    await reload();
  } catch (err) {
    console.error(err);
    root.innerHTML = V.loading('Daten konnten nicht geladen werden. Bitte später erneut versuchen.');
    return;
  }
  const last = lastActivityDay(S.logs);
  const T = today();
  if (last && diffDays(last, T) > 3 && !session.get('welcomed') && route().name === 'overview') {
    location.hash = '#/welcome';
  }
  render();
  syncWithings(); // im Hintergrund
}

// Zurück in die App (z. B. nach dem Training): Withings erneut abgleichen
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && S.loaded) syncWithings();
});

async function start() {
  root.innerHTML = V.loading();
  try {
    await db.initDb();
  } catch (err) {
    console.error(err);
    root.innerHTML = V.loading('Keine Verbindung. Bitte Internet prüfen und neu laden.');
    return;
  }
  S.session = await db.getSession();
  db.onAuthChange((sess) => {
    const was = !!S.session;
    S.session = sess;
    if (sess && !was) afterLogin();
    if (!sess) { S.loaded = false; render(); }
  });
  if (S.session) await afterLogin();
  else render();
}

start();

if ('serviceWorker' in navigator && !db.isDemo) {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}
