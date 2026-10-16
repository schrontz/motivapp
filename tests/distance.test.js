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
