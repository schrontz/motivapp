// Aktionen: Abhaken, Werte eintragen, Pausen, Gewohnheit anlegen/bearbeiten, Kategorien, „Willkommen zurück“.

import * as db from '../db.js';
import { S, local, session, route, go, render, toast, reindex, persist } from '../core.js';
import { today, addDays, weekday } from '../dates.js';
import { logOf, lastActivityDay } from '../stats.js';
import { CATEGORY_GROUPS } from '../auto.js';
import { applyAuto } from './withings.js';

// ───────────── Einträge ─────────────

export function putLog(habitId, day, status, value = null, source = 'manual') {
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

// ───────────── Pausen ─────────────

export async function addPauseFor(habitId, start, end) {
  const row = await persist(() => db.addPause(habitId, start, end));
  if (row) { S.pauses.push(row); render(); }
}

// Schnellwahl im Pausen-Sheet
function quickRange(key, T) {
  if (key === 'week') return [T, addDays(T, 6)];
  if (key === 'weekend') {
    const wd = weekday(T); // 1 = Mo … 7 = So
    const from = wd >= 6 ? T : addDays(T, 6 - wd);
    return [from, addDays(from, 7 - weekday(from))];
  }
  return [T, T];
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

// ───────────── Ereignisse ─────────────

export const clicks = {
  cat: ({ id }) => { S.cat = id; local.set('cat', id); render(); },
  toggle: ({ id, T }) => cycleCheck(id, T),
  'open-sheet': ({ id, T }) => openSheet(id, T),
  cal: ({ id, day }) => {
    const h = S.habits.find((x) => x.id === id);
    if (!h) return;
    if (h.kind === 'count') openSheet(id, day);
    else cycleCheck(id, day);
  },
  'close-sheet': () => { S.sheet = null; render(); },
  'sheet-inc': ({ action }) => stepSheet(action),
  'sheet-dec': ({ action }) => stepSheet(action),
  'sheet-save': () => {
    const h = S.habits.find((x) => x.id === S.sheet.id);
    const v = sheetValue();
    const status = h.target && v >= h.target ? 'done' : (h.mini_value != null && v >= h.mini_value ? 'mini' : 'partial');
    const { day: d } = S.sheet;
    S.sheet = null;
    if (v === 0) putLog(h.id, d, null); else putLog(h.id, d, status, v);
  },
  'sheet-mini': () => {
    const h = S.habits.find((x) => x.id === S.sheet.id);
    const { day: d } = S.sheet;
    S.sheet = null;
    putLog(h.id, d, 'mini', h.mini_value);
  },
  'sheet-pause': async () => {
    const { id: hid, day: d } = S.sheet;
    S.sheet = null;
    await addPauseFor(hid, d, d);
    toast('Pause eingetragen – zählt nicht gegen dich.');
  },
  'sheet-unpause': async () => {
    const { id: hid, day: d } = S.sheet;
    S.sheet = null;
    await removePausesOn(hid, d);
  },
  'sheet-delete': () => {
    const { id: hid, day: d } = S.sheet;
    S.sheet = null;
    putLog(hid, d, null);
  },
  archive: async ({ id }) => {
    if (!confirm('Gewohnheit wirklich entfernen? Bisherige Einträge bleiben in deiner Gesamtzahl.')) return;
    S.habits = S.habits.map((h) => (h.id === id ? { ...h, archived: true } : h));
    go('#/habits');
    await persist(() => db.archiveHabit(id));
  },
  'cat-delete': async ({ id }) => {
    const c = S.categories.find((x) => x.id === id);
    if (!c || !confirm(`Kategorie „${c.name}“ löschen? Die Gewohnheiten bleiben erhalten, nur ohne Kategorie.`)) return;
    S.categories = S.categories.filter((x) => x.id !== id);
    S.habits = S.habits.map((h) => (h.category_id === id ? { ...h, category_id: null } : h));
    render();
    await persist(() => db.deleteCategory(id));
  },
  'pause-open': ({ id, T }) => {
    S.pauseSheet = { habitId: id === 'all' ? null : id, from: T, to: T };
    render();
  },
  'pause-close': () => { S.pauseSheet = null; render(); },
  'pause-quick': ({ id, T }) => {
    const [from, to] = quickRange(id, T);
    S.pauseSheet = { ...S.pauseSheet, from, to };
    render();
  },
  'pause-delete': async ({ id }) => {
    S.pauses = S.pauses.filter((p) => p.id !== id);
    render();
    await persist(() => db.deletePause(id));
  },
  'hint-ok': ({ id, el }) => {
    local.set('hint.' + id, el.dataset.count);
    render();
  },
  'welcome-toggle': () => { S.welcomePause = !(S.welcomePause !== false); render(); },
  'welcome-go': async ({ T }) => {
    session.set('welcomed', '1');
    const last = lastActivityDay(S.logs);
    const yesterday = addDays(T, -1);
    if (S.welcomePause !== false && last && addDays(last, 1) <= yesterday) {
      await addPauseFor(null, addDays(last, 1), yesterday);
    }
    go('#/');
  }
};

function stepSheet(action) {
  const step = action === 'sheet-inc' ? 1 : -1;
  S.sheet.value = Math.max(0, Math.round((sheetValue() + step) * 100) / 100);
  document.getElementById('sheet-val').value = S.sheet.value;
}

export const changes = {
  'form-change': ({ el }) => {
    S.form = readHabitForm(el.form);
    render();
  },
  'cat-rename': async ({ el }) => {
    const name = el.value.trim();
    const c = S.categories.find((x) => x.id === el.dataset.id);
    if (!c || !name || name === c.name) { if (c) el.value = c.name; return; }
    c.name = name;
    const saved = await persist(() => db.saveCategory(c));
    if (saved) toast('Kategorie umbenannt');
  },
  'cat-color': async ({ el }) => {
    const c = S.categories.find((x) => x.id === el.dataset.id);
    if (!c) return;
    c.color = el.value;
    await persist(() => db.saveCategory(c));
  }
};

export const submits = {
  habit: (form) => submitHabit(form),
  pause: async (form) => {
    const fd = new FormData(form);
    const from = String(fd.get('from') || '');
    const to = String(fd.get('to') || '');
    const err = (msg) => { const el = document.getElementById('pause-error'); if (el) el.textContent = msg; };
    if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) return err('Bitte Von und Bis wählen.');
    if (to < from) return err('„Bis“ liegt vor „Von“.');
    const { habitId } = S.pauseSheet || {};
    S.pauseSheet = null;
    await addPauseFor(habitId ?? null, from, to);
    toast(from === to ? 'Pause eingetragen – zählt nicht gegen dich.' : 'Pause eingetragen – diese Tage zählen nicht gegen dich.');
  },
  'new-cat': async (form) => {
    const name = String(new FormData(form).get('name') || '').trim();
    if (!name) return;
    const cat = await persist(() => db.saveCategory({ name, color: nextColor(), sort_order: S.categories.length }));
    if (cat) { S.categories.push(cat); render(); toast('Kategorie angelegt'); }
  }
};
