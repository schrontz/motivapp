// Startbildschirm: Reihenfolge der Blöcke (reine Funktionen, testbar).
// Fest oben bleiben Begrüßung, Kategorie-Filter und Feiern (z. B. „Angekommen“).

export const HOME_BLOCKS = [
  { id: 'rings', label: 'Ringe', sub: 'Heute · 7 Tage · 30 Tage' },
  { id: 'fund', label: 'Fundstück', sub: 'Buchstaben aufdecken' },
  { id: 'weniger', label: 'Weniger rauchen', sub: 'Timer und „Geraucht“' },
  { id: 'alkohol', label: 'Alkoholfrei', sub: 'Woche und „Getrunken“' },
  { id: 'essen', label: 'Essen', sub: 'Pflanzen und Mahlzeiten' },
  { id: 'heute', label: 'Heute', sub: 'deine Gewohnheiten zum Abhaken' },
  { id: 'gesamt', label: 'Gesamtzahl', sub: '„… Mal drangeblieben“' },
  { id: 'werte', label: 'Deine Werte', sub: 'Kacheln (Schritte, Training …)' }
];
export const DEFAULT_ORDER = HOME_BLOCKS.map((b) => b.id);

// Gespeicherte Reihenfolge → vollständige: Unbekanntes fliegt raus, Neues kommt an seinen Standardplatz
export function homeOrder(saved) {
  const known = new Set(DEFAULT_ORDER);
  const out = (Array.isArray(saved) ? saved : []).filter((id, i, a) => known.has(id) && a.indexOf(id) === i);
  DEFAULT_ORDER.forEach((id, i) => {
    if (out.includes(id)) return;
    // hinter den Vorgänger aus der Standardreihenfolge, der schon drin ist
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
