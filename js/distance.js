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
  ['Athen', 37.9838, 23.7275], ['Istanbul', 41.0082, 28.9784]
].map(([name, lat, lng]) => ({ name, lat, lng }));

// Startorte zur Auswahl
export const STARTS = ['Frankfurt am Main', 'Berlin', 'Hamburg', 'München', 'Köln', 'Düsseldorf', 'Stuttgart', 'Leipzig', 'Hannover', 'Nürnberg', 'Wien', 'Zürich'];

export function city(name) {
  return CITIES.find((c) => c.name === name) || CITIES[0];
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
export function journey(startName, total) {
  const start = city(startName);
  const list = CITIES.filter((c) => c.name !== start.name)
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
