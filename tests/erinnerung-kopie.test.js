// Die Edge Function „erinnerung“ trägt eine Kopie von js/remind.js in sich (Supabase erlaubt keine Importe von GitHub Pages).
// Dieser Test prüft, dass die Kopie genauso entscheidet wie die App. Schlägt er fehl:
//   node supabase/functions/erinnerung/einbetten.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as app from '../js/remind.js';

const src = readFileSync(new URL('../supabase/functions/erinnerung/index.ts', import.meta.url), 'utf8');
const block = src.split('// ── BEGIN Kopie von js/remind.js (nicht hier ändern – einbetten.mjs) ──')[1].split('// ── END Kopie von js/remind.js ──')[0];
const copy = await import('data:text/javascript,' + encodeURIComponent(block + '\nexport { openForReminder, reminderText, isDue, zonedNow };'));

const H = (id, extra = {}) => ({ id, name: id, schedule: 'daily', start_day: '2026-10-01', archived: false, ...extra });
const habits = [
  H('Lesen', { mini_text: '1 Seite' }), H('Dehnen', { schedule: 'weekdays', schedule_days: [1, 3, 5] }),
  H('Laufen', { schedule: 'per_week', schedule_count: 3, schedule_min: 2 }), H('Schritte', { auto_metric: 'steps' }),
  H('Aus', { remind: false }), H('Monat', { schedule: 'per_month', schedule_count: 4 })
];
const logs = [{ habit_id: 'Laufen', day: '2026-10-27', status: 'done' }, { habit_id: 'Lesen', day: '2026-10-30', status: 'mini' }];
const pauses = [{ habit_id: 'Dehnen', start_day: '2026-10-28', end_day: '2026-10-28' }, { habit_id: null, start_day: '2026-11-07', end_day: '2026-11-08' }];

test('Kopie in der Edge Function entscheidet wie die App', () => {
  for (let i = 0; i < 40; i += 1) {
    const d = new Date(Date.UTC(2026, 9, 24 + i, 12)).toISOString().slice(0, 10);
    const strip = (list) => list.map((o) => [o.name, o.need || 0, o.word || '']);
    assert.deepEqual(strip(copy.openForReminder(habits, logs, pauses, d)), strip(app.openForReminder(habits, logs, pauses, d)), d);
    assert.deepEqual(copy.reminderText(copy.openForReminder(habits, logs, pauses, d)), app.reminderText(app.openForReminder(habits, logs, pauses, d)), d);
  }
  for (const [at, now, last] of [[1200, 1199, null], [1200, 1205, null], [1200, 1205, '2026-10-26'], [480, 700, null]]) {
    assert.equal(copy.isDue(at, now, last, '2026-10-26'), app.isDue(at, now, last, '2026-10-26'));
  }
  const t = new Date('2026-10-26T23:30:00Z');
  assert.deepEqual(copy.zonedNow(t, 'Europe/Berlin'), app.zonedNow(t, 'Europe/Berlin'));
});
