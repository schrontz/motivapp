// Körperwerte: Verlauf und Renpho-Import.

import { FIELDS, series, change, lastChange } from '../body.js';
import { monthShort, WEEKDAYS_SHORT, parseDay } from '../dates.js';
import { svg, UI_ICONS } from '../icons.js';
import { restValues, restSeries, lastRest, REST_TEXT } from '../pulse.js';
import { dayShift, esc, nav, numTxt } from './ui.js';

export const BODY_RANGES = [['3m', '3 Monate', 91], ['1y', '1 Jahr', 365], ['all', 'Alles', null]];

// marker: { day, label } – senkrechte Linie, z. B. „weniger rauchen“ seit …
export function bodyChart(points, f, fromDay, T, marker = null) {
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
  const mx = marker && marker.day >= (fromDay || points[0].day) && marker.day <= T ? x(marker.day) : null;
  const date = (d) => `${parseDay(d).getDate()}. ${monthShort(d.slice(0, 7))}${d.slice(0, 4) !== T.slice(0, 4) ? ' ' + d.slice(0, 4) : ''}`;
  return `<div class="hr-chart" style="grid-template-columns: 38px minmax(0, 1fr); margin-top: 10px">
      <div class="hr-y small muted" style="height: ${Hc}px" aria-hidden="true"><span style="top: ${((y(hi0) / Hc) * 100).toFixed(1)}%">${numTxt(hi0, f.digits)}</span><span style="top: ${((y(lo0) / Hc) * 100).toFixed(1)}%">${numTxt(lo0, f.digits)}</span></div>
      <svg viewBox="0 0 ${W} ${Hc}" style="height: ${Hc}px" role="img" aria-label="${esc(f.label)} zwischen ${numTxt(lo0, f.digits)} und ${numTxt(hi0, f.digits)} ${f.unit}; zuletzt ${numTxt(vals[vals.length - 1], f.digits)}">
        <line x1="0" x2="${W}" y1="${y(hi0).toFixed(1)}" y2="${y(hi0).toFixed(1)}" style="stroke: var(--border)" stroke-dasharray="3 4"></line>
        <line x1="0" x2="${W}" y1="${y(lo0).toFixed(1)}" y2="${y(lo0).toFixed(1)}" style="stroke: var(--border)" stroke-dasharray="3 4"></line>
        ${mx != null ? `<line x1="${mx.toFixed(1)}" x2="${mx.toFixed(1)}" y1="2" y2="${Hc - 2}" style="stroke: var(--c-teal)" stroke-width="1.5" stroke-dasharray="2 3"></line><text x="${(mx > W - 100 ? mx - 4 : mx + 4).toFixed(1)}" y="11" text-anchor="${mx > W - 100 ? 'end' : 'start'}" font-size="10" style="fill: var(--c-teal)">${esc(marker.label)}</text>` : ''}
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

const HEART = '<svg width="15" height="15" viewBox="0 0 24 24" aria-hidden="true" style="fill: var(--c-pink)"><path d="M12 21s-7.5-4.6-9.5-9.3C1 8 3.4 4.5 7 4.5c2 0 3.4 1.1 5 3 1.6-1.9 3-3 5-3 3.6 0 6 3.5 4.5 7.2C19.5 16.4 12 21 12 21z"></path></svg>';
const PULSE = { key: 'rest', label: 'Ruhepuls', unit: 'bpm', digits: 0, color: 'pink' };

// Ruhepuls von Withings: Ø Puls im Schlaf, als Verlauf wie die Waagen-Werte
export function pulseCard(S, T, fromDay, ranged) {
  if (!S.hasPulseSchema) return '';
  const rest = restValues(S.sleep, S.heart, T);
  if (!rest) return '';
  const txt = REST_TEXT[rest.kind];
  const pts = restSeries(rest.vals, fromDay);
  const last = lastRest(rest.vals, T, 7);
  const smoke = (S.reduceSettings || []).find((r) => r.kind === 'rauchen');
  const marker = smoke && (S.profile?.modules || []).includes('weniger') ? { day: smoke.started_on, label: 'weniger rauchen' } : null;
  const dayTxt = (d) => `${parseDay(d).getDate()}. ${monthShort(d.slice(0, 7))}`;
  const when = !last ? 'nichts Frisches' : (rest.kind === 'sleep'
    ? (last.day === T ? 'letzte Nacht' : `Nacht zum ${dayTxt(last.day)}`)
    : (last.day === dayShift(T, -1) ? 'gestern' : dayTxt(last.day)));
  return `<section class="card pad">
    <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 10px">
      <div><div class="small muted" style="font-weight: 600; display: flex; align-items: center; gap: 6px">${HEART}Ruhepuls</div>
        <div style="font-size: 28px; font-weight: 700; line-height: 1.15">${last ? `${last.v} bpm` : '–'}</div>
        <div class="small muted" style="margin-top: 2px">${when} · ${txt.what}</div></div>
      <div class="small muted" style="text-align: right; line-height: 1.4">${changeTxt(pts, PULSE)}</div>
    </div>
    ${pts.length ? bodyChart(pts, PULSE, ranged ? fromDay : null, T, marker) : '<p class="hint" style="margin-top: 8px">In diesem Zeitraum noch keine Werte.</p>'}
  </section>`;
}

// Hinweis unter dem Puls – je nach Quelle
export function pulseHint(S, T) {
  const rest = S.hasPulseSchema && restValues(S.sleep, S.heart, T);
  return rest ? ` Ruhepuls: ${REST_TEXT[rest.kind].hint.replace(/\.$/, '')}; Schlaf, Stress, Koffein und Rauchen bewegen ihn.` : '';
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
  const pulse = pulseCard(S, T, range[2] ? fromDay : '0000-00-00', !!range[2]);
  const pHint = pulse ? pulseHint(S, T) : '';
  const body = list.length
    ? `<div class="seg" role="radiogroup" aria-label="Zeitraum">${seg}</div>
      ${main}
      ${pulse}
      <p class="hint" style="padding: 0 4px">Punkte = einzelne Messungen, Linie = Schnitt der letzten 2 Wochen. Die Waage schätzt Fett und Muskeln – ein Trend, kein Urteil.${pHint}</p>
      ${more ? `<div class="section-head"><h2 style="font-size: 17px">Weitere Werte</h2><span class="small muted">antippen für Verlauf</span></div>
      <section class="card list">${more}</section>` : ''}`
    : `${pulse ? `<div class="seg" role="radiogroup" aria-label="Zeitraum">${seg}</div>${pulse}<p class="hint" style="padding: 0 4px">Punkte = einzelne Werte, Linie = Schnitt der letzten 2 Wochen.${pHint}</p>` : ''}<section class="card pad" style="display: flex; flex-direction: column; gap: 10px"><b>Noch keine Messungen</b><p class="hint">Exportiere deine Werte aus Renpho und importiere sie hier.</p><a class="btn" href="#/body-import">Renpho importieren</a></section>`;
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
