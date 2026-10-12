import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addDays, weekday, weekStart, daysInMonth, diffDays } from '../js/dates.js';
import { indexLogs, todayItems, todayRing, windowQuota, totalHits, habitStats, scheduleText, isDueOn } from '../js/stats.js';

const TODAY = '2026-10-12'; // Montag

const daily = { id: 'd', kind: 'check', schedule: 'daily', start_day: '2026-09-01', archived: false };
const mwf = { id: 'w', kind: 'check', schedule: 'weekdays', schedule_days: [1, 3, 5], start_day: '2026-09-01', archived: false };
const perWeek = { id: 'p', kind: 'check', schedule: 'per_week', schedule_count: 3, start_day: '2026-09-01', archived: false };

test('Datumshilfen', () => {
  assert.equal(weekday('2026-10-12'), 1);
  assert.equal(weekday('2026-10-18'), 7);
  assert.equal(weekStart('2026-10-15'), '2026-10-12');
  assert.equal(addDays('2026-10-31', 1), '2026-11-01');
  assert.equal(addDays('2026-03-29', 1), '2026-03-30'); // Zeitumstellung
  assert.equal(daysInMonth('2026-02-10'), 28);
  assert.equal(diffDays('2026-10-01', '2026-10-12'), 11);
});

test('Fälligkeit', () => {
  assert.equal(isDueOn(mwf, '2026-10-12'), true);
  assert.equal(isDueOn(mwf, '2026-10-13'), false);
  assert.equal(isDueOn(daily, '2026-08-31'), false, 'vor dem Start nicht fällig');
});

test('Heute-Ring: Mini zählt, Pause zählt nicht', () => {
  const logs = [{ habit_id: 'd', day: TODAY, status: 'mini' }];
  const pauses = [{ habit_id: 'w', start_day: TODAY, end_day: TODAY }];
  const items = todayItems([daily, mwf], indexLogs(logs), pauses, TODAY);
  assert.equal(items.length, 2);
  assert.deepEqual(todayRing(items), { done: 1, due: 1 });
  assert.equal(items.find((i) => i.habit.id === 'w').paused, true);
});

test('X-mal pro Woche: zählt nur, solange das Wochenziel offen ist', () => {
  // Woche ab Mo 05.10.: drei Treffer bis Mittwoch → am Donnerstag nicht mehr „fällig“
  const logs = ['2026-10-05', '2026-10-06', '2026-10-07'].map((day) => ({ habit_id: 'p', day, status: 'done' }));
  const idx = indexLogs(logs);
  const thu = todayItems([perWeek], idx, [], '2026-10-08')[0];
  assert.equal(thu.counted, false);
  assert.equal(thu.sub, 'diese Woche geschafft');
  const mon = todayItems([perWeek], idx, [], TODAY)[0];
  assert.equal(mon.counted, true);
  assert.equal(mon.sub, 'diese Woche 0 von 3');
});

test('Quote: Heute kann nur helfen', () => {
  const logs = [];
  for (let i = 1; i <= 6; i += 1) logs.push({ habit_id: 'd', day: addDays(TODAY, -i), status: 'done' });
  const idx = indexLogs(logs);
  // 6 von 6 geschafft, heute noch offen → 100 %, nicht 86 %
  assert.equal(windowQuota([daily], idx, [], TODAY, 7).pct, 100);
  logs.push({ habit_id: 'd', day: TODAY, status: 'done' });
  assert.equal(windowQuota([daily], indexLogs(logs), [], TODAY, 7).pct, 100);
});

test('Quote: Pausentage fallen raus', () => {
  const logs = [{ habit_id: 'd', day: addDays(TODAY, -1), status: 'done' }];
  const pauses = [{ habit_id: null, start_day: addDays(TODAY, -6), end_day: addDays(TODAY, -2) }];
  const q = windowQuota([daily], indexLogs(logs), pauses, TODAY, 7);
  assert.equal(q.expected, 1);
  assert.equal(q.pct, 100);
});

test('Quote: X-mal pro Woche wird anteilig erwartet und gedeckelt', () => {
  // 7 Tage, 3× pro Woche erwartet → 6 Treffer zählen nur als 3 (heute offen → 6 aktive Tage)
  const logs = [];
  for (let i = 1; i <= 6; i += 1) logs.push({ habit_id: 'p', day: addDays(TODAY, -i), status: 'done' });
  const q = windowQuota([perWeek], indexLogs(logs), [], TODAY, 7);
  assert.equal(q.pct, 100);
  const half = windowQuota([perWeek], indexLogs(logs.slice(0, 1)), [], TODAY, 7);
  assert.ok(half.pct > 30 && half.pct < 45, `erwartet ~39 %, war ${half.pct}`);
});

test('Gesamtzahl zählt nur Treffer', () => {
  assert.equal(totalHits([
    { habit_id: 'd', day: TODAY, status: 'done' },
    { habit_id: 'd', day: addDays(TODAY, -1), status: 'mini' },
    { habit_id: 'd', day: addDays(TODAY, -2), status: 'partial' }
  ]), 2);
});

test('Detail-Statistik', () => {
  const logs = [
    { habit_id: 'd', day: '2026-10-02', status: 'done' },
    { habit_id: 'd', day: '2026-10-05', status: 'mini' },
    { habit_id: 'd', day: '2026-09-10', status: 'done' },
    { habit_id: 'd', day: '2026-09-11', status: 'done' },
    { habit_id: 'd', day: '2026-09-12', status: 'done' }
  ];
  const s = habitStats(daily, indexLogs(logs), [], TODAY);
  assert.equal(s.total, 5);
  assert.equal(s.last30, 2, '10.–12.09. liegen mehr als 30 Tage zurück');
  assert.equal(s.best.key, '2026-09');
  assert.equal(s.months.length, 6);
  assert.equal(s.months[5].key, '2026-10');
  assert.equal(s.months[5].running, true);
  assert.equal(s.cells.length, 31);
  assert.equal(s.offset, 3); // 1. Oktober 2026 ist ein Donnerstag
  assert.equal(s.cells[4].state, 'mini');
  assert.equal(s.cells[12].state, 'future');
});

test('Häufigkeitstexte', () => {
  assert.equal(scheduleText(daily), 'täglich');
  assert.equal(scheduleText(mwf), 'Mo, Mi, Fr');
  assert.equal(scheduleText(perWeek), '3× pro Woche');
});
