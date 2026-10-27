// Fundstücke: reine Funktionen, testbar.
//
// Ein Satz: Jede erledigte Gewohnheit deckt Buchstaben auf – ist alles frei, gehört das Fundstück dir.
// - Anteil des Heute-Rings (Mini zählt, Wochenziele wie im Ring) = Anteil der Buchstaben; voller Ring = alles frei.
// - Aufgedecktes bleibt über Nacht: abgeschlossene Tage wandern in `base`.
// - Der Pfad wandert durch Wikipedia weiter (du wählst nach Beschreibung); bringt ein Bereich etwas Neues,
//   zweigt er dorthin ab (Strecke, Sport, Essen).

import { todayItems, todayRing } from './stats.js';
import { addDays, eachDay } from './dates.js';

// ───────────── Buchstaben ─────────────

const LETTER = /[\p{L}\p{N}]/u;

// Positionen der Buchstaben im Titel (Leerzeichen, Klammern, Bindestriche sind immer sichtbar)
export function letterSlots(title) {
  const chars = Array.from(title || '');
  const slots = [];
  chars.forEach((c, i) => { if (LETTER.test(c)) slots.push(i); });
  return { chars, slots };
}

export const letterCount = (title) => letterSlots(title).slots.length;

// Feste, aber zufällig wirkende Reihenfolge pro Titel – der erste Buchstabe kommt immer zuerst
function seeded(text) {
  let h = 2166136261;
  for (const c of text) { h ^= c.codePointAt(0); h = Math.imul(h, 16777619); }
  return () => { h = Math.imul(h ^ (h >>> 15), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); h ^= h >>> 16; return (h >>> 0) / 4294967296; };
}

export function revealOrder(title) {
  const { slots } = letterSlots(title);
  if (!slots.length) return [];
  const rest = slots.slice(1);
  const rnd = seeded(title);
  for (let i = rest.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rnd() * (i + 1));
    [rest[i], rest[j]] = [rest[j], rest[i]];
  }
  return [slots[0], ...rest];
}

// Titel mit n aufgedeckten Buchstaben → [{ c, shown, letter }]
export function maskTitle(title, n) {
  const { chars } = letterSlots(title);
  const open = new Set(revealOrder(title).slice(0, Math.max(0, n)));
  return chars.map((c, i) => {
    const letter = LETTER.test(c);
    return { c, letter, shown: !letter || open.has(i) };
  });
}

// Richtig geraten? Groß/klein, Umlaute (ä = ae), Akzente, Leerzeichen und Bindestriche egal;
// ein Zusatz in Klammern darf fehlen („Linie“ für „Linie (Aquavit)“), ein Artikel davor auch („die Gotik“).
export function guessMatches(guess, title) {
  const norm = (s) => String(s || '').toLowerCase()
    .replace(/ß/g, 'ss').replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
  const g = norm(String(guess || '').trim().replace(/^(der|die|das|ein|eine)\s+/i, ''));
  if (!g) return false;
  const full = norm(title);
  const short = norm(String(title || '').replace(/\s*\(.*?\)\s*/g, ' '));
  return g === full || g === short;
}

// ───────────── Fortschritt ─────────────

// Wie viele Buchstaben bringt dieser Tag? Anteil des Heute-Rings × Buchstaben (voller Ring = alle)
export function earnedOn(habits, idx, pauses, day, letters) {
  const ring = todayRing(todayItems(habits, idx, pauses, day));
  if (!ring.due || !letters) return 0;
  if (ring.done >= ring.due) return letters;
  return Math.floor((letters * ring.done) / ring.due);
}

// Abgeschlossene Tage in `base` übernehmen (vom base_day bis gestern). Gibt den neuen Stand zurück.
export function rollover(find, T, earned) {
  if (!find || !find.base_day || find.base_day >= T) return { base: find ? find.base || 0 : 0, base_day: find ? find.base_day : T, changed: false };
  let base = find.base || 0;
  for (const d of eachDay(find.base_day, addDays(T, -1))) base += earned(d);
  return { base, base_day: T, changed: true };
}

// Aufgedeckt = base + heute, begrenzt auf 0 … Buchstaben
export function revealed(find, T, earned) {
  const L = letterCount(find.title);
  const r = rollover(find, T, earned);
  return Math.max(0, Math.min(L, r.base + earned(T)));
}

// Volle Tage: Heute-Ring voll (mit etwas Fälligem). Heute zählt erst, wenn voll. Rückwirkend, wächst nur.
export function fullDays(habits, idx, pauses, T) {
  const starts = habits.filter((h) => !h.archived).map((h) => h.start_day).filter(Boolean).sort();
  if (!starts.length) return 0;
  let n = 0;
  for (const d of eachDay(starts[0], T)) {
    const ring = todayRing(todayItems(habits, idx, pauses, d));
    if (ring.due > 0 && ring.done >= ring.due) n += 1;
  }
  return n;
}

// ───────────── Wikipedia-Links filtern ─────────────

const MONTHS = /^(\d{1,2}\. )?(Januar|Februar|März|April|Mai|Juni|Juli|August|September|Oktober|November|Dezember)( \d+)?$/;
const MATH = /mathemati|\bzahl(en)?\b|zahlentheor|gleichung|geometri|algebra|theorem|axiom|integral|differenzial|differential|statisti|stochasti|arithmeti|funktion \(mathematik\)|primzahl|matrix|vektor/i;

export function goodLink(page, needDescription = true) {
  if (!page || !page.title || page.missing !== undefined) return false;
  const t = page.title;
  const d = page.description || '';
  if (page.pageprops && page.pageprops.disambiguation !== undefined) return false;
  if (/^\d/.test(t) || MONTHS.test(t) || /^Liste /.test(t) || /Jahrhundert|Jahrtausend|Begriffsklärung/.test(t)) return false;
  if (/^(Kalenderjahr|Jahr|Jahrzehnt|Begriffsklärung|Wikimedia-)/i.test(d)) return false;
  if (MATH.test(t) || MATH.test(d)) return false;
  if (needDescription && d.length < 4) return false; // ohne Beschreibung kein Rätsel
  if (letterCount(t) < 3 || letterCount(t) > 40) return false;
  return true;
}

// Drei Ziele für „Wohin geht es weiter?“ – zufällig aus den guten Links, schon Gesammeltes nicht
export function pickOptions(pages, used, n = 3, rnd = Math.random) {
  const seen = new Set([...used].map((x) => x.toLowerCase()));
  const fresh = (p) => !seen.has(p.title.toLowerCase());
  const out = [];
  const take = (pool) => {
    while (pool.length && out.length < n) {
      const p = pool.splice(Math.floor(rnd() * pool.length), 1)[0];
      out.push({ title: p.title, description: p.description || '' });
    }
  };
  take(pages.filter((p) => goodLink(p) && fresh(p)));
  // Rückfall: liefert Wikipedia keine Kurzbeschreibungen, lieber ohne als gar nicht weiter
  if (out.length < n) take(pages.filter((p) => !goodLink(p) && goodLink(p, false) && fresh(p)));
  return out;
}

// ───────────── Abzweige aus deinen Bereichen ─────────────

// Neues seit `since` (Tag): erreichte Reiseziele, erstmals gegessene Pflanzen, neue Übungen/Sportarten.
// Neueste zuerst. Titel, die schon gesammelt sind, fallen raus.
export function branchCandidates({ travel = [], meals = [], strength = [], workouts = [] }, since, used, helpers) {
  const { wikiTitle = (x) => x, plantWikiTitle = (x) => x, categoryName = () => null } = helpers || {};
  const seen = new Set([...used].map((x) => x.toLowerCase()));
  const out = [];
  const add = (day, title, origin, area) => {
    if (!title || day < since || seen.has(title.toLowerCase())) return;
    seen.add(title.toLowerCase());
    out.push({ day, title, origin, area });
  };
  for (const g of travel) if (g.reached_on) add(g.reached_on, wikiTitle(g.city), `Strecke: ${g.city} erreicht`, 'strecke');
  const firstSeen = (rows, keysOf) => {
    const first = new Map();
    for (const r of [...rows].sort((a, b) => (a.day < b.day ? -1 : 1))) for (const k of keysOf(r)) if (k && !first.has(k)) first.set(k, r.day);
    return first;
  };
  for (const [plant, day] of firstSeen(meals, (m) => m.plants || [])) add(day, plantWikiTitle(plant), `Essen: zum ersten Mal ${plant}`, 'essen');
  const clean = (name) => String(name || '').replace(/\s*\(.*?\)\s*/g, ' ').trim();
  for (const [ex, day] of firstSeen(strength, (s) => (s.exercises || []).map((e) => clean(e.name)))) add(day, ex, `Training: zum ersten Mal ${ex}`, 'sport');
  for (const [cat, day] of firstSeen(workouts, (w) => [w.category])) {
    if (cat == null || cat === 36 || cat < 0) continue;
    const name = categoryName(cat);
    if (name && !/^Art /.test(name)) add(day, name, `Training: zum ersten Mal ${name}`, 'sport');
  }
  return out.sort((a, b) => (a.day < b.day ? 1 : a.day > b.day ? -1 : 0));
}

export const AREA_LABEL = { strecke: 'deiner Strecke', essen: 'deinem Essen', sport: 'deinem Training' };
