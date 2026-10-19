// „Weniger von …“ – Rauchen weniger werden lassen. Reine Funktionen, getestet.
// Ablauf: erste Woche nur zählen → Ausgangswert. Danach wächst ein Abstand langsam (Nachtruhe zählt nicht).
// Gespartes wächst nur: jeder abgeschlossene Tag unter dem Ausgangswert zählt, ein Tag darüber nimmt nichts weg.

import { addDays, diffDays, toDay } from './dates.js';

export const WATCH_DAYS = 7;
export const DEFAULT_COSTS = { tobacco_price: 6.75, tobacco_g: 30, paper_price: 2, paper_qty: 100, filter_price: 2, filter_qty: 120, g_per_unit: 0.6 };

const num = (v, d = 0) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : d);

// Kosten pro Zigarette in Euro (aus Tabak pro Gramm, Blättchen und Filter)
export function costPerUnit(costs = {}) {
  const c = { ...DEFAULT_COSTS, ...costs };
  const tobacco = num(c.tobacco_g) ? (num(c.tobacco_price) / num(c.tobacco_g)) * num(c.g_per_unit) : 0;
  const paper = num(c.paper_qty) ? num(c.paper_price) / num(c.paper_qty) : 0;
  const filter = num(c.filter_qty) ? num(c.filter_price) / num(c.filter_qty) : 0;
  return { total: tobacco + paper + filter, tobacco, paper, filter, perPack: num(c.g_per_unit) ? num(c.tobacco_g) / num(c.g_per_unit) : 0 };
}

// „23:00“ → Minuten nach Mitternacht
export const hm = (s) => { const [h, m] = String(s || '0:0').split(':').map(Number); return (h || 0) * 60 + (m || 0); };
const minutesOf = (d) => d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60;

export function isNight(date, nightFrom = '23:00', nightTo = '07:00') {
  const m = minutesOf(date); const a = hm(nightFrom); const b = hm(nightTo);
  return a > b ? (m >= a || m < b) : (m >= a && m < b);
}

// Wache Minuten zwischen zwei Zeitpunkten (Nachtruhe wird ausgelassen) – in 5-Minuten-Schritten genau genug
export function awakeMinutes(from, to, nightFrom = '23:00', nightTo = '07:00') {
  const start = new Date(from).getTime(); const end = new Date(to).getTime();
  if (!(end > start)) return 0;
  const STEP = 60000; // Minute
  let n = 0;
  // Lange Pausen (Tage) nicht minutenweise zählen: volle Tage × wache Minuten pro Tag, nur den Rest genau
  const DAY = 86400000;
  const fullDays = Math.max(0, Math.floor((end - start) / DAY) - 1);
  if (fullDays > 0) {
    const a = hm(nightFrom); const b = hm(nightTo);
    const nightLen = a > b ? 1440 - a + b : b - a;
    n += fullDays * (1440 - nightLen);
  }
  for (let t = start + fullDays * DAY; t < end; t += STEP) {
    if (!isNight(new Date(t), nightFrom, nightTo)) n += Math.min(1, (end - t) / STEP);
  }
  return n;
}

// Zählungen pro Kalendertag
export function countsByDay(events) {
  const m = new Map();
  for (const e of events || []) m.set(e.day, (m.get(e.day) || 0) + 1);
  return m;
}

// Phase: erste Woche (nur zählen) oder Abstand
export function phase(settings, T) {
  if (!settings) return null;
  const day = diffDays(settings.started_on, T) + 1;
  if (day <= WATCH_DAYS) return { name: 'watch', day: Math.max(1, day) };
  return { name: 'interval', week: Math.floor((day - WATCH_DAYS - 1) / 7) + 1, since: addDays(settings.started_on, WATCH_DAYS) };
}

// Ausgangswert aus der ersten Woche: Ø pro Tag und Ø Abstand (nur Abstände am selben wachen Tag)
export function baseline(events, settings) {
  if (!settings) return null;
  const from = settings.started_on;
  const to = addDays(from, WATCH_DAYS - 1);
  const inWeek = (events || []).filter((e) => e.day >= from && e.day <= to).sort((a, b) => (a.at < b.at ? -1 : 1));
  const perDay = inWeek.length / WATCH_DAYS;
  const gaps = [];
  for (let i = 1; i < inWeek.length; i += 1) {
    if (inWeek[i].day !== inWeek[i - 1].day) continue;
    const g = awakeMinutes(inWeek[i - 1].at, inWeek[i].at, settings.night_from, settings.night_to);
    if (g > 0) gaps.push(g);
  }
  const gap = gaps.length ? gaps.reduce((s, v) => s + v, 0) / gaps.length : null;
  return { perDay: Math.round(perDay * 10) / 10, gap: gap == null ? null : Math.round(gap), count: inWeek.length };
}

// Aktueller Abstand: Ausgangsabstand (auf 5 Min gerundet) + Woche × Schritt + eigene Korrektur
export function currentInterval(base, settings, T) {
  const p = phase(settings, T);
  if (!p || p.name !== 'interval' || !base || !base.gap) return null;
  const start = Math.max(15, Math.round(base.gap / 5) * 5);
  const minutes = Math.max(10, start + (p.week - 1) * (settings.step_min || 0) + (settings.adjust_min || 0));
  return { minutes, next: minutes + (settings.step_min || 0), week: p.week };
}

// Timer: wie viele wache Minuten seit der letzten, wie viele bis zum Abstand
export function timer(events, intervalMin, now, settings) {
  const last = (events || []).reduce((m, e) => (!m || e.at > m.at ? e : m), null);
  const night = isNight(now, settings.night_from, settings.night_to);
  if (!last) return { last: null, since: null, left: null, night };
  const since = Math.floor(awakeMinutes(last.at, now, settings.night_from, settings.night_to));
  return { last, since, left: intervalMin == null ? null : Math.ceil(intervalMin - since), night };
}

// Gespartes seit Beginn der Abstand-Phase: nur abgeschlossene Tage, nur Tage unter dem Ausgangswert
export function savings(events, base, settings, T, unitCost) {
  const p = phase(settings, T);
  if (!p || p.name !== 'interval' || !base) return { units: 0, euro: 0 };
  const counts = countsByDay(events);
  let units = 0;
  for (let d = p.since; d < T; d = addDays(d, 1)) units += Math.max(0, base.perDay - (counts.get(d) || 0));
  units = Math.round(units * 10) / 10;
  return { units, euro: Math.round(units * unitCost * 100) / 100 };
}

// Ø der letzten n abgeschlossenen Tage (heute zählt noch nicht)
export function recentAvg(events, T, n = 7, notBefore = '0000-00-00') {
  const counts = countsByDay(events);
  let sum = 0; let days = 0;
  for (let i = 1; i <= n; i += 1) {
    const d = addDays(T, -i);
    if (d < notBefore) break;
    sum += counts.get(d) || 0; days += 1;
  }
  return days ? Math.round((sum / days) * 10) / 10 : null;
}

// Neues Ereignis „jetzt“
export const newEvent = (kind = 'rauchen', now = new Date()) => ({ kind, at: now.toISOString(), day: toDay(now) });

// Was das Rauchen kostet: ausgegeben seit Start und hochgerechnet (Tag, Monat, Jahr).
// Basis „recent“ = Ø der letzten 7 abgeschlossenen Tage, „start“ = Ø seit Start. Heute zählt beim Schnitt noch nicht.
export function costStats(events, settings, T, unitCost, basis = 'recent') {
  if (!settings) return null;
  const counts = countsByDay(events);
  let units = 0;
  for (const [d, n] of counts) if (d >= settings.started_on && d <= T) units += n;
  let sum = 0; let days = 0;
  for (let d = settings.started_on; d < T; d = addDays(d, 1)) { sum += counts.get(d) || 0; days += 1; }
  const sinceStart = days ? sum / days : null;
  const recent = recentAvg(events, T, 7, settings.started_on);
  const rate = basis === 'start' ? sinceStart : (recent ?? sinceStart);
  const r2 = (v) => Math.round(v * 100) / 100;
  return {
    spent: { units, euro: r2(units * unitCost) },
    days,
    rate: rate == null ? null : Math.round(rate * 10) / 10,
    perDay: rate == null ? null : r2(rate * unitCost),
    perMonth: rate == null ? null : Math.round(rate * unitCost * 30.4),
    perYear: rate == null ? null : Math.round(rate * unitCost * 365)
  };
}

// Plan-Kurve: Was kostet ein Monat, wenn der Abstand weiter nach Plan wächst?
// Grobes Modell: wache Minuten pro Tag ÷ Abstand = Zigaretten, die noch Platz haben (höchstens der Ausgangswert).
// Kein Versprechen, keine Frist – bleibt der Abstand länger gleich, wird die Kurve flacher.
export function planProjection(base, settings, T, unitCost, months = 12) {
  if (!settings || !base || !base.gap || !base.perDay) return null;
  const a = hm(settings.night_from); const b = hm(settings.night_to);
  const awake = 1440 - (a > b ? 1440 - a + b : b - a);
  const out = [];
  for (let m = 0; m <= months; m += 1) {
    const day = addDays(T, Math.round(m * 30.4));
    const iv = currentInterval(base, settings, day);
    const units = iv ? Math.min(base.perDay, awake / iv.minutes) : base.perDay;
    out.push({ m, day, interval: iv ? iv.minutes : null, units: Math.round(units * 10) / 10, euro: Math.round(units * unitCost * 30.4) });
  }
  return out;
}
