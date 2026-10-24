import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openForReminder, reminderText, isDue, usualTime, timeText, parseTime, zonedNow, remindable } from '../js/remind.js';

const H = (id, extra = {}) => ({ id, name: id, schedule: 'daily', start_day: '2026-10-01', archived: false, ...extra });
const log = (habit_id, day, status = 'done', extra = {}) => ({ habit_id, day, status, ...extra });
// Montag 26.10.2026
const MO = '2026-10-26';

test('Offen: tägliche Gewohnheit ohne Eintrag, Mini und erledigt zählen nicht', () => {
  const habits = [H('Lesen'), H('Dehnen'), H('Wasser')];
  const logs = [log('Dehnen', MO, 'mini'), log('Wasser', MO, 'partial')];
  assert.deepEqual(openForReminder(habits, logs, [], MO).map((o) => o.name), ['Lesen', 'Wasser']);
});

test('Draußen: automatisch (Withings), abgewählt, archiviert, heute nicht dran', () => {
  const habits = [
    H('Schritte', { auto_metric: 'steps' }), H('Sport', { auto_categories: [16] }), H('Aus', { remind: false }),
    H('Alt', { archived: true }), H('Mi', { schedule: 'weekdays', schedule_days: [3] }), H('Neu', { start_day: '2026-10-27' })
  ];
  assert.deepEqual(openForReminder(habits, [], [], MO), []);
  assert.equal(remindable(H('x')), true);
});

test('Pausen: Pause für alles → still, Pause einer Gewohnheit → nur die fehlt', () => {
  const habits = [H('Lesen'), H('Dehnen')];
  assert.deepEqual(openForReminder(habits, [], [{ habit_id: null, start_day: MO, end_day: MO }], MO), []);
  assert.deepEqual(openForReminder(habits, [], [{ habit_id: 'Lesen', start_day: '2026-10-20', end_day: MO }], MO).map((o) => o.name), ['Dehnen']);
});

test('Woche: erst dabei, wenn es knapp wird', () => {
  const run = H('Laufen', { schedule: 'per_week', schedule_count: 3 });
  // Freitag, 0 von 3 → Fr, Sa, So frei = 3 Tage für 3 Male → knapp
  assert.deepEqual(openForReminder([run], [], [], '2026-10-30').map((o) => [o.name, o.need]), [['Laufen', 3]]);
  // Donnerstag, 0 von 3 → 4 Tage für 3 → noch kein Druck
  assert.deepEqual(openForReminder([run], [], [], '2026-10-29'), []);
  // Samstag, 2 von 3 → 2 Tage für 1 → still
  const logs = [log('Laufen', '2026-10-26'), log('Laufen', '2026-10-28')];
  assert.deepEqual(openForReminder([run], logs, [], '2026-10-31'), []);
  // Sonntag, 2 von 3 → letzter Tag für 1 → dabei
  assert.equal(openForReminder([run], logs, [], '2026-11-01')[0].need, 1);
  // Ziel erreicht → still
  assert.deepEqual(openForReminder([run], [...logs, log('Laufen', '2026-10-31')], [], '2026-11-01'), []);
});

test('Woche: Mini-Woche reicht', () => {
  const run = H('Laufen', { schedule: 'per_week', schedule_count: 3, schedule_min: 1 });
  assert.deepEqual(openForReminder([run], [log('Laufen', MO)], [], '2026-11-01'), []);
  assert.equal(openForReminder([run], [], [], '2026-11-01')[0].need, 1);
});

test('Woche: Pausentage am Ende zählen nicht als freie Tage', () => {
  const run = H('Laufen', { schedule: 'per_week', schedule_count: 3 });
  // Donnerstag, 1 von 3, Sa+So Pause → Do, Fr frei für 2 → knapp (Ziel bleibt wegen Pause anteilig bei 3·5/7 → 3)
  const pauses = [{ habit_id: 'Laufen', start_day: '2026-10-31', end_day: '2026-11-01' }];
  const open = openForReminder([run], [log('Laufen', MO)], pauses, '2026-10-29');
  assert.equal(open.length, 1);
  assert.equal(open[0].need, 2);
});

test('Text der Nachricht', () => {
  assert.equal(reminderText([]), null);
  const a = { name: 'Lesen', habit: H('Lesen', { mini_text: '1 Seite' }) };
  const b = { name: 'Dehnen', habit: H('Dehnen') };
  const w = { name: 'Laufen', need: 1, word: 'diese Woche', habit: H('Laufen') };
  assert.deepEqual(reminderText([a, b]), { title: 'Noch offen heute', body: 'Lesen, Dehnen. Mini zählt auch 🙂' });
  assert.deepEqual(reminderText([b, w]), { title: 'Noch offen', body: 'Dehnen heute · Laufen – noch 1× diese Woche.' });
  const many = ['A', 'B', 'C', 'D', 'E'].map((n) => ({ name: n, habit: H(n) }));
  assert.equal(reminderText(many).body, 'A, B, C und 2 weitere.');
});

test('Fällig: ab der Uhrzeit, höchstens 3 Stunden nachholen, einmal am Tag', () => {
  assert.equal(isDue(1200, 1199, null, MO), false);
  assert.equal(isDue(1200, 1200, null, MO), true);
  assert.equal(isDue(1200, 1379, '2026-10-25', MO), true);
  assert.equal(isDue(1200, 1380, null, MO), false);
  assert.equal(isDue(1200, 1250, MO, MO), false);
  assert.equal(isDue(null, 1250, null, MO), false);
});

test('Uhrzeit lesen und schreiben', () => {
  assert.equal(timeText(1200), '20:00');
  assert.equal(timeText(465), '7:45');
  assert.equal(parseTime('07:45'), 465);
  assert.equal(parseTime('24:00'), null);
  assert.equal(parseTime(''), null);
});

test('Ortszeit in einer Zeitzone', () => {
  // 18:05 UTC am 26.10. = 19:05 in Berlin (Winterzeit seit 25.10.)
  assert.deepEqual(zonedNow(new Date('2026-10-26T18:05:00Z'), 'Europe/Berlin'), { day: MO, min: 19 * 60 + 5 });
  // 22:30 UTC = 23:30 Berlin, gleicher Tag; 23:30 UTC = 0:30 nächster Tag
  assert.deepEqual(zonedNow(new Date('2026-10-26T23:30:00Z'), 'Europe/Berlin'), { day: '2026-10-27', min: 30 });
  assert.deepEqual(zonedNow(new Date('2026-10-26T18:05:00Z'), 'Quatsch/Zone'), { day: MO, min: 19 * 60 + 5 });
});

test('„meist gegen“: Median, gerundet auf 10 Minuten; Nachgetragenes und Automatisches zählen nicht', () => {
  const localOf = (iso) => ({ day: iso.slice(0, 10), min: Number(iso.slice(11, 13)) * 60 + Number(iso.slice(14, 16)) });
  const at = (day, t) => `${day}T${t}:00`;
  const logs = [
    log('L', '2026-10-20', 'done', { created_at: at('2026-10-20', '07:31') }),
    log('L', '2026-10-21', 'mini', { created_at: at('2026-10-21', '07:44') }),
    log('L', '2026-10-22', 'done', { created_at: at('2026-10-23', '09:00') }), // nachgetragen
    log('L', '2026-10-23', 'done', { created_at: at('2026-10-23', '07:38') }),
    log('L', '2026-10-24', 'done', { created_at: at('2026-10-24', '08:10'), source: 'withings' }),
    log('L', '2026-10-25', 'partial', { created_at: at('2026-10-25', '07:00') })
  ];
  assert.deepEqual(usualTime(logs, 'L', MO, localOf), { n: 3, min: null });
  const more = [...logs, log('L', '2026-10-25', 'done', { created_at: at('2026-10-25', '07:50') }), log('L', MO, 'done', { created_at: at(MO, '22:00') })];
  // 7:31, 7:38, 7:44, 7:50, 22:00 → Median 7:44 → 7:40
  assert.deepEqual(usualTime(more, 'L', MO, localOf), { n: 5, min: 460 });
  // älter als 14 Tage zählt nicht
  assert.equal(usualTime(more, 'L', '2026-11-20', localOf).n, 0);
});
