// Startbildschirm: die Module (Rauchen, Fundstück, Essen, Alkohol) als Kachel oben oder als Zeile weiter unten.
// Jedes Modul liefert dieselben Angaben – die Übersicht entscheidet nur die Form.

import { esc } from './ui.js';
import { reduceOn, reduceState, timerText } from './reduce.js';
import { alcoholOn, alcoholState } from './alcohol.js';
import { foodOn } from './food.js';
import { dayFood } from '../food.js';
import { letterCount } from '../finds.js';
import { openFind, latestFound, revealedNow } from '../actions/finds.js';
import { homeOrder, homeTiles } from '../home.js';

// { label, value, sub, href, btn: { act } | { href }, btnLabel, undo }  – null = nicht anzeigen
const INFO = {
  weniger(S, T) {
    if (!reduceOn(S)) return null;
    const st = reduceState(S, T);
    if (!st.settings) return { label: 'Rauchen', value: 'Start', sub: 'erst eine Woche zählen', href: '#/weniger', btn: { act: 'reduce-start' }, btnLabel: 'Los geht’s' };
    if (st.settings.show_card === false) return null;
    const watch = st.ph.name === 'watch';
    const t = watch ? null : timerText(st);
    return {
      label: 'Rauchen', value: watch ? `heute ${st.today}` : t.big, sub: watch ? `Zähl-Woche · Tag ${st.ph.day}` : `heute ${st.today}`,
      href: '#/weniger', btn: { act: 'reduce-smoke' }, btnLabel: 'Geraucht',
      undo: S.reduceUndo ? { act: 'reduce-undo' } : null
    };
  },
  fund(S, T) {
    if (!S.hasFindSchema) return null;
    const open = openFind(S);
    const last = latestFound(S);
    if (!open && last && last.found_day === T) return { label: 'Fundstück', value: 'gefunden 🎉', sub: last.title, href: `#/fund/${encodeURIComponent(last.id)}`, btn: { href: `#/fund/${encodeURIComponent(last.id)}` }, btnLabel: 'Lesen' };
    if (!open) return { label: 'Fundstück', value: '…', sub: 'das nächste kommt gleich', href: '#/fundstuecke', btn: { href: '#/fundstuecke' }, btnLabel: 'Ansehen' };
    const n = revealedNow(open, T);
    const L = letterCount(open.title);
    return { label: 'Fundstück', value: open.guessed_with != null ? `⭐ ${n} von ${L}` : `${n} von ${L}`, sub: open.description || 'Buchstaben aufdecken', href: '#/fundstuecke', btn: { href: '#/fundstuecke' }, btnLabel: open.guessed_with != null ? 'Ansehen' : 'Raten' };
  },
  essen(S, T) {
    if (!foodOn(S)) return null;
    const d = dayFood(S.meals, T);
    return {
      label: 'Essen', value: `${d.plants.length}/5 🌱`, sub: d.meals.length ? `${d.meals.length} ${d.meals.length === 1 ? 'Mahlzeit' : 'Mahlzeiten'}` : 'noch nichts',
      href: '#/essen', btn: { href: '#/essen-neu' }, btnLabel: 'Eintragen',
      undo: S.foodUndo ? { act: 'food-undo' } : null
    };
  },
  alkohol(S, T) {
    if (!alcoholOn(S)) return null;
    const st = alcoholState(S, T);
    if (!st.settings) return { label: 'Alkoholfrei', value: 'Start', sub: 'zählt sich selbst', href: '#/alkohol', btn: { act: 'alc-start' }, btnLabel: 'Los geht’s' };
    if (st.settings.show_card === false) return null;
    const cur = st.weeks[st.weeks.length - 1] || { free: 0 };
    return {
      label: 'Alkoholfrei', value: `${cur.free} von ${st.goal}`, sub: 'diese Woche', href: '#/alkohol', btn: { act: 'alc-open' }, btnLabel: 'Getrunken',
      undo: S.drinkUndo ? { act: 'alc-undo' } : null
    };
  }
};

export function moduleInfo(S, T, id) {
  return INFO[id] ? INFO[id](S, T) : null;
}

// Welche Module könnten gerade auf dem Startbildschirm stehen?
export function homeVisible(S, T) {
  return new Set(Object.keys(INFO).filter((id) => INFO[id](S, T)));
}

const button = (m, cls) => (m.btn.act
  ? `<button type="button" class="${cls}" data-action="${m.btn.act}">${esc(m.btnLabel)}</button>`
  : `<a class="${cls}" href="${m.btn.href}">${esc(m.btnLabel)}</a>`);
const undo = (m) => (m.undo ? `<button type="button" class="link-btn mod-undo" data-action="${m.undo.act}">Rückgängig</button>` : '');

function tile(m) {
  return `<div class="mod-tile">
    <a class="mod-tile-top" href="${m.href}"><span class="small muted">${esc(m.label)}</span><b>${esc(m.value)}</b><span class="mod-sub">${esc(m.sub || '')}</span></a>
    ${button(m, 'mod-btn')}
    ${undo(m)}
  </div>`;
}

function line(m) {
  return `<div class="mod-line">
    <a class="mod-line-main" href="${m.href}"><b>${esc(m.label)}</b> <span class="muted">· ${esc(m.value)}${m.sub ? ' · ' + esc(m.sub) : ''}</span></a>
    ${undo(m)}${button(m, 'mod-btn small')}
  </div>`;
}

// Kacheln oben (bis zu 3) und der Rest als Zeilen
export function homeModules(S, T) {
  const visible = homeVisible(S, T);
  const order = homeOrder(S.profile && S.profile.home_order).filter((id) => visible.has(id));
  const tiles = homeTiles(S.profile && S.profile.home_order, visible, S.profile ? S.profile.home_tiles : null);
  const infos = Object.fromEntries(order.map((id) => [id, moduleInfo(S, T, id)]));
  const rest = order.filter((id) => !tiles.includes(id));
  return {
    tiles: tiles.length ? `<section class="mod-tiles" style="grid-template-columns: repeat(${tiles.length}, 1fr)">${tiles.map((id) => tile(infos[id])).join('')}</section>` : '',
    lines: rest.length ? `<section class="card mod-lines">${rest.map((id) => line(infos[id])).join('')}</section>` : ''
  };
}
