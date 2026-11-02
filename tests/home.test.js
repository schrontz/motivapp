import { test } from 'node:test';
import assert from 'node:assert/strict';
import { homeOrder, moveBlock, homeTiles, toggleTile, groupToday, DEFAULT_ORDER } from '../js/home.js';

test('Reihenfolge: leer = Standard, Unbekanntes (alte Blöcke) raus, Neues an seinen Platz', () => {
  assert.deepEqual(homeOrder(null), DEFAULT_ORDER);
  // fehlendes hinter seinen Standard-Vorgänger: Fundstück hinter Rauchen, Alkohol hinter Essen
  assert.deepEqual(homeOrder(['heute', 'essen', 'rings', 'weniger', 'quatsch']), ['essen', 'alkohol', 'weniger', 'fund']);
});

test('Verschieben springt über Ausgeblendetes', () => {
  const visible = new Set(['weniger', 'fund', 'essen']); // Alkohol aus
  assert.deepEqual(moveBlock(null, visible, 'essen', -1), ['weniger', 'essen', 'fund', 'alkohol']);
  assert.deepEqual(moveBlock(null, visible, 'weniger', -1), DEFAULT_ORDER, 'oben bleibt oben');
});

test('Kacheln: Standard = erste drei sichtbaren, eigene Wahl höchstens drei', () => {
  const all = new Set(DEFAULT_ORDER);
  assert.deepEqual(homeTiles(null, all, null), ['weniger', 'fund', 'essen']);
  assert.deepEqual(homeTiles(null, new Set(['fund', 'alkohol']), null), ['fund', 'alkohol']);
  assert.deepEqual(homeTiles(['essen', 'weniger', 'fund', 'alkohol'], all, ['fund', 'essen']), ['essen', 'fund'], 'in Reihenfolge');
  assert.deepEqual(homeTiles(null, all, []), [], 'bewusst keine');
  // an/aus
  assert.deepEqual(toggleTile(null, all, null, 'fund'), ['weniger', 'essen']);
  assert.equal(toggleTile(null, all, null, 'alkohol'), null, 'schon drei');
  assert.deepEqual(toggleTile(null, all, ['weniger'], 'alkohol'), ['weniger', 'alkohol']);
});

test('Heute aufteilen: Jetzt nach Uhrzeit, Später ab 90 Min., Erledigt/Pause unten', () => {
  const it = (name, extra = {}) => ({ habit: { id: name, name }, hit: false, paused: false, period: null, ...extra });
  const usual = { Sport: 460, Hautpflege: 450, Duolingo: 1290, Liegestuetze: 1030, Lesen: null };
  const items = [it('Duolingo'), it('Sport'), it('Lesen'), it('Liegestuetze'), it('Hautpflege'), it('Wasser', { hit: true }), it('Laufen', { period: { state: 'goal' } }), it('Yoga', { paused: true })];
  const g = groupToday(items, (h) => usual[h.id] ?? null, 450); // 7:30
  assert.deepEqual(g.now.map((e) => e.item.habit.id), ['Hautpflege', 'Sport', 'Lesen']);
  assert.deepEqual(g.later.map((e) => e.item.habit.id), ['Liegestuetze', 'Duolingo']);
  assert.deepEqual(g.done.map((e) => e.item.habit.id), ['Wasser', 'Laufen', 'Yoga']);
  // abends: Überfälliges vom Morgen bleibt in „Jetzt“
  const e = groupToday(items, (h) => usual[h.id] ?? null, 1200);
  assert.deepEqual(e.now.map((x) => x.item.habit.id), ['Hautpflege', 'Sport', 'Liegestuetze', 'Duolingo', 'Lesen']);
  assert.equal(e.later.length, 0);
});
