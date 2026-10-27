import { test } from 'node:test';
import assert from 'node:assert/strict';
import { letterCount, revealOrder, maskTitle, earnedOn, rollover, revealed, fullDays, goodLink, pickOptions, branchCandidates, guessMatches } from '../js/finds.js';
import { indexLogs } from '../js/stats.js';

const H = (id, extra = {}) => ({ id, name: id, schedule: 'daily', start_day: '2026-10-20', archived: false, ...extra });
const log = (habit_id, day, status = 'done') => ({ habit_id, day, status });

test('Buchstaben: nur Buchstaben zählen, erster kommt zuerst, Reihenfolge fest', () => {
  assert.equal(letterCount('Pfahlbauten'), 11);
  assert.equal(letterCount('Dom von Cefalù'), 12);
  assert.equal(letterCount('Linie (Aquavit)'), 12);
  const o = revealOrder('Pfahlbauten');
  assert.equal(o[0], 0);
  assert.equal(new Set(o).size, 11);
  assert.deepEqual(revealOrder('Pfahlbauten'), o, 'immer gleich');
  const m = maskTitle('Dom von Cefalù', 1);
  assert.equal(m.filter((x) => x.letter && x.shown).length, 1);
  assert.equal(m[0].shown, true);
  assert.equal(m[3].shown, true, 'Leerzeichen sichtbar');
  assert.equal(maskTitle('Dom', 99).every((x) => x.shown), true);
});

test('Anteil des Heute-Rings = Anteil der Buchstaben, voller Ring = alles', () => {
  const habits = [H('a'), H('b'), H('c', { mini_text: 'kurz' })];
  const d = '2026-10-26';
  const idx = (logs) => indexLogs(logs);
  assert.equal(earnedOn(habits, idx([]), [], d, 11), 0);
  assert.equal(earnedOn(habits, idx([log('a', d)]), [], d, 11), 3); // 11 × 1/3 → 3
  assert.equal(earnedOn(habits, idx([log('a', d), log('b', d)]), [], d, 11), 7);
  assert.equal(earnedOn(habits, idx([log('a', d), log('b', d), log('c', d, 'mini')]), [], d, 11), 11, 'Mini zählt');
  assert.equal(earnedOn(habits, idx([]), [{ habit_id: null, start_day: d, end_day: d }], d, 11), 0, 'Pausentag bringt nichts, nimmt nichts');
});

test('Aufgedecktes bleibt über Nacht, neu angelegt am selben Tag startet bei 0', () => {
  const byDay = { '2026-10-24': 3, '2026-10-25': 0, '2026-10-26': 4 };
  const earned = (d) => byDay[d] || 0;
  const f = { title: 'Pfahlbauten', base: 0, base_day: '2026-10-24' };
  assert.equal(revealed(f, '2026-10-24', earned), 3);
  assert.equal(revealed(f, '2026-10-26', earned), 7, '3 von Samstag + 0 + 4 heute');
  const r = rollover(f, '2026-10-26', earned);
  assert.deepEqual(r, { base: 3, base_day: '2026-10-26', changed: true });
  // Am Montag gefunden, nächstes sofort angelegt: base = −heute → startet bei 0
  const next = { title: 'Jungsteinzeit', base: -4, base_day: '2026-10-26' };
  assert.equal(revealed(next, '2026-10-26', earned), 0);
  byDay['2026-10-26'] = 6; // danach noch etwas abgehakt
  assert.equal(revealed(next, '2026-10-26', earned), 2);
  assert.equal(revealed(next, '2026-10-27', earned), 2, 'über Nacht: nur, was nach dem Anlegen kam');
  assert.equal(revealed({ title: 'Ab', base: 5, base_day: '2026-10-26' }, '2026-10-26', earned), 2, 'nie mehr als Buchstaben');
});

test('Volle Tage: rückwirkend, heute erst wenn voll, Pausentage nicht', () => {
  const habits = [H('a', { start_day: '2026-10-23' }), H('b', { start_day: '2026-10-23' })];
  const logs = [log('a', '2026-10-23'), log('b', '2026-10-23'), log('a', '2026-10-24'), log('a', '2026-10-26'), log('b', '2026-10-26', 'mini')];
  const pauses = [{ habit_id: null, start_day: '2026-10-25', end_day: '2026-10-25' }];
  assert.equal(fullDays(habits, indexLogs(logs), pauses, '2026-10-26'), 2);
  assert.equal(fullDays(habits, indexLogs(logs.slice(0, 4)), pauses, '2026-10-26'), 1, 'heute noch nicht voll');
});

test('Links: keine Mathe, Jahreszahlen, Listen, Begriffsklärungen, ohne Beschreibung', () => {
  const ok = (title, description, extra = {}) => goodLink({ title, description, ...extra });
  assert.equal(ok('Unteruhldingen', 'Ortsteil von Uhldingen-Mühlhofen am Bodensee'), true);
  assert.equal(ok('Pythagoras', 'griechischer Philosoph'), true, 'Philosoph ist keine Mathe-Beschreibung');
  assert.equal(ok('Satz des Pythagoras', 'Satz der euklidischen Geometrie'), false);
  assert.equal(ok('Primzahl', 'natürliche Zahl mit genau zwei Teilern'), false);
  assert.equal(ok('1848', 'Jahr'), false);
  assert.equal(ok('12. März', 'Tag im Kalender'), false);
  assert.equal(ok('Liste der Pfahlbauten', 'Wikimedia-Liste'), false);
  assert.equal(ok('Merkur', 'Begriffsklärung', { pageprops: { disambiguation: '' } }), false);
  assert.equal(ok('Bronzezeit', ''), false);
  assert.equal(goodLink({ title: 'Gibtsnicht', missing: '' }), false);
  const pages = [{ title: 'Bronzezeit', description: 'Epoche der Menschheitsgeschichte' }, { title: 'Bodensee', description: 'See im Alpenvorland' }, { title: 'Primzahl', description: 'Zahl' }, { title: 'Pfahlbauten', description: 'Bauweise' }];
  const opts = pickOptions(pages, new Set(['pfahlbauten']), 3, () => 0);
  assert.deepEqual(opts.map((o) => o.title).sort(), ['Bodensee', 'Bronzezeit']);
  const bare = pickOptions([{ title: 'Bodensee' }, { title: '1848' }, { title: 'Bronzezeit', description: 'Epoche' }], new Set(), 3, () => 0);
  assert.deepEqual(bare.map((o) => o.title), ['Bronzezeit', 'Bodensee'], 'ohne Beschreibung nur als Rückfall, Jahreszahlen nie');
});

test('Abzweige: Neues aus Strecke, Essen, Sport seit dem letzten Fundstück, neueste zuerst', () => {
  const data = {
    travel: [{ city: 'Köln', reached_on: '2026-10-25' }, { city: 'Mainz', reached_on: '2026-10-10' }, { city: 'Paris' }],
    meals: [{ day: '2026-10-12', plants: ['Zwiebel'] }, { day: '2026-10-24', plants: ['Zwiebel', 'Kümmel'] }],
    strength: [{ day: '2026-10-26', exercises: [{ name: 'Kreuzheben (Langhantel)' }] }, { day: '2026-10-01', exercises: [{ name: 'Bankdrücken' }] }],
    workouts: [{ day: '2026-10-23', category: 7 }, { day: '2026-10-23', category: 36 }]
  };
  const c = branchCandidates(data, '2026-10-20', new Set(['Köln']), { categoryName: (k) => ({ 7: 'Schwimmen', 36: 'Sonstiges' })[k] });
  assert.deepEqual(c.map((x) => [x.day, x.title, x.area]), [
    ['2026-10-26', 'Kreuzheben', 'sport'],
    ['2026-10-24', 'Kümmel', 'essen'],
    ['2026-10-23', 'Schwimmen', 'sport']
  ]);
  assert.equal(c[1].origin, 'Essen: zum ersten Mal Kümmel');
});

test('Raten: Schreibweise großzügig, Inhalt genau', () => {
  assert.equal(guessMatches('pfahlbauten', 'Pfahlbauten'), true);
  assert.equal(guessMatches(' Pfahl-Bauten ', 'Pfahlbauten'), true);
  assert.equal(guessMatches('Kuemmel', 'Kümmel'), true);
  assert.equal(guessMatches('Kümmel', 'Kuemmel'), true);
  assert.equal(guessMatches('Strassburger Münster', 'Straßburger Münster'), true);
  assert.equal(guessMatches('cefalu', 'Cefalù'), true);
  assert.equal(guessMatches('die Gotik', 'Gotik'), true);
  assert.equal(guessMatches('Linie', 'Linie (Aquavit)'), true);
  assert.equal(guessMatches('Linie Aquavit', 'Linie (Aquavit)'), true);
  assert.equal(guessMatches('Pfahlbau', 'Pfahlbauten'), false, 'fast ist nicht richtig');
  assert.equal(guessMatches('', 'Gotik'), false);
  assert.equal(guessMatches('die', 'Gotik'), false);
});
