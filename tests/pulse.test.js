import { test } from 'node:test';
import assert from 'node:assert/strict';
import { restValues, restSeries, lastRest, restCompare } from '../js/pulse.js';

const n = (day, hr) => ({ day, hr_avg: hr });
const a = (day, hr) => ({ day, rest_hr: hr, samples: 60 });
const T = '2026-10-20';

test('Quelle: Tageswerte, wenn nachts keine Uhr – heute zählt noch nicht', () => {
  const r = restValues([], [a('2026-10-18', 58), a('2026-10-19', 60), a(T, 55), a('2026-10-17', null), a('2026-10-16', 0)], T);
  assert.equal(r.kind, 'day');
  assert.deepEqual(r.vals.map((x) => x.day), ['2026-10-18', '2026-10-19']);
});

test('Quelle: Schlaf, wenn genug Nächte da sind', () => {
  const sleep = ['2026-10-14', '2026-10-15', '2026-10-16', '2026-10-17', '2026-10-18'].map((d) => n(d, 61));
  assert.equal(restValues(sleep, [a('2026-10-19', 55)], T).kind, 'sleep');
  // Nur zwei alte Nächte → Tageswerte gewinnen
  assert.equal(restValues(sleep.slice(0, 2), [a('2026-10-19', 55)], T).kind, 'day');
  assert.equal(restValues([], [], T), null);
});

test('Verlauf mit 14-Tage-Schnitt', () => {
  const s = restSeries([{ day: '2026-10-01', v: 60 }, { day: '2026-10-02', v: 64 }, { day: '2026-10-03', v: 62 }]);
  assert.equal(s[2].avg, 62);
  assert.equal(restSeries([{ day: '2026-10-01', v: 60 }, { day: '2026-10-05', v: 64 }], '2026-10-03').length, 1);
});

test('Letzter Wert nur, wenn frisch', () => {
  assert.equal(lastRest([{ day: '2026-10-19', v: 60 }], T).v, 60);
  assert.equal(lastRest([{ day: '2026-10-01', v: 60 }], T), null);
});

test('Vorher / jetzt rund um den Start', () => {
  const vals = [];
  for (let i = 24; i <= 30; i += 1) vals.push({ day: `2026-09-${i}`, v: 65 });
  for (let i = 13; i <= 19; i += 1) vals.push({ day: `2026-10-${i}`, v: 62 });
  const c = restCompare(vals, '2026-10-01', T);
  assert.equal(c.before.v, 65);
  assert.equal(c.recent.v, 62);
  assert.equal(c.delta, -3);
  assert.equal(restCompare(vals.slice(5), '2026-10-01', T).before, null);
});
