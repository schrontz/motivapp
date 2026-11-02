import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openForReminder, reminderText, isDue, usualTime, timeText, parseTime, zonedNow, remindable, usualDueNow, usualText, usualFor } from '../js/remind.js';

const H = (id, extra = {}) => ({ id, name: id, schedule: 'daily', start_day: '2026-10-01', archived: false, ...extra });
const log = (habit_id, day, status = 'done', extra = {}) => ({ habit_id, day, status, ...extra });
// Montag 26.10.2026
const MO = '2026-10-26';

test('Offen: tägliche Gewohnheit ohne Eintrag, Mini und erledigt zählen nicht', () => {
  const habits = [H('Lesen'), H('Dehnen'), H('Wasser')];
  const logs = [log('Dehnen', MO, 'mini'), log('Wasser', MO, 'partial')];
  assert.deepEqual(openForReminder(habits, logs, [], MO).map((o) => o.name), ['Lesen', 'Wasser']);
});

test('Draußen: Zahlen von der Uhr, abgewählt, archiviert, heute nicht dran – Training mit Auto-Abhaken bleibt drin', () => {
  assert.deepEqual(openForReminder([H('Sport', { auto_categories: [16] })], [], [], MO).map((o) => o.name), ['Sport']);
  const habits = [
    H('Schritte', { auto_metric: 'steps' }), H('Aus', { remind: false }),
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

test('Steigerung in der Erinnerung: nur wenn Sport offen ist', async () => {
  const sport = { name: 'Sport', habit: H('Sport', { auto_categories: [16] }) };
  const lesen = { name: 'Lesen', habit: H('Lesen') };
  const ch = [{ name: 'Bankdrücken', mode: 'kg', sets: 3, reps: 24, kg: 20, from: { reps: 22, kg: 20 } }];
  assert.equal(reminderText([lesen, sport], ch).body, 'Lesen, Sport. ↑ Diese Woche höher: Bankdrücken 3 × 24 (statt 22).');
  assert.equal(reminderText([lesen], ch).body, 'Lesen.', 'Sport schon erledigt → kein Hinweis');
  const many = [1, 2, 3, 4].map((i) => ({ ...ch[0], name: 'Übung ' + i }));
  assert.match(reminderText([sport], many).body, /Übung 1 3 × 24 \(statt 22\), Übung 2 3 × 24 \(statt 22\), und 2 weitere\.$/);
});

test('Eigene Erinnerung zur üblichen Zeit: Fenster, einmal am Tag, Woche nur am „eigenen“ Wochentag oder wenn knapp', () => {
  const localOf = (iso) => ({ day: iso.slice(0, 10), min: Number(iso.slice(11, 13)) * 60 + Number(iso.slice(14, 16)) });
  // Lesen meist gegen 8:40 (fünf Tage vor Montag)
  const days = ['2026-10-21', '2026-10-22', '2026-10-23', '2026-10-24', '2026-10-25'];
  const logs = days.map((d) => log('Lesen', d, 'done', { created_at: `${d}T08:40:00` }));
  const lesen = H('Lesen', { remind_mode: 'usual', mini_text: '1 Seite' });
  const due = (habits, l, now, day = MO) => usualDueNow(habits, l, [], day, now, localOf).map((o) => o.name);
  assert.deepEqual(due([lesen], logs, 8 * 60 + 9), [], 'vor 8:10 noch nicht');
  assert.deepEqual(due([lesen], logs, 8 * 60 + 10), ['Lesen']);
  assert.deepEqual(due([lesen], logs, 9 * 60 + 40), [], 'nach 90 Min. nicht mehr');
  assert.deepEqual(due([{ ...lesen, remind_last: MO }], logs, 8 * 60 + 15), [], 'schon erinnert');
  assert.deepEqual(due([lesen], [...logs, log('Lesen', MO)], 8 * 60 + 15), [], 'schon erledigt');
  assert.deepEqual(due([{ ...lesen, remind_mode: 'daily' }], logs, 8 * 60 + 15), [], 'Passt so = Abend');
  assert.deepEqual(due([lesen], logs.slice(0, 4), 8 * 60 + 15), [], 'lernt noch');
  const o = usualDueNow([lesen], logs, [], MO, 8 * 60 + 15, localOf)[0];
  assert.deepEqual(usualText(o), { title: 'Lesen', body: 'Meist machst du das gegen 8:40. Mini zählt auch 🙂' });
  // am Abend nicht noch einmal
  assert.deepEqual(openForReminder([{ ...lesen, remind_last: MO }, H('Dehnen')], [], [], MO).map((x) => x.name), ['Dehnen']);

  // Sport 3× pro Woche, meist montags und mittwochs gegen 7:40
  const sport = H('Sport', { schedule: 'per_week', schedule_count: 3, remind_mode: 'usual', auto_categories: [16] });
  const sl = ['2026-10-05', '2026-10-12', '2026-10-19', '2026-10-21', '2026-10-14', '2026-10-07']
    .map((d) => log('Sport', d, 'done', { created_at: `${d}T07:40:00` }));
  // für die Uhrzeit zählen nur die letzten 14 Tage (ab 13.): 14., 19., 21. → noch zwei dazu
  sl.push(log('Sport', '2026-10-16', 'done', { created_at: '2026-10-16T07:40:00' }), log('Sport', '2026-10-23', 'done', { created_at: '2026-10-23T07:40:00' }));
  assert.deepEqual(due([sport], sl, 7 * 60 + 10), ['Sport'], 'Montag ist sein Tag');
  assert.deepEqual(due([sport], sl, 7 * 60 + 10, '2026-10-27'), [], 'Dienstag nicht – und noch nicht knapp');
  const ch = [{ name: 'Bankdrücken', mode: 'kg', sets: 3, reps: 24, kg: 20, from: { reps: 22, kg: 20 } }];
  const s = usualDueNow([sport], sl, [], MO, 7 * 60 + 10, localOf)[0];
  assert.deepEqual(usualText(s, ch), { title: 'Sport', body: 'Meist um diese Zeit – noch 3× diese Woche. ↑ Diese Woche höher: Bankdrücken 3 × 24 (statt 22).' });
});

test('Training mit Auto-Abhaken: „meist gegen“ aus der Startzeit des Trainings', () => {
  const localOf = (iso) => ({ day: iso.slice(0, 10), min: Number(iso.slice(11, 13)) * 60 + Number(iso.slice(14, 16)) });
  const sport = H('Sport', { auto_categories: [16], remind_mode: 'usual' });
  const w = (day, t, category = 16, duration_min = 40) => ({ day, start_at: `${day}T${t}:00`, category, duration_min });
  const workouts = [w('2026-10-19', '07:35'), w('2026-10-19', '18:00'), w('2026-10-21', '07:45'), w('2026-10-23', '07:40'), w('2026-10-24', '10:00', 1), w('2026-10-25', '07:50')];
  // Einträge von Withings (Abgleich um 9 Uhr) zählen nicht – nur der Trainingsstart
  const logs = workouts.filter((x) => x.category === 16).map((x) => log('Sport', x.day, 'done', { created_at: `${x.day}T09:00:00`, source: 'withings' }));
  logs.push(log('Sport', '2026-10-22', 'done', { created_at: '2026-10-22T07:30:00' })); // von Hand
  // 7:35, 7:45, 7:40, 7:50, 7:30 (Hand) → 7:40
  assert.deepEqual(usualFor(sport, logs, workouts, MO, localOf), { n: 5, min: 460 });
  assert.deepEqual(usualTime(logs, 'Sport', MO, localOf).n, 1, 'ohne Trainings nur der Hand-Eintrag');
  assert.deepEqual(usualDueNow([sport], logs, [], MO, 7 * 60 + 10, localOf, workouts).map((o) => o.name), ['Sport']);
});
