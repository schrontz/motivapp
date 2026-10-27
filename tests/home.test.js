import { test } from 'node:test';
import assert from 'node:assert/strict';
import { homeOrder, moveBlock, DEFAULT_ORDER } from '../js/home.js';

test('Reihenfolge: leer = Standard, Unbekanntes raus, Neues an seinen Platz', () => {
  assert.deepEqual(homeOrder(null), DEFAULT_ORDER);
  // Fehlendes kommt hinter seinen Vorgänger aus der Standardreihenfolge (Gesamtzahl hinter Heute)
  assert.deepEqual(homeOrder(['heute', 'rings', 'quatsch', 'heute']), ['heute', 'gesamt', 'werte', 'rings', 'fund', 'weniger', 'alkohol', 'essen']);
  // „fund“ kam später dazu: landet hinter „rings“, wo immer das steht
  assert.deepEqual(homeOrder(['heute', 'rings', 'weniger', 'alkohol', 'essen', 'gesamt', 'werte']), ['heute', 'rings', 'fund', 'weniger', 'alkohol', 'essen', 'gesamt', 'werte']);
});

test('Verschieben springt über Ausgeblendetes', () => {
  const visible = new Set(['rings', 'fund', 'heute', 'gesamt', 'werte']); // ohne Rauchen/Alkohol/Essen
  assert.deepEqual(moveBlock(null, visible, 'heute', -1), ['rings', 'heute', 'weniger', 'alkohol', 'essen', 'fund', 'gesamt', 'werte']);
  assert.deepEqual(moveBlock(null, visible, 'rings', -1), DEFAULT_ORDER, 'oben bleibt oben');
  assert.deepEqual(moveBlock(null, visible, 'werte', 1), DEFAULT_ORDER, 'unten bleibt unten');
  assert.deepEqual(moveBlock(null, visible, 'rings', 1), ['fund', 'rings', 'weniger', 'alkohol', 'essen', 'heute', 'gesamt', 'werte']);
});
