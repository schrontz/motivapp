// Übersicht: Ringe, Heute-Liste, Kacheln, Wert-Sheet, „Willkommen zurück“.

import { tileValues, categoryName, workoutCounts } from '../auto.js';
import { series, latest } from '../body.js';
import { longDate, greeting, monthName, diffDays, parseDay } from '../dates.js';
import { svg, habitIcon, HABIT_ICONS, UI_ICONS } from '../icons.js';
import { todayItems, sortTodayItems, todayRing, windowQuota, totalHits, scheduleText, logOf, isPaused, miniPeriodName, patternHint } from '../stats.js';
import { travelArrivedCard } from './distance.js';
import { bodyOn, colorOf, dayShift, esc, fmt, hm, nav, numTxt, timeOf, trainings } from './ui.js';

export function tilesSection(S, T) {
  const show = (S.profile && S.profile.tiles) || ['steps', 'training'];
  const withings = (S.withings && S.withings.connected) || S.activity.length;
  const v = tileValues({ activity: S.activity, workouts: trainings(S), today: T });
  const defs = {};
  if (withings) {
    defs.steps = { label: 'Schritte', color: 'teal', value: v.steps.value != null ? fmt(v.steps.value) : '–', sub: v.steps.avg7 != null ? `Ø 7 T. ${fmt(v.steps.avg7)}` : 'heute', href: '#/steps' };
    defs.training = { label: 'Training', color: 'blue', value: `${v.training.count}×`, sub: `7 Tage${v.training.minutes ? ' · ' + hm(v.training.minutes).replace(' min', '′') : ''}`, href: '#/training' };
    defs.active = { label: 'Aktiv', color: 'orange', value: v.active.value != null ? `${v.active.value} min` : '–', sub: 'heute', href: '#/steps' };
    defs.distance = { label: 'Strecke', color: 'pink', value: v.distance.value != null ? `${fmt(v.distance.value)} km` : '–', sub: 'heute', href: '#/distance' };
  }
  if (bodyOn(S)) {
    const w = latest(S.body || [], 'weight', T);
    const pts = series(S.body || [], 'weight', dayShift(T, -90));
    let spark = '';
    if (pts.length >= 2) {
      const vals = pts.map((p) => p.avg);
      const lo = Math.min(...vals); const hi = Math.max(...vals) || lo + 1;
      const t0 = parseDay(dayShift(T, -90)).getTime(); const t1 = parseDay(T).getTime();
      spark = `<svg viewBox="0 0 90 18" style="width: 100%; height: 18px; display: block; margin-top: 2px" aria-hidden="true"><polyline fill="none" style="stroke: var(--c-purple)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" points="${pts.map((p) => `${(2 + ((parseDay(p.day).getTime() - t0) / (t1 - t0)) * 86).toFixed(1)},${(2 + (1 - (p.avg - lo) / Math.max(0.1, hi - lo)) * 14).toFixed(1)}`).join(' ')}"></polyline></svg>`;
    }
    defs.body = { label: 'Körper', color: 'purple', value: w ? `${numTxt(w.avg2w ?? w.v, 1)} kg` : '–', sub: w ? (w.avg2w != null ? 'Ø 2 Wochen' : 'zuletzt') : 'noch leer', href: '#/body', spark };
  }
  const tiles = show.filter((k) => defs[k]).map((k) => {
    const d = defs[k];
    return `<a class="card tile" href="${d.href}" aria-label="${d.label}: ${esc(d.value)}, Verlauf ansehen">
      <div class="tile-head" style="color: var(--c-${d.color})">${d.label}</div>
      <div class="tile-val">${d.value}</div>
      ${d.spark || `<div class="small muted">${d.sub}</div>`}
    </a>`;
  });
  if (!tiles.length) return '';
  return `<div class="section-head"><h2>Deine Werte</h2><span class="small muted">antippen für Verlauf</span></div>
    <section class="tiles" aria-label="Kennzahlen">${tiles.join('')}</section>`;
}

export function dash(r, f) {
  const c = 2 * Math.PI * r;
  const len = Math.max(0.001, Math.min(1, f || 0)) * c;
  return `${len.toFixed(1)} ${c.toFixed(1)}`;
}

// pause: heute ist nichts fällig, weil Pause ist → Ring „Heute“ voll („Nichts muss“ soll sich auch so anfühlen)
export function ringsCard(today, week, month, pause = null) {
  const fToday = pause ? 1 : (today.due ? today.done / today.due : 0);
  const fWeek = week.expected ? week.hits / week.expected : 0;
  const fMonth = month.expected ? month.hits / month.expected : 0;
  const tText = pause ? (pause.done ? `Pause · ${pause.done} ✓` : 'Pause') : (today.due ? `${today.done} von ${today.due}` : '–');
  const wText = week.pct == null ? '–' : `${week.pct} %`;
  const mText = month.pct == null ? '–' : `${month.pct} %`;
  const label = `Heute ${tText}, letzte 7 Tage ${wText}, letzte 30 Tage ${mText}`;
  const ring = (r, n, f) => `
    <circle class="ring-track" cx="90" cy="90" r="${r}" style="stroke: var(--ring-${n}-track)"></circle>
    <circle class="ring-val" cx="90" cy="90" r="${r}" style="stroke: var(--ring-${n})" stroke-dasharray="${dash(r, f)}"></circle>`;
  const leg = (n, l, v) => `<div class="legend-item"><span class="dot" style="background: var(--ring-${n})"></span><div><div class="label">${l}</div><div class="value">${v}</div></div></div>`;
  return `<section class="card rings">
    <svg width="150" height="150" viewBox="0 0 180 180" role="img" aria-label="${esc(label)}">
      <g transform="rotate(-90 90 90)">${ring(78, 1, fToday)}${ring(60, 2, fWeek)}${ring(42, 3, fMonth)}</g>
    </svg>
    <div class="legend">${leg(1, 'Heute', tText)}${leg(2, 'Letzte 7 Tage', wText)}${leg(3, 'Letzte 30 Tage', mText)}</div>
  </section>`;
}

// Pausentag: alles pausiert oder nichts fällig, aber etwas pausiert. Zählt, was trotzdem gemacht wurde.
function pauseToday(items, allPaused) {
  const ring = todayRing(items);
  const paused = allPaused || (ring.due === 0 && items.some((i) => i.paused));
  return paused ? { done: items.filter((i) => i.hit).length } : null;
}

export function habitRow(S, item) {
  const h = item.habit;
  const col = colorOf(S, h);
  const log = item.log;
  let sub = item.sub || scheduleText(h);
  if (h.kind === 'count') {
    const v = log && log.value != null ? log.value : 0;
    sub = `${fmt(v)} von ${fmt(h.target)}${h.unit ? ' ' + esc(h.unit) : ''}` + (item.sub ? ` · ${item.sub}` : '');
  } else if (!item.sub && h.mini_text) {
    sub = `${scheduleText(h)} · Mini: ${h.mini_text}`;
  }
  const auto = log && log.source === 'withings';
  if (auto && h.kind === 'check') {
    const w = S.workouts.find((x) => x.day === log.day && workoutCounts(h, x));
    if (w) sub = `${categoryName(w.category)} ${timeOf(w.start_at)} · ${Math.round(w.duration_min)} Min · von Withings` + (item.sub ? ` · ${item.sub}` : '');
  } else if (auto && h.kind === 'count') {
    sub += ' · von Withings';
  }
  const p = item.period;
  const pills = [
    auto ? '<span class="pill auto">Auto</span>' : '',
    item.state === 'mini' ? '<span class="pill">Mini</span>' : '',
    p && p.state === 'mini' ? `<span class="pill">${miniPeriodName(h)}</span>` : '',
    p && p.state === 'goal' ? '<span class="pill goal">Ziel</span>' : '',
    (item.paused && !item.hit) ? '<span class="pill pause">Pause</span>' : ''
  ].join('');
  let progress = '';
  if (h.kind === 'count' && h.target) {
    progress = `<div class="progress" style="background: var(--k-${col})"><div style="width: ${Math.min(100, Math.round(((log && log.value) || 0) / h.target * 100))}%; background: var(--c-${col})"></div></div>`;
  } else if (p && p.target <= 14) {
    // Striche: dunkel bis zum Minimum, hell weiter bis zum Ziel
    const segs = [];
    for (let i = 0; i < p.target; i += 1) {
      const core = i < p.min;
      const filled = i < p.n;
      const bg = filled ? `var(--c-${col})` : (core ? 'var(--field)' : 'var(--border)');
      segs.push(`<span style="background: ${bg}${filled && !core ? '; opacity: 0.5' : ''}"></span>`);
    }
    progress = `<div class="segs" aria-hidden="true">${segs.join('')}</div>`;
  }
  const stateLabel = { open: 'offen', done: 'erledigt', mini: 'Mini erledigt', partial: 'angefangen' }[item.state];
  const btnStyle = item.state === 'done' ? ` style="background: var(--c-${col})"` : '';
  const btnIcon = item.state === 'done' || item.state === 'mini'
    ? svg(HABIT_ICONS.check.path, 20, 2.5)
    : (h.kind === 'count' ? svg(UI_ICONS.plus, 18, 2.5) : '');
  const action = h.kind === 'count' ? 'open-sheet' : 'toggle';
  const aria = h.kind === 'count' ? `${h.name}: Wert eintragen (${stateLabel})` : `${h.name}: ${stateLabel}. Tippen zum Ändern`;
  return `<div class="row${(item.paused && !item.hit) ? ' paused' : ''}">
    <div class="hicon" style="background: var(--k-${col}); color: var(--c-${col})">${habitIcon(h.icon)}</div>
    <a class="row-main" href="#/habit/${esc(h.id)}">
      <div class="row-title"><span>${esc(h.name)}</span>${pills}</div>
      <div class="row-sub">${esc(sub)}</div>
      ${progress}
    </a>
    <button type="button" class="check" data-action="${action}" data-id="${esc(h.id)}" data-state="${item.state}"${btnStyle} aria-label="${esc(aria)}">${btnIcon}</button>
  </div>`;
}

// ───────────── Übersicht ─────────────

export function overview(S, T) {
  const active = S.habits.filter((h) => !h.archived);
  const usedCats = S.categories.filter((c) => active.some((h) => h.category_id === c.id));
  const cat = usedCats.some((c) => c.id === S.cat) ? S.cat : 'all';
  const shown = cat === 'all' ? active : active.filter((h) => h.category_id === cat);
  const items = todayItems(shown, S.idx, S.pauses, T);
  const ids = new Set(shown.map((h) => h.id));
  const total = totalHits(S.logs.filter((l) => ids.has(l.habit_id) || cat === 'all'));
  const name = S.profile && S.profile.display_name ? `, ${esc(S.profile.display_name)}` : '';

  const chips = usedCats.length
    ? `<div class="chips" role="group" aria-label="Nach Kategorie filtern">
        <button type="button" class="chip" data-action="cat" data-id="all" aria-pressed="${cat === 'all'}">Alle</button>
        ${usedCats.map((c) => `<button type="button" class="chip" data-action="cat" data-id="${esc(c.id)}" aria-pressed="${cat === c.id}">${esc(c.name)}</button>`).join('')}
      </div>`
    : '';

  // Freundliche Hinweise bei Mustern (z. B. 4 Mini-Wochen am Stück) – wegklickbar
  const hints = shown.map((h) => ({ h, hint: patternHint(h, S.idx, S.pauses, T) }))
    .filter((x) => x.hint && !(S.hintSeen && S.hintSeen(x.h.id, x.hint.count)))
    .map(({ h, hint }) => hintCard(h, hint)).join('');

  const allPaused = S.pauses.some((p) => p.habit_id == null && p.start_day <= T && T <= p.end_day);
  let list;
  if (active.length === 0) {
    list = `<div class="empty"><b>Noch keine Gewohnheiten</b><p class="hint" style="margin: 6px 0 16px">Fang mit einer an – klein ist völlig okay.</p><a class="btn" href="#/new">Erste Gewohnheit anlegen</a></div>`;
  } else if (items.length === 0) {
    list = `<div class="empty"><b>Heute ist nichts geplant</b><p class="hint" style="margin-top: 4px">Genieß den freien Tag.</p></div>`;
  } else {
    list = `<div class="card list">${sortTodayItems(items).map((i) => habitRow(S, i)).join('')}</div>`;
  }

  return `<div class="app">
    <header class="top">
      <div><div class="date">${longDate(T)}</div><h1>${greeting()}${name}</h1></div>
      <a class="icon-btn" href="#/new" aria-label="Neue Gewohnheit anlegen">${svg(UI_ICONS.plus)}</a>
    </header>
    ${chips}
    <div class="wrap">
      ${travelArrivedCard(S)}
      ${ringsCard(todayRing(items), windowQuota(shown, S.idx, S.pauses, T, 7), windowQuota(shown, S.idx, S.pauses, T, 30), pauseToday(items, allPaused))}
      <div class="section-head"><h2>Heute</h2>${items.length ? '<span class="small muted">Tippen zum Abhaken</span>' : ''}</div>
      ${allPaused ? '<section class="hint-card"><div style="font-size: 15px; font-weight: 700">Heute ist Pause</div><p>Nichts muss, nichts zählt gegen dich. Genieß den Tag – wenn du doch etwas machst, darfst du es natürlich abhaken.</p></section>' : ''}
      ${list}
      ${hints}
      <section class="total">
        <div class="ico">${svg(UI_ICONS.trend, 22)}</div>
        <div><div class="big">${fmt(total)} Mal drangeblieben</div><div class="small muted">seit Start · diese Zahl kann nur wachsen</div></div>
      </section>
      ${tilesSection(S, T)}
    </div>
    ${nav('overview')}
    ${S.sheet ? sheet(S, T) : ''}
  </div>`;
}

export function hintCard(h, hint, withDismiss = true) {
  const target = h.schedule_count || 1;
  return `<section class="hint-card">
    <div style="font-size: 15px; font-weight: 700">Ein Gedanke zu ${esc(h.name)}</div>
    <p>Die letzten ${hint.count} ${hint.word} waren ${hint.name}. Passt das Ziel von ${target}× noch, oder willst du es wieder anpeilen?</p>
    <div class="grid2">
      <a class="btn soft" href="#/edit/${esc(h.id)}" style="background: var(--surface); color: var(--text)">Ziel anpassen</a>
      ${withDismiss ? `<button type="button" class="btn ghost" data-action="hint-ok" data-id="${esc(h.id)}" data-count="${hint.count}">Passt so</button>` : ''}
    </div>
  </section>`;
}

// ───────────── Wert eintragen ─────────────

export function sheet(S, T) {
  const h = S.habits.find((x) => x.id === S.sheet.id);
  if (!h) return '';
  const day = S.sheet.day;
  const log = logOf(S.idx, h.id, day);
  const col = colorOf(S, h);
  const paused = isPaused(h, day, S.pauses.filter((p) => p.habit_id === h.id));
  const dayText = day === T ? 'heute' : `am ${parseDay(day).getDate()}. ${monthName(day)}`;
  const target = h.target ? `Ziel ${dayText}: ${fmt(h.target)}${h.unit ? ' ' + esc(h.unit) : ''}` : `Eintrag ${dayText}`;
  return `<button type="button" class="scrim" data-action="close-sheet" aria-label="Schließen"></button>
  <section class="sheet" role="dialog" aria-modal="true" aria-label="${esc(h.name)} eintragen">
    <div class="handle"></div>
    <div style="display: flex; align-items: center; gap: 12px">
      <div class="hicon" style="width: 44px; height: 44px; border-radius: 14px; background: var(--k-${col}); color: var(--c-${col})">${habitIcon(h.icon, 22)}</div>
      <div><h2 style="font-size: 22px">${esc(h.name)}</h2><div class="small muted">${target}</div></div>
    </div>
    <div class="stepper">
      <button type="button" data-action="sheet-dec" aria-label="Eins weniger">${svg(UI_ICONS.minus, 22, 2.5)}</button>
      <input id="sheet-val" type="number" inputmode="decimal" min="0" step="1" value="${esc(S.sheet.value)}" aria-label="Wert${h.unit ? ' in ' + esc(h.unit) : ''}">
      <button type="button" data-action="sheet-inc" aria-label="Eins mehr">${svg(UI_ICONS.plus, 22, 2.5)}</button>
    </div>
    <button type="button" class="btn" data-action="sheet-save">Speichern</button>
    <div class="grid2">
      ${h.mini_value != null ? `<button type="button" class="btn soft" data-action="sheet-mini">Mini-Version (${fmt(h.mini_value)})</button>` : ''}
      ${paused
        ? '<button type="button" class="btn ghost" data-action="sheet-unpause">Pause aufheben</button>'
        : `<button type="button" class="btn ghost" data-action="sheet-pause">${day === T ? 'Heute' : 'Tag als'} Pause</button>`}
      ${log ? '<button type="button" class="btn danger" data-action="sheet-delete">Eintrag löschen</button>' : ''}
    </div>
    <p class="small muted" style="text-align: center">Die Mini-Version zählt als geschafft. Ein Pausentag zählt nicht gegen dich.</p>
  </section>`;
}

// ───────────── Detail ─────────────

export function welcome(S, T, last) {
  const gap = diffDays(last, T) - 1;
  const total = totalHits(S.logs);
  const on = S.welcomePause !== false;
  return `<div class="welcome">
    <svg width="120" height="120" viewBox="0 0 120 120" aria-hidden="true" style="align-self: center; margin-top: 12px">
      <circle cx="60" cy="60" r="52" fill="none" style="stroke: var(--ring-1-track)" stroke-width="10"></circle>
      <circle cx="60" cy="60" r="36" fill="none" style="stroke: var(--ring-2-track)" stroke-width="10"></circle>
      <circle cx="60" cy="60" r="20" fill="none" style="stroke: var(--ring-3-track)" stroke-width="10"></circle>
      <circle cx="60" cy="60" r="6" style="fill: var(--ring-3)"></circle>
    </svg>
    <div>
      <h1>Schön, dass du<br>wieder da bist.</h1>
      <p class="lead">Du hast ${gap} ${gap === 1 ? 'Tag' : 'Tage'} nichts eingetragen.<br>Das ist völlig in Ordnung.</p>
    </div>
    <section class="total" style="flex-direction: column; align-items: flex-start; gap: 2px">
      <div class="small" style="font-weight: 600">Was bleibt</div>
      <div style="font-size: 22px; font-weight: 700">${fmt(total)} Mal drangeblieben</div>
      <div class="small">Das nimmt dir keine Pause weg.</div>
    </section>
    <section class="card pad" style="display: flex; align-items: center; justify-content: space-between; gap: 14px">
      <div><div style="font-size: 15px; font-weight: 700">Als Pause eintragen</div>
        <div class="small muted" style="margin-top: 2px">${on ? `Die ${gap} Tage zählen nicht in deine Quoten.` : `Die ${gap} Tage zählen als offene Tage.`}</div></div>
      <button type="button" class="switch" role="switch" aria-checked="${on}" aria-label="Die Lücke als Pause eintragen" data-action="welcome-toggle"></button>
    </section>
    <div style="flex: 1"></div>
    <button type="button" class="btn" data-action="welcome-go">Weiter zur Übersicht</button>
  </div>`;
}

// ───────────── Login ─────────────
