import { test } from 'node:test';
import assert from 'node:assert/strict';
import { costPerUnit, isNight, awakeMinutes, phase, baseline, currentInterval, timer, savings, recentAvg, countsByDay, costStats, planProjection } from '../js/reduce.js';

const S0 = { started_on: '2026-10-01', night_from: '23:00', night_to: '07:00', step_min: 5, adjust_min: 0 };
const ev = (day, time) => ({ day, at: new Date(`${day}T${time}:00`).toISOString() });

test('Kosten pro Zigarette aus Jans Material', () => {
  const c = costPerUnit({ tobacco_price: 6.75, tobacco_g: 30, paper_price: 2, paper_qty: 100, filter_price: 2, filter_qty: 120, g_per_unit: 0.6 });
  assert.equal(Math.round(c.total * 1000) / 1000, 0.172);
  assert.equal(Math.round(c.perPack), 50);
  assert.equal(costPerUnit({ tobacco_g: 0 }).tobacco, 0, 'keine Division durch 0');
});

test('Nachtruhe und wache Minuten', () => {
  assert.equal(isNight(new Date('2026-10-01T23:30:00')), true);
  assert.equal(isNight(new Date('2026-10-01T06:59:00')), true);
  assert.equal(isNight(new Date('2026-10-01T07:00:00')), false);
  assert.equal(Math.round(awakeMinutes('2026-10-01T10:00:00', '2026-10-01T11:15:00')), 75);
  // 22:30 → 07:20: 30 Min abends + 20 Min morgens
  assert.equal(Math.round(awakeMinutes(new Date('2026-10-01T22:30:00'), new Date('2026-10-02T07:20:00'))), 50);
  assert.equal(Math.round(awakeMinutes(new Date('2026-10-01T10:00:00'), new Date('2026-10-11T10:00:00'))), 10 * 960, '10 Tage = 10 × 16 wache Stunden');
});

test('Phase: erste Woche zählen, dann Abstand mit Wochen', () => {
  assert.deepEqual(phase(S0, '2026-10-01'), { name: 'watch', day: 1 });
  assert.deepEqual(phase(S0, '2026-10-07'), { name: 'watch', day: 7 });
  assert.deepEqual(phase(S0, '2026-10-08'), { name: 'interval', week: 1, since: '2026-10-08' });
  assert.equal(phase(S0, '2026-10-15').week, 2);
  assert.equal(phase(null, '2026-10-15'), null);
});

test('Ausgangswert und wachsender Abstand', () => {
  const events = [];
  for (let d = 1; d <= 7; d += 1) {
    const day = `2026-10-0${d}`;
    for (const t of ['08:00', '09:15', '10:30', '11:45']) events.push(ev(day, t));
  }
  events.push(ev('2026-10-09', '08:00')); // nach der Woche – zählt nicht zum Ausgangswert
  const b = baseline(events, S0);
  assert.equal(b.perDay, 4);
  assert.equal(b.gap, 75, 'Abstand am selben Tag, nicht über Nacht');
  assert.equal(currentInterval(b, S0, '2026-10-05'), null, 'in der ersten Woche kein Abstand');
  assert.deepEqual(currentInterval(b, S0, '2026-10-08'), { minutes: 75, next: 80, week: 1 });
  assert.equal(currentInterval(b, S0, '2026-10-22').minutes, 85, 'Woche 3: +2×5');
  assert.equal(currentInterval(b, { ...S0, adjust_min: -10 }, '2026-10-22').minutes, 75, 'eigene Korrektur');
});

test('Timer und Gespartes (wächst nur)', () => {
  const b = { perDay: 10, gap: 80 };
  const events = [ev('2026-10-08', '09:00'), ev('2026-10-08', '10:00')];
  const t = timer(events, 80, new Date('2026-10-08T10:50:00'), S0);
  assert.equal(t.since, 50);
  assert.equal(t.left, 30);
  // Tage: 8.10. 6 Stück (−4), 9.10. 14 Stück (darüber → 0, nimmt nichts weg), 10.10. 8 Stück (−2); heute (11.) zählt nicht
  const ev2 = [];
  const add = (day, n) => { for (let i = 0; i < n; i += 1) ev2.push(ev(day, `1${i % 10}:00`)); };
  add('2026-10-08', 6); add('2026-10-09', 14); add('2026-10-10', 8); add('2026-10-11', 1);
  const s = savings(ev2, b, S0, '2026-10-11', 0.17);
  assert.equal(s.units, 6);
  assert.equal(s.euro, 1.02);
  assert.deepEqual(savings(ev2, b, S0, '2026-10-05', 0.17), { units: 0, euro: 0 }, 'erste Woche: noch nichts gespart');
  assert.equal(countsByDay(ev2).get('2026-10-09'), 14);
  assert.equal(recentAvg(ev2, '2026-10-11', 3), 9.3);
});

test('Kosten: ausgegeben seit Start und hochgerechnet', () => {
  // Start 1.10., heute 4.10.: 10, 12, 8 abgeschlossen + heute 3
  const events = [];
  [['2026-10-01', 10], ['2026-10-02', 12], ['2026-10-03', 8], ['2026-10-04', 3]].forEach(([d, n]) => { for (let i = 0; i < n; i += 1) events.push(ev(d, '10:00')); });
  events.push(ev('2026-09-30', '10:00')); // vor dem Start: zählt nicht
  const c = costStats(events, S0, '2026-10-04', 0.2, 'start');
  assert.equal(c.spent.units, 33);
  assert.equal(c.spent.euro, 6.6);
  assert.equal(c.days, 3);
  assert.equal(c.rate, 10);
  assert.equal(c.perDay, 2);
  assert.equal(c.perMonth, 61);
  assert.equal(c.perYear, 730);
  // Am ersten Tag: noch kein Schnitt
  const first = costStats(events, S0, '2026-10-01', 0.2);
  assert.equal(first.rate, null);
  assert.equal(first.perYear, null);
  assert.equal(first.spent.units, 10);
});

test('Kosten: Basis letzte 7 Tage folgt dem Weniger', () => {
  const s = { ...S0, started_on: '2026-09-01' };
  const events = [];
  for (let d = '2026-09-01'; d < '2026-10-10'; d = new Date(new Date(d + 'T12:00').getTime() + 86400000).toISOString().slice(0, 10)) {
    const n = d < '2026-10-03' ? 14 : 7;
    for (let i = 0; i < n; i += 1) events.push(ev(d, '10:00'));
  }
  const recent = costStats(events, s, '2026-10-10', 0.2, 'recent');
  const start = costStats(events, s, '2026-10-10', 0.2, 'start');
  assert.equal(recent.rate, 7);
  assert.ok(start.rate > 12);
  assert.ok(recent.perYear < start.perYear);
});

test('Plan-Kurve: Kosten sinken mit wachsendem Abstand, nie über dem Ausgangswert', () => {
  const base = { perDay: 13, gap: 74 };
  const p = planProjection(base, S0, '2026-10-20', 0.17);
  assert.equal(p.length, 13);
  // jetzt: Woche 2 → 75 + 5 = 80 Min, 960 wache Minuten → 12 am Tag
  assert.equal(p[0].interval, 80);
  assert.equal(p[0].units, 12);
  assert.ok(p[12].euro < p[6].euro && p[6].euro < p[0].euro);
  // In der ersten Woche: erst noch der Ausgangswert
  const w = planProjection(base, S0, '2026-10-02', 0.17);
  assert.equal(w[0].units, 13);
  // Ohne Zuwachs: flach
  const flat = planProjection(base, { ...S0, step_min: 0 }, '2026-10-20', 0.17);
  assert.equal(flat[0].euro, flat[12].euro);
  assert.equal(planProjection({ perDay: 13, gap: null }, S0, '2026-10-20', 0.17), null);
});
