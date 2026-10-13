// Statistik-Logik: reine Funktionen ohne Datenbank oder Oberfläche, damit sie testbar bleiben.
//
// Grundregeln (siehe Konzept):
// - Mini zählt als geschafft.
// - Pausentage zählen nicht in die Quote – weder als geschafft noch als verpasst.
// - Der heutige Tag kann die Quote nur verbessern: Er zählt erst mit, wenn er geschafft ist.
// - Vor dem Starttag einer Gewohnheit zählt nichts.

import { addDays, diffDays, weekday, weekStart, monthStart, monthKey, daysInMonth, eachDay, WEEKDAYS_SHORT } from './dates.js';

export function isHit(log) {
  return !!log && (log.status === 'done' || log.status === 'mini');
}

// logs → Map(habit_id → Map(day → log))
export function indexLogs(logs) {
  const idx = new Map();
  for (const l of logs) {
    if (!idx.has(l.habit_id)) idx.set(l.habit_id, new Map());
    idx.get(l.habit_id).set(l.day, l);
  }
  return idx;
}

export function logOf(idx, habitId, day) {
  const m = idx.get(habitId);
  return m ? m.get(day) || null : null;
}

export function isPaused(habit, day, pauses) {
  for (const p of pauses) {
    if ((p.habit_id == null || p.habit_id === habit.id) && p.start_day <= day && day <= p.end_day) return true;
  }
  return false;
}

export function isPeriodic(habit) {
  return habit.schedule === 'per_week' || habit.schedule === 'per_month';
}

// Ziel pro Woche/Monat
export function periodTarget(h) {
  return h.schedule_count || 1;
}

// Ab wie vielen Treffern der Zeitraum als geschafft zählt (Mini-Woche / Mini-Monat)
export function periodMin(h) {
  const t = periodTarget(h);
  return h.schedule_min && h.schedule_min < t ? h.schedule_min : t;
}

export function hasMiniPeriod(h) {
  return isPeriodic(h) && periodMin(h) < periodTarget(h);
}

export function miniPeriodName(h) {
  return h.schedule === 'per_month' ? 'Mini-Monat' : 'Mini-Woche';
}

// Ziel und Minimum für einen konkreten Zeitraum: Pausentage und Tage vor dem Start senken beides anteilig.
// Beispiel: 5×/Woche, Mini 3, aber 3 Tage Pause → 4 von 7 Tagen → Ziel 3, Mini 2.
export function periodNeeds(h, from, to, pauses) {
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

export function periodState(h, n, needs = { target: periodTarget(h), min: periodMin(h) }) {
  if (n >= needs.target) return 'goal';
  if (hasMiniPeriod(h) && n >= needs.min) return 'mini';
  return 'open';
}

// Ist die Gewohnheit an diesem Tag fällig? (nur für tägliche / bestimmte Tage)
export function isDueOn(habit, day) {
  if (day < habit.start_day) return false;
  if (habit.schedule === 'daily') return true;
  if (habit.schedule === 'weekdays') return (habit.schedule_days || []).includes(weekday(day));
  return false;
}

function periodBounds(habit, day) {
  if (habit.schedule === 'per_week') return [weekStart(day), addDays(weekStart(day), 6)];
  const start = monthStart(day);
  return [start, addDays(start, daysInMonth(day) - 1)];
}

// Treffer im laufenden Zeitraum (Woche/Monat) – optional nur vor einem bestimmten Tag
export function periodHits(habit, idx, day, { before = false } = {}) {
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

export function stateOf(log) {
  if (!log) return 'open';
  return log.status; // 'done' | 'mini' | 'partial'
}

// Die Liste für „Heute“: was heute dran ist, und ob es im Heute-Ring mitzählt.
export function todayItems(habits, idx, pauses, day) {
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
      const word = h.schedule === 'per_week' ? 'diese Woche' : 'diesen Monat';
      const n = before + (isHit(log) ? 1 : 0);
      const state = periodState(h, n, needs);
      // Im Alltag steht immer das echte Ziel – die Mini-Woche schützt nur in Ringen und Quote.
      sub = `${word} ${n} von ${target}`;
      if (state === 'goal') sub += ' · Ziel erreicht';
      else if (state === 'mini') sub += ` · noch ${target - n} bis zum Ziel`;
      else if (hasMiniPeriod(h)) sub += ` · noch ${min - n} bis zur ${miniPeriodName(h)}`;
      // Für den Heute-Ring zählt es nur, solange das Minimum noch offen ist (oder heute geschafft wurde).
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

// Reihenfolge in „Heute“: Offenes oben, Erledigtes (oder Wochenziel schon erreicht) darunter, Pausiertes ganz unten.
// Innerhalb der Gruppen bleibt die eigene Reihenfolge erhalten.
export function sortTodayItems(items) {
  const rank = (i) => {
    if (i.paused) return 2;
    if (i.hit || (i.period && i.period.state === 'goal')) return 1;
    return 0;
  };
  return items.map((i, n) => ({ i, n })).sort((a, b) => rank(a.i) - rank(b.i) || a.n - b.n).map((x) => x.i);
}

export function todayRing(items) {
  const counted = items.filter((i) => i.counted);
  return { done: counted.filter((i) => i.hit).length, due: counted.length };
}

// Quote über ein rollierendes Fenster (z. B. letzte 7 oder 30 Tage, inklusive heute)
export function windowQuota(habits, idx, pauses, endDay, days) {
  const from = addDays(endDay, -(days - 1));
  let hits = 0;
  let expected = 0;
  for (const h of habits) {
    if (h.archived) continue;
    if (isPeriodic(h)) {
      let active = 0;
      let got = 0;
      for (const d of eachDay(from, endDay)) {
        if (d < h.start_day || isPaused(h, d, pauses)) continue;
        const hit = isHit(logOf(idx, h.id, d));
        if (d === endDay && !hit) continue; // heute zählt erst, wenn geschafft
        active += 1;
        if (hit) got += 1;
      }
      // Erwartet wird das Minimum (Mini-Woche) – alles darüber zählt in der Gesamtzahl, nicht über 100 %.
      const perDay = periodMin(h) / (h.schedule === 'per_week' ? 7 : 30.44);
      const exp = active * perDay;
      expected += exp;
      hits += Math.min(got, exp);
    } else {
      for (const d of eachDay(from, endDay)) {
        if (!isDueOn(h, d) || isPaused(h, d, pauses)) continue;
        const hit = isHit(logOf(idx, h.id, d));
        if (d === endDay && !hit) continue;
        expected += 1;
        if (hit) hits += 1;
      }
    }
  }
  const pct = expected > 0 ? Math.round((hits / expected) * 100) : null;
  return { hits, expected, pct };
}

// Die Zahl, die nur wachsen kann
export function totalHits(logs) {
  let n = 0;
  for (const l of logs) if (isHit(l)) n += 1;
  return n;
}

export function lastActivityDay(logs) {
  let last = null;
  for (const l of logs) if (!last || l.day > last) last = l.day;
  return last;
}

export function scheduleText(h) {
  switch (h.schedule) {
    case 'daily': return 'täglich';
    case 'weekdays': {
      const days = (h.schedule_days || []).slice().sort((a, b) => a - b);
      if (days.length === 0) return 'keine Tage gewählt';
      if (days.length === 7) return 'täglich';
      return days.map((d) => WEEKDAYS_SHORT[d - 1]).join(', ');
    }
    case 'per_week': return `${h.schedule_count || 1}× pro Woche`;
    case 'per_month': return `${h.schedule_count || 1}× pro Monat`;
    default: return '';
  }
}

// Detail-Statistik für eine Gewohnheit
export function habitStats(h, idx, pauses, day) {
  const m = idx.get(h.id) || new Map();
  let total = 0;
  let last30 = 0;
  const from30 = addDays(day, -29);
  const perMonth = new Map();
  for (const [d, log] of m) {
    if (!isHit(log)) continue;
    total += 1;
    if (d >= from30 && d <= day) last30 += 1;
    const k = monthKey(d);
    perMonth.set(k, (perMonth.get(k) || 0) + 1);
  }
  let best = null;
  for (const [k, n] of perMonth) {
    if (!best || n > best.count) best = { key: k, count: n, keys: [k] };
    else if (n === best.count) best.keys.push(k);
  }
  // letzte 6 Monate inkl. laufendem
  const months = [];
  let cursor = monthStart(day);
  for (let i = 0; i < 6; i += 1) {
    const k = monthKey(cursor);
    months.unshift({ key: k, count: perMonth.get(k) || 0, running: i === 0 });
    cursor = monthStart(addDays(cursor, -1));
  }
  // Kalender für den laufenden Monat
  const start = monthStart(day);
  const n = daysInMonth(day);
  const cells = [];
  for (let i = 0; i < n; i += 1) {
    const d = addDays(start, i);
    const log = m.get(d) || null;
    let state;
    if (d > day) state = 'future';
    else if (d < h.start_day) state = 'before';
    else if (isHit(log)) state = log.status === 'mini' ? 'mini' : 'done';
    else if (isPaused(h, d, pauses)) state = 'paused';
    else if (isPeriodic(h) || isDueOn(h, d)) state = 'open';
    else state = 'free';
    cells.push({ day: d, n: i + 1, state, today: d === day });
  }
  const monthDays = Number(day.slice(8, 10));
  const monthQuota = windowQuota([h], idx, pauses, day, monthDays);
  const periods = isPeriodic(h) ? periodSummary(h, idx, pauses, day, h.schedule === 'per_week' ? 8 : 6) : null;
  return { total, last30, best, months, cells, offset: weekday(start) - 1, monthQuota, periods, hint: patternHint(h, idx, pauses, day) };
}

// ISO-Kalenderwoche
export function isoWeek(day) {
  const thursday = addDays(day, 4 - weekday(day));
  const jan1 = thursday.slice(0, 4) + '-01-01';
  return Math.floor(diffDays(jan1, thursday) / 7) + 1; // diffDays rundet – robust gegen Zeitumstellung
}

// Die letzten Wochen bzw. Monate einer „X-mal pro …“-Gewohnheit, älteste zuerst
export function periodSummary(h, idx, pauses, day, count) {
  const out = [];
  let ref = day;
  for (let i = 0; i < count; i += 1) {
    const [from, to] = periodBounds(h, ref);
    const running = from <= day && day <= to;
    let hits = 0;
    let activeDays = 0;
    for (const d of eachDay(from, to)) {
      if (d < h.start_day || d > day) continue;
      if (isPaused(h, d, pauses)) continue;
      activeDays += 1;
      if (isHit(logOf(idx, h.id, d))) hits += 1;
    }
    const needs = periodNeeds(h, from, to, pauses);
    let state;
    if (to < h.start_day) state = 'before';
    else if (running) state = 'running';
    else if (activeDays === 0) state = 'paused';
    else {
      const ps = periodState(h, hits, needs);
      state = ps === 'open' ? 'missed' : ps;
    }
    const label = h.schedule === 'per_week' ? `KW ${isoWeek(from)}` : `${from.slice(5, 7)}/${from.slice(2, 4)}`;
    out.unshift({ from, to, label, hits, state, target: needs.target, min: needs.min });
    ref = addDays(from, -1);
  }
  const done = out.filter((p) => p.state === 'goal' || p.state === 'mini').length;
  const judged = out.filter((p) => p.state === 'goal' || p.state === 'mini' || p.state === 'missed').length;
  return { list: out, done, judged };
}

// Freundlicher Hinweis: mehrere Mini-Wochen am Stück → passt das Ziel noch?
export function patternHint(h, idx, pauses, day, threshold = 4) {
  if (!hasMiniPeriod(h)) return null;
  const list = periodSummary(h, idx, pauses, day, threshold + 8).list;
  let streak = 0;
  for (let i = list.length - 1; i >= 0; i -= 1) {
    const s = list[i].state;
    if (s === 'running' || s === 'paused') continue;
    if (s === 'mini') streak += 1;
    else break;
  }
  if (streak < threshold) return null;
  const weekly = h.schedule === 'per_week';
  return { count: streak, word: weekly ? 'Wochen' : 'Monate', name: weekly ? 'Mini-Wochen' : 'Mini-Monate' };
}
