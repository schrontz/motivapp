// „Weniger rauchen“: Karte auf der Übersicht, Bereich (erste Woche / Abstand), Einrichten.
// Grün statt Rot, keine Vorwürfe: Früher geraucht wird einfach gezählt.

import { phase, baseline, currentInterval, timer, savings, recentAvg, countsByDay, costPerUnit, costStats, planProjection, DEFAULT_COSTS, WATCH_DAYS, hm } from '../reduce.js';
import { restValues, restCompare, REST_TEXT } from '../pulse.js';
import { addDays, parseDay } from '../dates.js';
import { backBar, esc, nav, numTxt, shortDate } from './ui.js';

const KIND = 'rauchen';
const WD = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];

export function reduceOn(S) {
  return !!(S.hasReduceSchema && S.profile && (S.profile.modules || []).includes('weniger'));
}

const euro = (v) => `${numTxt(v, 2)} €`;
const cents = (v) => { if (v >= 1) return euro(v); const c = v < 0.1 ? Math.round(v * 1000) / 10 : Math.round(v * 100); return `${numTxt(c, Number.isInteger(c) ? 0 : 1)} Cent`; };
const timeTxt = (iso) => { const d = new Date(iso); return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')} Uhr`; };
function agoTxt(min) {
  if (min == null) return '';
  if (min < 1) return 'gerade eben';
  if (min < 60) return `vor ${min} Min`;
  const h = Math.floor(min / 60); const m = min % 60;
  return `vor ${h} Std${m ? ` ${m} Min` : ''}`;
}

function pulseOf(S, settings, T) {
  const rest = S.hasPulseSchema && restValues(S.sleep, S.activity, T);
  return rest ? { kind: rest.kind, ...restCompare(rest.vals, settings.started_on, T) } : null;
}

// Alles, was die Bildschirme brauchen, an einer Stelle
export function reduceState(S, T, now = new Date()) {
  const settings = (S.reduceSettings || []).find((r) => r.kind === KIND) || null;
  if (!settings) return { settings: null };
  const events = (S.reduceEvents || []).filter((e) => e.kind === KIND && !e.cancelled);
  const ph = phase(settings, T);
  const base = baseline(events, settings);
  const iv = currentInterval(base, settings, T);
  const tm = timer(events, iv && iv.minutes, now, settings);
  const cost = costPerUnit(settings.costs);
  const counts = countsByDay(events);
  return {
    settings, events, ph, base, iv, tm, cost, counts,
    today: counts.get(T) || 0,
    saved: savings(events, base, settings, T, cost.total),
    avg7: recentAvg(events, T, 7, settings.started_on),
    spend: costStats(events, settings, T, cost.total, S.reduceCostBasis),
    plan: planProjection(base, settings, T, cost.total),
    pulse: pulseOf(S, settings, T)
  };
}

function ringSvg(size, stroke, share, label, inner = '') {
  const r = (size - stroke) / 2;
  const C = 2 * Math.PI * r;
  const f = Math.max(0, Math.min(1, share));
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" role="img" aria-label="${esc(label)}">
    <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" style="stroke: var(--k-teal)" stroke-width="${stroke}"></circle>
    <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" style="stroke: var(--c-teal)" stroke-width="${stroke}" stroke-linecap="round" stroke-dasharray="${(f * C).toFixed(1)} ${C.toFixed(1)}" transform="rotate(-90 ${size / 2} ${size / 2})"></circle>
    ${inner}
  </svg>`;
}

// Text für den Timer (Karte und Bereich)
function timerText(st) {
  const { tm, iv, settings } = st;
  if (tm.night) return { big: 'Nachtruhe', small: `Der Abstand ruht bis ${settings.night_to} Uhr`, share: 1 };
  if (!iv) return { big: tm.last ? agoTxt(tm.since).replace('vor ', '') : 'noch keine', small: tm.last ? `seit der letzten (${timeTxt(tm.last.at)})` : 'heute', share: 0 };
  if (!tm.last) return { big: 'frei', small: 'noch keine heute', share: 1 };
  if (tm.left > 0) {
    const next = new Date(Date.now() + tm.left * 60000);
    return { big: `noch ${tm.left} Min`, small: `nächste ab ${next.getHours()}:${String(next.getMinutes()).padStart(2, '0')} · zuletzt ${agoTxt(tm.since)}`, share: tm.since / iv.minutes };
  }
  return { big: 'Abstand geschafft', small: tm.left < 0 ? `schon ${-tm.left} Min länger – stark` : 'genau geschafft', share: 1 };
}

function undoLink(S) {
  return S.reduceUndo ? '<button type="button" class="link-btn" data-action="reduce-undo">Gezählt · Rückgängig</button>' : '';
}

// ───────────── Karte auf der Übersicht ─────────────

export function reduceCard(S, T) {
  if (!reduceOn(S)) return '';
  const st = reduceState(S, T);
  if (!st.settings) {
    return `<section class="card pad reduce-card">
      <div class="reduce-head"><span class="reduce-ico">${smokeIcon()}</span><b>Weniger rauchen</b></div>
      <p class="small muted">Starte mit einer Woche nur zählen – ohne Ziel. Danach schlage ich dir einen Abstand vor.</p>
      <button type="button" class="btn" data-action="reduce-start" style="height: 48px; font-size: 16px; background: var(--c-teal)">Los geht's</button>
    </section>`;
  }
  if (st.settings.show_card === false) return '';
  const t = timerText(st);
  const watch = st.ph.name === 'watch';
  return `<section class="card pad reduce-card">
    <a class="reduce-head" href="#/weniger"><span class="reduce-ico">${smokeIcon()}</span><b style="flex: 1">Weniger rauchen</b><span class="small muted">heute <b style="color: var(--text); font-size: 16px">${st.today}</b></span></a>
    ${watch
      ? `<div class="small muted">Erste Woche · Tag ${st.ph.day} von ${WATCH_DAYS} – einfach zählen${st.tm.last ? ` · zuletzt ${agoTxt(st.tm.since)}` : ''}</div>`
      : `<div class="reduce-row">${ringSvg(64, 7, t.share, t.big)}<div style="flex: 1; min-width: 0"><div class="reduce-big">${esc(t.big)}</div><div class="small muted">${esc(t.small)}</div></div></div>`}
    <button type="button" class="btn ghost reduce-btn" data-action="reduce-smoke">Geraucht</button>
    ${undoLink(S)}
    ${watch ? '' : `<div class="small muted reduce-foot"><span>Abstand gerade ${st.iv ? st.iv.minutes : '–'} Min</span><span>gespart <b style="color: var(--c-teal)">${euro(st.saved.euro)}</b></span></div>`}
  </section>`;
}

function smokeIcon() {
  return '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 15h13v3H3z"></path><path d="M19 15v3M21 15v3"></path><path d="M17 11c0-2 2-2 2-4M20 11c0-2 2-2 2-4"></path></svg>';
}

// ───────────── Bereich ─────────────

// Was das Rauchen kostet – neutral, ohne Rot. Die Hochrechnung schrumpft, wenn du weniger rauchst.
function costCard(S, st, watch) {
  const c = st.spend;
  if (!c) return '';
  const basis = watch ? 'start' : S.reduceCostBasis;
  const seg = watch ? '' : `<div class="seg small-seg" role="radiogroup" aria-label="Hochrechnen mit">
      ${[['recent', 'letzte 7 Tage'], ['start', 'seit Start']].map(([id, label]) => `<label><input type="radio" name="rcost" value="${id}"${basis === id ? ' checked' : ''} data-action="reduce-cost-basis"><span>${label}</span></label>`).join('')}
    </div>`;
  const n = (v) => numTxt(v, v % 1 ? 1 : 0);
  const note = c.rate == null
    ? 'Ab morgen steht hier, was das im Monat und im Jahr ausmacht.'
    : `Hochgerechnet mit deinem Schnitt ${basis === 'start' ? 'seit Start' : 'der letzten 7 Tage'} (${n(c.rate)} am Tag).${watch ? '' : ' Rauchst du weniger, schrumpfen Monat und Jahr mit.'}`;
  return `<section class="card pad" style="display: flex; flex-direction: column; gap: 12px">
    <h2 style="font-size: 17px">Was das Rauchen kostet</h2>
    ${seg}
    <div class="stat3 inner">
      <div><div class="small muted">am Tag</div><b>${c.perDay == null ? '–' : euro(c.perDay)}</b></div>
      <div><div class="small muted">im Monat</div><b>${c.perMonth == null ? '–' : `≈ ${numTxt(c.perMonth, 0)} €`}</b></div>
      <div><div class="small muted">im Jahr</div><b>${c.perYear == null ? '–' : `≈ ${numTxt(c.perYear, 0)} €`}</b></div>
    </div>
    ${planChart(st, watch)}
    <div class="reduce-spent"><span class="muted">ausgegeben seit ${shortDate(st.settings.started_on)}</span><b>${euro(c.spent.euro)} · ${c.spent.units} Stück</b></div>
    <p class="small muted" style="line-height: 1.45">${note}</p>
  </section>`;
}

// Kurve: Monatskosten in den nächsten 12 Monaten, wenn der Abstand nach Plan wächst
function planChart(st, watch) {
  const p = st.plan;
  if (watch) return '<p class="small muted reduce-plan" style="line-height: 1.45">Nach der ersten Woche siehst du hier, wie die Kosten sinken, wenn der Abstand wächst.</p>';
  if (!p || !st.settings.step_min) return '';
  const W = 300; const H = 96;
  const now = !watch && st.spend.rate != null ? Math.round(st.spend.rate * st.cost.total * 30.4) : null;
  const hi = Math.max(p[0].euro, now || 0, 1); const lo = 0;
  const x = (m) => 6 + (m / 12) * (W - 12);
  const y = (v) => 8 + (1 - (v - lo) / (hi - lo)) * (H - 16);
  const line = p.map((q) => `${x(q.m).toFixed(1)},${y(q.euro).toFixed(1)}`).join(' ');
  const area = `${x(0).toFixed(1)},${y(0).toFixed(1)} ${line} ${x(12).toFixed(1)},${y(0).toFixed(1)}`;
  const end = p[12];
  const iv = end.interval ? ` (Abstand dann ${end.interval >= 120 ? `${numTxt(Math.round(end.interval / 6) / 10, 1)} Std` : `${end.interval} Min`})` : '';
  return `<div class="reduce-plan">
    <div class="small" style="font-weight: 600">Wenn der Abstand weiter wächst</div>
    <div class="hr-chart" style="grid-template-columns: 40px minmax(0, 1fr)">
      <div class="hr-y small muted" style="height: ${H}px" aria-hidden="true"><span style="top: ${((y(p[0].euro) / H) * 100).toFixed(1)}%">${numTxt(p[0].euro, 0)} €</span><span style="top: ${((y(end.euro) / H) * 100).toFixed(1)}%">${numTxt(end.euro, 0)} €</span></div>
      <svg viewBox="0 0 ${W} ${H}" style="height: ${H}px" role="img" aria-label="Kosten pro Monat nach Plan: jetzt etwa ${p[0].euro} Euro, in einem Jahr etwa ${end.euro} Euro">
        <line x1="0" x2="${W}" y1="${y(0).toFixed(1)}" y2="${y(0).toFixed(1)}" style="stroke: var(--border)"></line>
        <polygon points="${area}" style="fill: var(--k-teal)" opacity="0.7"></polygon>
        <polyline points="${line}" fill="none" style="stroke: var(--c-teal)" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"></polyline>
        ${now != null ? `<circle cx="${x(0).toFixed(1)}" cy="${y(now).toFixed(1)}" r="4.5" style="fill: var(--surface); stroke: var(--text)" stroke-width="2"><title>tatsächlich gerade ≈ ${now} € im Monat</title></circle>` : ''}
      </svg>
    </div>
    <div class="small muted" style="display: flex; justify-content: space-between; padding-left: 46px"><span>jetzt</span><span>in 6 Mon.</span><span>in 1 Jahr</span></div>
    <p class="small muted" style="line-height: 1.45">Ein Monat kostet nach Plan in einem Jahr noch ≈ ${numTxt(end.euro, 0)} € statt ≈ ${numTxt(p[0].euro, 0)} €${iv}.${now != null ? ' Der Kreis zeigt, wo du gerade wirklich stehst.' : ''} Ein Plan, keine Frist – bleibst du länger beim selben Abstand, wird die Kurve einfach flacher.</p>
  </div>`;
}

// Ruhepuls vorher / jetzt (Withings) – nur wenn Nächte da sind
function pulseCard(st) {
  const p = st.pulse;
  if (!p || (!p.before && !p.recent)) return '';
  const v = (a) => (a ? `${numTxt(Math.round(a.v), 0)} <span style="font-size: 13px; font-weight: 500">bpm</span>` : '–');
  return `<section class="card pad" style="display: flex; flex-direction: column; gap: 10px">
    <div style="display: flex; justify-content: space-between; align-items: center">
      <h2 style="font-size: 17px; display: flex; align-items: center; gap: 6px"><svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" style="fill: var(--c-pink)"><path d="M12 21s-7.5-4.6-9.5-9.3C1 8 3.4 4.5 7 4.5c2 0 3.4 1.1 5 3 1.6-1.9 3-3 5-3 3.6 0 6 3.5 4.5 7.2C19.5 16.4 12 21 12 21z"></path></svg>Ruhepuls</h2>
      <a class="link-btn" href="#/body" style="text-decoration: none">Verlauf ›</a>
    </div>
    <div class="grid2 inner">
      <div><div class="small muted">Woche vor dem Start</div><b>${v(p.before)}</b></div>
      <div><div class="small muted">${REST_TEXT[p.kind].recent}</div><b>${v(p.recent)}</b></div>
    </div>
    <p class="small muted" style="line-height: 1.45">${REST_TEXT[p.kind].hint} Er schwankt mit Schlaf, Stress und Infekten – erst über Wochen sieht man, was das Rauchen ausmacht.</p>
  </section>`;
}

function bars(days, counts, T, ref) {
  const max = Math.max(ref || 0, ...days.map((d) => counts.get(d) || 0), 1);
  const H = 110;
  return `<div class="reduce-bars" style="height: ${H + 50}px">
    ${ref ? `<div class="goal-line mini" style="bottom: ${Math.round((ref / max) * H) + 22}px"></div>` : ''}
    ${days.map((d) => {
      const n = d > T ? null : (counts.get(d) || 0);
      return `<div class="reduce-bar"><span class="small" style="font-weight: 600">${n == null ? '' : n}</span>
        <span class="reduce-bar-fill" data-today="${d === T}" style="height: ${n ? Math.max(4, Math.round((n / max) * H)) : 4}px${n == null ? '; background: var(--border)' : ''}"></span>
        <span class="small muted">${days.length <= 7 ? WD[parseDay(d).getDay()] : (d === T ? 'heute' : '')}</span></div>`;
    }).join('')}
  </div>`;
}

function todayLine(st, T) {
  const from = hm(st.settings.night_to); const to = hm(st.settings.night_from);
  const span = (to > from ? to : to + 1440) - from;
  const dots = st.events.filter((e) => e.day === T).map((e) => {
    const d = new Date(e.at); let m = d.getHours() * 60 + d.getMinutes() - from;
    if (m < 0) m += 1440;
    return `<span class="reduce-dot" style="left: calc(${Math.min(100, (m / span) * 100).toFixed(1)}% - 7px)" title="${timeTxt(e.at)}"></span>`;
  }).join('');
  return `<div class="reduce-line" role="img" aria-label="Heute ${st.today} Mal">${dots}</div>
    <div class="small muted" style="display: flex; justify-content: space-between"><span>${esc(st.settings.night_to)}</span><span>${esc(st.settings.night_from)}</span></div>`;
}

export function reduceView(S, T) {
  if (!reduceOn(S)) {
    return `<div class="app">${backBar('#/', 'Übersicht')}<div class="wrap"><p class="hint-card">Schalte „Weniger rauchen“ im Profil ein.</p></div>${nav('overview')}</div>`;
  }
  const st = reduceState(S, T);
  if (!st.settings) {
    return `<div class="app">${backBar('#/', 'Übersicht')}<div class="wrap" style="gap: 14px">
      <h1 style="font-size: 28px; padding: 0 4px">Weniger rauchen</h1>
      <section class="hint-card"><div style="font-size: 16px; font-weight: 700">Erst mal nur zählen</div><p>Eine Woche lang tippst du jedes Mal auf „Geraucht“ – ohne Ziel. Danach kenne ich deinen Ausgangswert und schlage dir einen Abstand vor.</p>
      <button type="button" class="btn" data-action="reduce-start" style="background: var(--c-teal)">Los geht's</button></section>
    </div>${nav('overview')}</div>`;
  }
  const watch = st.ph.name === 'watch';
  const t = timerText(st);
  const head = `<div style="padding: 0 4px"><h1 style="font-size: 28px">Weniger rauchen</h1>
    <div class="small muted" style="font-size: 14px">${watch ? `Erste Woche · Tag ${st.ph.day} von ${WATCH_DAYS}` : `Woche ${st.ph.week} · Abstand ${st.iv ? st.iv.minutes : '–'} Min`}</div></div>`;
  const top = `<div style="display: flex; justify-content: space-between; align-items: center">${backBar('#/', 'Übersicht')}<a class="link-btn" href="#/weniger-einrichten" style="margin-right: 12px; display: inline-flex; align-items: center; text-decoration: none">Einrichten</a></div>`;

  if (watch) {
    const days = Array.from({ length: WATCH_DAYS }, (_, i) => addDays(st.settings.started_on, i));
    const segs = days.map((d) => `<span style="${d < T ? 'background: var(--c-teal)' : (d === T ? 'background: var(--c-teal); opacity: 0.5' : 'background: var(--surface)')}"></span>`).join('');
    const sofar = days.filter((d) => d < T);
    const sum = sofar.reduce((s, d) => s + (st.counts.get(d) || 0), 0);
    const perDay = sofar.length ? Math.round((sum / sofar.length) * 10) / 10 : null;
    return `<div class="app">${top}<div class="wrap" style="gap: 14px">
      ${head}
      <section class="hint-card reduce-soft"><div style="font-size: 16px; font-weight: 700">Erst mal nur zählen</div>
        <p>Noch kein Ziel, kein Abstand. Rauch wie immer und tipp jedes Mal auf „Geraucht“. Nach ${WATCH_DAYS} Tagen kenne ich deinen Ausgangswert und schlage dir einen Abstand vor.</p>
        <div class="reduce-segs">${segs}</div></section>
      <section class="card pad" style="display: flex; flex-direction: column; gap: 12px">
        <div style="display: flex; justify-content: space-between; align-items: baseline">
          <div><div class="small muted" style="font-weight: 600">Heute</div><div class="reduce-count">${st.today}</div></div>
          <div class="small muted" style="text-align: right">${st.tm.last ? `zuletzt<br><b style="color: var(--text); font-size: 15px">${timeTxt(st.tm.last.at)}</b>` : ''}</div>
        </div>
        ${todayLine(st, T)}
        <button type="button" class="btn" data-action="reduce-smoke" style="background: var(--c-teal)">Geraucht</button>
        ${undoLink(S)}
      </section>
      <section class="card pad"><h2 style="font-size: 17px; margin-bottom: 12px">Bisher</h2>${bars(days, st.counts, T)}</section>
      <section class="stat3">
        <div class="card"><div class="small muted">Ø am Tag</div><b>${perDay == null ? '–' : numTxt(perDay, perDay % 1 ? 1 : 0)}</b></div>
        <div class="card"><div class="small muted">Ø Abstand</div><b>${st.base.gap ? `${st.base.gap}′` : '–'}</b></div>
        <div class="card"><div class="small muted">seit Start</div><b>${st.spend.spent.units}</b></div>
      </section>
      ${costCard(S, st, true)}
      ${pulseCard(st)}
      <p class="hint" style="padding: 0 4px">Abstand zwischen ${esc(st.settings.night_to)} und ${esc(st.settings.night_from)} Uhr, die Nacht zählt nicht. Kosten: etwa ${cents(st.cost.total)} pro Zigarette (${numTxt((st.settings.costs || {}).g_per_unit || DEFAULT_COSTS.g_per_unit, 2)} g – nachwiegen unter „Einrichten“).</p>
    </div>${nav('overview')}</div>`;
  }

  const days = Array.from({ length: 14 }, (_, i) => addDays(T, i - 13));
  return `<div class="app">${top}<div class="wrap" style="gap: 14px">
    ${head}
    <section class="card pad reduce-timer">
      ${ringSvg(190, 14, t.share, t.big, `<text x="95" y="${t.big.length > 12 ? 92 : 98}" text-anchor="middle" class="reduce-ring-big">${esc(t.big.length > 12 ? '✓' : t.big)}</text>`)}
      <div class="small muted" style="text-align: center; font-size: 14px">${esc(t.big.length > 12 ? `${t.big} · ${t.small}` : t.small)}</div>
      <button type="button" class="btn" data-action="reduce-smoke" style="background: var(--c-teal)">Geraucht</button>
      ${undoLink(S)}
    </section>
    <section class="stat3">
      <div class="card"><div class="small muted">Heute</div><b>${st.today}</b></div>
      <div class="card"><div class="small muted">Ø 7 Tage</div><b>${st.avg7 == null ? '–' : numTxt(st.avg7, st.avg7 % 1 ? 1 : 0)}</b></div>
      <div class="card"><div class="small muted">am Anfang</div><b>${numTxt(st.base.perDay, st.base.perDay % 1 ? 1 : 0)}</b></div>
    </section>
    <section class="reduce-saved">
      <div style="font-size: 14px; font-weight: 600; opacity: 0.9">Gespart seit Start</div>
      <div class="reduce-euro">${euro(st.saved.euro)}</div>
      <p>${st.saved.units ? `${numTxt(st.saved.units, st.saved.units % 1 ? 1 : 0)} Zigaretten weniger als am Anfang.` : 'Jeder Tag unter deinem Ausgangswert zählt hier.'} Diese Zahl wächst nur – ein Tag mit mehr nimmt nichts weg.</p>
    </section>
    ${costCard(S, st, false)}
    ${pulseCard(st)}
    <section class="card pad">
      <div class="section-head" style="margin: 0 0 12px"><h2 style="font-size: 17px">Letzte 14 Tage</h2><span class="small muted">Linie = am Anfang (${numTxt(st.base.perDay, st.base.perDay % 1 ? 1 : 0)})</span></div>
      ${bars(days, st.counts, T, st.base.perDay)}
    </section>
    <section class="card pad" style="display: flex; flex-direction: column; gap: 10px">
      <h2 style="font-size: 17px">Abstand</h2>
      <div style="display: flex; align-items: center; justify-content: space-between">
        <div><div style="font-size: 22px; font-weight: 700">${st.iv ? st.iv.minutes : '–'} Min</div>
          <div class="small muted">${st.settings.step_min ? `ab nächster Woche ${st.iv ? st.iv.next : '–'} Min (+${st.settings.step_min} pro Woche)` : 'bleibt gleich (kein Zuwachs eingestellt)'}</div></div>
        <div style="display: flex; gap: 6px">
          <button type="button" class="mini-round" data-action="reduce-adjust" data-id="-5" aria-label="Abstand 5 Minuten kürzer">−</button>
          <button type="button" class="mini-round" data-action="reduce-adjust" data-id="5" aria-label="Abstand 5 Minuten länger">+</button>
        </div>
      </div>
      <p class="small muted" style="line-height: 1.45">Zu schnell? Einfach kürzer stellen. Früher geraucht wird nur gezählt – der Abstand beginnt dann neu.</p>
    </section>
    <p class="hint" style="padding: 0 4px">Seit ${shortDate(st.settings.started_on)} · etwa ${cents(st.cost.total)} pro Zigarette · Nachtruhe ${esc(st.settings.night_from)}–${esc(st.settings.night_to)} Uhr</p>
  </div>${nav('overview')}</div>`;
}

// ───────────── Einrichten ─────────────

export function reduceSettingsView(S, T) {
  const s = (S.reduceSettings || []).find((r) => r.kind === KIND);
  if (!s) return reduceView(S, T);
  const c = { ...DEFAULT_COSTS, ...(s.costs || {}) };
  const dec = (v) => String(v).replace('.', ',');
  const field = (name, label, value, extra = '') => `<label class="field"><span>${label}</span><input class="input" name="${name}" inputmode="decimal" value="${esc(dec(value))}" ${extra}></label>`;
  const cost = costPerUnit(c);
  return `<div class="app">${backBar('#/weniger', 'Weniger rauchen')}
  <form class="wrap" data-form="reduce-settings" style="gap: 14px">
    <h1 style="font-size: 28px; padding: 0 4px">Einrichten</h1>
    <section class="card pad" style="display: flex; flex-direction: column; gap: 12px">
      <h2 style="font-size: 17px">Was du kaufst</h2>
      <div class="reduce-grid"><b>Tabak</b>${field('tobacco_price', 'Preis €', c.tobacco_price)}${field('tobacco_g', 'Gramm', c.tobacco_g)}</div>
      <div class="reduce-grid"><b>Blättchen</b>${field('paper_price', 'Preis €', c.paper_price)}${field('paper_qty', 'Stück', c.paper_qty)}</div>
      <div class="reduce-grid"><b>Filter</b>${field('filter_price', 'Preis €', c.filter_price)}${field('filter_qty', 'Stück', c.filter_qty)}</div>
      <div class="reduce-grid two"><span><b>Tabak pro Zigarette</b><br><span class="small muted">geschätzt – später nachwiegen</span></span>${field('g_per_unit', 'Gramm', c.g_per_unit)}</div>
      <div class="reduce-cost"><span>Eine Zigarette kostet etwa</span><b>${cents(cost.total)}</b></div>
      <div class="small muted">Tabak ${cents(cost.tobacco)} · Blättchen ${cents(cost.paper)} · Filter ${cents(cost.filter)}. Aus ${numTxt(c.tobacco_g, 0)} g werden etwa ${Math.round(cost.perPack)} Zigaretten.</div>
    </section>
    <section class="card pad" style="display: flex; flex-direction: column; gap: 12px">
      <h2 style="font-size: 17px">Abstand</h2>
      <div class="grid2">
        <label class="field"><span>Nachtruhe ab</span><input class="input" type="time" name="night_from" value="${esc(s.night_from)}"></label>
        <label class="field"><span>bis</span><input class="input" type="time" name="night_to" value="${esc(s.night_to)}"></label>
      </div>
      <label class="field"><span>Länger werden pro Woche (Minuten, startet nach der ersten Woche)</span><input class="input" type="number" inputmode="numeric" min="0" max="60" name="step_min" value="${esc(s.step_min)}"></label>
    </section>
    <section class="card pad">
      <label class="switch-row" style="cursor: pointer">
        <span><span style="display: block; font-size: 15px; font-weight: 600">Auf der Übersicht zeigen</span><span class="small muted">Aus: nur hier im Bereich sichtbar – unauffälliger</span></span>
        <input type="checkbox" name="show_card" class="reduce-check" ${s.show_card === false ? '' : 'checked'}>
      </label>
    </section>
    <p class="small" style="color: var(--danger); min-height: 18px" id="reduce-error" role="alert"></p>
    <button type="submit" class="btn">Speichern</button>
    <p class="hint" style="padding: 0 4px">Das Modul schaltest du im Profil ein oder aus – jede Person für sich.</p>
  </form>${nav('overview')}</div>`;
}

// ───────────── Profil ─────────────

export function reduceProfileCard(S) {
  if (!S.hasReduceSchema) {
    return '<section class="card pad"><b>Weniger rauchen</b><p class="hint" style="margin-top: 4px">Dafür bitte zuerst das Datenbank-Update <code>009_weniger.sql</code> im Supabase SQL-Editor ausführen.</p></section>';
  }
  const on = reduceOn(S);
  return `<section class="card pad" style="display: flex; flex-direction: column; gap: 14px">
    <div class="switch-row" style="cursor: default">
      <div><div style="font-size: 16px; font-weight: 700">Weniger rauchen</div>
        <div class="small muted">Zählen, wachsender Abstand, Gespartes – ohne Vorwürfe</div></div>
      <button type="button" class="switch" role="switch" aria-checked="${on}" aria-label="Weniger rauchen nutzen" data-action="module-toggle" data-id="weniger"></button>
    </div>
    ${on ? '<a class="btn ghost" href="#/weniger">Öffnen</a>' : ''}
  </section>`;
}
