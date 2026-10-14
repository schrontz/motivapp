import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseAlphaCsv, parseDuration, importPreview, exerciseHistory, exerciseKey, oneRm, bestOneRm, volume, setsText, matchSessions, mergeTrainings, progress, suggestPlan, sessionTarget, splitKey } from '../js/strength.js';

// Ausschnitt im echten Format (BOM, CRLF, ; als Trenner, Komma-Zahlen)
const CSV = '﻿' + [
  '"Oberkörper 2 · Tag 5 · Woche 17 · Mini Gainz PT. II";"2026-10-09 7:42 Uhr";"18 Min."',
  '"1. Frontheben · Kurzhanteln · 10 Wdh"',
  '#;KG;WDH',
  '1;4;32', '2;4;32', '3;4;30',
  '"2. Crunches · Körpergewicht · 10 Wdh"',
  '#;KG;WDH',
  '1;+0;22', '2;+5;20',
  '"3. Plank · Körpergewicht"',
  '#;SEK',
  '1;55', '2;55',
  '',
  '"Cardio und Beine · Einzelnes Workout";"2024-06-22 18:26 Uhr";"1:13 Std."',
  '"1. Stationäres Radfahren · Maschine · 15 Min."',
  '#;KM;MIN.',
  '1;5,35;15',
  '"2. Plank · Körpergewicht"',
  '#;MIN.',
  '1;1',
  '"3. Liegestütze eng · Körpergewicht · 10 Wdh"',
  '#;WDH',
  '1;10', '2;12',
  ''
].join('\r\n');

test('Alpha-CSV: Einheiten, Übungen und Sätze', () => {
  const { sessions, skipped } = parseAlphaCsv(CSV);
  assert.equal(skipped, 0);
  assert.equal(sessions.length, 2);
  const [a, b] = sessions;
  assert.equal(a.title, 'Oberkörper 2');
  assert.equal(a.program, 'Tag 5 · Woche 17 · Mini Gainz PT. II');
  assert.equal(a.day, '2026-10-09');
  assert.equal(a.ext_id, 'alpha:2026-10-09T07:42');
  assert.equal(a.duration_min, 18);
  assert.equal(new Date(a.started_at).getHours(), 7);
  assert.deepEqual(a.exercises.map((e) => [e.name, e.equipment, e.kind, e.goal]), [
    ['Frontheben', 'Kurzhanteln', 'kg_reps', '10 Wdh'],
    ['Crunches', 'Körpergewicht', 'kg_reps', '10 Wdh'],
    ['Plank', 'Körpergewicht', 'time', undefined]
  ]);
  assert.deepEqual(a.exercises[0].sets, [{ kg: 4, reps: 32 }, { kg: 4, reps: 32 }, { kg: 4, reps: 30 }]);
  assert.deepEqual(a.exercises[1].sets[1], { kg: 5, plus: true, reps: 20 });
  assert.deepEqual(a.exercises[2].sets[0], { sec: 55 });
  assert.equal(b.title, 'Cardio und Beine');
  assert.equal(b.program, null);
  assert.equal(b.duration_min, 73);
  assert.deepEqual(b.exercises[0].sets[0], { km: 5.35, sec: 900 });
  assert.equal(b.exercises[0].kind, 'distance');
  assert.deepEqual(b.exercises[1].sets[0], { sec: 60 });
  assert.equal(b.exercises[2].kind, 'reps');
});

test('Dauer-Angaben', () => {
  assert.equal(parseDuration('19 Min.'), 19);
  assert.equal(parseDuration('1 Std.'), 60);
  assert.equal(parseDuration('1:01 Std.'), 61);
  assert.equal(parseDuration(''), null);
});

test('Import-Vorschau: Bekanntes wird übersprungen', () => {
  const { sessions } = parseAlphaCsv(CSV);
  const p = importPreview(sessions, [{ ext_id: 'alpha:2026-10-09T07:42' }]);
  assert.equal(p.fresh.length, 1);
  assert.equal(p.known, 1);
  assert.equal(p.from, '2024-06-22');
  assert.equal(p.to, '2026-10-09');
  assert.equal(p.exercises, 5);
});

test('1RM, Volumen, Satz-Text', () => {
  assert.equal(oneRm({ kg: 7, reps: 20 }), 11.7);
  assert.equal(oneRm({ kg: 0, plus: true, reps: 20 }), null);
  assert.equal(oneRm({ kg: 50, reps: 1 }), 50);
  assert.equal(bestOneRm({ sets: [{ kg: 4, reps: 40 }, { kg: 7, reps: 20 }] }), 11.7);
  assert.equal(volume({ exercises: [{ sets: [{ kg: 7, reps: 20 }, { kg: 7, reps: 20 }, { kg: 5, plus: true, reps: 10 }] }] }), 280);
  assert.equal(setsText({ kind: 'kg_reps', sets: [{ kg: 7, reps: 20 }, { kg: 7, reps: 20 }, { kg: 7, reps: 20 }] }), '3 × 20 · 7 kg');
  assert.equal(setsText({ kind: 'kg_reps', sets: [{ kg: 4, reps: 32 }, { kg: 4, reps: 30 }] }), '32 · 30 · 4 kg');
  assert.equal(setsText({ kind: 'kg_reps', sets: [{ kg: 0, plus: true, reps: 22 }] }), '1 × 22 · Körpergewicht');
  assert.equal(setsText({ kind: 'time', sets: [{ sec: 55 }, { sec: 55 }] }), '2 × 55 s');
  assert.equal(setsText({ kind: 'distance', sets: [{ km: 5.35, sec: 900 }] }), '5,35 km in 15 Min');
  assert.deepEqual(splitKey('Curls|Kurzhanteln'), { name: 'Curls', equipment: 'Kurzhanteln' });
});

const wo = (id, day, start, mins, category = 16) => {
  const s = new Date(`${day}T${start}:00`);
  return { id, day, start_at: s.toISOString(), end_at: new Date(s.getTime() + mins * 60000).toISOString(), duration_min: mins, category };
};
const st = (id, day, start, mins, exercises = []) => ({ id, day, started_at: new Date(`${day}T${start}:00`).toISOString(), duration_min: mins, title: 'Oberkörper', exercises });

test('Zuordnung zu Withings über die Uhrzeit', () => {
  const workouts = [wo('w1', '2026-10-09', '07:42', 19), wo('w2', '2026-10-08', '07:24', 19), wo('g', '2026-10-07', '07:10', 30, 1)];
  const sessions = [st('a', '2026-10-09', '07:42', 18), st('b', '2026-10-08', '07:30', 19), st('c', '2026-10-07', '07:10', 20), st('d', '2026-10-06', '12:00', 20)];
  const m = matchSessions(sessions, workouts);
  assert.equal(m.get('a').id, 'w1');
  assert.equal(m.get('b').id, 'w2', '6 Minuten daneben passt noch');
  assert.equal(m.has('c'), false, 'Gehen wird nie zugeordnet');
  assert.equal(m.has('d'), false);
  const merged = mergeTrainings(workouts, sessions);
  assert.equal(merged.find((w) => w.id === 'w1').strength.id, 'a');
  const solo = merged.filter((w) => w.alphaOnly).map((w) => w.id).sort();
  assert.deepEqual(solo, ['a:c', 'a:d']);
});

// Verlauf für Curls bauen
const curls = (day, kg, reps, n = 3) => ({ id: day, day, started_at: `${day}T07:30:00.000Z`, exercises: [{ name: 'Curls', equipment: 'Kurzhanteln', kind: 'kg_reps', sets: Array.from({ length: n }, () => ({ kg, reps })) }] });
const plan = { sets: 3, start_reps: 20, kg: 7, plus_reps: 2, every_weeks: 2, max_reps: 24, kg_step: 3, started_on: '2026-09-28' };

test('Steigerung: +2 alle 2 Wochen, Fehlwoche wiederholt, Pause zählt nicht', () => {
  const sessions = [
    curls('2026-10-02', 7, 20),   // KW 40: 20 geschafft
    curls('2026-10-08', 7, 20),   // KW 41: 20 gefestigt → 22
    curls('2026-10-14', 7, 21),   // KW 42: 22 verfehlt → bleibt
    // KW 43: kein Training → zählt nicht
    curls('2026-10-28', 7, 22),   // KW 44: 22 geschafft
    curls('2026-11-04', 7, 23)    // KW 45: 22 gefestigt (mehr zählt mit) → 24
  ];
  const h = exerciseHistory(sessions, 'Curls|Kurzhanteln');
  const r = progress(plan, h, '2026-11-10');
  const wk = (d) => r.weeks.get(d);
  assert.deepEqual([wk('2026-09-28').reps, wk('2026-09-28').result], [20, 'done']);
  assert.equal(wk('2026-10-05').consolidating, true);
  assert.deepEqual([wk('2026-10-12').reps, wk('2026-10-12').result], [22, 'missed']);
  assert.equal(wk('2026-10-19').result, 'none');
  assert.deepEqual([wk('2026-10-26').reps, wk('2026-10-26').consolidating], [22, false]);
  assert.deepEqual([wk('2026-11-02').reps, wk('2026-11-02').consolidating], [22, true]);
  assert.deepEqual([r.current.reps, r.current.kg, r.current.done], [24, 7, false]);
  assert.deepEqual(r.next, { reps: 24, kg: 7, consolidating: true });
});

test('Steigerung: nach dem Maximum mehr Gewicht und zurück auf Start', () => {
  const p = { ...plan, every_weeks: 1, max_reps: 22 };
  const sessions = [curls('2026-10-02', 7, 20), curls('2026-10-08', 7, 22)];
  const r = progress(p, exerciseHistory(sessions, 'Curls|Kurzhanteln'), '2026-10-14');
  assert.deepEqual([r.current.reps, r.current.kg], [20, 10]);
  assert.equal(r.ladder[r.ladder.length - 1].txt, '+3 kg');
});

test('Steigerung: Sätze mit weniger Gewicht zählen nicht, laufende Woche zeigt geschafft', () => {
  const sessions = [curls('2026-10-02', 5, 20), curls('2026-10-13', 7, 20)];
  const r = progress(plan, exerciseHistory(sessions, 'Curls|Kurzhanteln'), '2026-10-14');
  assert.equal(r.weeks.get('2026-09-28').result, 'missed');
  assert.deepEqual([r.current.reps, r.current.done], [20, true]);
  assert.equal(r.next.consolidating, true);
});

test('Leiter und Restwochen', () => {
  const p = { ...plan, max_reps: 40 };
  const sessions = [curls('2026-10-02', 7, 20), curls('2026-10-08', 7, 20)];
  const r = progress(p, exerciseHistory(sessions, 'Curls|Kurzhanteln'), '2026-10-14');
  const now = r.ladder.find((x) => x.state === 'now');
  assert.equal(now.txt, '22');
  assert.deepEqual(r.ladder.slice(0, 3).map((x) => x.state), ['done', 'done', 'now']);
  assert.equal(r.weeksToNextKg, 20, '22 → 40 = 10 Stufen à 2 Wochen');
});

test('Planvorschlag aus dem Verlauf (wie Jans Curls)', () => {
  const sessions = [curls('2026-09-17', 4, 37), curls('2026-09-25', 4, 40), curls('2026-10-02', 7, 20), curls('2026-10-08', 7, 20)];
  const s = suggestPlan(exerciseHistory(sessions, 'Curls|Kurzhanteln'), '2026-10-12');
  assert.deepEqual([s.sets, s.start_reps, s.kg, s.max_reps, s.started_on], [3, 20, 7, 40, '2026-10-12'], 'Plan beginnt diese Woche');
  const r = progress(s, exerciseHistory(sessions, 'Curls|Kurzhanteln'), '2026-10-12');
  assert.deepEqual([r.current.reps, r.current.kg, r.current.done], [20, 7, false], 'kein Sprung durch alte Wochen');
});

test('Ziel-Pille einer einzelnen Einheit', () => {
  const sessions = [curls('2026-10-02', 7, 20), curls('2026-10-08', 7, 20)];
  const h = exerciseHistory(sessions, exerciseKey({ name: 'Curls', equipment: 'Kurzhanteln' }));
  assert.deepEqual(sessionTarget(plan, h, h[1], '2026-10-12'), { reps: 20, kg: 7, sets: 3, ok: true, mode: 'kg' });
  assert.equal(sessionTarget(null, h, h[1], '2026-10-12'), null);
});

test('Plan zählt nie vor der Woche, in der er angelegt wurde', async () => {
  const { planStart } = await import('../js/strength.js');
  const sessions = [curls('2026-09-24', 7, 20), curls('2026-10-02', 7, 20), curls('2026-10-08', 7, 20)];
  const h = exerciseHistory(sessions, 'Curls|Kurzhanteln');
  const old = { ...plan, started_on: '2026-09-21', created_at: '2026-10-08T09:00:00Z' };
  assert.equal(planStart(old), '2026-10-05');
  assert.equal(sessionTarget(old, h, h[0], '2026-10-12'), null, 'Einheit vor dem Plan bekommt keine Pille');
  assert.equal(sessionTarget(old, h, h[2], '2026-10-12').ok, true, 'Einheit in der Anlage-Woche zählt');
  assert.deepEqual([progress(old, h, '2026-10-12').current.reps], [20], 'erst eine Woche geschafft → festigen');
});

const plank = (day, ...secs) => ({ id: day, day, started_at: `${day}T07:30:00.000Z`, exercises: [{ name: 'Plank', equipment: 'Körpergewicht', kind: 'time', sets: secs.map((sec) => ({ sec })) }] });

test('Steigerung in Sekunden: jede Woche +5 s, am Maximum bleibt es stehen', async () => {
  const { planMode, planPreview } = await import('../js/strength.js');
  const sessions = [plank('2026-09-30', 55, 55), plank('2026-10-07', 60, 58), plank('2026-10-08', 60, 61), plank('2026-10-14', 65, 65)];
  const h = exerciseHistory(sessions, 'Plank|Körpergewicht');
  assert.equal(planMode(h), 'sec');
  const s = suggestPlan(h, '2026-10-14');
  assert.deepEqual([s.sets, s.start_reps, s.plus_reps, s.every_weeks, s.kg, s.started_on], [2, 65, 5, 1, 0, '2026-10-12']);
  const p = { sets: 2, start_reps: 55, kg: 0, plus_reps: 5, every_weeks: 1, max_reps: 65, kg_step: 1, started_on: '2026-09-28' };
  const r = progress(p, h, '2026-10-21');
  const wk = (d) => r.weeks.get(d);
  assert.deepEqual([wk('2026-09-28').reps, wk('2026-09-28').result], [55, 'done']);
  assert.deepEqual([wk('2026-10-05').reps, wk('2026-10-05').result], [60, 'done'], 'die bessere Einheit der Woche zählt');
  assert.deepEqual([wk('2026-10-12').reps, wk('2026-10-12').result], [65, 'done']);
  assert.deepEqual([r.current.reps, r.current.kg, r.current.atMax], [65, 0, true], 'am Maximum stehen bleiben, kein Gewicht');
  assert.equal(r.weeksToNextKg, 0);
  assert.equal(r.ladder.some((l) => /kg/.test(l.txt)), false);
  assert.equal(r.ladder[r.ladder.length - 1].txt, '65 s');
  const pv = planPreview({ ...p, max_reps: 70 }, 'sec');
  assert.deepEqual(pv.items.map((i) => i.txt), ['55', '60', '65', '70 s']);
  assert.equal(pv.weeks, 3);
});

test('Steigerung nur mit Wiederholungen (ohne Gewicht)', () => {
  const lieg = (day, reps) => ({ id: day, day, started_at: `${day}T07:30:00.000Z`, exercises: [{ name: 'Liegestütze', equipment: 'Körpergewicht', kind: 'reps', sets: [{ reps }, { reps }] }] });
  const h = exerciseHistory([lieg('2026-10-07', 12), lieg('2026-10-13', 12)], 'Liegestütze|Körpergewicht');
  const s = suggestPlan(h, '2026-10-14');
  assert.deepEqual([s.sets, s.start_reps, s.kg, s.plus_reps], [2, 12, 0, 2]);
  const r = progress({ ...s, every_weeks: 1, started_on: '2026-10-05' }, h, '2026-10-14');
  assert.deepEqual([r.weeks.get('2026-10-05').result, r.current.reps, r.current.done], ['done', 14, false]);
});
