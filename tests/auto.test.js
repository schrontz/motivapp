import { test } from 'node:test';
import assert from 'node:assert/strict';
import { autoLogChanges, matchesCategories, categoryName, tileValues } from '../js/auto.js';

const TODAY = '2026-10-13';
const sport = { id: 's', kind: 'check', auto_categories: [16, 17], auto_min_minutes: 20, start_day: '2026-10-13', archived: false };
const steps = { id: 'st', kind: 'count', target: 5000, mini_value: 2000, auto_metric: 'steps', start_day: '2026-10-01', archived: false };
const workouts = [
  { day: '2026-10-13', category: 16, duration_min: 52 },
  { day: '2026-10-13', category: 1, duration_min: 40 },   // Gehen zählt nicht
  { day: '2026-10-12', category: 16, duration_min: 50 },  // vor dem Start
  { day: '2026-10-11', category: 16, duration_min: 10 }   // zu kurz (und vor dem Start)
];

test('Krafttraining hakt Sport ab – Gehen, zu kurz und vor dem Start nicht', () => {
  const c = autoLogChanges({ habits: [sport], logs: [], workouts, activity: [], dismissals: [], today: TODAY });
  assert.deepEqual(c, [{ habit_id: 's', day: '2026-10-13', status: 'done', value: null, source: 'withings' }]);
});

test('Abgelehnter Auto-Haken kommt nicht wieder, eigener Eintrag bleibt unangetastet', () => {
  assert.equal(autoLogChanges({ habits: [sport], logs: [], workouts, activity: [], dismissals: [{ habit_id: 's', day: TODAY }], today: TODAY }).length, 0);
  assert.equal(autoLogChanges({ habits: [sport], logs: [{ habit_id: 's', day: TODAY, status: 'mini', source: 'manual' }], workouts, activity: [], dismissals: [], today: TODAY }).length, 0);
});

test('Schritte füllen Zahl-Gewohnheit, aktualisieren nur eigene Auto-Werte', () => {
  const activity = [{ day: '2026-10-13', steps: 6240 }, { day: '2026-10-12', steps: 2500 }, { day: '2026-10-11', steps: 800 }];
  const c = autoLogChanges({ habits: [steps], logs: [], workouts: [], activity, dismissals: [], today: TODAY });
  assert.deepEqual(c.map((x) => `${x.day}:${x.status}:${x.value}`), ['2026-10-13:done:6240', '2026-10-12:mini:2500', '2026-10-11:partial:800']);
  const logs = [
    { habit_id: 'st', day: '2026-10-13', status: 'done', value: 6240, source: 'withings' }, // unverändert → nichts
    { habit_id: 'st', day: '2026-10-12', status: 'done', value: 9000, source: 'manual' }    // selbst → nicht anfassen
  ];
  const c2 = autoLogChanges({ habits: [steps], logs, workouts: [], activity, dismissals: [], today: TODAY });
  assert.deepEqual(c2.map((x) => x.day), ['2026-10-11']);
});

test('Kategorien und „Sonstiges“', () => {
  assert.equal(matchesCategories(16, [16, 17]), true);
  assert.equal(matchesCategories(28, [-1]), true, 'Yoga fällt unter Sonstiges');
  assert.equal(matchesCategories(2, [-1]), false, 'Laufen hat eine eigene Gruppe');
  assert.equal(categoryName(16), 'Krafttraining');
  assert.equal(categoryName(999), 'Art 999');
});

test('Kacheln', () => {
  const activity = [{ day: '2026-10-13', steps: 6240, active_minutes: 30, distance_m: 4810 }, { day: '2026-10-12', steps: 8000 }, { day: '2026-10-11', steps: 6000 }];
  const t = tileValues({ activity, workouts, today: TODAY });
  assert.equal(t.steps.value, 6240);
  assert.equal(t.steps.avg7, 7000);
  assert.equal(t.training.count, 3, 'Gehen zählt nicht als Training');
  assert.equal(t.distance.value, 4.8);
});
