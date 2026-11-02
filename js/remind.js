// Erinnerung: reine Funktionen, testbar. Wird auch von der Edge Function „erinnerung“ benutzt
// (die lädt diese Datei von GitHub Pages) – darum keine Abhängigkeit vom Browser.
//
// Regeln (siehe Mockup „Erinnerungen“):
// - eine Nachricht am Tag, nur wenn etwas offen ist
// - Pausentag für alles → still; pausierte Gewohnheit → nicht dabei
// - Zahlen von der Uhr (Schritte & Co.) bleiben draußen; Training mit Auto-Abhaken darf erinnert werden
// - Woche/Monat: erst dabei, wenn es knapp wird (noch genau so viele freie Tage wie fehlende Male)
// - Mini zählt als geschafft

import { todayItems, indexLogs, isPaused, isPeriodic, isHit, logOf } from './stats.js';
import { eachDay, weekStart, addDays, monthStart, daysInMonth } from './dates.js';
import { weekChanges, changeText, isStrengthHabit } from './strength.js';
import { workoutCounts } from './auto.js';

export { weekChanges }; // auch für die Edge Function (eingebettete Kopie)

export const DEFAULT_TIME = 20 * 60; // Minuten seit Mitternacht
export const MIN_USUAL = 5; // ab so vielen Einträgen zeigt die App „meist gegen“
export const USUAL_DAYS = 14;

// Zahlen von der Uhr (Schritte, Minuten, Strecke) wachsen von selbst – daran erinnern ergibt keinen Sinn.
// Gewohnheiten, die sich nach einem Training selbst abhaken (Withings-Trainingsart), sind vorher offen: die dürfen erinnert werden.
export const isAuto = (h) => !!h.auto_metric;
export const remindable = (h) => !h.archived && !isAuto(h) && h.remind !== false;
export const hasMini = (h) => !!(h.mini_text || h.mini_value != null);
// Eigene Erinnerung 30 Minuten vor „meist gegen …“ (pro Gewohnheit, Mockup „meist gegen“)
export const USUAL_LEAD = 30;
export const remindsUsual = (h) => remindable(h) && h.remind_mode === 'usual';

export function allPaused(pauses, day) {
  return pauses.some((p) => p.habit_id == null && p.start_day <= day && day <= p.end_day);
}

function periodEnd(h, day) {
  if (h.schedule === 'per_week') return addDays(weekStart(day), 6);
  return addDays(monthStart(day), daysInMonth(day) - 1);
}

// Was ist heute noch offen? → [{ habit, name, need, word }] (need nur bei Woche/Monat)
export function openForReminder(habits, logs, pauses, day) {
  if (allPaused(pauses, day)) return [];
  const idx = indexLogs(logs);
  const out = [];
  for (const it of todayItems(habits.filter(remindable), idx, pauses, day)) {
    const h = it.habit;
    if (it.paused || it.hit) continue;
    if (h.remind_mode === 'usual' && h.remind_last === day) continue; // kam heute schon zur üblichen Zeit
    if (!isPeriodic(h)) { out.push({ habit: h, name: h.name }); continue; }
    const p = periodOpen(h, it, pauses, day);
    if (p && p.tight) out.push({ habit: h, name: h.name, need: p.need, word: p.word });
  }
  return out;
}

// Woche/Monat: wie viel fehlt noch, und wird es knapp (noch genau so viele freie Tage wie fehlende Male)?
function periodOpen(h, it, pauses, day) {
  const need = it.period.min - it.period.n;
  if (need <= 0) return null;
  let free = 0;
  for (const d of eachDay(day, periodEnd(h, day))) if (!isPaused(h, d, pauses)) free += 1;
  return { need, tight: free <= need, word: h.schedule === 'per_week' ? 'diese Woche' : 'diesen Monat' };
}

// Ist das „sein“ Wochentag? An mindestens 2 der letzten 4 gleichen Wochentage geschafft.
export function usualWeekday(idx, habitId, day) {
  let n = 0;
  for (let k = 1; k <= 4; k += 1) if (isHit(logOf(idx, habitId, addDays(day, -7 * k)))) n += 1;
  return n >= 2;
}

// Eigene Erinnerungen, die jetzt dran sind → [{ habit, name, at, usual, need?, word? }]
// Fenster: ab 30 Min. vor „meist gegen“ bis 90 Min. danach (falls der Zeitplan hängt); einmal am Tag (remind_last).
// Woche/Monat: nur an Tagen, an denen man es meist macht – oder wenn es knapp wird.
export function usualDueNow(habits, logs, pauses, day, nowMin, localOf = browserLocal, workouts = []) {
  if (allPaused(pauses, day)) return [];
  const idx = indexLogs(logs);
  const out = [];
  for (const it of todayItems(habits.filter(remindsUsual), idx, pauses, day)) {
    const h = it.habit;
    if (h.remind_last === day || it.paused || it.hit) continue;
    const u = usualFor(h, logs, workouts, day, localOf);
    if (u.min == null) continue; // lernt noch – bis dahin in der Abend-Nachricht
    const at = Math.max(0, u.min - USUAL_LEAD);
    if (nowMin < at || nowMin >= at + 90) continue;
    if (!isPeriodic(h)) { out.push({ habit: h, name: h.name, at, usual: u.min }); continue; }
    const p = periodOpen(h, it, pauses, day);
    if (!p || !(p.tight || usualWeekday(idx, h.id, day))) continue;
    out.push({ habit: h, name: h.name, at, usual: u.min, need: p.need, word: p.word });
  }
  return out;
}

// Text der eigenen Erinnerung: Titel = Name der Gewohnheit
export function usualText(o, changes = []) {
  let body = o.need ? `Meist um diese Zeit – noch ${o.need}× ${o.word}.` : `Meist machst du das gegen ${timeText(o.usual)}.`;
  const note = trainingNote([o], changes);
  if (note) body += ` ${note}.`;
  if (hasMini(o.habit)) body += ' Mini zählt auch 🙂';
  return { title: o.name, body };
}

const listNames = (names) => {
  if (names.length <= 4) return names.join(', ');
  return `${names.slice(0, 3).join(', ')} und ${names.length - 3} weitere`;
};

// „↑ Diese Woche höher: …“ – nur, wenn die Sport-Gewohnheit offen ist und ein Plan diese Woche steigt
export function trainingNote(open, changes = []) {
  if (!changes.length || !open.some((o) => isStrengthHabit(o.habit))) return '';
  const list = changes.slice(0, 2).map(changeText);
  if (changes.length > 2) list.push(`und ${changes.length - 2} weitere`);
  return `↑ Diese Woche höher: ${list.join(', ')}`;
}

// Text der Nachricht – null, wenn nichts offen ist
export function reminderText(open, changes = []) {
  if (!open.length) return null;
  const daily = open.filter((o) => !o.need);
  const periodic = open.filter((o) => o.need);
  const parts = [];
  if (daily.length) parts.push(listNames(daily.map((o) => o.name)) + (periodic.length ? ' heute' : ''));
  for (const o of periodic) parts.push(`${o.name} – noch ${o.need}× ${o.word}`);
  let body = parts.join(' · ');
  if (!/[.!?]$/.test(body)) body += '.';
  const note = trainingNote(open, changes);
  if (note) body += ` ${note}.`;
  if (open.some((o) => hasMini(o.habit))) body += ' Mini zählt auch 🙂';
  return { title: periodic.length ? 'Noch offen' : 'Noch offen heute', body };
}

// Uhrzeit-Hilfen
export function timeText(min) {
  const m = ((Math.round(min) % 1440) + 1440) % 1440;
  return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`;
}

export function parseTime(text) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(text || '').trim());
  if (!m) return null;
  const h = Number(m[1]);
  const mm = Number(m[2]);
  if (h > 23 || mm > 59) return null;
  return h * 60 + mm;
}

// Ist die Erinnerung jetzt fällig? Bis 3 Stunden nach der Uhrzeit wird nachgeholt (falls der Zeitplan mal hängt),
// danach nicht mehr – wer um 22 Uhr einschaltet, bekommt die 8-Uhr-Erinnerung erst morgen.
export function isDue(remindAt, nowMin, lastDay, today) {
  if (remindAt == null || lastDay === today) return false;
  return nowMin >= remindAt && nowMin < remindAt + 180;
}

// „meist gegen 7:40“ – aus Einträgen der letzten 14 Tage, die am selben Tag von Hand abgehakt wurden.
// Gibt { n, min } zurück; min ist null, solange es weniger als MIN_USUAL Einträge gibt.
// localOf(iso) → { day, min } in der Zeitzone des Geräts (für Tests austauschbar).
export function usualTime(logs, habitId, today, localOf = browserLocal) {
  const from = addDays(today, -(USUAL_DAYS - 1));
  const mins = [];
  for (const l of logs) {
    if (l.habit_id !== habitId || !l.created_at || l.source) continue;
    if (l.day < from || l.day > today) continue;
    if (l.status !== 'done' && l.status !== 'mini') continue;
    const at = localOf(l.created_at);
    if (!at || at.day !== l.day) continue; // nachgetragen – zählt nicht
    mins.push(at.min);
  }
  if (mins.length < MIN_USUAL) return { n: mins.length, min: null };
  mins.sort((a, b) => a - b);
  const mid = Math.floor(mins.length / 2);
  const median = mins.length % 2 ? mins[mid] : (mins[mid - 1] + mins[mid]) / 2;
  return { n: mins.length, min: Math.round(median / 10) * 10 };
}

// Training mit Auto-Abhaken: der Eintrag entsteht erst beim Abgleich mit der Uhr – darum zählt hier
// die Startzeit des Trainings (das erste passende am Tag). Von Hand Abgehaktes an anderen Tagen zählt mit.
export const isTrainingAuto = (h) => !h.auto_metric && Array.isArray(h.auto_categories) && h.auto_categories.length > 0;
export function usualFor(h, logs, workouts = [], today, localOf = browserLocal) {
  if (!isTrainingAuto(h) || !workouts || !workouts.length) return usualTime(logs, h.id, today, localOf);
  const first = new Map();
  for (const w of workouts) {
    if (!w.start_at || !workoutCounts(h, w)) continue;
    const f = first.get(w.day);
    if (!f || w.start_at < f.start_at) first.set(w.day, w);
  }
  const samples = [...first.values()].map((w) => ({ habit_id: h.id, day: w.day, status: 'done', created_at: w.start_at }));
  const manual = logs.filter((l) => l.habit_id === h.id && !l.source && !first.has(l.day));
  return usualTime([...samples, ...manual], h.id, today, localOf);
}

function browserLocal(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const day = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return { day, min: d.getHours() * 60 + d.getMinutes() };
}

// Ortszeit in einer Zeitzone (für die Edge Function, die in UTC läuft)
export function zonedNow(date, tz) {
  try {
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
      timeZone: tz || 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
    }).formatToParts(date).map((p) => [p.type, p.value]));
    return { day: `${parts.year}-${parts.month}-${parts.day}`, min: Number(parts.hour) * 60 + Number(parts.minute) };
  } catch (_) {
    return zonedNow(date, 'Europe/Berlin');
  }
}
