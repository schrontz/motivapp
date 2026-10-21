// „Wie weit bin ich gekommen?“ – Strecke aus Withings, als Luftlinie von einem Startort. Reine Funktionen, testbar.

import { addDays } from './dates.js';

// Ziele (Breite, Länge). Entfernungen rechnet die App selbst aus – so passt es zu jedem Startort.
export const CITIES = [
  ['Frankfurt am Main', 50.1109, 8.6821], ['Mainz', 49.9929, 8.2473], ['Wiesbaden', 50.0782, 8.2398],
  ['Darmstadt', 49.8728, 8.6512], ['Heidelberg', 49.3988, 8.6724], ['Mannheim', 49.4875, 8.466],
  ['Würzburg', 49.7913, 9.9534], ['Koblenz', 50.3569, 7.589], ['Kassel', 51.3127, 9.4797],
  ['Köln', 50.9375, 6.9603], ['Düsseldorf', 51.2277, 6.7735], ['Stuttgart', 48.7758, 9.1829],
  ['Nürnberg', 49.4521, 11.0767], ['Luxemburg', 49.6116, 6.1319], ['Straßburg', 48.5734, 7.7521],
  ['Dortmund', 51.5136, 7.4653], ['Hannover', 52.3759, 9.732], ['Zürich', 47.3769, 8.5417],
  ['München', 48.1351, 11.582], ['Brüssel', 50.8503, 4.3517], ['Amsterdam', 52.3676, 4.9041],
  ['Leipzig', 51.3397, 12.3731], ['Hamburg', 53.5511, 9.9937], ['Prag', 50.0755, 14.4378],
  ['Berlin', 52.52, 13.405], ['Paris', 48.8566, 2.3522], ['Mailand', 45.4642, 9.19],
  ['Wien', 48.2082, 16.3738], ['Venedig', 45.4408, 12.3155], ['London', 51.5074, -0.1278],
  ['Kopenhagen', 55.6761, 12.5683], ['Marseille', 43.2965, 5.3698], ['Budapest', 47.4979, 19.0402],
  ['Edinburgh', 55.9533, -3.1883], ['Rom', 41.9028, 12.4964], ['Barcelona', 41.3874, 2.1686],
  ['Stockholm', 59.3293, 18.0686], ['Madrid', 40.4168, -3.7038], ['Lissabon', 38.7223, -9.1393],
  ['Athen', 37.9838, 23.7275], ['Istanbul', 41.0082, 28.9784],
  // Weitere Fernziele in Europa
  ['Warschau', 52.2297, 21.0122], ['Dublin', 53.3498, -6.2603], ['Oslo', 59.9139, 10.7522], ['Dubrovnik', 42.6507, 18.0944],
  ['Helsinki', 60.1699, 24.9384], ['Sevilla', 37.3891, -5.9845], ['Santiago de Compostela', 42.8782, -8.5448],
  ['Moskau', 55.7558, 37.6173], ['Reykjavík', 64.1466, -21.9426], ['Nordkap', 71.1685, 25.7838],
  // Zwischenstationen – machen Etappen auf langen Wegen möglich
  ['Basel', 47.5596, 7.5886], ['Bremen', 53.0793, 8.8017], ['Rotterdam', 51.9244, 4.4777], ['Salzburg', 47.8095, 13.055],
  ['Innsbruck', 47.2692, 11.4041], ['Lyon', 45.764, 4.8357], ['Bordeaux', 44.8378, -0.5792], ['Genua', 44.4056, 8.9463],
  ['Bologna', 44.4949, 11.3426], ['Florenz', 43.7696, 11.2558], ['Neapel', 40.8518, 14.2681], ['Palermo', 38.1157, 13.3615],
  ['Valencia', 39.4699, -0.3763], ['Porto', 41.1579, -8.6291], ['Zagreb', 45.815, 15.9819], ['Belgrad', 44.7866, 20.4489],
  ['Sofia', 42.6977, 23.3219], ['Bukarest', 44.4268, 26.1025], ['Krakau', 50.0647, 19.945], ['Danzig', 54.352, 18.6466],
  ['Riga', 56.9496, 24.1052], ['Tallinn', 59.437, 24.7536], ['Göteborg', 57.7089, 11.9746], ['Glasgow', 55.8642, -4.2518],
  // Andere Kontinente – Luftlinie, also auch übers Wasser
  ['Tunis', 36.8065, 10.1815, 'Afrika'], ['Marrakesch', 31.6295, -7.9811, 'Afrika'], ['Kairo', 30.0444, 31.2357, 'Afrika'],
  ['Nairobi', -1.2921, 36.8219, 'Afrika'], ['Sansibar', -6.1659, 39.2026, 'Afrika'], ['Kapstadt', -33.9249, 18.4241, 'Afrika'],
  ['Jerusalem', 31.7683, 35.2137, 'Asien'], ['Dubai', 25.2048, 55.2708, 'Asien'], ['Mumbai', 19.076, 72.8777, 'Asien'],
  ['Kathmandu', 27.7172, 85.324, 'Asien'], ['Bangkok', 13.7563, 100.5018, 'Asien'], ['Peking', 39.9042, 116.4074, 'Asien'],
  ['Tokio', 35.6762, 139.6503, 'Asien'], ['Bali', -8.6705, 115.2126, 'Asien'],
  ['New York', 40.7128, -74.006, 'Amerika'], ['Montréal', 45.5017, -73.5673, 'Amerika'], ['Havanna', 23.1136, -82.3666, 'Amerika'],
  ['Mexiko-Stadt', 19.4326, -99.1332, 'Amerika'], ['San Francisco', 37.7749, -122.4194, 'Amerika'], ['Rio de Janeiro', -22.9068, -43.1729, 'Amerika'],
  ['Cusco', -13.532, -71.9675, 'Amerika'], ['Buenos Aires', -34.6037, -58.3816, 'Amerika'],
  ['Sydney', -33.8688, 151.2093, 'Ozeanien'], ['Auckland', -36.8485, 174.7633, 'Ozeanien'],
  ['Nordpol', 90, 0, 'Pole'], ['Südpol', -90, 0, 'Pole']
].map(([name, lat, lng, region = 'Europa']) => ({ name, lat, lng, region }));

// Reihenfolge der Kontinente im Auswahlfenster
export const REGIONS = ['Europa', 'Afrika', 'Asien', 'Amerika', 'Ozeanien', 'Pole'];

// Bekannte Fernziele – die schlägt die App bevorzugt vor
const STARS = ['Berlin', 'Hamburg', 'München', 'Paris', 'London', 'Amsterdam', 'Prag', 'Wien', 'Kopenhagen', 'Rom', 'Venedig', 'Barcelona', 'Madrid', 'Lissabon', 'Stockholm', 'Athen', 'Istanbul', 'Dublin', 'Santiago de Compostela', 'Moskau', 'Reykjavík', 'Nordkap'];

// Startorte zur Auswahl
export const STARTS = ['Frankfurt am Main', 'Berlin', 'Hamburg', 'München', 'Köln', 'Düsseldorf', 'Stuttgart', 'Leipzig', 'Hannover', 'Nürnberg', 'Wien', 'Zürich'];

// Ab wann zählt die Strecke? Eigenes Datum (Profil) – sonst wie früher: 30 Tage vor dem Verbinden mit Withings
// (so weit hat der erste Abgleich zurückgeholt). Spätere Abgleiche holen mehr Vergangenheit – die zählt dann nicht mit.
export function travelFrom(S) {
  if (S.profile && S.profile.travel_from) return String(S.profile.travel_from).slice(0, 10);
  const c = S.withings && S.withings.connected_at;
  if (c) return addDays(String(c).slice(0, 10), -30);
  return '0000-00-00';
}

// Strecke seit dem Zähl-Start (optional bis/ab einem Zeitraum)
export function walkedFor(S, fromDay = '0000-00-00', toDay = '9999-12-31') {
  const from = travelFrom(S);
  return walked(S.activity || [], fromDay > from ? fromDay : from, toDay);
}

export function city(name) {
  return CITIES.find((c) => c.name === name) || CITIES[0];
}

// Eigene Orte („Meine Orte“) zu den festen Zielen dazu – gleichnamige feste Ziele haben Vorrang
export function withPlaces(places = []) {
  const known = new Set(CITIES.map((c) => c.name));
  return CITIES.concat((places || []).filter((p) => !known.has(p.name))
    .map((p) => ({ name: p.name, lat: Number(p.lat), lng: Number(p.lng), region: 'Meine Orte', label: p.label || '' })));
}

// Ort eines Ziels: eigene Orte bringen ihre Koordinaten mit, feste Ziele stehen in der Liste
export function placeOf(goal) {
  if (goal.lat != null && goal.lng != null) return { name: goal.city, lat: Number(goal.lat), lng: Number(goal.lng) };
  return city(goal.city);
}

// Suche in festen Zielen und eigenen Orten – ohne Groß-/Kleinschreibung und Akzente
const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ß/g, 'ss');
export function searchLocal(query, places = []) {
  const q = norm(query).trim();
  if (!q) return [];
  return withPlaces(places)
    .filter((c) => norm(c.name).includes(q))
    .sort((a, b) => (norm(a.name).startsWith(q) ? 0 : 1) - (norm(b.name).startsWith(q) ? 0 : 1) || a.name.localeCompare(b.name, 'de'))
    .slice(0, 6);
}

// Ein Treffer von OpenStreetMap (Nominatim) → eigener Ort
export function osmToPlace(r) {
  const a = r.address || {};
  const name = r.name || String(r.display_name || '').split(',')[0].trim();
  const region = a.state || a.county || '';
  const label = [region !== name ? region : '', a.country].filter(Boolean).join(', ');
  return { name, label, lat: Math.round(Number(r.lat) * 1e5) / 1e5, lng: Math.round(Number(r.lon) * 1e5) / 1e5 };
}

// Luftlinie in km (Haversine)
export function km(a, b) {
  const R = 6371;
  const rad = (d) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// Summe der Strecke (Withings, Meter) im Zeitraum → km
export function walked(activity, fromDay = '0000-00-00', toDay = '9999-12-31') {
  let m = 0;
  let first = null;
  for (const a of activity) {
    if (a.day < fromDay || a.day > toDay || !(Number(a.distance_m) > 0)) continue;
    m += Number(a.distance_m);
    if (!first || a.day < first) first = a.day;
  }
  return { km: Math.round(m / 100) / 10, first };
}

// Welche Ziele liegen innerhalb der Strecke, welches kommt als Nächstes?
export function journey(startName, total, places = []) {
  const start = city(startName);
  const list = withPlaces(places).filter((c) => c.name !== start.name)
    .map((c) => ({ ...c, dist: Math.round(km(start, c)) }))
    .sort((a, b) => a.dist - b.dist);
  const reached = list.filter((c) => c.dist <= total);
  const ahead = list.filter((c) => c.dist > total);
  return {
    start,
    reached,
    last: reached[reached.length - 1] || null,
    next: ahead[0] || null,
    toNext: ahead[0] ? Math.round((ahead[0].dist - total) * 10) / 10 : null,
    ahead: ahead.slice(0, 3)
  };
}

// Schnitt der letzten 28 abgeschlossenen Tage (heute zählt noch nicht – der Tag läuft ja noch)
export function pace(activity, T, days = 28) {
  const from = addDays(T, -days);
  const vals = activity.filter((a) => a.day >= from && a.day < T && Number(a.distance_m) > 0).map((a) => Number(a.distance_m) / 1000);
  if (!vals.length) return null;
  const perDay = vals.reduce((s, v) => s + v, 0) / vals.length;
  return { perDay: Math.round(perDay * 10) / 10, perWeek: Math.round(perDay * 7), days: vals.length };
}

// ───────────── Reiseziele ─────────────

export const activeGoal = (travel) => (travel || []).find((g) => !g.reached_on) || null;
export const reachedGoals = (travel) => (travel || []).filter((g) => g.reached_on)
  .sort((a, b) => (a.reached_on < b.reached_on ? 1 : a.reached_on > b.reached_on ? -1 : 0));

// Wie weit ist das Ziel, wie viel ist geschafft? (Strecke zählt seit Start – kann nur wachsen)
export function goalStatus(goal, total) {
  const dist = Math.round(km(city(goal.start_city), placeOf(goal)));
  const left = Math.max(0, Math.round((dist - total) * 10) / 10);
  return { dist, left, share: dist > 0 ? Math.min(1, total / dist) : 1, reached: total >= dist };
}

// „Danach“-Liste: das nächste Ziel, das noch vor dir liegt. Schon erreichte oder unbekannte Orte werden übersprungen.
export function queueNext(queue, startName, total, places = []) {
  const all = withPlaces(places);
  const start = city(startName);
  const rest = [...(queue || [])];
  const skipped = [];
  while (rest.length) {
    const name = rest.shift();
    const place = all.find((c) => c.name === name);
    if (!place || place.name === start.name || km(start, place) <= total) { skipped.push(name); continue; }
    return { next: name, rest, skipped };
  }
  return { next: null, rest: [], skipped };
}

// Grobe Dauer, freundlich gerundet. inText: „in etwa 7 Tagen“ statt „etwa 7 Tage“.
export function duration(days, inText = false) {
  let n; let unit;
  if (days <= 1.5) return inText ? 'in 1–2 Tagen' : '1–2 Tage';
  if (days <= 13) { n = Math.round(days); unit = inText ? 'Tagen' : 'Tage'; }
  else if (days <= 60) { n = Math.round(days / 7); unit = 'Wochen'; }
  else if (days <= 330) { n = Math.round(days / 30); unit = inText ? 'Monaten' : 'Monate'; }
  else {
    n = Math.round(days / 182.5) / 2; // halbe Jahre: „etwa 1,5 Jahre“
    unit = n === 1 ? 'Jahr' : (inText ? 'Jahren' : 'Jahre');
    n = String(n).replace('.', ',');
  }
  return `${inText ? 'in ' : ''}etwa ${n} ${unit}`;
}

// Gleichmäßig verteilt bis zu n Einträge aus einer sortierten Liste
function spread(list, n) {
  if (list.length <= n) return list;
  return Array.from({ length: n }, (_, i) => list[Math.round((i * (list.length - 1)) / (n - 1))]);
}

// Ziele zur Auswahl, nach deinem Schnitt gruppiert: diese Woche / in ein paar Wochen / fern
export function goalChoices(startName, total, perWeek, places = []) {
  const week = perWeek && perWeek > 0 ? perWeek : 35;
  const start = city(startName);
  // Meine Orte: alle, auch die schon im Kreis (die sind dann nicht wählbar)
  const mine = withPlaces(places).filter((c) => c.region === 'Meine Orte')
    .map((c) => { const dist = Math.round(km(start, c)); return { name: c.name, label: c.label, region: c.region, dist, left: Math.max(0, Math.round((dist - total) * 10) / 10), inside: dist <= total }; })
    .sort((a, b) => a.dist - b.dist);
  const ahead = CITIES.filter((c) => c.name !== start.name)
    .map((c) => ({ name: c.name, region: c.region, dist: Math.round(km(start, c)) }))
    .filter((c) => c.dist > total)
    .map((c) => ({ ...c, left: Math.round((c.dist - total) * 10) / 10 }))
    .sort((a, b) => a.left - b.left);
  const soon = ahead.filter((c) => c.left <= week);
  const mid = ahead.filter((c) => c.left > week && c.left <= week * 6);
  const far = ahead.filter((c) => c.left > week * 6);
  // Fernziele nach Kontinent; in Europa bevorzugt die bekannten Orte
  const regions = REGIONS.map((name) => {
    const all = far.filter((c) => c.region === name);
    const stars = all.filter((c) => STARS.includes(c.name));
    const pool = name === 'Europa' && stars.length >= 5 ? stars : all;
    return { name, items: name === 'Europa' ? spread(pool, 5) : pool.slice(0, 8) };
  }).filter((r) => r.items.length);
  return [
    { key: 'mine', title: 'Meine Orte', items: mine },
    { key: 'week', title: 'Diese Woche drin', items: soon.slice(0, 3) },
    { key: 'mid', title: 'In ein paar Wochen', items: spread(mid, 4) },
    { key: 'far', title: 'Fernziele', items: regions.flatMap((r) => r.items), regions }
  ].filter((g) => g.items.length);
}

// Nach der Ankunft: ein Ziel in der Nähe (≈ 2 Wochen) und eins in der Ferne (≈ 2 Monate)
export function nextSuggestions(startName, total, perDay) {
  const day = perDay && perDay > 0 ? perDay : 5;
  const ahead = goalChoices(startName, total, day * 7).flatMap((g) => g.items).filter((c) => c.region === 'Europa');
  if (!ahead.length) return { near: null, far: null };
  const closest = (want, from = ahead) => from.reduce((best, c) => (Math.abs(c.left - want) < Math.abs(best.left - want) ? c : best), from[0]);
  const near = closest(day * 14);
  const rest = ahead.filter((c) => c.left > near.left * 2);
  const far = rest.length ? closest(day * 60, rest) : null;
  return { near, far };
}

// Startort: aus dem Profil (alle Geräte), sonst vom Gerät, sonst Frankfurt
export const startOf = (S) => (S.profile && S.profile.travel_start) || S.distStart || STARTS[0];

// ───────────── Etappen ─────────────

// Zwischenstationen auf dem Weg zum Ziel: Orte nahe der Linie (höchstens 8 % Umweg), mit Abstand verteilt.
// Fehlt in der Mitte eines langen Wegs eine Stadt, gibt es die „Halbzeit“. Das Ziel selbst ist die letzte Etappe.
export function stagesFor(goal, places = []) {
  const s = city(goal.start_city);
  const g = placeOf(goal);
  const D = km(s, g);
  const gap = Math.max(D / 10, 15);
  const cands = withPlaces(places)
    .filter((c) => c.name !== s.name && c.name !== goal.city)
    .map((c) => ({ name: c.name, lat: c.lat, lng: c.lng, dist: km(s, c), rest: km(c, g) }))
    .filter((c) => c.dist < D && c.dist + c.rest <= D * 1.08)
    .sort((a, b) => a.dist - b.dist);
  const out = [];
  let last = 0;
  for (const c of cands) {
    if (c.dist - last >= gap && D - c.dist >= gap / 2) { out.push(c); last = c.dist; }
  }
  if (D >= 300 && !out.some((c) => Math.abs(c.dist - D / 2) <= D * 0.1)) {
    out.push({ name: 'Halbzeit', virtual: true, lat: s.lat + (g.lat - s.lat) / 2, lng: s.lng + (g.lng - s.lng) / 2, dist: D / 2 });
    out.sort((a, b) => a.dist - b.dist);
  }
  return out.map((c) => ({ name: c.name, lat: c.lat, lng: c.lng, dist: Math.round(c.dist), virtual: !!c.virtual }))
    .concat({ name: goal.city, lat: g.lat, lng: g.lng, dist: Math.round(D), final: true });
}

// Wo stehe ich auf dem Weg? Etappe, Stück bis zur nächsten, und was dieser Monat beigetragen hat.
export function stageStatus(stages, total, monthKm = 0) {
  const reached = stages.filter((st) => st.dist <= total).length;
  const prev = reached ? stages[reached - 1] : null;
  const from = prev ? prev.dist : 0;
  const next = stages[reached] || null;
  const leg = next ? next.dist - from : 1;
  const clamp = (v) => Math.max(0, Math.min(1, v));
  const monthFrom = Math.max(0, total - monthKm);
  return {
    reached,
    count: stages.length,
    prev,
    next,
    left: next ? Math.round((next.dist - total) * 10) / 10 : 0,
    legShare: next ? clamp((total - from) / leg) : 1,
    // Anteil der aktuellen Etappe, der schon vor diesem Monat geschafft war (für die zweifarbige Leiste)
    legBeforeMonth: next ? clamp((monthFrom - from) / leg) : 1,
    passedThisMonth: stages.filter((st) => st.dist > monthFrom && st.dist <= total)
  };
}

// ───────────── Stadt-Wissen (Wikipedia) ─────────────

// Artikel, deren Titel vom Ortsnamen abweicht
const WIKI_TITLES = {
  'Luxemburg': 'Luxemburg (Stadt)', 'New York': 'New York City', 'Sansibar': 'Sansibar-Stadt',
  'Valencia': 'Valencia', 'Bali': 'Bali', 'Nordpol': 'Nordpol', 'Südpol': 'Südpol'
};
export const wikiTitle = (name) => WIKI_TITLES[name] || name;
const WIKI_WIDE = new Set(['Bali', 'Sansibar', 'Nordkap', 'Sylt']);

// Suchtreffer nur nehmen, wenn der Ortsname im Titel steckt („Bingen am Rhein“ passt zu „Bingen“, „Darmstadt“ nicht zu „Wiesbaden“)
export function titleMatches(title, name) {
  const first = norm(name).split(/[\s,(-]+/)[0];
  return !!first && norm(title).includes(first);
}

// Antwort der Wikipedia-Kurzfassung prüfen: kein Begriffsklärungs-Artikel, und – wenn Koordinaten da sind – in der Nähe des Orts
export function pickSummary(json, place) {
  if (!json || json.type === 'disambiguation' || !json.extract) return null;
  if (place && json.coordinates && Number.isFinite(place.lat) && Math.abs(place.lat) < 89) {
    const d = km({ lat: json.coordinates.lat, lng: json.coordinates.lon }, place);
    // Städte: Artikel-Punkt liegt im Zentrum (≤ 25 km). Inseln/Regionen: Mittelpunkt der Fläche, darum großzügiger.
    if (d > (WIKI_WIDE.has(place.name) ? 150 : 25)) return null; // anderer Ort (gleichen Namens oder ein Nachbarort)
  }
  return {
    title: json.title,
    description: json.description || '',
    extract: json.extract,
    image: json.thumbnail ? json.thumbnail.source : null,
    url: (json.content_urls && json.content_urls.mobile && json.content_urls.mobile.page) || `https://de.wikipedia.org/wiki/${encodeURIComponent(json.title)}`
  };
}

// Kurzer Anriss für die Feier: die ersten ein, zwei Sätze, höchstens ~220 Zeichen
export function teaser(text, max = 220) {
  const t = String(text || '').trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const end = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('! '), cut.lastIndexOf('? '));
  return end > 80 ? cut.slice(0, end + 1) : cut.replace(/\s+\S*$/, '') + ' …';
}
