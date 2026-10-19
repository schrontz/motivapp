// Puls von Withings – als Trend, kein Urteil. Reine Funktionen, getestet.
// Ruhepuls-Quelle:
//   „sleep“ = Ø Puls im Schlaf (wenn die Uhr nachts getragen wird) – am saubersten
//   „day“   = niedrigster Puls des Tages, solange die Uhr getragen wird (z. B. beim Sitzen) – Jans Fall
// Schlaf, Stress, Infekte, Koffein und Rauchen bewegen beides.

import { addDays } from './dates.js';
import { series } from './body.js';

const valid = (v) => Number(v) > 25 && Number(v) < 200;

// Welche Quelle? Schlaf, wenn es in den letzten 30 Tagen genug Nächte gibt – sonst Tageswerte.
// Tageswerte nur von abgeschlossenen Tagen (heute kann der Wert noch fallen).
export function restValues(sleep, activity, T) {
  const nights = (sleep || []).filter((n) => n && n.day && valid(n.hr_avg))
    .map((n) => ({ day: n.day, v: Number(n.hr_avg) })).sort((a, b) => (a.day < b.day ? -1 : 1));
  if (nights.filter((n) => n.day >= addDays(T, -30)).length >= 5) return { kind: 'sleep', vals: nights };
  const days = (activity || []).filter((a) => a && a.day && a.day < T && valid(a.hr_min))
    .map((a) => ({ day: a.day, v: Number(a.hr_min) })).sort((a, b) => (a.day < b.day ? -1 : 1));
  if (days.length) return { kind: 'day', vals: days };
  if (nights.length) return { kind: 'sleep', vals: nights };
  return null;
}

// Verlauf wie bei den Körperwerten: jeder Wert + Schnitt der letzten 14 Tage
export function restSeries(vals, fromDay = '0000-00-00') {
  return series((vals || []).map((n) => ({ day: n.day, vals: { rest: n.v } })), 'rest', fromDay);
}

// Letzter Wert (nicht älter als maxAge Tage)
export function lastRest(vals, T, maxAge = 3) {
  const last = (vals || [])[(vals || []).length - 1];
  if (!last || last.day < addDays(T, -maxAge)) return null;
  return last;
}

// Ø in [from, to] – erst ab min Werten aussagekräftig
export function avgBetween(vals, from, to, min = 3) {
  const list = (vals || []).filter((n) => n.day >= from && n.day <= to).map((n) => n.v);
  if (list.length < min) return null;
  return { v: Math.round((list.reduce((s, v) => s + v, 0) / list.length) * 10) / 10, n: list.length };
}

// Vorher / jetzt: Woche vor dem Start gegen die letzten 7 Tage
export function restCompare(vals, startedOn, T) {
  const before = avgBetween(vals, addDays(startedOn, -7), addDays(startedOn, -1));
  const recent = avgBetween(vals, addDays(T, -7), T);
  return { before, recent, delta: before && recent ? Math.round((recent.v - before.v) * 10) / 10 : null };
}

// Texte je nach Quelle
export const REST_TEXT = {
  sleep: { what: 'Ø im Schlaf', recent: 'letzte 7 Nächte', hint: 'Ø Puls im Schlaf, von deiner Withings-Uhr.' },
  day: { what: 'niedrigster am Tag', recent: 'letzte 7 Tage', hint: 'Niedrigster Puls des Tages, solange du die Uhr trägst – meist beim ruhigen Sitzen.' }
};
