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
  assert.equal(thu.sub, 'diese Woche 3 von 3 · Ziel erreicht');
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

const sport = { id: 's', kind: 'check', schedule: 'per_week', schedule_count: 5, schedule_min: 3, start_day: '2026-08-01', archived: false };

test('Mini-Woche: Alltag zeigt das Ziel, Ring schützt ab dem Minimum', () => {
  // Woche ab Mo 12.10.: Mo, Di, Mi trainiert → Donnerstag
  const logs = ['2026-10-12', '2026-10-13', '2026-10-14'].map((day) => ({ habit_id: 's', day, status: 'done' }));
  const idx = indexLogs(logs);
  const thu = todayItems([sport], idx, [], '2026-10-15')[0];
  assert.equal(thu.sub, 'diese Woche 3 von 5 · noch 2 bis zum Ziel');
  assert.equal(thu.period.state, 'mini');
  assert.equal(thu.counted, false, 'nach der Mini-Woche zieht ein trainingsfreier Tag den Heute-Ring nicht runter');
  const tue = todayItems([sport], indexLogs(logs.slice(0, 1)), [], '2026-10-13')[0];
  assert.equal(tue.sub, 'diese Woche 1 von 5 · noch 2 bis zur Mini-Woche');
  assert.equal(tue.counted, true);
});

test('Mini-Woche: Quote ist bei 3 von 5 voll, 5 von 5 bleibt 100 %', () => {
  const end = '2026-10-18'; // Sonntag
  const three = ['2026-10-12', '2026-10-14', '2026-10-16'].map((day) => ({ habit_id: 's', day, status: 'done' }));
  assert.equal(windowQuota([sport], indexLogs(three), [], end, 7).pct, 100);
  const five = ['2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15', '2026-10-16'].map((day) => ({ habit_id: 's', day, status: 'done' }));
  assert.equal(windowQuota([sport], indexLogs(five), [], end, 7).pct, 100);
  // 2 Trainings, Sonntag offen → 6 aktive Tage, erwartet 3 × 6/7 ≈ 2,57 → 78 %
  const two = three.slice(0, 2);
  assert.equal(windowQuota([sport], indexLogs(two), [], end, 7).pct, 78);
});

test('Kalenderwoche', async () => {
  const { isoWeek } = await import('../js/stats.js');
  assert.equal(isoWeek('2026-10-12'), 42);
  assert.equal(isoWeek('2026-01-01'), 1);
  assert.equal(isoWeek('2026-12-28'), 53);
  assert.equal(isoWeek('2027-01-04'), 1);
  assert.equal(isoWeek('2026-03-30'), 14); // nach der Zeitumstellung
});

test('Wochenübersicht und freundlicher Hinweis', () => {
  // vier abgeschlossene Wochen (KW 38–41) mit je 3 Trainings, laufende KW 42
  const logs = [];
  for (const mon of ['2026-09-14', '2026-09-21', '2026-09-28', '2026-10-05']) {
    for (const off of [0, 2, 4]) logs.push({ habit_id: 's', day: addDays(mon, off), status: 'done' });
  }
  const idx = indexLogs(logs);
  const s = habitStats(sport, idx, [], TODAY);
  const last = s.periods.list.slice(-5).map((p) => `${p.label}:${p.state}`);
  assert.deepEqual(last, ['KW 38:mini', 'KW 39:mini', 'KW 40:mini', 'KW 41:mini', 'KW 42:running']);
  assert.ok(s.hint, 'nach 4 Mini-Wochen kommt der Hinweis');
  assert.equal(s.hint.count, 4);
  // eine Ziel-Woche dazwischen unterbricht das Muster
  for (const off of [1, 3]) logs.push({ habit_id: 's', day: addDays('2026-10-05', off), status: 'done' });
  assert.equal(habitStats(sport, indexLogs(logs), [], TODAY).hint, null);
});

test('Pausen und Start mitten in der Woche senken Ziel und Minimum anteilig', async () => {
  const { periodNeeds } = await import('../js/stats.js');
  const pauses = [{ habit_id: null, start_day: '2026-10-12', end_day: '2026-10-14' }]; // Mo–Mi Pause
  assert.deepEqual(periodNeeds(sport, '2026-10-12', '2026-10-18', pauses), { target: 3, min: 2, active: 4, length: 7 });
  assert.deepEqual(periodNeeds(sport, '2026-10-12', '2026-10-18', []), { target: 5, min: 3, active: 7, length: 7 });
  const lateStart = { ...sport, start_day: '2026-10-15' }; // Start Donnerstag
  assert.deepEqual(periodNeeds(lateStart, '2026-10-12', '2026-10-18', []), { target: 3, min: 2, active: 4, length: 7 });
  // Woche mit Pause: 2 Trainings reichen für die Mini-Woche
  const logs = ['2026-10-15', '2026-10-16'].map((day) => ({ habit_id: 's', day, status: 'done' }));
  const sum = habitStats(sport, indexLogs(logs), pauses, '2026-10-19').periods.list.slice(-2);
  assert.equal(sum[0].state, 'mini');
  assert.equal(sum[0].target, 3);
});

test('Häufigkeitstexte', () => {
  assert.equal(scheduleText(daily), 'täglich');
  assert.equal(scheduleText(mwf), 'Mo, Mi, Fr');
  assert.equal(scheduleText(perWeek), '3× pro Woche');
});

test('Heute: Offenes oben, Erledigtes unten, Pausiertes ganz unten – sonst eigene Reihenfolge', async () => {
  const { sortTodayItems } = await import('../js/stats.js');
  const it = (id, extra = {}) => ({ habit: { id }, hit: false, paused: false, period: null, ...extra });
  const list = [it('a', { hit: true }), it('b'), it('c', { paused: true }), it('d', { period: { state: 'goal' } }), it('e'), it('f', { hit: true })];
  assert.deepEqual(sortTodayItems(list).map((i) => i.habit.id), ['b', 'e', 'a', 'd', 'f', 'c']);
});
