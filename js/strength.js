// Krafttraining: Alpha-Progression-CSV einlesen, Einheiten mit Withings zusammenführen,
// Steigerung berechnen. Reine Funktionen, testbar.

import { weekStart, addDays } from './dates.js';
import { dedupeWorkouts, WALKING } from './auto.js';

// ───────────── CSV einlesen ─────────────

// Eine Zeile mit ; als Trenner, Felder optional in "…"
function splitLine(line) {
  const out = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const c = line[i];
    if (quoted) {
      if (c === '"' && line[i + 1] === '"') { cur += '"'; i += 1; }
      else if (c === '"') quoted = false;
      else cur += c;
    } else if (c === '"') quoted = true;
    else if (c === ';') { out.push(cur); cur = ''; }
    else cur += c;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

function numDe(s) {
  if (s == null) return null;
  const t = String(s).trim().replace(/^\+/, '').replace(',', '.');
  if (t === '') return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

// "18 Min." → 18, "1 Std." → 60, "1:01 Std." → 61
export function parseDuration(s) {
  const t = String(s || '').trim();
  let m = t.match(/^(\d+):(\d{1,2})\s*Std/);
  if (m) return Number(m[1]) * 60 + Number(m[2]);
  m = t.match(/^(\d+(?:[.,]\d+)?)\s*Std/);
  if (m) return Math.round(numDe(m[1]) * 60);
  m = t.match(/^(\d+)\s*Min/);
  if (m) return Number(m[1]);
  return null;
}

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})\s+(\d{1,2}):(\d{2})/;
const GOAL_RE = /^\d+(?:[.,]\d+)?\s*(Wdh\.?|Min\.?|s|Sek\.?)$/;
const COLS = { KG: 'kg', WDH: 'reps', SEK: 'sec', 'MIN.': 'min', MIN: 'min', KM: 'km' };

function kindOf(cols) {
  if (cols.includes('kg') && cols.includes('reps')) return 'kg_reps';
  if (cols.includes('km')) return 'distance';
  if (cols.includes('reps')) return 'reps';
  if (cols.includes('sec') || cols.includes('min')) return 'time';
  return 'other';
}

function pad(n) { return String(n).padStart(2, '0'); }

// Liefert { sessions, skipped }. Uhrzeiten aus der CSV sind Ortszeit des Handys.
export function parseAlphaCsv(text) {
  const lines = String(text || '').replace(/^﻿/, '').split(/\r?\n/);
  const sessions = [];
  let session = null;
  let exercise = null;
  let cols = null;
  let skipped = 0;
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) { exercise = null; cols = null; continue; }
    const f = splitLine(line);
    // Kopf einer Einheit: "Titel";"2026-10-09 7:42 Uhr";"18 Min."
    const dm = f.length >= 2 && f[1].match(DATE_RE);
    if (dm) {
      const [, y, mo, d, h, mi] = dm.map(Number);
      const parts = f[0].split(' · ').map((s) => s.trim()).filter(Boolean);
      const local = `${y}-${pad(mo)}-${pad(d)}T${pad(h)}:${pad(mi)}`;
      session = {
        ext_id: `alpha:${local}`,
        title: parts[0] || 'Training',
        program: parts.slice(1).filter((p) => p !== 'Einzelnes Workout').join(' · ') || null,
        started_at: new Date(y, mo - 1, d, h, mi).toISOString(),
        day: `${y}-${pad(mo)}-${pad(d)}`,
        duration_min: parseDuration(f[2]),
        exercises: []
      };
      sessions.push(session);
      exercise = null;
      cols = null;
      continue;
    }
    if (!session) { skipped += 1; continue; }
    // Übung: "2. Curls · Kurzhanteln · 10 Wdh"
    if (f.length === 1 && /^\d+\.\s/.test(f[0])) {
      const parts = f[0].replace(/^\d+\.\s*/, '').split(' · ').map((s) => s.trim());
      const goal = parts.length > 1 && GOAL_RE.test(parts[parts.length - 1]) ? parts.pop() : null;
      exercise = { name: parts[0], equipment: parts[1] || '', kind: 'other', sets: [] };
      if (goal) exercise.goal = goal;
      session.exercises.push(exercise);
      cols = null;
      continue;
    }
    // Spaltenköpfe: #;KG;WDH
    if (f[0] === '#') {
      cols = f.slice(1).map((c) => COLS[c.toUpperCase()] || c.toLowerCase());
      if (exercise) exercise.kind = kindOf(cols);
      continue;
    }
    // Satz: 1;7;20  ·  1;+0;22 (Körpergewicht + Zusatz)  ·  1;5,35;15
    if (exercise && cols && /^\d+$/.test(f[0])) {
      const set = {};
      cols.forEach((c, i) => {
        const v = f[i + 1];
        const n = numDe(v);
        if (n == null) return;
        if (c === 'min') { set.sec = Math.round(n * 60); return; }
        set[c] = n;
        if (c === 'kg' && /^\+/.test(String(v).trim())) set.plus = true;
      });
      exercise.sets.push(set);
      continue;
    }
    skipped += 1;
  }
  // Gleiche Startminute zweimal (sehr selten) → eindeutig machen
  const seen = new Map();
  for (const s of sessions) {
    const n = (seen.get(s.ext_id) || 0) + 1;
    seen.set(s.ext_id, n);
    if (n > 1) s.ext_id += `#${n}`;
  }
  return { sessions, skipped };
}

// Was ist neu, was schon da?
export function importPreview(parsed, existing, workouts = []) {
  const known = new Set(existing.map((s) => s.ext_id));
  const fresh = parsed.filter((s) => !known.has(s.ext_id));
  const days = parsed.map((s) => s.day).sort();
  const names = new Set(parsed.flatMap((s) => s.exercises.map((e) => exerciseKey(e))));
  const matched = matchSessions(fresh.map((s, i) => ({ ...s, id: 'new' + i })), workouts).size;
  return { fresh, known: parsed.length - fresh.length, from: days[0] || null, to: days[days.length - 1] || null, exercises: names.size, matched };
}

// ───────────── Übungen ─────────────

export function exerciseKey(e) {
  return `${e.name}|${e.equipment || ''}`;
}

export function splitKey(key) {
  const i = key.lastIndexOf('|');
  return i < 0 ? { name: key, equipment: '' } : { name: key.slice(0, i), equipment: key.slice(i + 1) };
}

// Alle Vorkommen einer Übung, älteste zuerst
export function exerciseHistory(sessions, key) {
  const out = [];
  for (const s of sessions) {
    for (const e of s.exercises || []) {
      if (exerciseKey(e) === key) out.push({ session: s, day: s.day, started_at: s.started_at, ex: e });
    }
  }
  return out.sort((a, b) => (a.started_at < b.started_at ? -1 : 1));
}

// Geschätztes Maximalgewicht für eine Wiederholung (Epley)
export function oneRm(set) {
  if (!set || set.plus || !(set.kg > 0) || !(set.reps > 0)) return null;
  if (set.reps === 1) return set.kg;
  return Math.round(set.kg * (1 + set.reps / 30) * 10) / 10;
}

export function bestOneRm(ex) {
  const vals = (ex.sets || []).map(oneRm).filter((v) => v != null);
  return vals.length ? Math.max(...vals) : null;
}

export function volume(session) {
  let kg = 0;
  for (const e of session.exercises || []) {
    for (const s of e.sets || []) if (!s.plus && s.kg > 0 && s.reps > 0) kg += s.kg * s.reps;
  }
  return Math.round(kg);
}

// Kurztext für Sätze: "3 × 20 · 7 kg" bzw. "20 · 22 · 22 · 7 kg"
export function setsText(ex) {
  const sets = ex.sets || [];
  if (!sets.length) return '–';
  const n = (v) => String(Math.round(v * 100) / 100).replace('.', ',');
  if (ex.kind === 'kg_reps' || ex.kind === 'reps') {
    const reps = sets.map((s) => s.reps ?? 0);
    const kgs = [...new Set(sets.map((s) => s.kg ?? 0))];
    const same = reps.every((r) => r === reps[0]);
    const r = same ? `${sets.length} × ${reps[0]}` : reps.join(' · ');
    if (ex.kind === 'reps') return r;
    const k = kgs.length === 1 ? (sets[0].plus ? (kgs[0] ? `+${n(kgs[0])} kg` : 'Körpergewicht') : `${n(kgs[0])} kg`) : `${n(Math.min(...kgs))}–${n(Math.max(...kgs))} kg`;
    return `${r} · ${k}`;
  }
  if (ex.kind === 'time') {
    const secs = sets.map((s) => s.sec ?? 0);
    const t = (s) => (s >= 60 && s % 60 === 0 ? `${s / 60} Min` : `${s} s`);
    return secs.every((s) => s === secs[0]) ? `${sets.length} × ${t(secs[0])}` : secs.map(t).join(' · ');
  }
  if (ex.kind === 'distance') {
    return sets.map((s) => `${s.km != null ? n(s.km) + ' km' : ''}${s.sec ? ` in ${Math.round(s.sec / 60)} Min` : ''}`).join(' · ');
  }
  return `${sets.length} Sätze`;
}

// ───────────── Zusammenführen mit Withings ─────────────

const MATCH_WINDOW = 20 * 60000;

// Map: strength-session id → Withings-Training (ohne Gehen, ohne Doppelte). Jedes Training höchstens einmal.
export function matchSessions(sessions, workouts) {
  const pool = dedupeWorkouts(workouts).filter((w) => !WALKING.has(w.category));
  const used = new Set();
  const out = new Map();
  const ordered = sessions.slice().sort((a, b) => (a.started_at < b.started_at ? -1 : 1));
  for (const s of ordered) {
    const ss = new Date(s.started_at).getTime();
    const se = ss + (s.duration_min || 0) * 60000;
    let best = null;
    let bestDiff = Infinity;
    for (const w of pool) {
      if (used.has(w.id)) continue;
      const ws = new Date(w.start_at).getTime();
      const we = new Date(w.end_at).getTime();
      const diff = Math.abs(ws - ss);
      const overlap = Math.min(se, we) - Math.max(ss, ws);
      const shorter = Math.max(60000, Math.min(se - ss, we - ws));
      if (diff > MATCH_WINDOW && overlap <= shorter / 2) continue;
      if (diff < bestDiff) { best = w; bestDiff = diff; }
    }
    if (best) { used.add(best.id); out.set(s.id, best); }
  }
  return out;
}

// Trainingsliste mit Alpha: Withings-Trainings bekommen ihre Einheit angehängt,
// Einheiten ohne Uhr erscheinen als eigenes Krafttraining.
export function mergeTrainings(workouts, sessions) {
  if (!sessions || !sessions.length) return workouts;
  const map = matchSessions(sessions, workouts);
  const byWorkout = new Map();
  for (const s of sessions) {
    const w = map.get(s.id);
    if (w) byWorkout.set(w.id, s);
  }
  const merged = workouts.map((w) => (byWorkout.has(w.id) ? { ...w, strength: byWorkout.get(w.id) } : w));
  for (const s of sessions) {
    if (map.has(s.id)) continue;
    const start = new Date(s.started_at);
    const mins = s.duration_min || 0;
    merged.push({
      id: 'a:' + s.id, ext_id: s.ext_id, day: s.day, start_at: s.started_at,
      end_at: new Date(start.getTime() + mins * 60000).toISOString(),
      category: 16, duration_min: mins, calories: null, hr_avg: null, hr_max: null, data: {},
      alphaOnly: true, strength: s
    });
  }
  return merged;
}

export function sessionTitle(w) {
  return w.strength ? w.strength.title : null;
}

// ───────────── Steigerung ─────────────

function weekOk(entries, target) {
  return entries.some((h) => {
    const good = (h.ex.sets || []).filter((s) => (s.kg ?? 0) >= target.kg - 1e-9 && (s.reps ?? 0) >= target.reps).length;
    return good >= target.sets;
  });
}

function round1(n) { return Math.round(n * 100) / 100; }

// Spielt den Plan Woche für Woche durch.
// Geschafft (alle Sätze mit mind. dem Zielgewicht erreichen die Ziel-Wiederholungen) → Stufe hält bzw. steigt.
// Nicht geschafft → Stufe wird wiederholt. Woche ohne diese Übung → zählt nicht.
export function progress(plan, history, T) {
  const p = {
    sets: Number(plan.sets), start: Number(plan.start_reps), kg: Number(plan.kg), plus: Number(plan.plus_reps),
    every: Math.max(1, Number(plan.every_weeks)), max: Number(plan.max_reps), kgStep: Number(plan.kg_step)
  };
  const byWeek = new Map();
  for (const h of history) {
    const wk = weekStart(h.day);
    if (!byWeek.has(wk)) byWeek.set(wk, []);
    byWeek.get(wk).push(h);
  }
  let reps = p.start;
  let kg = p.kg;
  let streak = 0;
  const weeks = new Map();
  const nowWeek = weekStart(T);
  const first = weekStart(plan.started_on);
  for (let wk = first; wk <= nowWeek; wk = addDays(wk, 7)) {
    const target = { reps, kg, sets: p.sets, consolidating: streak > 0 };
    const entries = byWeek.get(wk) || [];
    const result = entries.length ? (weekOk(entries, target) ? 'done' : 'missed') : 'none';
    weeks.set(wk, { ...target, result });
    if (wk === nowWeek) break; // laufende Woche: Ziel bleibt bis Sonntag stehen
    if (result === 'done') {
      streak += 1;
      if (streak >= p.every) {
        streak = 0;
        reps += p.plus;
        if (reps > p.max) { reps = p.start; kg = round1(kg + p.kgStep); }
      }
    }
  }
  const current = weeks.get(nowWeek) || { reps, kg, sets: p.sets, consolidating: streak > 0, result: 'none' };
  // Wie geht es weiter, wenn diese Woche klappt?
  let nr = current.reps;
  let nk = current.kg;
  let ns = streak + 1;
  if (ns >= p.every) { ns = 0; nr += p.plus; if (nr > p.max) { nr = p.start; nk = round1(nk + p.kgStep); } }
  return {
    weeks,
    current: { ...current, done: current.result === 'done' },
    next: { reps: nr, kg: nk, consolidating: ns > 0 },
    ladder: ladder(p, current.reps, streak, current.kg),
    weeksToNextKg: weeksLeft(p, current.reps, streak)
  };
}

function weeksLeft(p, reps, streak) {
  const levels = Math.floor((p.max - reps) / p.plus);
  return levels * p.every + (p.every - streak);
}

// Leiter für das aktuelle Gewicht: jede Stufe so oft, wie Wochen pro Stufe
function ladder(p, reps, streak, kg) {
  const all = [];
  for (let r = p.start; r <= p.max; r += p.plus) for (let i = 0; i < p.every; i += 1) all.push(r);
  const pos = Math.round(((reps - p.start) / p.plus) * p.every + streak);
  let items = all.map((r, i) => ({ txt: String(r), state: i < pos ? 'done' : (i === pos ? 'now' : 'next') }));
  if (items.length > 10) {
    const from = Math.max(0, pos - 2);
    const to = Math.min(items.length - 1, pos + 4);
    const mid = items.slice(from, to + 1);
    items = [...(from > 0 ? [{ txt: '…', state: 'done' }] : []), ...mid,
      ...(to < items.length - 2 ? [{ txt: '…', state: 'next' }] : []),
      ...(to < items.length - 1 ? [items[items.length - 1]] : [])];
  }
  const step = String(round1(p.kgStep)).replace('.', ',');
  items.push({ txt: `+${step} kg`, state: 'next', kg: round1(kg + p.kgStep) });
  return items;
}

// Vorschau im Plan-Formular: die ganze Leiter ab Start
export function planPreview(plan) {
  const p = {
    start: Number(plan.start_reps), plus: Number(plan.plus_reps), every: Math.max(1, Number(plan.every_weeks)),
    max: Number(plan.max_reps), kgStep: Number(plan.kg_step)
  };
  const items = ladder(p, p.start, 0, Number(plan.kg));
  const nextKg = round1(Number(plan.kg) + p.kgStep);
  return { items, nextKg, weeks: weeksLeft(p, p.start, 0) };
}

// Vorschlag für einen neuen Plan aus dem Verlauf
export function suggestPlan(history, T) {
  const withKg = history.filter((h) => h.ex.kind === 'kg_reps' && (h.ex.sets || []).length);
  const last = withKg[withKg.length - 1];
  if (!last) return null;
  const kg = Math.max(...last.ex.sets.map((s) => s.kg ?? 0));
  const atKg = last.ex.sets.filter((s) => (s.kg ?? 0) >= kg);
  const start = Math.max(1, Math.min(...atKg.map((s) => s.reps ?? 0)));
  // Ab wann wird mit diesem Gewicht trainiert? Rückwärts suchen, solange das Gewicht gleich bleibt.
  let firstDay = last.day;
  for (let i = withKg.length - 1; i >= 0; i -= 1) {
    const top = Math.max(...withKg[i].ex.sets.map((s) => s.kg ?? 0));
    if (top < kg) break;
    firstDay = withKg[i].day;
  }
  const equipment = last.ex.equipment || '';
  return {
    exercise: last.ex.name,
    equipment,
    sets: atKg.length,
    start_reps: start,
    kg,
    plus_reps: 2,
    every_weeks: 2,
    max_reps: start < 40 ? 40 : start + 10,
    kg_step: /Kurzhantel/.test(equipment) ? 2 : 2.5,
    // höchstens 8 Wochen zurück – ältere Wochen folgten einem anderen Schema
    started_on: weekStart(firstDay < addDays(last.day, -56) ? addDays(last.day, -56) : firstDay)
  };
}

// Zielvergleich für eine einzelne Einheit (Pille in der Einheit)
export function sessionTarget(plan, history, entry, T) {
  if (!plan) return null;
  const res = progress(plan, history, T);
  const wk = res.weeks.get(weekStart(entry.day));
  if (!wk) return null;
  const ok = weekOk([entry], wk);
  return { reps: wk.reps, kg: wk.kg, sets: wk.sets, ok };
}
