import { test } from 'node:test';
import assert from 'node:assert/strict';
import { freeDays, goalFor, weeks, weekDays, savings, patterns, dayAfter, drinksByDay, costsOf } from '../js/alcohol.js';

// Start Mittwoch 21.10.2026
const S0 = { started_on: '2026-10-21', costs: { price: 2, per_week: 14, goal_start: 5, goal_every: 2 } };
const drink = (day, qty = 1, time = '20:00', tags = []) => ({ day, qty, tags, at: new Date(`${day}T${time}:00`).toISOString() });

test('Alkoholfreie Tage: nur abgeschlossene, Biertage zählen nicht mit', () => {
  assert.equal(freeDays([], S0, '2026-10-21'), 0, 'heute zählt erst, wenn der Tag vorbei ist');
  assert.equal(freeDays([], S0, '2026-10-27'), 6);
  assert.equal(freeDays([drink('2026-10-26', 3)], S0, '2026-10-28'), 6);
  assert.equal(freeDays([drink('2026-10-20', 3)], S0, '2026-10-22'), 1, 'vor dem Start egal');
});

test('Ziel wächst alle 2 Wochen um 1, höchstens 7', () => {
  assert.equal(goalFor(S0, '2026-10-21'), 5);
  assert.equal(goalFor(S0, '2026-10-26'), 5); // Woche 2
  assert.equal(goalFor(S0, '2026-11-02'), 6); // Woche 3
  assert.equal(goalFor(S0, '2027-03-01'), 7);
  assert.equal(goalFor({ ...S0, costs: { ...S0.costs, goal_every: 0 } }, '2027-03-01'), 5);
});

test('Wochen und Wochentage', () => {
  const ev = [drink('2026-10-26', 2)];
  const w = weeks(ev, S0, '2026-10-29');
  assert.equal(w.length, 2);
  assert.deepEqual([w[0].free, w[0].days], [5, 5]); // Mi–So
  assert.deepEqual([w[1].free, w[1].days, w[1].current], [2, 3, true]); // Mo Bier, Di+Mi frei, Do heute
  const d = weekDays(ev, S0, '2026-10-29').map((x) => x.state);
  assert.deepEqual(d, ['drink', 'free', 'free', 'today', 'future', 'future', 'future']);
  assert.equal(weekDays([], S0, '2026-10-22')[0].state, 'before');
});

test('Gespart wächst nur', () => {
  const s1 = savings([], S0, '2026-10-24'); // 3 Tage × 2 Bier × 2 €
  assert.equal(s1.euro, 12);
  assert.equal(s1.perDay, 4);
  const s2 = savings([drink('2026-10-24', 6)], S0, '2026-10-26'); // Sa 6 Bier nimmt nichts weg, So zählt voll
  assert.equal(s2.euro, 16);
  assert.equal(costsOf({ costs: { price: 0 } }).price, 2, 'Unsinn → Standard');
});

test('Muster: Situationen, Tageszeit, Wochentag, Ø', () => {
  assert.equal(patterns([]), null);
  const p = patterns([
    drink('2026-10-23', 3, '19:00', ['Langeweile', 'allein zu Hause']),
    drink('2026-10-30', 4, '21:30', ['Langeweile']),
    drink('2026-10-30', 1, '23:30', [])
  ]);
  assert.deepEqual(p.tags[0], { label: 'Langeweile', n: 2 });
  assert.equal(p.part, 'abends');
  assert.equal(p.weekday, 'Freitag'); // 23. und 30.10. sind beide Freitage
  assert.equal(p.avg, 4);
  assert.equal(p.drinkDays, 2);
  assert.equal(patterns([drink('2026-10-23'), drink('2026-10-24')]).weekday, null, 'Fr und Sa je einmal: kein „häufigster Tag“');
  assert.deepEqual(drinksByDay([drink('2026-10-30', 4), drink('2026-10-30', 1)]).get('2026-10-30'), 5);
});

test('Am Tag danach', () => {
  const rest = [{ day: '2026-10-22', v: 64 }, { day: '2026-10-23', v: 65 }, { day: '2026-10-25', v: 70 }];
  const act = [{ day: '2026-10-22', steps: 8000 }, { day: '2026-10-25', steps: 4000 }];
  const a = dayAfter([drink('2026-10-24', 5)], S0, '2026-10-26', rest, act);
  assert.equal(a.rest.after, 70);
  assert.equal(a.rest.other, 64.5);
  assert.equal(a.steps.after, 4000);
  assert.equal(a.afterDays, 1);
});
