// Startbildschirm (reine Funktionen, testbar).
// Aufbau fest: Begrüßung · Ring · Kacheln (bis zu 3 Module) · Jetzt / Später heute / Erledigt · übrige Module als Zeilen · Deine Werte.
// Einstellbar (Profil → Startbildschirm): Reihenfolge der Module und welche oben als Kachel stehen.

export const HOME_BLOCKS = [
  { id: 'weniger', label: 'Weniger rauchen', sub: 'Timer und „Geraucht“' },
  { id: 'fund', label: 'Fundstück', sub: 'Buchstaben und Raten' },
  { id: 'essen', label: 'Essen', sub: 'Pflanzen und „Eintragen“' },
  { id: 'alkohol', label: 'Alkoholfrei', sub: 'Woche und „Getrunken“' }
];
export const DEFAULT_ORDER = HOME_BLOCKS.map((b) => b.id);
export const MAX_TILES = 3;

// Gespeicherte Reihenfolge → vollständige: Unbekanntes (auch alte Blöcke wie „rings“) fliegt raus,
// Neues kommt an seinen Standardplatz
export function homeOrder(saved) {
  const known = new Set(DEFAULT_ORDER);
  const out = (Array.isArray(saved) ? saved : []).filter((id, i, a) => known.has(id) && a.indexOf(id) === i);
  DEFAULT_ORDER.forEach((id, i) => {
    if (out.includes(id)) return;
    const before = DEFAULT_ORDER.slice(0, i).reverse().find((x) => out.includes(x));
    out.splice(before ? out.indexOf(before) + 1 : 0, 0, id);
  });
  return out;
}

// Einen Block hoch/runter schieben – über ausgeblendete Blöcke hinweg (die bleiben, wo sie sind)
export function moveBlock(order, visible, id, dir) {
  const list = homeOrder(order);
  const vis = list.filter((x) => visible.has(x));
  const i = vis.indexOf(id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= vis.length) return list;
  const a = list.indexOf(id);
  const b = list.indexOf(vis[j]);
  [list[a], list[b]] = [list[b], list[a]];
  return list;
}

// Welche Module stehen oben als Kachel? Nichts gewählt (null) = die ersten drei sichtbaren.
export function homeTiles(order, visible, tiles) {
  const list = homeOrder(order).filter((id) => visible.has(id));
  if (!Array.isArray(tiles)) return list.slice(0, MAX_TILES);
  return list.filter((id) => tiles.includes(id)).slice(0, MAX_TILES);
}

// Kachel an/aus. Beim ersten Mal wird aus dem Standard (erste drei) eine eigene Liste.
// Mehr als drei geht nicht – dann bleibt alles, wie es ist (die Ansicht sagt es).
export function toggleTile(order, visible, tiles, id) {
  const cur = homeTiles(order, visible, tiles);
  if (cur.includes(id)) return cur.filter((x) => x !== id);
  if (cur.length >= MAX_TILES) return null;
  return homeOrder(order).filter((x) => x === id || cur.includes(x));
}

// Heute aufteilen: Jetzt (offen, ohne Zeit oder bald/überfällig), Später heute (übliche Zeit erst in > 90 Min.),
// Erledigt (geschafft, Wochenziel erreicht oder Pause). „Jetzt“ nach üblicher Uhrzeit sortiert.
// Noch nichts gelernt? Dann verrät oft der Name die Tageszeit („Skincare Abends“). Nur zum Einordnen –
// angezeigt („meist gegen …“) und erinnert wird weiter nur nach gelernter Zeit.
export function nameHint(name) {
  const n = String(name || '').toLowerCase();
  if (/morgen|früh|frueh/.test(n)) return 7 * 60;
  if (/nachmittag/.test(n)) return 16 * 60;
  if (/mittag/.test(n)) return 12 * 60 + 30;
  if (/abend|nacht/.test(n)) return 20 * 60;
  return null;
}

// Zählt sich von selbst (Schritte von der Uhr) – braucht kein Antippen, darum in „Jetzt“ ans Ende
export const countsItself = (h) => !!h.auto_metric;

export const LATER_MIN = 90;
export function groupToday(items, usualOf, nowMin) {
  const now = [];
  const later = [];
  const done = [];
  items.forEach((item, n) => {
    const usual = usualOf(item.habit);
    const at = usual ?? nameHint(item.habit.name);
    const entry = { item, usual, at, auto: countsItself(item.habit), n };
    if (item.hit || (item.period && item.period.state === 'goal') || item.paused) done.push(entry);
    else if (at != null && at > nowMin + LATER_MIN) later.push(entry);
    else now.push(entry);
  });
  const byTime = (a, b) => (a.auto - b.auto) || (a.at ?? 9999) - (b.at ?? 9999) || a.n - b.n;
  return { now: now.sort(byTime), later: later.sort(byTime), done: done.sort((a, b) => a.n - b.n) };
}
