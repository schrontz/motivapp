// Körperwerte: Verlauf und Renpho-Import.

import { FIELDS, series, change, lastChange } from '../body.js';
import { monthShort, WEEKDAYS_SHORT, parseDay } from '../dates.js';
import { svg, UI_ICONS } from '../icons.js';
import { dayShift, esc, nav, numTxt } from './ui.js';

export const BODY_RANGES = [['3m', '3 Monate', 91], ['1y', '1 Jahr', 365], ['all', 'Alles', null]];

export function bodyChart(points, f, fromDay, T) {
  if (points.length < 2) return '<p class="hint" style="margin-top: 8px">Noch zu wenige Messungen für einen Verlauf.</p>';
  const W = 300; const Hc = 110;
  const vals = points.map((p) => p.v);
  const lo0 = Math.min(...vals); const hi0 = Math.max(...vals);
  const pad = (hi0 - lo0) * 0.08 || 0.5;
  const lo = lo0 - pad; const hi = hi0 + pad;
  const t = (d) => parseDay(d).getTime();
  const t0 = t(fromDay || points[0].day); const t1 = t(T);
  const x = (d) => 4 + ((t(d) - t0) / Math.max(1, t1 - t0)) * (W - 8);
  const y = (v) => 10 + (1 - (v - lo) / (hi - lo)) * (Hc - 20);
  const col = `var(--c-${f.color || 'blue'})`;
  const date = (d) => `${parseDay(d).getDate()}. ${monthShort(d.slice(0, 7))}${d.slice(0, 4) !== T.slice(0, 4) ? ' ' + d.slice(0, 4) : ''}`;
  return `<div class="hr-chart" style="grid-template-columns: 38px minmax(0, 1fr); margin-top: 10px">
      <div class="hr-y small muted" style="height: ${Hc}px" aria-hidden="true"><span style="top: ${((y(hi0) / Hc) * 100).toFixed(1)}%">${numTxt(hi0, f.digits)}</span><span style="top: ${((y(lo0) / Hc) * 100).toFixed(1)}%">${numTxt(lo0, f.digits)}</span></div>
      <svg viewBox="0 0 ${W} ${Hc}" style="height: ${Hc}px" role="img" aria-label="${esc(f.label)} zwischen ${numTxt(lo0, f.digits)} und ${numTxt(hi0, f.digits)} ${f.unit}; zuletzt ${numTxt(vals[vals.length - 1], f.digits)}">
        <line x1="0" x2="${W}" y1="${y(hi0).toFixed(1)}" y2="${y(hi0).toFixed(1)}" style="stroke: var(--border)" stroke-dasharray="3 4"></line>
        <line x1="0" x2="${W}" y1="${y(lo0).toFixed(1)}" y2="${y(lo0).toFixed(1)}" style="stroke: var(--border)" stroke-dasharray="3 4"></line>
        ${points.map((p) => `<circle cx="${x(p.day).toFixed(1)}" cy="${y(p.v).toFixed(1)}" r="2.5" style="fill: ${col}" opacity="0.3"></circle>`).join('')}
        <polyline fill="none" style="stroke: ${col}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" points="${points.map((p) => `${x(p.day).toFixed(1)},${y(p.avg).toFixed(1)}`).join(' ')}"></polyline>
      </svg>
    </div>
    <div class="small muted" style="display: flex; justify-content: space-between; padding-left: 44px; margin-top: 2px"><span>${date(fromDay || points[0].day)}</span><span>heute</span></div>`;
}

export function changeTxt(points, f) {
  const c = change(points);
  if (c == null) return '';
  const sign = c > 0 ? '+' : (c < 0 ? '−' : '±');
  const d = points[0].day;
  return `${sign}${numTxt(Math.abs(c), f.digits)}${f.unit ? ' ' + f.unit : ''}<br>im Schnitt seit ${parseDay(d).getDate()}. ${monthShort(d.slice(0, 7))}`;
}

export function lastCmpTxt(list, f) {
  const c = lastChange(list, f.key);
  if (!c) return '';
  const d = parseDay(c.day);
  const p = parseDay(c.prevDay);
  const sign = Math.abs(c.delta) < Math.pow(10, -f.digits) / 2 ? '±' : (c.delta > 0 ? '+' : '−');
  return `<div class="small muted" style="margin-top: 2px">${WEEKDAYS_SHORT[(d.getDay() + 6) % 7]} ${d.getDate()}. ${monthShort(c.day.slice(0, 7))} · ${sign}${numTxt(Math.abs(c.delta), f.digits)}${f.unit ? ' ' + f.unit : ''} zum ${p.getDate()}. ${monthShort(c.prevDay.slice(0, 7))}</div>`;
}

export function bodyView(S, T) {
  const list = S.body || [];
  const range = BODY_RANGES.find((r) => r[0] === S.bodyRange) || BODY_RANGES[0];
  const fromDay = range[2] ? dayShift(T, -(range[2] - 1)) : (list[0] ? list[0].day : T);
  const seg = BODY_RANGES.map(([id, label]) => `<label><input type="radio" name="brange" value="${id}"${range[0] === id ? ' checked' : ''} data-action="body-range"><span>${label}</span></label>`).join('');
  const lastOf = (key) => { const s = series(list, key); return s.length ? s[s.length - 1] : null; };
  const main = FIELDS.filter((f) => f.show === 'main').map((f) => {
    const pts = series(list, f.key, fromDay);
    const last = lastOf(f.key);
    return `<section class="card pad">
      <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 10px">
        <div><div class="small muted" style="font-weight: 600">${f.label}</div><div style="font-size: 28px; font-weight: 700; line-height: 1.15">${last ? numTxt(last.v, f.digits) + (f.unit ? ' ' + f.unit : '') : '–'}</div>${lastCmpTxt(list, f)}</div>
        <div class="small muted" style="text-align: right; line-height: 1.4">${changeTxt(pts, f)}</div>
      </div>
      ${bodyChart(pts, f, range[2] ? fromDay : null, T)}
    </section>`;
  }).join('');
  const open = S.bodyOpen || new Set();
  const more = FIELDS.filter((f) => f.show === 'more' && lastOf(f.key)).map((f) => {
    const pts = series(list, f.key, fromDay);
    const last = lastOf(f.key);
    const c = change(pts);
    const isOpen = open.has(f.key);
    return `<div class="more-row">
      <button type="button" class="more-btn" data-action="body-more" data-id="${f.key}" aria-expanded="${isOpen}">
        <span>${f.label}</span>
        <span><b>${numTxt(last.v, f.digits)}${f.unit ? ' ' + f.unit : ''}</b> <span class="small muted">${c == null ? '' : (c > 0 ? '+' : (c < 0 ? '−' : '±')) + numTxt(Math.abs(c), f.digits)}</span></span>
      </button>
      ${isOpen ? `<div style="padding: 0 16px 14px">${bodyChart(pts, { ...f, color: 'purple' }, range[2] ? fromDay : null, T)}</div>` : ''}
    </div>`;
  }).join('');
  const body = list.length
    ? `<div class="seg" role="radiogroup" aria-label="Zeitraum">${seg}</div>
      ${main}
      <p class="hint" style="padding: 0 4px">Punkte = einzelne Messungen, Linie = Schnitt der letzten 2 Wochen. Die Waage schätzt Fett und Muskeln – ein Trend, kein Urteil.</p>
      ${more ? `<div class="section-head"><h2 style="font-size: 17px">Weitere Werte</h2><span class="small muted">antippen für Verlauf</span></div>
      <section class="card list">${more}</section>` : ''}`
    : `<section class="card pad" style="display: flex; flex-direction: column; gap: 10px"><b>Noch keine Messungen</b><p class="hint">Exportiere deine Werte aus Renpho und importiere sie hier.</p><a class="btn" href="#/body-import">Renpho importieren</a></section>`;
  const first = list[0];
  return `<div class="app">
    <div class="bar"><a class="link-btn" href="#/">${svg(UI_ICONS.back, 20, 2.2)}Übersicht</a><a class="link-btn" href="#/body-import">Renpho importieren</a></div>
    <div class="wrap" style="gap: 14px">
      <div style="padding: 0 4px"><h1 style="font-size: 28px">Körper</h1>${first ? `<div class="small muted" style="font-size: 14px">${list.length} Messtage seit ${monthShort(first.day.slice(0, 7))} ${first.day.slice(0, 4)} · Renpho</div>` : ''}</div>
      ${body}
    </div>
    ${nav('overview')}
  </div>`;
}
