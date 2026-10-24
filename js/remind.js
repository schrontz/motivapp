// Erinnerung: reine Funktionen, testbar. Wird auch von der Edge Function „erinnerung“ benutzt
// (die lädt diese Datei von GitHub Pages) – darum keine Abhängigkeit vom Browser.
//
// Regeln (siehe Mockup „Erinnerungen“):
// - eine Nachricht am Tag, nur wenn etwas offen ist
// - Pausentag für alles → still; pausierte Gewohnheit → nicht dabei
// - Automatische Gewohnheiten (Withings) bleiben draußen
// - Woche/Monat: erst dabei, wenn es knapp wird (noch genau so viele freie Tage wie fehlende Male)
// - Mini zählt als geschafft

import { todayItems, indexLogs, isPaused, isPeriodic } from './stats.js';
import { eachDay, weekStart, addDays, monthStart, daysInMonth } from './dates.js';

export const DEFAULT_TIME = 20 * 60; // Minuten seit Mitternacht
export const MIN_USUAL = 5; // ab so vielen Einträgen zeigt die App „meist gegen“
export const USUAL_DAYS = 14;

export const isAuto = (h) => !!h.auto_metric || (Array.isArray(h.auto_categories) && h.auto_categories.length > 0);
export const remindable = (h) => !h.archived && !isAuto(h) && h.remind !== false;
export const hasMini = (h) => !!(h.mini_text || h.mini_value != null);

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
    if (!isPeriodic(h)) { out.push({ habit: h, name: h.name }); continue; }
    const need = it.period.min - it.period.n;
    if (need <= 0) continue;
    let free = 0;
    for (const d of eachDay(day, periodEnd(h, day))) if (!isPaused(h, d, pauses)) free += 1;
    if (free > need) continue; // noch genug Zeit – kein Druck
    out.push({ habit: h, name: h.name, need, word: h.schedule === 'per_week' ? 'diese Woche' : 'diesen Monat' });
  }
  return out;
}

const listNames = (names) => {
  if (names.length <= 4) return names.join(', ');
  return `${names.slice(0, 3).join(', ')} und ${names.length - 3} weitere`;
};

// Text der Nachricht – null, wenn nichts offen ist
export function reminderText(open) {
  if (!open.length) return null;
  const daily = open.filter((o) => !o.need);
  const periodic = open.filter((o) => o.need);
  const parts = [];
  if (daily.length) parts.push(listNames(daily.map((o) => o.name)) + (periodic.length ? ' heute' : ''));
  for (const o of periodic) parts.push(`${o.name} – noch ${o.need}× ${o.word}`);
  let body = parts.join(' · ');
  if (!/[.!?]$/.test(body)) body += '.';
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
