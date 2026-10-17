import { test } from 'node:test';
import assert from 'node:assert/strict';
import { km, city, walked, journey, pace, CITIES, STARTS } from '../js/distance.js';

test('Luftlinie stimmt ungefähr', () => {
  const f = city('Frankfurt am Main');
  assert.ok(Math.abs(km(f, city('Barcelona')) - 1090) < 25, 'Frankfurt–Barcelona ≈ 1.090 km');
  assert.ok(Math.abs(km(f, city('Paris')) - 479) < 15, 'Frankfurt–Paris ≈ 480 km');
  assert.ok(Math.abs(km(f, city('Düsseldorf')) - 182) < 10, 'Frankfurt–Düsseldorf ≈ 180 km');
  assert.equal(Math.round(km(f, f)), 0);
  assert.ok(STARTS.every((s) => CITIES.some((c) => c.name === s)), 'alle Startorte haben Koordinaten');
});

test('Strecke summieren (Meter → km), Zeitraum und erster Tag', () => {
  const act = [
    { day: '2026-09-20', distance_m: 4000 }, { day: '2026-10-01', distance_m: 5500 },
    { day: '2026-10-02', distance_m: null }, { day: '2026-10-15', distance_m: 2550 }
  ];
  assert.deepEqual(walked(act), { km: 12.1, first: '2026-09-20' });
  assert.deepEqual(walked(act, '2026-10-01', '2026-10-31'), { km: 8.1, first: '2026-10-01' });
  assert.deepEqual(walked([]), { km: 0, first: null });
});

test('Erreichte Ziele und nächstes Ziel', () => {
  const j = journey('Frankfurt am Main', 100);
  assert.equal(j.last.name, 'Würzburg');
  assert.equal(j.next.name, 'Kassel');
  assert.ok(j.toNext > 40 && j.toNext < 50);
  assert.ok(j.reached.some((c) => c.name === 'Mainz'));
  assert.equal(j.reached.some((c) => c.name === 'Frankfurt am Main'), false, 'Startort ist kein Ziel');
  const none = journey('Frankfurt am Main', 0);
  assert.equal(none.last, null);
  assert.equal(none.next.name, 'Darmstadt');
  assert.equal(journey('Berlin', 2000).reached.some((c) => c.name === 'Barcelona'), true);
});

test('Schnitt: nur abgeschlossene Tage mit Daten, Woche = 7 × Schnitt', () => {
  const act = [
    { day: '2026-10-10', distance_m: 6000 }, { day: '2026-10-12', distance_m: 4000 },
    { day: '2026-10-15', distance_m: 5000 }, { day: '2026-10-16', distance_m: 99000 }
  ];
  const p = pace(act, '2026-10-16');
  assert.equal(p.perDay, 5);
  assert.equal(p.perWeek, 35);
  assert.equal(p.days, 3);
  assert.equal(pace([], '2026-10-16'), null);
  assert.equal(pace([{ day: '2026-08-01', distance_m: 5000 }], '2026-10-16'), null, 'nur die letzten 28 Tage');
});

test('Reiseziel: Stand, Rest und erreicht', async () => {
  const { goalStatus, activeGoal, reachedGoals } = await import('../js/distance.js');
  const g = { start_city: 'Frankfurt am Main', city: 'Düsseldorf' };
  const s = goalStatus(g, 146);
  assert.equal(s.dist, 183);
  assert.equal(s.left, 37);
  assert.equal(s.reached, false);
  assert.ok(s.share > 0.79 && s.share < 0.8);
  assert.equal(goalStatus(g, 190).reached, true);
  assert.equal(goalStatus(g, 190).left, 0);
  const travel = [{ id: 1, reached_on: '2026-10-01' }, { id: 2, reached_on: null }, { id: 3, reached_on: '2026-10-10' }];
  assert.equal(activeGoal(travel).id, 2);
  assert.deepEqual(reachedGoals(travel).map((x) => x.id), [3, 1]);
  assert.equal(activeGoal([]), null);
});

test('Dauer freundlich gerundet', async () => {
  const { duration } = await import('../js/distance.js');
  assert.equal(duration(1), '1–2 Tage');
  assert.equal(duration(7.1, true), 'in etwa 7 Tagen');
  assert.equal(duration(20), 'etwa 3 Wochen');
  assert.equal(duration(65, true), 'in etwa 2 Monaten');
  assert.equal(duration(1800), 'etwa 5 Jahre');
  assert.equal(duration(400, true), 'in etwa 1 Jahr');
  assert.equal(duration(560), 'etwa 1,5 Jahre');
});

test('Zielvorschläge nach Schnitt gruppiert', async () => {
  const { goalChoices, nextSuggestions } = await import('../js/distance.js');
  const g = goalChoices('Frankfurt am Main', 146, 36);
  assert.deepEqual(g.map((x) => x.key), ['week', 'mid', 'far'], 'ohne eigene Orte keine Gruppe „Meine Orte“');
  assert.deepEqual(g[0].items.map((c) => c.name).sort(), ['Dortmund', 'Köln', 'Stuttgart']);
  assert.ok(g[1].items.length <= 4 && g[1].items.every((c) => c.left > 36 && c.left <= 216));
  assert.deepEqual(g[2].regions.map((r) => r.name), ['Europa', 'Afrika', 'Asien', 'Amerika', 'Ozeanien', 'Pole']);
  assert.ok(g[2].regions[0].items.length <= 5);
  assert.ok(g[2].regions.find((r) => r.name === 'Asien').items.some((c) => c.name === 'Tokio'));
  assert.ok(g[2].regions.every((r) => r.items.every((c) => c.region === r.name)));
  assert.ok(g.flatMap((x) => x.items).every((c) => c.dist > 146), 'nur noch nicht erreichte');
  const s = nextSuggestions('Frankfurt am Main', 183, 5);
  assert.ok(s.near && s.far);
  assert.ok(s.near.left > 40 && s.near.left < 110, s.near.name);
  assert.ok(s.far.left > 200, s.far.name);
});

test('Meine Orte: Suche, OSM-Treffer, Ziel mit eigenen Koordinaten', async () => {
  const { searchLocal, osmToPlace, goalChoices, goalStatus, journey, placeOf } = await import('../js/distance.js');
  const places = [{ name: 'Sylt', label: 'Schleswig-Holstein, Deutschland', lat: 54.9, lng: 8.31 }, { name: 'Bingen am Rhein', lat: 49.9669, lng: 7.8999 }];
  assert.equal(searchLocal('dusseldorf')[0].name, 'Düsseldorf', 'Umlaute egal');
  assert.equal(searchLocal('STRASSBURG')[0].name, 'Straßburg');
  assert.equal(searchLocal('syl', places)[0].name, 'Sylt');
  assert.deepEqual(searchLocal('  '), []);
  const p = osmToPlace({ name: 'Sylt', lat: '54.9079123', lon: '8.3082456', address: { state: 'Schleswig-Holstein', country: 'Deutschland' } });
  assert.deepEqual(p, { name: 'Sylt', label: 'Schleswig-Holstein, Deutschland', lat: 54.90791, lng: 8.30825 });
  assert.equal(osmToPlace({ display_name: 'Bonn, Nordrhein-Westfalen, Deutschland', lat: '50.7', lon: '7.1' }).name, 'Bonn');
  const g = goalChoices('Frankfurt am Main', 146, 36, places);
  assert.equal(g[0].key, 'mine');
  assert.deepEqual(g[0].items.map((c) => [c.name, c.inside]), [['Bingen am Rhein', true], ['Sylt', false]]);
  const goal = { start_city: 'Frankfurt am Main', city: 'Sylt', lat: 54.9, lng: 8.31 };
  assert.ok(Math.abs(goalStatus(goal, 0).dist - 535) < 15, 'Frankfurt–Sylt ≈ 530 km');
  assert.equal(placeOf({ city: 'Köln' }).lat, 50.9375);
  assert.ok(journey('Frankfurt am Main', 146, places).reached.some((c) => c.name === 'Bingen am Rhein'));
});

test('Etappen: Orte nahe der Linie, mit Abstand, Halbzeit, Ziel am Ende', async () => {
  const { stagesFor, stageStatus } = await import('../js/distance.js');
  const dus = stagesFor({ start_city: 'Frankfurt am Main', city: 'Düsseldorf' });
  assert.deepEqual(dus.map((s) => s.name), ['Wiesbaden', 'Koblenz', 'Köln', 'Düsseldorf']);
  assert.equal(dus.at(-1).final, true);
  const cef = stagesFor({ start_city: 'Frankfurt am Main', city: 'Cefalù', lat: 38.0357, lng: 14.0222 });
  const names = cef.map((s) => s.name);
  assert.ok(names.includes('Mailand') && names.includes('Rom') && names.at(-1) === 'Cefalù', names.join(', '));
  assert.ok(cef.length >= 5 && cef.length <= 11, names.join(', '));
  for (let i = 1; i < cef.length; i += 1) assert.ok(cef[i].dist > cef[i - 1].dist, 'aufsteigend');
  const tok = stagesFor({ start_city: 'Frankfurt am Main', city: 'Tokio' });
  assert.ok(tok.some((s) => s.name === 'Peking'), tok.map((s) => s.name).join(', '));
  assert.ok(tok.some((s) => s.virtual && s.name === 'Halbzeit'), 'Halbzeit in der leeren Mitte');
  // Stand: 146 km Richtung Düsseldorf, davon 52 km diesen Monat
  const st = stageStatus(dus, 146, 52);
  assert.equal(st.reached, 2);
  assert.equal(st.prev.name, 'Koblenz');
  assert.equal(st.next.name, 'Köln');
  assert.ok(st.legShare > 0.8 && st.legShare < 0.95);
  assert.ok(Math.abs(st.legBeforeMonth - 12 / 71) < 0.001, 'Monat begann bei km 94, Etappe bei km 82');
  assert.deepEqual(st.passedThisMonth, []);
  const st2 = stageStatus(dus, 146, 80);
  assert.equal(st2.legBeforeMonth, 0, 'Koblenz erst diesen Monat erreicht');
  assert.deepEqual(st2.passedThisMonth.map((s) => s.name), ['Koblenz']);
  assert.equal(stageStatus(dus, 0).next.name, 'Wiesbaden');
});

test('Stadt-Wissen: Titel, Prüfung der Wikipedia-Antwort, Anriss', async () => {
  const { wikiTitle, pickSummary, teaser, city } = await import('../js/distance.js');
  assert.equal(wikiTitle('Luxemburg'), 'Luxemburg (Stadt)');
  assert.equal(wikiTitle('Köln'), 'Köln');
  const ok = { type: 'standard', title: 'Köln', description: 'Großstadt in NRW', extract: 'Köln ist eine Großstadt.', coordinates: { lat: 50.94, lon: 6.96 }, thumbnail: { source: 'https://x/k.jpg' }, content_urls: { mobile: { page: 'https://de.m.wikipedia.org/wiki/K%C3%B6ln' } } };
  const s = pickSummary(ok, city('Köln'));
  assert.equal(s.title, 'Köln');
  assert.equal(s.image, 'https://x/k.jpg');
  assert.equal(s.url, 'https://de.m.wikipedia.org/wiki/K%C3%B6ln');
  assert.equal(pickSummary({ ...ok, type: 'disambiguation' }, city('Köln')), null, 'Begriffsklärung');
  assert.equal(pickSummary({ ...ok, coordinates: { lat: 40.7, lon: -74 } }, city('Köln')), null, 'falscher Ort');
  assert.equal(pickSummary({ ...ok, coordinates: { lat: 49.87, lon: 8.65 } }, city('Wiesbaden')), null, 'Nachbarort (Darmstadt statt Wiesbaden)');
  assert.ok(pickSummary({ ...ok, coordinates: undefined }, city('Köln')), 'ohne Koordinaten okay');
  assert.ok(pickSummary({ ...ok, title: 'Bali', coordinates: { lat: -8.34, lon: 115.09 } }, city('Bali')), 'Insel: Mittelpunkt weiter weg okay');
  assert.equal(pickSummary({ ...ok, extract: '' }, city('Köln')), null);
  const { titleMatches } = await import('../js/distance.js');
  assert.equal(titleMatches('Bingen am Rhein', 'Bingen am Rhein'), true);
  assert.equal(titleMatches('Darmstadt', 'Wiesbaden'), false);
  assert.equal(titleMatches('Cefalù', 'Cefalu'), true, 'Akzente egal');
  assert.equal(teaser('Kurz.'), 'Kurz.');
  const long = 'Erster Satz ist hier ziemlich lang und erzählt etwas über die Stadt und ihre Geschichte. ' + 'Zweiter Satz. '.repeat(30);
  assert.ok(teaser(long).endsWith('.') && teaser(long).length <= 220);
});
