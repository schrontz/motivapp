// Datums-Hilfen. Alle Tage sind lokale Kalendertage im Format 'YYYY-MM-DD'.

export function toDay(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function today() {
  return toDay(new Date());
}

export function parseDay(day) {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y, m - 1, d, 12); // Mittag: robust gegen Zeitumstellung
}

export function addDays(day, n) {
  const dt = parseDay(day);
  dt.setDate(dt.getDate() + n);
  return toDay(dt);
}

export function diffDays(a, b) {
  // Anzahl Tage von a bis b (b - a)
  return Math.round((parseDay(b) - parseDay(a)) / 86400000);
}

// 1 = Montag … 7 = Sonntag
export function weekday(day) {
  const wd = parseDay(day).getDay();
  return wd === 0 ? 7 : wd;
}

export function weekStart(day) {
  return addDays(day, 1 - weekday(day));
}

export function monthKey(day) {
  return day.slice(0, 7);
}

export function monthStart(day) {
  return day.slice(0, 8) + '01';
}

export function daysInMonth(day) {
  const dt = parseDay(day);
  return new Date(dt.getFullYear(), dt.getMonth() + 1, 0).getDate();
}

export function* eachDay(from, to) {
  for (let d = from; d <= to; d = addDays(d, 1)) yield d;
}

const MONTHS = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
const MONTHS_SHORT = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
const WEEKDAYS = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];
export const WEEKDAYS_SHORT = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

export function monthName(day) {
  return MONTHS[Number(day.slice(5, 7)) - 1];
}

export function monthShort(key) {
  return MONTHS_SHORT[Number(key.slice(5, 7)) - 1];
}

export function longDate(day) {
  const dt = parseDay(day);
  return `${WEEKDAYS[weekday(day) - 1]}, ${dt.getDate()}. ${MONTHS[dt.getMonth()]}`;
}

export function greeting(date = new Date()) {
  const h = date.getHours();
  if (h < 5) return 'Gute Nacht';
  if (h < 11) return 'Guten Morgen';
  if (h < 17) return 'Hallo';
  if (h < 22) return 'Guten Abend';
  return 'Gute Nacht';
}
