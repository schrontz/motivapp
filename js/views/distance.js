// „Wie weit bin ich gekommen?“ – Strecke als Kreis auf der Karte, zusammengezählt.

import { STARTS, walked, journey, pace } from '../distance.js';
import { monthName, monthStart } from '../dates.js';
import { backBar, esc, nav, numTxt, shortDate } from './ui.js';

const kmTxt = (v) => `${numTxt(v, v >= 100 || Number.isInteger(v) ? 0 : 1)} km`;

// Dauer grob: bis zwei Wochen in Tagen, danach in Wochen
function daysTxt(days) {
  if (days <= 14) return `etwa ${Math.ceil(days)} Tage`;
  return `etwa ${Math.round(days / 7)} Wochen`;
}

export function distanceView(S, T) {
  const startName = S.distStart || STARTS[0];
  const month = S.distRange === 'month';
  const all = walked(S.activity || []);
  const span = month ? walked(S.activity || [], monthStart(T), T) : all;
  const j = journey(startName, span.km);
  const p = pace(S.activity || [], T);
  const short = startName.replace(' am Main', '');

  if (!all.first) {
    return `<div class="app">
      ${backBar('#/', 'Übersicht')}
      <div class="wrap" style="gap: 14px">
        <h1 style="font-size: 28px; padding: 0 4px">Wie weit bin ich gekommen?</h1>
        <p class="hint-card"><span>Hier zählt die App deine Strecke aus Withings zusammen und zeigt, bis wohin du hättest laufen können. Verbinde Withings im Profil – dann geht's los.</span></p>
      </div>
      ${nav('overview')}
    </div>`;
  }

  const seg = [['all', 'Seit Start'], ['month', 'Dieser Monat']].map(([id, label]) =>
    `<label><input type="radio" name="drange" value="${id}"${(month ? 'month' : 'all') === id ? ' checked' : ''} data-action="dist-range"><span>${label}</span></label>`).join('');

  const headline = j.last
    ? `Von ${esc(short)} bis <b>${esc(j.last.name)}</b>`
    : `Noch nicht ganz bis ${esc(j.next.name)}`;
  const nextLine = j.next
    ? `Nächstes Ziel: <b>${esc(j.next.name)}</b> – noch ${kmTxt(j.toNext)}`
    : 'Alle Ziele auf der Karte erreicht. Respekt.';

  // Karte: Daten für js/map.js
  const mapData = {
    start: { name: j.start.name, lat: j.start.lat, lng: j.start.lng },
    km: span.km,
    reached: j.reached.map((c) => ({ name: c.name, lat: c.lat, lng: c.lng })),
    next: j.next ? { name: j.next.name, lat: j.next.lat, lng: j.next.lng } : null
  };

  // Sanfter Ausblick: Was schafft man in einer normalen Woche? Kein Ziel, nur ein Gefühl dafür.
  let paceCard = '';
  if (p && p.days >= 5) {
    const week = journey(startName, p.perWeek);
    paceCard = `<section class="hint-card">
      <p>In einer normalen Woche läufst du etwa <b>${kmTxt(p.perWeek)}</b> (Ø ${numTxt(p.perDay, 1)} km am Tag).
      ${week.last ? `Von ${esc(short)} aus reicht das bis <b>${esc(week.last.name)}</b> (${kmTxt(week.last.dist)}).` : `Bis ${esc(week.next.name)} (${kmTxt(week.next.dist)}) wären es bei deinem Schnitt ${daysTxt(week.next.dist / p.perDay)}.`}</p>
    </section>`;
  }

  const recent = j.reached.slice(-4).reverse();
  const rows = [
    ...j.ahead.slice(0, 2).reverse().map((c) => ({ c, state: 'ahead' })),
    ...recent.map((c) => ({ c, state: 'done' }))
  ].map(({ c, state }) => `<div class="dest-row" data-state="${state}">
      <span class="dest-dot"></span><span class="dest-name">${esc(c.name)}</span>
      <span class="small muted">${state === 'done' ? kmTxt(c.dist) : `noch ${kmTxt(Math.round((c.dist - span.km) * 10) / 10)}`}</span>
    </div>`).join('');
  const more = j.reached.length > recent.length ? `<div class="small muted" style="padding: 4px 0 0 22px">und ${j.reached.length - recent.length} weitere davor</div>` : '';

  const startOpts = STARTS.map((n) => `<option value="${esc(n)}"${n === startName ? ' selected' : ''}>${esc(n)}</option>`).join('');

  return `<div class="app">
    ${backBar('#/', 'Übersicht')}
    <div class="wrap" style="gap: 14px">
      <h1 style="font-size: 28px; padding: 0 4px">Wie weit bin ich gekommen?</h1>
      <div class="seg" role="radiogroup" aria-label="Zeitraum">${seg}</div>
      <section class="card pad dist-head">
        <div class="dist-km">${kmTxt(span.km)}</div>
        <div class="small muted">${month ? `im ${monthName(T)}` : `zu Fuß seit ${shortDate(all.first)}`}</div>
        <div class="dist-line">${headline}</div>
      </section>
      <div id="dist-map" class="dist-map" data-map='${esc(JSON.stringify(mapData))}' role="img" aria-label="Karte: Kreis mit ${kmTxt(span.km)} um ${esc(j.start.name)}"><div class="dist-map-msg small muted">Karte lädt …</div></div>
      <section class="card pad">
        <div class="dist-next">${nextLine}</div>
        <div class="dest-list">${rows}${more}</div>
      </section>
      ${paceCard}
      <section class="card pad" style="display: flex; flex-direction: column; gap: 8px">
        <label class="small muted" for="dist-start">Startort</label>
        <select id="dist-start" class="input" data-action="dist-start">${startOpts}</select>
      </section>
      <p class="hint" style="padding: 0 4px">Luftlinie – zu Fuß wäre der Weg etwas länger. Die Strecke kommt aus Withings und reicht so weit zurück wie deine Withings-Daten.</p>
    </div>
    ${nav('overview')}
  </div>`;
}
