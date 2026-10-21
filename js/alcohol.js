// „Alkoholfrei“ – reine Funktionen, getestet.
// Gezählt werden alkoholfreie Tage (wachsen nur), eine Quote pro Woche (Ziel wächst langsam) und Gespartes (wächst nur).
// Ein Tag mit Bier nimmt nichts weg – er zählt nur nicht mit. Heute zählt erst, wenn der Tag vorbei ist.

import { addDays, diffDays, weekStart, toDay } from './dates.js';

export const KIND = 'alkohol';
export const DEFAULTS = { price: 2, per_week: 12, goal_start: 5, goal_every: 2 };
// Jans Thesen als Knöpfe – „Sonstiges“ immer zuletzt
export const TAGS = ['Gewohnheit', 'Langeweile', 'Gefühle wegdrücken', 'allein zu Hause', 'Feierabend', 'unterwegs', 'mit anderen', 'Sonstiges'];

const num = (v, d) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : d);
export const costsOf = (settings) => {
  const c = { ...DEFAULTS, ...((settings && settings.costs) || {}) };
  return { price: num(c.price, DEFAULTS.price), per_week: num(c.per_week, DEFAULTS.per_week), goal_start: Math.min(7, Math.max(1, Math.round(num(c.goal_start, DEFAULTS.goal_start)))), goal_every: Math.max(0, Math.round(Number(c.goal_every ?? DEFAULTS.goal_every) || 0)) };
};

// Getränke pro Tag (ein Eintrag kann mehrere sein)
export function drinksByDay(events) {
  const m = new Map();
  for (const e of events || []) m.set(e.day, (m.get(e.day) || 0) + (Number(e.qty) || 1));
  return m;
}

// Abgeschlossene Tage seit Start (heute nicht) – als Liste
function doneDays(settings, T) {
  const out = [];
  for (let d = settings.started_on; d < T; d = addDays(d, 1)) out.push(d);
  return out;
}

// Alkoholfreie Tage seit Start (wächst nur)
export function freeDays(events, settings, T) {
  if (!settings) return 0;
  const drinks = drinksByDay(events);
  return doneDays(settings, T).filter((d) => !drinks.get(d)).length;
}

// Ziel dieser Woche: Startwert + 1 alle n Wochen, höchstens 7
export function goalFor(settings, T) {
  const c = costsOf(settings);
  if (!c.goal_every) return c.goal_start;
  const weeks = Math.max(0, Math.floor(diffDays(weekStart(settings.started_on), weekStart(T)) / 7));
  return Math.min(7, c.goal_start + Math.floor(weeks / c.goal_every));
}

// Wochen (Mo–So) seit Start: alkoholfreie und gezählte Tage (nur abgeschlossene, nur ab Start), plus heute
export function weeks(events, settings, T) {
  if (!settings) return [];
  const drinks = drinksByDay(events);
  const out = [];
  for (let w = weekStart(settings.started_on); w <= T; w = addDays(w, 7)) {
    let free = 0; let days = 0;
    for (let i = 0; i < 7; i += 1) {
      const d = addDays(w, i);
      if (d < settings.started_on || d >= T) continue;
      days += 1;
      if (!drinks.get(d)) free += 1;
    }
    out.push({ start: w, free, days, goal: goalFor(settings, w < settings.started_on ? settings.started_on : w), current: w === weekStart(T) });
  }
  return out;
}

// Diese Woche Tag für Tag: 'free' | 'drink' | 'today' | 'future' | 'before' (vor dem Start)
export function weekDays(events, settings, T) {
  const drinks = drinksByDay(events);
  const w = weekStart(T);
  return Array.from({ length: 7 }, (_, i) => {
    const d = addDays(w, i);
    let state;
    if (settings && d < settings.started_on) state = 'before';
    else if (d > T) state = 'future';
    else if (d === T) state = drinks.get(d) ? 'drink' : 'today';
    else state = drinks.get(d) ? 'drink' : 'free';
    return { day: d, state, n: drinks.get(d) || 0 };
  });
}

// Gespart: jeder abgeschlossene Tag zählt, was unter dem bisherigen Tageswert bleibt (wächst nur)
export function savings(events, settings, T) {
  if (!settings) return { euro: 0, units: 0 };
  const c = costsOf(settings);
  const base = c.per_week / 7;
  const drinks = drinksByDay(events);
  let units = 0;
  for (const d of doneDays(settings, T)) units += Math.max(0, base - (drinks.get(d) || 0));
  return { units: Math.round(units * 10) / 10, euro: Math.round(units * c.price * 100) / 100, perDay: Math.round(base * c.price * 100) / 100 };
}

// Wann und warum: Situationen (pro Eintrag), Tageszeit, Wochentag, Ø an Biertagen
const PARTS = [['morgens', 5, 12], ['nachmittags', 12, 17], ['abends', 17, 22], ['nachts', 22, 29]];
const WD = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
export function patterns(events) {
  const list = events || [];
  if (!list.length) return null;
  const tags = new Map();
  for (const e of list) for (const t of e.tags || []) tags.set(t, (tags.get(t) || 0) + 1);
  const parts = new Map();
  const wds = new Map();
  for (const e of list) {
    const d = new Date(e.at);
    let h = d.getHours(); if (h < 5) h += 24;
    const p = PARTS.find(([, a, b]) => h >= a && h < b)[0];
    parts.set(p, (parts.get(p) || 0) + 1);
  }
  const drinks = drinksByDay(list);
  for (const day of drinks.keys()) { const w = WD[new Date(day + 'T12:00').getDay()]; wds.set(w, (wds.get(w) || 0) + 1); }
  const top = (m) => [...m.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || null;
  // Nur nennen, wenn ein Wochentag wirklich vorne liegt (mindestens 2× und kein Gleichstand)
  const clearTop = (m) => { const e = [...m.entries()].sort((a, b) => b[1] - a[1]); return e[0] && e[0][1] >= 2 && (!e[1] || e[1][1] < e[0][1]) ? e[0][0] : null; };
  const total = [...drinks.values()].reduce((s, v) => s + v, 0);
  return {
    tags: [...tags.entries()].sort((a, b) => b[1] - a[1] || TAGS.indexOf(a[0]) - TAGS.indexOf(b[0])).map(([label, n]) => ({ label, n })),
    entries: list.length,
    part: top(parts),
    weekday: clearTop(wds),
    avg: Math.round((total / drinks.size) * 10) / 10,
    drinkDays: drinks.size
  };
}

// Am Tag danach: Ruhepuls und Schritte am Tag nach einem Biertag vs. andere Tage seit Start (abgeschlossene Tage)
export function dayAfter(events, settings, T, restVals = [], activity = []) {
  if (!settings) return null;
  const drinks = drinksByDay(events);
  const after = new Set([...drinks.keys()].map((d) => addDays(d, 1)));
  const rest = new Map((restVals || []).map((v) => [v.day, v.v]));
  const steps = new Map((activity || []).filter((a) => Number(a.steps) > 0).map((a) => [a.day, Number(a.steps)]));
  const pick = (m) => {
    const a = []; const o = [];
    for (const d of doneDays(settings, T)) {
      if (!m.has(d)) continue;
      (after.has(d) ? a : o).push(m.get(d));
    }
    const avg = (l) => (l.length ? l.reduce((s, v) => s + v, 0) / l.length : null);
    return { after: avg(a), other: avg(o), nAfter: a.length, nOther: o.length };
  };
  return { rest: pick(rest), steps: pick(steps), afterDays: [...after].filter((d) => d >= settings.started_on && d < T).length };
}

// Neuer Eintrag „jetzt“
export const newDrink = (qty = 1, tags = [], now = new Date()) => ({ kind: KIND, at: now.toISOString(), day: toDay(now), qty, tags });
