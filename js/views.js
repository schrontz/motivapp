// Oberfläche: reine Funktionen, die aus dem Zustand HTML erzeugen.
// Alle Texte aus der Datenbank laufen durch esc().

import { svg, habitIcon, HABIT_ICONS, UI_ICONS, COLORS } from './icons.js';
import { longDate, greeting, monthName, monthShort, WEEKDAYS_SHORT, diffDays, parseDay } from './dates.js';
import { todayItems, sortTodayItems, todayRing, windowQuota, totalHits, habitStats, scheduleText, logOf, isPaused, miniPeriodName, patternHint, isoWeek } from './stats.js';
import { tileValues, categoryName, CATEGORY_GROUPS, METRICS, workoutCounts, matchesCategories, dedupeWorkouts, trainingList, trainingSummary, weeklyTrainingCounts, heartZones, stepsSummary } from './auto.js';
import { APP_VERSION } from './config.js';
import { FIELDS, series, change, latest, lastChange } from './body.js';
import { mergeTrainings, exerciseHistory, exerciseKey, splitKey, bestOneRm, volume, setsText, progress, sessionTarget, planPreview, planModeOk, setCellText } from './strength.js';

// Alpha Progression eingeschaltet (und Datenbank-Update 004 da)?
export function alphaOn(S) {
  return !!(S.hasStrengthSchema && S.profile && (S.profile.modules || []).includes('alpha'));
}

// Trainings für alle Ansichten: mit Alpha zusammengeführt, sonst nur Withings
function trainings(S) {
  if (!alphaOn(S)) return S.workouts;
  if (S._mergedFor !== S.workouts || S._mergedStrength !== S.strength) {
    S._merged = mergeTrainings(S.workouts, S.strength || []);
    S._mergedFor = S.workouts;
    S._mergedStrength = S.strength;
  }
  return S._merged;
}

function kgTxt(n) {
  return String(Math.round(Number(n) * 100) / 100).replace('.', ',');
}

function hm(min) {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return h ? `${h} h ${m} min` : `${m} min`;
}

function timeOf(iso) {
  return new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

function tilesSection(S, T) {
  const show = (S.profile && S.profile.tiles) || ['steps', 'training'];
  const withings = (S.withings && S.withings.connected) || S.activity.length;
  const v = tileValues({ activity: S.activity, workouts: trainings(S), today: T });
  const defs = {};
  if (withings) {
    defs.steps = { label: 'Schritte', color: 'teal', value: v.steps.value != null ? fmt(v.steps.value) : '–', sub: v.steps.avg7 != null ? `Ø 7 T. ${fmt(v.steps.avg7)}` : 'heute', href: '#/steps' };
    defs.training = { label: 'Training', color: 'blue', value: `${v.training.count}×`, sub: `7 Tage${v.training.minutes ? ' · ' + hm(v.training.minutes).replace(' min', '′') : ''}`, href: '#/training' };
    defs.active = { label: 'Aktiv', color: 'orange', value: v.active.value != null ? `${v.active.value} min` : '–', sub: 'heute', href: '#/steps' };
    defs.distance = { label: 'Strecke', color: 'pink', value: v.distance.value != null ? `${fmt(v.distance.value)} km` : '–', sub: 'heute', href: '#/steps' };
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

export function esc(v) {
  return String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function fmt(n) {
  if (n == null || n === '') return '';
  return Number(n).toLocaleString('de-DE', { maximumFractionDigits: 2 });
}

export function colorOf(S, h) {
  const cat = S.categories.find((c) => c.id === h.category_id);
  return (cat && cat.color) || h.color || 'blue';
}

function nav(active) {
  const item = (href, key, icon, label) =>
    `<a href="${href}"${active === key ? ' aria-current="page"' : ''}>${svg(icon, 22)}${label}</a>`;
  return `<nav class="nav" aria-label="Hauptnavigation"><div class="nav-inner">
    ${item('#/', 'overview', UI_ICONS.home, 'Übersicht')}
    ${item('#/habits', 'habits', UI_ICONS.list, 'Gewohnheiten')}
    ${item('#/profile', 'profile', UI_ICONS.user, 'Profil')}
  </div></nav>`;
}

function dash(r, f) {
  const c = 2 * Math.PI * r;
  const len = Math.max(0.001, Math.min(1, f || 0)) * c;
  return `${len.toFixed(1)} ${c.toFixed(1)}`;
}

function ringsCard(today, week, month) {
  const fToday = today.due ? today.done / today.due : 0;
  const fWeek = week.expected ? week.hits / week.expected : 0;
  const fMonth = month.expected ? month.hits / month.expected : 0;
  const tText = today.due ? `${today.done} von ${today.due}` : '–';
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

function habitRow(S, item) {
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
    item.paused ? '<span class="pill pause">Pause</span>' : ''
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
  return `<div class="row${item.paused ? ' paused' : ''}">
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
      ${ringsCard(todayRing(items), windowQuota(shown, S.idx, S.pauses, T, 7), windowQuota(shown, S.idx, S.pauses, T, 30))}
      <div class="section-head"><h2>Heute</h2>${items.length ? '<span class="small muted">Tippen zum Abhaken</span>' : ''}</div>
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

function hintCard(h, hint, withDismiss = true) {
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

export function detail(S, T, id) {
  const h = S.habits.find((x) => x.id === id);
  if (!h) return notFound();
  const st = habitStats(h, S.idx, S.pauses, T);
  const col = colorOf(S, h);
  const cat = S.categories.find((c) => c.id === h.category_id);
  const best = st.best
    ? `<div class="num">${st.best.count}</div><div class="small muted">${st.best.keys.slice(0, 2).map((k) => `${monthShort(k)} ${k.slice(0, 4)}`).join(' & ')}</div>`
    : '<div class="num">–</div><div class="small muted">noch keine Daten</div>';
  const quota = st.monthQuota.pct == null ? 'noch nichts fällig' : `${st.monthQuota.pct} % geschafft`;
  const maxBar = Math.max(1, ...st.months.map((m) => m.count));
  const stateWord = { done: 'geschafft', mini: 'Mini geschafft', paused: 'Pause', open: 'offen', free: 'nicht geplant', future: 'Zukunft', before: 'vor dem Start' };
  const cells = st.cells.map((c) => {
    const disabled = c.state === 'future' || c.state === 'before';
    return `<button type="button" data-action="cal" data-id="${esc(h.id)}" data-day="${c.day}" data-state="${c.state}" data-today="${c.today}"${disabled ? ' disabled' : ''} aria-label="${c.n}. ${monthName(T)}: ${stateWord[c.state]}">${c.n}</button>`;
  }).join('');
  const blanks = '<span></span>'.repeat(st.offset);
  return `<div class="app">
    <div class="bar">
      <a class="link-btn" href="#/">${svg(UI_ICONS.back, 20, 2.2)}Übersicht</a>
      <a class="link-btn" href="#/edit/${esc(h.id)}">Bearbeiten</a>
    </div>
    <div class="wrap">
      <div style="display: flex; align-items: center; gap: 14px; padding: 0 4px">
        <div class="hicon" style="width: 52px; height: 52px; border-radius: 16px; background: var(--k-${col}); color: var(--c-${col})">${habitIcon(h.icon, 26)}</div>
        <div><h1 style="font-size: 28px">${esc(h.name)}</h1><div class="small muted">${esc(scheduleText(h))}${cat ? ' · ' + esc(cat.name) : ''}${h.mini_text ? ' · Mini: ' + esc(h.mini_text) : ''}</div></div>
      </div>
      <section class="stat-grid">
        <div class="card stat-hero">
          <div><div class="small" style="font-weight: 600">Insgesamt</div><div class="num">${fmt(st.total)} Mal</div><div class="small">geschafft · kann nur wachsen</div></div>
          <span style="color: var(--c-teal)">${svg(UI_ICONS.trend, 40)}</span>
        </div>
        <div class="card stat"><div class="small muted">Letzte 30 Tage</div><div class="num">${st.last30}</div><div class="small muted">Mal geschafft</div></div>
        <div class="card stat"><div class="small muted">Bester Monat</div>${best}</div>
      </section>
      ${st.hint ? hintCard(h, st.hint, false) : ''}
      ${st.periods ? periodsCard(h, st.periods, col) : ''}
      <section class="card pad">
        <div class="section-head" style="margin: 0 0 12px"><h2 style="font-size: 17px">${monthName(T)}</h2><span class="small muted">${quota}</span></div>
        <div class="cal">${WEEKDAYS_SHORT.map((w) => `<div class="wd">${w}</div>`).join('')}${blanks}${cells}</div>
        <div class="cal-legend">
          <span><i class="sw" style="background: var(--c-blue)"></i>geschafft</span>
          <span><i class="sw" style="background: var(--k-teal)"></i>Mini</span>
          <span><i class="sw" style="background: repeating-linear-gradient(135deg, var(--bg), var(--bg) 3px, var(--border) 3px, var(--border) 6px)"></i>Pause</span>
        </div>
        <p class="hint" style="margin-top: 10px">Vergessen einzutragen? Tipp auf einen vergangenen Tag.</p>
      </section>
      <section class="card pad">
        <div class="section-head" style="margin: 0 0 14px"><h2 style="font-size: 17px">Pro Monat</h2><span class="small muted">letzte 6 Monate</span></div>
        <div class="bars" role="img" aria-label="${esc(st.months.map((m) => `${monthShort(m.key)} ${m.count}`).join(', '))}">
          ${st.months.map((m) => `<div><div class="small" style="font-weight: 600">${m.count}</div><div class="b${m.running ? ' running' : ''}" style="height: ${Math.round(m.count / maxBar * 100)}px"></div><div class="small muted">${monthShort(m.key)}</div></div>`).join('')}
        </div>
      </section>
      ${trainingsSection(S, h, T)}
    </div>
    ${nav('habits')}
    ${S.sheet ? sheet(S, T) : ''}
  </div>`;
}

function trainingsSection(S, h, T) {
  if (!(h.auto_categories && h.auto_categories.length)) return '';
  const from = new Date(parseDay(T).getTime() - 30 * 86400000);
  const fromDay = `${from.getFullYear()}-${String(from.getMonth() + 1).padStart(2, '0')}-${String(from.getDate()).padStart(2, '0')}`;
  const list = dedupeWorkouts(S.workouts).filter((w) => w.day >= fromDay && w.day <= T).sort((a, b) => (a.start_at < b.start_at ? 1 : -1));
  const body = list.length === 0
    ? '<p class="hint" style="padding: 14px">Noch keine Trainings von Withings in den letzten 30 Tagen.</p>'
    : list.map((w) => {
      const dt = parseDay(w.day);
      const counts = workoutCounts(h, w);
      const why = !counts && matchesCategories(w.category, h.auto_categories) ? ' · zu kurz' : '';
      return `<details class="wo">
        <summary>
          <div class="wo-date"><div class="small muted" style="font-weight: 600">${WEEKDAYS_SHORT[(dt.getDay() + 6) % 7]}</div><div style="font-size: 18px; font-weight: 700">${dt.getDate()}.</div></div>
          <div style="flex: 1; min-width: 0">
            <div class="row-title"><span>${esc(categoryName(w.category))}</span>${counts ? '<span class="pill goal">zählt</span>' : ''}</div>
            <div class="row-sub">${timeOf(w.start_at)} · ${Math.round(w.duration_min)} Min${w.hr_avg ? ` · Ø ${w.hr_avg} bpm` : ''}${why}</div>
          </div>
        </summary>
        <div class="wo-body">
          <div class="wo-stat"><div class="small muted">Ø Puls</div><b>${w.hr_avg ?? '–'}</b></div>
          <div class="wo-stat"><div class="small muted">max.</div><b>${w.hr_max ?? '–'}</b></div>
          <div class="wo-stat"><div class="small muted">kcal</div><b>${w.calories != null ? Math.round(w.calories) : '–'}</b></div>
        </div>
      </details>`;
    }).join('');
  return `<section style="display: flex; flex-direction: column; gap: 10px">
    <div class="section-head"><h2 style="font-size: 17px">Trainings</h2><span class="small muted">von Withings · 30 Tage</span></div>
    <div class="card list">${body}</div>
  </section>`;
}

// ───────────── Trainingsbereich ─────────────

function dayShift(T, n) {
  const dt = parseDay(T);
  dt.setDate(dt.getDate() + n);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

function backBar(href, label) {
  return `<div class="bar"><a class="link-btn" href="${href}">${svg(UI_ICONS.back, 20, 2.2)}${label}</a><span></span></div>`;
}

function zonesBar(zones) {
  if (!zones) return '';
  const total = zones.reduce((s, z) => s + z.minutes, 0) || 1;
  const cols = ['var(--z0)', 'var(--z1)', 'var(--z2)', 'var(--z3)'];
  return `<div class="zones-bar" aria-hidden="true">${zones.map((z, i) => `<span style="width: ${(z.minutes / total) * 100}%; background: ${cols[i]}"></span>`).join('')}</div>`;
}

function sportHabit(S) {
  return S.habits.find((h) => !h.archived && h.auto_categories && h.auto_categories.length && h.schedule === 'per_week')
    || S.habits.find((h) => !h.archived && h.auto_categories && h.auto_categories.length);
}

export function trainingView(S, T) {
  const range = Number(S.trainRange || 30);
  const all = trainings(S);
  const list = trainingList(all, dayShift(T, -(range - 1)), T);
  const sum = trainingSummary(list);
  const sport = sportHabit(S);
  const goal = sport && sport.schedule === 'per_week' ? (sport.schedule_count || null) : null;
  const mini = goal && sport.schedule_min && sport.schedule_min < goal ? sport.schedule_min : null;
  const weeks = weeklyTrainingCounts(all, T, 8);
  const top = Math.max(goal || 0, ...weeks.map((w) => w.count), 1);
  const H = 110;
  const line = (v, cls) => (v ? `<div class="goal-line ${cls}" style="bottom: ${Math.round((v / top) * H) + 20}px"></div>` : '');
  const bars = weeks.map((w, i) => {
    let bg = 'var(--field)';
    if (w.running) bg = 'var(--k-blue)';
    else if (goal && w.count >= goal) bg = 'var(--c-blue)';
    else if (w.count >= (mini || goal || 1)) bg = 'var(--c-teal)';
    const label = `${isoWeekOf(w.from)}`;
    return `<div class="wbar"><div class="small" style="font-weight: 600">${w.count}</div><div class="b" style="height: ${Math.max(3, Math.round((w.count / top) * H))}px; background: ${bg}"></div><div class="small muted">${label}</div></div>`;
  }).join('');
  // Puls-Trend: letzte 12 Einheiten mit Puls, chronologisch
  const hrList = trainingList(S.workouts, dayShift(T, -365), T).filter((w) => w.hr_avg).slice(0, 12).reverse();
  let trend = '';
  if (hrList.length >= 2) {
    const vals = hrList.map((w) => w.hr_avg);
    const vmin = Math.min(...vals);
    const vmax = Math.max(...vals);
    const lo = vmin - 2;
    const hi = Math.max(vmax + 2, lo + 6);
    const W = 300;
    const Hc = 120;
    const pad = 8;
    const xy = vals.map((v, i) => [pad + (i / (vals.length - 1)) * (W - 2 * pad), pad + (1 - (v - lo) / (hi - lo)) * (Hc - 2 * pad)]);
    const yOf = (v) => pad + (1 - (v - lo) / (hi - lo)) * (Hc - 2 * pad);
    const dateOf = (w) => { const d = parseDay(w.day); return `${d.getDate()}. ${monthShort(w.day.slice(0, 7))}`; };
    trend = `<section class="card pad">
      <div class="section-head" style="margin: 0 0 8px"><h2 style="font-size: 17px">Ø Puls im Training</h2><span class="small muted">bpm · letzte ${vals.length} Einheiten</span></div>
      <div class="hr-chart">
        <div class="hr-y small muted" aria-hidden="true"><span style="top: ${((yOf(vmax) / Hc) * 100).toFixed(1)}%">${vmax}</span><span style="top: ${((yOf(vmin) / Hc) * 100).toFixed(1)}%">${vmin}</span></div>
        <svg viewBox="0 0 ${W} ${Hc}" role="img" aria-label="Durchschnittspuls der letzten ${vals.length} Einheiten, zwischen ${vmin} und ${vmax} Schlägen pro Minute; zuletzt ${vals[vals.length - 1]}">
          <line x1="0" x2="${W}" y1="${yOf(vmax).toFixed(1)}" y2="${yOf(vmax).toFixed(1)}" style="stroke: var(--border)" stroke-dasharray="3 4"></line>
          <line x1="0" x2="${W}" y1="${yOf(vmin).toFixed(1)}" y2="${yOf(vmin).toFixed(1)}" style="stroke: var(--border)" stroke-dasharray="3 4"></line>
          <polyline fill="none" style="stroke: var(--c-orange)" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" points="${xy.map((p) => p.map((n) => n.toFixed(1)).join(',')).join(' ')}"></polyline>
          ${xy.map((p) => `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="3.5" style="fill: var(--surface); stroke: var(--c-orange)" stroke-width="2"></circle>`).join('')}
        </svg>
      </div>
      <div class="small muted" style="display: flex; justify-content: space-between; padding-left: 36px; margin-top: 4px"><span>${dateOf(hrList[0])}</span><span>${dateOf(hrList[hrList.length - 1])}</span></div>
      <p class="hint" style="margin-top: 8px">Ein ruhigerer Puls bei gleichem Training kann ein Zeichen besserer Fitness sein – ein Trend, kein Urteil.</p>
    </section>`;
  }
  const rows = list.length === 0
    ? '<p class="hint" style="padding: 14px">In diesem Zeitraum keine Trainings.</p>'
    : list.map((w) => {
      const dt = parseDay(w.day);
      return `<a class="row" href="#/training/${encodeURIComponent(w.id)}" style="text-decoration: none; color: inherit">
        <div class="wo-date"><div class="small muted" style="font-weight: 600">${WEEKDAYS_SHORT[(dt.getDay() + 6) % 7]}</div><div style="font-size: 18px; font-weight: 700">${dt.getDate()}.</div></div>
        <div class="row-main"><div class="row-title"><span>${esc(w.strength ? w.strength.title : categoryName(w.category))}</span></div>
          <div class="row-sub">${timeOf(w.start_at)} · ${Math.round(w.duration_min)} Min${w.hr_avg ? ` · Ø ${w.hr_avg} bpm` : ''}${w.calories != null ? ` · ${Math.round(w.calories)} kcal` : ''}${w.strength ? ` · ${w.strength.exercises.length} Übungen` : ''}${w.alphaOnly ? ' · nur Alpha' : ''}</div>
          ${zonesBar(heartZones(w))}
        </div>
        <span class="muted" style="transform: rotate(180deg); display: flex">${svg(UI_ICONS.back, 18)}</span>
      </a>`;
    }).join('');
  const seg = [7, 30, 90].map((r) => `<label><input type="radio" name="trange" value="${r}"${range === r ? ' checked' : ''} data-action="train-range"><span>${r} Tage</span></label>`).join('');
  return `<div class="app">
    ${backBar('#/', 'Übersicht')}
    <div class="wrap" style="gap: 14px">
      <div style="display: flex; justify-content: space-between; align-items: center; padding: 0 4px"><h1 style="font-size: 28px">Training</h1>${alphaOn(S) ? '<a class="link-btn" href="#/import">Alpha importieren</a>' : ''}</div>
      <div class="seg" role="radiogroup" aria-label="Zeitraum">${seg}</div>
      <section class="stat3">
        <div class="card"><div class="small muted">Trainings</div><b>${sum.count}</b></div>
        <div class="card"><div class="small muted">Zeit</div><b>${sum.minutes ? (sum.minutes >= 60 ? `${Math.floor(sum.minutes / 60)}:${String(sum.minutes % 60).padStart(2, '0')} h` : `${sum.minutes} min`) : '–'}</b></div>
        <div class="card"><div class="small muted">Ø Puls</div><b>${sum.hr ?? '–'}</b></div>
      </section>
      <section class="card pad">
        <div class="section-head" style="margin: 0 0 12px"><h2 style="font-size: 17px">Trainings pro Woche</h2><span class="small muted">${goal ? `Ziel ${goal}${mini ? ` · Mini ${mini}` : ''}` : 'Tage mit Training'}</span></div>
        <div class="wbars" style="height: ${H + 40}px">${line(goal, 'goal')}${line(mini, 'mini')}${bars}</div>
        <div class="small muted" style="text-align: center; margin-top: 4px">Kalenderwoche</div>
        ${goal ? `<div class="cal-legend"><span><i class="dash goal"></i>Ziel</span>${mini ? '<span><i class="dash mini"></i>Mini-Woche</span>' : ''}</div>` : ''}
      </section>
      ${trend}
      <div class="section-head"><h2>Einheiten</h2><span class="small muted">Gehen ausgeblendet</span></div>
      <div class="card list">${rows}</div>
    </div>
    ${nav('overview')}
  </div>`;
}

function isoWeekOf(day) {
  return isoWeek(day);
}

export function sessionView(S, T, id) {
  const w = trainings(S).find((x) => String(x.id) === String(id));
  if (!w) return notFound();
  const st = w.strength || null;
  const zones = heartZones(w);
  const counts = w.alphaOnly ? [] : S.habits.filter((h) => !h.archived && h.auto_categories && h.auto_categories.length && workoutCounts(h, w));
  const autoDone = counts.filter((h) => { const l = logOf(S.idx, h.id, w.day); return l && l.source === 'withings'; });
  const chips = [
    ...autoDone.map((h) => `<span class="pill auto">${esc(h.name)} automatisch abgehakt</span>`),
    ...counts.filter((h) => !autoDone.includes(h)).map((h) => `<span class="pill goal">zählt für ${esc(h.name)}</span>`),
    `<span class="pill pause">${st ? (w.alphaOnly ? 'Alpha Progression' : 'Alpha Progression + Withings') : 'Withings'}</span>`
  ].join('');
  const maxZ = zones ? Math.max(...zones.map((z) => z.minutes), 1) : 1;
  const zcols = ['var(--z0)', 'var(--z1)', 'var(--z2)', 'var(--z3)'];
  const vol = st ? volume(st) : 0;
  const volTxt = vol >= 1000 ? `${kgTxt(Math.round(vol / 100) / 10)} t` : `${vol} kg`;
  const stat = (label, value) => `<div class="card stat"><div class="small muted">${label}</div><div class="num">${value}</div></div>`;
  let stats;
  if (st && w.alphaOnly) {
    const nSets = st.exercises.reduce((s, e) => s + e.sets.length, 0);
    stats = stat('Dauer', `${Math.round(w.duration_min)} Min`) + stat('Volumen', vol ? volTxt : '–') + stat('Übungen', st.exercises.length) + stat('Sätze', nSets);
  } else if (st) {
    stats = stat('Dauer', `${Math.round(w.duration_min)} Min`) + stat('Ø Puls', w.hr_avg ?? '–') + stat('Kalorien', w.calories != null ? Math.round(w.calories) + ' kcal' : '–') + stat('Volumen', vol ? volTxt : '–');
  } else {
    stats = stat('Dauer', `${Math.round(w.duration_min)} Min`) + stat('Kalorien', w.calories != null ? Math.round(w.calories) + ' kcal' : '–') + stat('Ø Puls', w.hr_avg ?? '–') + stat('Max. Puls', w.hr_max ?? '–');
  }
  let exercises = '';
  if (st) {
    const cards = st.exercises.map((e) => {
      const key = exerciseKey(e);
      const hist = exerciseHistory(S.strength, key);
      const idx = hist.findIndex((h) => h.session.id === st.id);
      const entry = hist[idx];
      const plan = (S.plans || []).find((p) => exerciseKey({ name: p.exercise, equipment: p.equipment }) === key);
      const tgt = entry ? sessionTarget(plan, hist, entry, T) : null;
      const pill = tgt
        ? (tgt.ok ? `<span class="pill">Ziel ${tgt.reps}${tgt.mode === 'sec' ? ' s' : ''} · erreicht</span>` : `<span class="pill pause">Ziel ${tgt.reps}${tgt.mode === 'sec' ? ' s' : ''} · diesmal nicht</span>`)
        : '';
      const rm = bestOneRm(e);
      let rmLine = '';
      if (rm != null) {
        const prev = idx > 0 ? bestOneRm(hist[idx - 1].ex) : null;
        const prevKg = idx > 0 ? Math.max(...hist[idx - 1].ex.sets.map((x) => x.kg ?? 0)) : null;
        const kgNow = Math.max(...e.sets.map((x) => x.kg ?? 0));
        let delta = '';
        if (prevKg != null && kgNow > prevKg) delta = ' · neues Gewicht';
        else if (prev != null && rm !== prev) delta = ` · ${rm > prev ? '+' : '−'}${kgTxt(Math.abs(Math.round((rm - prev) * 10) / 10))} zum letzten Mal`;
        rmLine = `<div class="small muted" style="margin-top: 8px">geschätzte Kraft (1RM): ${kgTxt(rm)} kg${delta}</div>`;
      }
      const setCells = e.sets.map((x, i) => `<div class="set-cell"><div class="small muted">Satz ${i + 1}</div><b>${esc(setCellText(e, x))}</b></div>`).join('');
      return `<a class="card ex-card" href="#/exercise/${encodeURIComponent(key)}">
        <div class="ex-head"><div><div class="ex-name">${esc(e.name)}</div><div class="small muted">${esc(e.equipment || '')}</div></div>${pill}</div>
        <div class="set-grid">${setCells}</div>
        ${rmLine}
      </a>`;
    }).join('');
    exercises = `<section style="display: flex; flex-direction: column; gap: 10px">
        <div class="section-head"><h2 style="font-size: 17px">Übungen</h2><span class="small muted">antippen für Verlauf</span></div>
        ${cards || '<p class="hint" style="padding: 0 4px">Keine Übungen in dieser Einheit.</p>'}
      </section>`;
  } else if (alphaOn(S) && [16, 17].includes(w.category)) {
    exercises = `<section style="display: flex; flex-direction: column; gap: 10px">
        <div class="section-head"><h2 style="font-size: 17px">Übungen</h2></div>
        <div class="card pad" style="display: flex; flex-direction: column; gap: 10px"><p class="hint">Keine passende Einheit aus Alpha Progression gefunden (Startzeit ±20 Minuten).</p><a class="btn ghost" href="#/import">Alpha-Trainings importieren</a></div>
      </section>`;
  }
  const title = st ? st.title : categoryName(w.category);
  return `<div class="app">
    ${backBar('#/training', 'Training')}
    <div class="wrap" style="gap: 14px">
      <div style="padding: 0 4px">
        <h1 style="font-size: 28px">${esc(title)}</h1>
        <div class="small muted" style="font-size: 14px; margin-top: 2px">${longDate(w.day)} · ${timeOf(w.start_at)}–${timeOf(w.end_at)}${st && st.program ? ` · ${esc(st.program)}` : ''}</div>
        <div style="display: flex; gap: 6px; flex-wrap: wrap; margin-top: 10px">${chips}</div>
      </div>
      <section class="stat-grid">${stats}</section>
      ${zones ? `<section class="card pad" style="display: flex; flex-direction: column; gap: 10px">
        <h2 style="font-size: 17px">Pulszonen</h2>
        ${zones.map((z, i) => `<div class="zone-row"><span>${z.label}</span><div class="zone-track"><div style="width: ${(z.minutes / maxZ) * 100}%; background: ${zcols[i]}"></div></div><b>${z.minutes} Min</b></div>`).join('')}
      </section>` : ''}
      ${exercises}
    </div>
    ${nav('overview')}
  </div>`;
}

// ───────────── Übung, Steigerung, Import ─────────────

function planOf(S, key) {
  return (S.plans || []).find((p) => exerciseKey({ name: p.exercise, equipment: p.equipment }) === key) || null;
}

function ladderChips(items) {
  return `<div class="ladder">${items.map((l) => `<span data-state="${l.state}">${esc(l.txt)}</span>`).join('')}</div>`;
}

function shortDate(day) {
  const d = parseDay(day);
  return `${d.getDate()}. ${monthShort(day.slice(0, 7))}`;
}

export function exerciseView(S, T, key) {
  const hist = exerciseHistory(S.strength || [], key);
  if (!hist.length) return notFound();
  const { name, equipment } = splitKey(key);
  const last = hist[hist.length - 1];
  const kind = last.ex.kind;
  const plan = planOf(S, key);
  const first = hist[0].day;
  let planCard = '';
  if (plan) {
    const r = progress(plan, hist, T);
    const c = r.current;
    const u = r.mode === 'sec' ? ' s' : '';
    const max = Number(plan.max_reps);
    let sub;
    if (c.atMax && c.done) sub = `Diese Woche geschafft – und dein Maximum von ${max}${u} ist erreicht. Halten oder den Plan erweitern.`;
    else if (c.done) sub = `Diese Woche geschafft. Nächste Woche: ${r.next.reps}${u}${r.mode === 'kg' && r.next.kg !== c.kg ? ` bei ${kgTxt(r.next.kg)} kg` : ''}${r.next.consolidating ? ' (festigen)' : ''}.`;
    else if (c.atMax) sub = `Maximum erreicht – jetzt geht es ums Halten.`;
    else if (c.consolidating) sub = 'Festigungswoche: gleiche Zahl wie letzte Woche.';
    else if (r.mode === 'kg' && c.reps === Number(plan.start_reps) && c.kg > Number(plan.kg)) sub = 'Neues Gewicht – darum wieder ab Start.';
    else sub = r.weeks.size > 1 ? 'Neue Stufe.' : 'Erste Woche mit diesem Plan.';
    const big = r.mode === 'kg' ? `${c.sets} × ${c.reps} bei ${kgTxt(c.kg)} kg` : `${c.sets} × ${c.reps}${u}`;
    const foot = r.mode === 'kg'
      ? `Noch etwa ${r.weeksToNextKg} ${r.weeksToNextKg === 1 ? 'Woche' : 'Wochen'} bis ${kgTxt(r.ladder[r.ladder.length - 1].kg)} kg.`
      : (r.weeksToNextKg > 0 ? `Noch etwa ${r.weeksToNextKg} ${r.weeksToNextKg === 1 ? 'Woche' : 'Wochen'} bis ${max}${u}.` : '');
    planCard = `<section class="plan-card">
      <div class="small" style="font-weight: 600">Ziel diese Woche</div>
      <div class="plan-big">${big}</div>
      <div class="small">${sub}</div>
      ${ladderChips(r.ladder)}
      ${foot ? `<div class="small">${foot}</div>` : ''}
    </section>`;
  } else if (planModeOk(kind)) {
    const example = kind === 'time' ? 'jede Woche 5 Sekunden länger halten.' : (kind === 'reps' ? 'alle 2 Wochen 2 Wiederholungen mehr.' : 'alle 2 Wochen 2 Wiederholungen mehr – und bei 40 mehr Gewicht.');
    planCard = `<section class="card pad" style="display: flex; flex-direction: column; gap: 10px">
      <b>Noch kein Steigerungsplan</b>
      <p class="hint">Zum Beispiel: ${example}</p>
      <a class="btn ghost" href="#/plan/${encodeURIComponent(key)}">Steigerung einrichten</a>
    </section>`;
  }
  // 1RM-Verlauf
  let chart = '';
  const pts = hist.map((h) => ({ day: h.day, rm: bestOneRm(h.ex), kg: Math.max(...h.ex.sets.map((x) => x.kg ?? 0)) })).filter((p) => p.rm != null).slice(-20);
  if (pts.length >= 2) {
    const vals = pts.map((p) => p.rm);
    const vmin = Math.min(...vals);
    const vmax = Math.max(...vals);
    const lo = vmin - 0.3;
    const hi = Math.max(vmax + 0.3, lo + 1);
    const W = 300; const Hc = 130; const pad = 10;
    const x = (i) => pad + (i / (pts.length - 1)) * (W - 2 * pad);
    const y = (v) => pad + (1 - (v - lo) / (hi - lo)) * (Hc - 2 * pad);
    const jumps = pts.map((p, i) => (i > 0 && p.kg > pts[i - 1].kg ? (x(i) + x(i - 1)) / 2 : null)).filter((v) => v != null);
    chart = `<section class="card pad">
      <div class="section-head" style="margin: 0 0 8px"><h2 style="font-size: 17px">Geschätzte Kraft (1RM)</h2><span class="small muted">kg · letzte ${pts.length}</span></div>
      <div class="hr-chart" style="grid-template-columns: 34px minmax(0, 1fr)">
        <div class="hr-y small muted" style="height: ${Hc}px" aria-hidden="true"><span style="top: ${((y(vmax) / Hc) * 100).toFixed(1)}%">${kgTxt(vmax)}</span><span style="top: ${((y(vmin) / Hc) * 100).toFixed(1)}%">${kgTxt(vmin)}</span></div>
        <svg viewBox="0 0 ${W} ${Hc}" style="height: ${Hc}px" role="img" aria-label="Geschätztes Maximalgewicht zwischen ${kgTxt(vmin)} und ${kgTxt(vmax)} Kilogramm; zuletzt ${kgTxt(vals[vals.length - 1])}">
          <line x1="0" x2="${W}" y1="${y(vmax).toFixed(1)}" y2="${y(vmax).toFixed(1)}" style="stroke: var(--border)" stroke-dasharray="3 4"></line>
          <line x1="0" x2="${W}" y1="${y(vmin).toFixed(1)}" y2="${y(vmin).toFixed(1)}" style="stroke: var(--border)" stroke-dasharray="3 4"></line>
          ${jumps.map((jx) => `<line x1="${jx.toFixed(1)}" x2="${jx.toFixed(1)}" y1="4" y2="${Hc - 4}" style="stroke: var(--c-blue)" stroke-dasharray="4 4" opacity="0.6"></line>`).join('')}
          <polyline fill="none" style="stroke: var(--c-blue)" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" points="${pts.map((p, i) => `${x(i).toFixed(1)},${y(p.rm).toFixed(1)}`).join(' ')}"></polyline>
          ${pts.map((p, i) => `<circle cx="${x(i).toFixed(1)}" cy="${y(p.rm).toFixed(1)}" r="3" style="fill: var(--surface); stroke: var(--c-blue)" stroke-width="2"></circle>`).join('')}
        </svg>
      </div>
      <div class="small muted" style="display: flex; justify-content: space-between; padding-left: 40px; margin-top: 4px"><span>${shortDate(pts[0].day)}</span><span>${shortDate(pts[pts.length - 1].day)}</span></div>
      ${jumps.length ? '<p class="hint" style="margin-top: 8px">Gestrichelt: mehr Gewicht. Weniger Wiederholungen, aber mehr Kraft – kein Rückschritt.</p>' : ''}
    </section>`;
  }
  const rows = hist.slice().reverse().slice(0, 15).map((h) => {
    const d = parseDay(h.day);
    return `<div class="row" style="justify-content: space-between"><span>${WEEKDAYS_SHORT[(d.getDay() + 6) % 7]} ${shortDate(h.day)}${h.day.slice(0, 4) !== T.slice(0, 4) ? ' ' + h.day.slice(0, 4) : ''}</span><b style="font-weight: 600">${esc(setsText(h.ex))}</b></div>`;
  }).join('');
  return `<div class="app">
    <div class="bar"><button type="button" class="link-btn" data-action="go-back">${svg(UI_ICONS.back, 20, 2.2)}Zurück</button>${plan ? `<a class="link-btn" href="#/plan/${encodeURIComponent(key)}">Steigerung</a>` : '<span></span>'}</div>
    <div class="wrap" style="gap: 14px">
      <div style="padding: 0 4px">
        <h1 style="font-size: 28px">${esc(name)}</h1>
        <div class="small muted" style="font-size: 14px">${esc(equipment)}${equipment ? ' · ' : ''}${hist.length} ${hist.length === 1 ? 'Einheit' : 'Einheiten'} seit ${monthShort(first.slice(0, 7))} ${first.slice(0, 4)}</div>
      </div>
      ${planCard}
      ${chart}
      <div class="section-head"><h2 style="font-size: 17px">Verlauf</h2>${hist.length > 15 ? '<span class="small muted">letzte 15</span>' : ''}</div>
      <div class="card list">${rows}</div>
    </div>
    ${nav('overview')}
  </div>`;
}

const PLAN_FIELDS = [
  { key: 'sets', label: 'Sätze', hint: 'pro Einheit', unit: '', step: 1, min: 1, max: 10 },
  { key: 'start_reps', label: 'Start', hint: 'Wiederholungen pro Satz', unit: ' Wdh.', step: 1, min: 1, max: 100 },
  { key: 'kg', label: 'Gewicht', hint: 'aktuell', unit: ' kg', step: 0.5, min: 0, max: 300 },
  { key: 'plus_reps', label: 'Steigern um', hint: 'Wiederholungen', unit: ' Wdh.', step: 1, min: 1, max: 10, sign: '+' },
  { key: 'every_weeks', label: 'alle', hint: 'Wochen pro Stufe', unit: ' Wo.', step: 1, min: 1, max: 6 },
  { key: 'max_reps', label: 'Bis', hint: 'dann mehr Gewicht', unit: ' Wdh.', step: 1, min: 1, max: 200 },
  { key: 'kg_step', label: 'Mehr Gewicht', hint: 'und zurück auf Start', unit: ' kg', step: 0.5, min: 0.5, max: 50, sign: '+' }
];

// Felder je nach Art: mit Gewicht, nur Wiederholungen, oder Zeit (Sekunden)
export function planFields(mode = 'kg') {
  if (mode === 'kg') return PLAN_FIELDS;
  const noKg = PLAN_FIELDS.filter((f) => f.key !== 'kg' && f.key !== 'kg_step').map((f) => ({ ...f }));
  const get = (k) => noKg.find((f) => f.key === k);
  get('max_reps').hint = 'dann halten';
  if (mode === 'sec') {
    Object.assign(get('start_reps'), { hint: 'Sekunden pro Satz', unit: ' s', step: 5, min: 5, max: 200 });
    Object.assign(get('plus_reps'), { hint: 'Sekunden', unit: ' s', step: 5, min: 5, max: 50 });
    Object.assign(get('max_reps'), { unit: ' s', step: 5, min: 5, max: 300 });
  }
  return noKg;
}

export function planForm(S, T, key) {
  const d = S.planDraft;
  if (!d || d.key !== key) return loading();
  const p = d.plan;
  const mode = d.mode || 'kg';
  const u = mode === 'sec' ? ' s' : '';
  const rows = planFields(mode).map((f) => `<div class="step-row">
      <div style="min-width: 0"><div style="font-size: 15px; font-weight: 600">${f.label}</div><div class="small muted">${f.hint}</div></div>
      <div class="mini-stepper">
        <button type="button" data-action="plan-step" data-id="${f.key}" data-delta="-1" aria-label="${f.label} weniger">−</button>
        <span aria-live="polite">${f.sign || ''}${kgTxt(p[f.key])}${f.unit}</span>
        <button type="button" data-action="plan-step" data-id="${f.key}" data-delta="1" aria-label="${f.label} mehr">+</button>
      </div>
    </div>`).join('');
  const pv = planPreview(p, mode);
  const every = Number(p.every_weeks) === 1 ? 'jede Woche' : `alle ${p.every_weeks} Wochen`;
  const items = mode === 'kg'
    ? [...pv.items.slice(0, -1), { txt: `${kgTxt(pv.nextKg)} kg × ${p.start_reps}`, state: 'final' }]
    : pv.items.map((it, i) => (i === pv.items.length - 1 ? { ...it, state: 'final' } : it));
  const sentence = mode === 'kg'
    ? `${p.sets} × ${p.start_reps} bei ${kgTxt(p.kg)} kg, ${every} +${p.plus_reps}. Bei ${p.max_reps} geht es mit ${kgTxt(pv.nextKg)} kg wieder ab ${p.start_reps} los.`
    : `${p.sets} × ${p.start_reps}${u}, ${every} +${p.plus_reps}${u}. Bei ${p.max_reps}${u} bleibt es stehen – dann heißt es halten.`;
  const weeksTxt = mode === 'kg'
    ? `Etwa ${pv.weeks} Wochen bis ${kgTxt(pv.nextKg)} kg – wenn alles klappt. Wenn nicht, dauert es eben länger.`
    : `Etwa ${pv.weeks} ${pv.weeks === 1 ? 'Woche' : 'Wochen'} bis ${p.max_reps}${u} – wenn alles klappt. Wenn nicht, dauert es eben länger.`;
  const doneTxt = mode === 'kg'
    ? `alle ${p.sets} Sätze mit mindestens ${kgTxt(p.kg)} kg erreichen das Ziel. Mehr Wiederholungen zählen mit.`
    : (mode === 'sec' ? `alle ${p.sets} Sätze halten mindestens die Ziel-Sekunden. Länger zählt mit.` : `alle ${p.sets} Sätze erreichen die Ziel-Wiederholungen. Mehr zählen mit.`);
  return `<div class="app">
    <div class="bar"><button type="button" class="link-btn" data-action="plan-cancel" data-id="${esc(key)}">${svg(UI_ICONS.back, 20, 2.2)}${esc(p.exercise)}</button><span></span></div>
    <div class="wrap" style="gap: 12px">
      <div style="padding: 0 4px"><h1 style="font-size: 28px">Steigerung einrichten</h1><div class="small muted" style="font-size: 14px">${esc(p.exercise)}${p.equipment ? ' · ' + esc(p.equipment) : ''}</div></div>
      <section class="card" style="padding: 4px 16px">${rows}</section>
      <section class="plan-card">
        <div class="small" style="font-weight: 600">So sieht das aus</div>
        <div style="font-size: 16px; font-weight: 600; line-height: 1.35">${sentence}</div>
        ${ladderChips(items)}
        <div class="small">${weeksTxt}</div>
      </section>
      <section class="card pad" style="display: flex; flex-direction: column; gap: 8px; font-size: 14px; line-height: 1.45">
        <div><b>Geschafft</b> heißt: ${doneTxt}</div>
        <div class="muted"><b style="color: var(--text)">Nicht geschafft?</b> Dann bleibt die Stufe einfach eine Woche länger. Kein Rückschritt, kein Minus.</div>
        <div class="muted"><b style="color: var(--text)">Woche ohne diese Übung</b> (Pause, krank) zählt gar nicht.</div>
      </section>
      <p class="small" style="color: var(--danger); min-height: 18px" id="form-error" role="alert"></p>
      <button type="button" class="btn" data-action="plan-save">Speichern</button>
      ${d.existing ? '<button type="button" class="btn danger" data-action="plan-delete">Plan löschen – nur Verlauf zeigen</button>' : `<button type="button" class="btn ghost" data-action="plan-cancel" data-id="${esc(key)}">Ohne Plan – nur Verlauf zeigen</button>`}
    </div>
    ${nav('overview')}
  </div>`;
}

export function importView(S) {
  const imp = S.imp || {};
  let body;
  if (imp.busy) {
    body = `<section class="card pad"><p>${esc(imp.busy)}</p></section>`;
  } else if (imp.done != null) {
    body = `<section class="total" style="flex-direction: column; align-items: flex-start; gap: 6px">
        <div style="font-size: 18px; font-weight: 700">${imp.done} ${imp.done === 1 ? 'Einheit' : 'Einheiten'} importiert</div>
        <div class="small">Beim nächsten Mal einfach wieder die ganze CSV schicken – bekannte Einheiten werden übersprungen.</div>
      </section>
      ${imp.latest ? `<a class="btn" href="#/training/${encodeURIComponent(imp.latest)}">Letzte Einheit ansehen</a>` : '<a class="btn" href="#/training">Zum Training</a>'}`;
  } else if (imp.preview) {
    const p = imp.preview;
    const range = p.from ? `${monthShort(p.from.slice(0, 7))} ${p.from.slice(0, 4)} bis ${shortDate(p.to)}${p.to.slice(0, 4) !== String(new Date().getFullYear()) ? ' ' + p.to.slice(0, 4) : ''}` : '';
    body = `<section class="card pad" style="display: flex; flex-direction: column; gap: 12px">
        <div class="small muted">${esc(imp.name || 'CSV-Datei')}</div>
        <div class="grid2" style="gap: 8px">
          <div class="imp-box" style="background: var(--soft)"><div class="small">Neu</div><b>${p.fresh.length}</b><div class="small">Einheiten</div></div>
          <div class="imp-box" style="background: var(--bg)"><div class="small muted">Schon da</div><b>${p.known}</b><div class="small muted">werden übersprungen</div></div>
        </div>
        <div style="font-size: 14px; line-height: 1.5">${range} · ${p.exercises} ${p.exercises === 1 ? 'Übung' : 'Übungen'}${p.fresh.length ? ` · <b>${p.matched}</b> davon passen zu Trainings von Withings` : ''}</div>
        ${p.fresh.length
          ? `<button type="button" class="btn" data-action="import-go">${p.fresh.length} ${p.fresh.length === 1 ? 'Einheit' : 'Einheiten'} importieren</button>`
          : '<p class="hint">Alles schon da – nichts zu tun.</p>'}
        <button type="button" class="btn ghost" data-action="import-reset">Andere Datei</button>
      </section>`;
  } else {
    body = `<section class="card pad" style="display: flex; flex-direction: column; gap: 12px">
        <b>So geht's</b>
        <ol style="margin: 0; padding-left: 20px; font-size: 15px; line-height: 1.6">
          <li>In Alpha Progression: Einstellungen → Daten exportieren (CSV)</li>
          <li>„Teilen“ → <b>Motivator</b> wählen</li>
          <li>Fertig – oder die Datei hier auswählen:</li>
        </ol>
        <label class="btn" style="cursor: pointer">CSV-Datei auswählen<input type="file" accept=".csv,text/csv,text/comma-separated-values,text/plain" data-action="import-file" style="position: absolute; opacity: 0; width: 1px; height: 1px"></label>
        <p class="hint">„Teilen → Motivator“ klappt, wenn die App auf dem Startbildschirm installiert ist.</p>
        ${imp.error ? `<p class="small" style="color: var(--danger)" role="alert">${esc(imp.error)}</p>` : ''}
      </section>`;
  }
  return `<div class="app">
    ${backBar('#/training', 'Training')}
    <div class="wrap" style="gap: 16px">
      <h1 style="font-size: 26px; padding: 0 4px; line-height: 1.2">Trainings aus Alpha Progression holen</h1>
      ${S.hasStrengthSchema ? body : '<section class="card pad"><p class="hint">Bitte zuerst das Datenbank-Update <code>004_kraft.sql</code> im Supabase SQL-Editor ausführen.</p></section>'}
    </div>
    ${nav('overview')}
  </div>`;
}

// ───────────── Körperwerte ─────────────

export function bodyOn(S) {
  return !!(S.hasBodySchema && S.profile && (S.profile.modules || []).includes('body'));
}

const BODY_RANGES = [['3m', '3 Monate', 91], ['1y', '1 Jahr', 365], ['all', 'Alles', null]];

function numTxt(n, digits) {
  if (n == null) return '–';
  return Number(n).toLocaleString('de-DE', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

function bodyChart(points, f, fromDay, T) {
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

function changeTxt(points, f) {
  const c = change(points);
  if (c == null) return '';
  const sign = c > 0 ? '+' : (c < 0 ? '−' : '±');
  const d = points[0].day;
  return `${sign}${numTxt(Math.abs(c), f.digits)}${f.unit ? ' ' + f.unit : ''}<br>im Schnitt seit ${parseDay(d).getDate()}. ${monthShort(d.slice(0, 7))}`;
}

function lastCmpTxt(list, f) {
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

export function bodyImportView(S) {
  const imp = S.bimp || {};
  let body;
  if (imp.busy) {
    body = `<section class="card pad"><p>${esc(imp.busy)}</p></section>`;
  } else if (imp.done != null) {
    body = `<section class="total" style="flex-direction: column; align-items: flex-start; gap: 6px">
        <div style="font-size: 18px; font-weight: 700">${imp.done} ${imp.done === 1 ? 'Messtag' : 'Messtage'} importiert</div>
        <div class="small">Alle Spalten sind gespeichert – auch die, die du gerade nicht siehst. Nächstes Mal einfach wieder alles exportieren.</div>
      </section>
      <a class="btn" href="#/body">Zu den Körperwerten</a>`;
  } else if (imp.preview) {
    const p = imp.preview;
    const range = p.from ? `${monthShort(p.from.slice(0, 7))} ${p.from.slice(0, 4)} bis ${shortDate(p.to)}${p.to.slice(0, 4) !== String(new Date().getFullYear()) ? ' ' + p.to.slice(0, 4) : ''}` : '';
    body = `<section class="card pad" style="display: flex; flex-direction: column; gap: 12px">
        <div class="small muted">${esc(imp.name || 'CSV-Datei')}</div>
        <div class="grid2" style="gap: 8px">
          <div class="imp-box" style="background: var(--soft)"><div class="small">Neu</div><b>${p.fresh.length}</b><div class="small">Messtage</div></div>
          <div class="imp-box" style="background: var(--bg)"><div class="small muted">Schon da</div><b>${p.known}</b><div class="small muted">werden übersprungen</div></div>
        </div>
        <div style="font-size: 14px; line-height: 1.5">${range} · ${p.rows} Zeilen.${p.merged ? ' Mehrfach-Messungen am selben Tag werden zu einer zusammengefasst.' : ''}</div>
        ${p.fresh.length
          ? `<button type="button" class="btn" data-action="bimport-go">${p.fresh.length} ${p.fresh.length === 1 ? 'Messtag' : 'Messtage'} importieren</button>`
          : '<p class="hint">Alles schon da – nichts zu tun.</p>'}
        <button type="button" class="btn ghost" data-action="bimport-reset">Andere Datei</button>
      </section>`;
  } else {
    body = `<section class="card pad" style="display: flex; flex-direction: column; gap: 12px">
        <b>So geht's</b>
        <ol style="margin: 0; padding-left: 20px; font-size: 15px; line-height: 1.6">
          <li>In Renpho: Waage → Verlauf → ganz unten „Daten exportieren“</li>
          <li>Zeitraum „alles“ → „Teilen“ → <b>Motivator</b></li>
          <li>Fertig – oder die Datei hier auswählen:</li>
        </ol>
        <label class="btn" style="cursor: pointer">CSV-Datei auswählen<input type="file" accept=".csv,text/csv,text/comma-separated-values,text/plain" data-action="bimport-file" style="position: absolute; opacity: 0; width: 1px; height: 1px"></label>
        ${imp.error ? `<p class="small" style="color: var(--danger)" role="alert">${esc(imp.error)}</p>` : ''}
      </section>`;
  }
  return `<div class="app">
    ${backBar('#/body', 'Körper')}
    <div class="wrap" style="gap: 16px">
      <h1 style="font-size: 26px; padding: 0 4px; line-height: 1.2">Messungen aus Renpho holen</h1>
      ${S.hasBodySchema ? body : '<section class="card pad"><p class="hint">Bitte zuerst das Datenbank-Update <code>005_koerper.sql</code> im Supabase SQL-Editor ausführen.</p></section>'}
    </div>
    ${nav('overview')}
  </div>`;
}

export function stepsView(S, T) {
  const habit = S.habits.find((h) => !h.archived && h.auto_metric === 'steps');
  const goal = habit && habit.target ? habit.target : null;
  const s = stepsSummary(S.activity, T, 30, goal);
  const top = Math.max(goal || 0, ...s.list.map((x) => x.steps || 0), 1);
  const H = 150;
  const bars = s.list.map((x) => {
    const today = x.day === T;
    let bg = 'var(--field)';
    if (x.steps != null && goal && x.steps >= goal) bg = 'var(--c-teal)';
    else if (x.steps != null && !goal) bg = 'var(--c-teal)';
    if (today) bg = 'var(--k-teal)';
    return `<span title="${x.day}: ${x.steps ?? '–'}" style="height: ${x.steps ? Math.max(2, Math.round((x.steps / top) * H)) : 2}px; background: ${bg}"></span>`;
  }).join('');
  const first = parseDay(s.list[0].day);
  return `<div class="app">
    ${backBar('#/', 'Übersicht')}
    <div class="wrap" style="gap: 14px">
      <h1 style="font-size: 28px; padding: 0 4px">Schritte</h1>
      <section class="stat3">
        <div class="card"><div class="small muted">Heute</div><b>${s.today != null ? fmt(s.today) : '–'}</b></div>
        <div class="card"><div class="small muted">Ø 30 Tage</div><b>${s.avg != null ? fmt(s.avg) : '–'}</b></div>
        <div class="card"><div class="small muted">Bester Tag</div><b>${s.best ? fmt(s.best.steps) : '–'}</b></div>
      </section>
      <section class="card pad">
        <div class="section-head" style="margin: 0 0 12px"><h2 style="font-size: 17px">Letzte 30 Tage</h2><span class="small muted">${goal ? `Linie = dein Ziel ${fmt(goal)}` : ''}</span></div>
        <div class="sbars" style="height: ${H}px">${goal ? `<div class="goal-line mini" style="bottom: ${Math.round((goal / top) * H)}px"></div>` : ''}${bars}</div>
        <div class="small muted" style="display: flex; justify-content: space-between; margin-top: 6px"><span>${first.getDate()}. ${monthShort(s.list[0].day.slice(0, 7))}</span><span>heute</span></div>
      </section>
      ${s.daysKnown ? `<section class="total" style="flex-direction: column; align-items: flex-start; gap: 2px">
        ${goal ? `<div class="big">${s.daysOverGoal} von ${s.daysKnown} Tagen über ${fmt(goal)}</div>` : ''}
        <div class="small">Zusammen ${fmt(s.total)} Schritte${s.km ? ` – etwa ${fmt(s.km)} km` : ''}.</div>
      </section>` : ''}
      ${goal ? '' : '<p class="hint" style="padding: 0 4px">Tipp: Leg eine Gewohnheit „Schritte“ an und wähle „Wert von Withings übernehmen: Schritte“ – dann siehst du hier dein Ziel.</p>'}
    </div>
    ${nav('overview')}
  </div>`;
}

function periodsCard(h, periods, col) {
  const weekly = h.schedule === 'per_week';
  const target = h.schedule_count || 1;
  const words = { goal: 'Ziel', mini: 'Mini', missed: 'offen', running: 'läuft', paused: 'Pause' };
  const list = periods.list.filter((p) => p.state !== 'before');
  if (list.length === 0) return '';
  const cells = list.map((p) => {
    let style = 'background: var(--bg)';
    if (p.state === 'goal') style = `background: var(--c-${col}); color: var(--on-accent)`;
    else if (p.state === 'mini') style = 'background: var(--k-teal); color: var(--mini-fg)';
    else if (p.state === 'running') style = 'background: var(--surface); box-shadow: inset 0 0 0 2px var(--field)';
    else if (p.state === 'paused') style = 'background: repeating-linear-gradient(135deg, var(--bg), var(--bg) 4px, var(--border) 4px, var(--border) 8px)';
    return `<div class="period" style="${style}"><div class="small" style="font-weight: 600; opacity: 0.85">${esc(p.label)}</div><div style="font-size: 20px; font-weight: 700">${p.hits}/${p.target || target}</div><div class="small" style="font-weight: 600">${words[p.state]}</div></div>`;
  }).join('');
  const summary = periods.judged ? `${periods.done} von ${periods.judged} geschafft` : 'noch keine abgeschlossene';
  return `<section class="card pad">
    <div class="section-head" style="margin: 0 0 12px"><h2 style="font-size: 17px">${weekly ? 'Wochen' : 'Monate'}</h2><span class="small muted">${summary}</span></div>
    <div class="periods">${cells}</div>
  </section>`;
}

// ───────────── Alle Gewohnheiten ─────────────

export function habitsList(S, T) {
  const active = S.habits.filter((h) => !h.archived);
  const groups = S.categories.map((c) => ({ name: c.name, items: active.filter((h) => h.category_id === c.id) }));
  groups.push({ name: 'Ohne Kategorie', items: active.filter((h) => !S.categories.some((c) => c.id === h.category_id)) });
  const body = active.length === 0
    ? `<div class="empty"><b>Noch keine Gewohnheiten</b><p class="hint" style="margin-top: 4px">Leg oben rechts die erste an.</p></div>`
    : groups.filter((g) => g.items.length).map((g) => `
      <div class="section-head"><h2 style="font-size: 16px">${esc(g.name)}</h2></div>
      <div class="card list">${g.items.map((h) => {
        const col = colorOf(S, h);
        return `<a class="row" href="#/habit/${esc(h.id)}" style="text-decoration: none; color: inherit">
          <div class="hicon" style="background: var(--k-${col}); color: var(--c-${col})">${habitIcon(h.icon)}</div>
          <div class="row-main"><div class="row-title"><span>${esc(h.name)}</span>${h.start_day > T ? `<span class="pill pause">ab ${parseDay(h.start_day).getDate()}. ${monthShort(h.start_day.slice(0, 7))}</span>` : ''}</div><div class="row-sub">${esc(scheduleText(h))}${h.kind === 'count' ? ` · Ziel ${fmt(h.target)}${h.unit ? ' ' + esc(h.unit) : ''}` : ''}</div></div>
          <span class="muted" style="transform: rotate(180deg); display: flex">${svg(UI_ICONS.back, 18)}</span>
        </a>`;
      }).join('')}</div>`).join('');
  return `<div class="app">
    <header class="top"><div><h1>Gewohnheiten</h1></div><a class="icon-btn" href="#/new" aria-label="Neue Gewohnheit anlegen">${svg(UI_ICONS.plus)}</a></header>
    <div class="wrap" style="margin-top: 8px">${body}</div>
    ${nav('habits')}
  </div>`;
}

// ───────────── Anlegen / Bearbeiten ─────────────

export function habitForm(S, T, id) {
  const editing = id ? S.habits.find((x) => x.id === id) : null;
  if (id && !editing) return notFound();
  const h = editing || { name: '', icon: 'check', kind: 'check', schedule: 'daily', schedule_days: [1, 2, 3, 4, 5], schedule_count: 3, category_id: S.cat !== 'all' ? S.cat : null };
  const f = S.form || {};
  const kind = f.kind || h.kind;
  const schedule = f.schedule || h.schedule;
  const catSel = f.category ?? (h.category_id || '');
  const radio = (name, value, label, current) =>
    `<label class="opt"><input type="radio" name="${name}" value="${value}"${current === value ? ' checked' : ''} data-action="form-change"><span>${label}</span></label>`;
  const days = h.schedule_days || [];
  return `<div class="app">
    <div class="bar">
      <a class="link-btn" href="${editing ? '#/habit/' + esc(editing.id) : '#/'}">Abbrechen</a>
      <h1>${editing ? 'Gewohnheit bearbeiten' : 'Neue Gewohnheit'}</h1>
      <span style="width: 86px"></span>
    </div>
    <form class="wrap" data-form="habit" novalidate style="padding-bottom: 24px; gap: 20px">
      <section class="card pad" style="display: flex; flex-direction: column; gap: 14px">
        <div class="field"><label for="f-name">Name</label>
          <input id="f-name" class="input" name="name" required maxlength="60" value="${esc(f.name ?? h.name)}" placeholder="z. B. Duolingo" autocomplete="off"></div>
        <div class="field"><span class="label">Symbol</span>
          <div class="opts icons" role="radiogroup" aria-label="Symbol">
            ${Object.entries(HABIT_ICONS).map(([k, v]) => `<label class="opt"><input type="radio" name="icon" value="${k}"${(f.icon || h.icon) === k ? ' checked' : ''} aria-label="${v.label}"><span>${svg(v.path, 22)}</span></label>`).join('')}
          </div></div>
        <div class="field"><label for="f-cat">Kategorie</label>
          <select id="f-cat" class="input" name="category" data-action="form-change">
            <option value="">Keine</option>
            ${S.categories.map((c) => `<option value="${esc(c.id)}"${catSel === c.id ? ' selected' : ''}>${esc(c.name)}</option>`).join('')}
            <option value="__new"${catSel === '__new' ? ' selected' : ''}>Neue Kategorie …</option>
          </select></div>
        ${catSel === '__new' ? `<div class="field"><label for="f-newcat">Name der neuen Kategorie</label><input id="f-newcat" class="input" name="newcat" maxlength="40" value="${esc(f.newcat || '')}" placeholder="z. B. Sport"></div>` : ''}
      </section>

      <section style="display: flex; flex-direction: column; gap: 10px">
        <h2 class="h3">Wie zählst du?</h2>
        <div class="seg" role="radiogroup" aria-label="Art">
          <label><input type="radio" name="kind" value="check"${kind === 'check' ? ' checked' : ''} data-action="form-change"><span>Abhaken</span></label>
          <label><input type="radio" name="kind" value="count"${kind === 'count' ? ' checked' : ''} data-action="form-change"><span>Zahl eintragen</span></label>
        </div>
        ${kind === 'count' ? `<div class="card pad grid2">
          <div class="field"><label for="f-target">Tagesziel</label><input id="f-target" class="input" name="target" type="number" inputmode="decimal" min="0" value="${esc(f.target ?? h.target ?? '')}" placeholder="20"></div>
          <div class="field"><label for="f-unit">Einheit</label><input id="f-unit" class="input" name="unit" maxlength="20" value="${esc(f.unit ?? h.unit ?? '')}" placeholder="Wdh."></div>
        </div>` : ''}
      </section>

      <section style="display: flex; flex-direction: column; gap: 10px">
        <h2 class="h3">Wie oft?</h2>
        <div class="opts" role="radiogroup" aria-label="Häufigkeit">
          ${radio('schedule', 'daily', 'Täglich', schedule)}
          ${radio('schedule', 'weekdays', 'Bestimmte Tage', schedule)}
          ${radio('schedule', 'per_week', 'X-mal pro Woche', schedule)}
          ${radio('schedule', 'per_month', 'X-mal pro Monat', schedule)}
        </div>
        ${schedule === 'weekdays' ? `<div class="opts days" role="group" aria-label="Wochentage">
          ${WEEKDAYS_SHORT.map((w, i) => `<label class="opt"><input type="checkbox" name="days" value="${i + 1}"${(f.days || days).includes(i + 1) ? ' checked' : ''}><span>${w}</span></label>`).join('')}
        </div>` : ''}
        ${schedule === 'per_week' || schedule === 'per_month' ? `<div class="card pad" style="display: flex; flex-direction: column; gap: 12px">
          <div class="grid2">
            <div class="field"><label for="f-count">Ziel ${schedule === 'per_week' ? 'pro Woche' : 'pro Monat'}</label>
              <input id="f-count" class="input" name="count" type="number" inputmode="numeric" min="1" max="${schedule === 'per_week' ? 7 : 31}" value="${esc(f.count ?? h.schedule_count ?? 3)}"></div>
            <div class="field"><label for="f-min">${schedule === 'per_week' ? 'Mini-Woche' : 'Mini-Monat'} ab</label>
              <input id="f-min" class="input" name="min" type="number" inputmode="numeric" min="1" value="${esc(f.min ?? h.schedule_min ?? '')}" placeholder="optional"></div>
          </div>
          <p class="hint">Im Alltag siehst du immer dein Ziel. In Ringen und Quote zählt ${schedule === 'per_week' ? 'die Woche' : 'der Monat'} schon ab der Mini-Zahl als geschafft – so peilst du das Ziel an, ohne dass ${schedule === 'per_week' ? 'eine schwere Woche' : 'ein schwerer Monat'} wehtut.</p>
        </div>` : ''}
        <div class="card pad field">
          <label for="f-start">Ab wann?</label>
          <input id="f-start" class="input" name="start_day" type="date" value="${esc(f.start_day ?? h.start_day ?? T)}" required>
          <p class="hint">Vorher zählt nichts – weder als geschafft noch als verpasst.</p>
        </div>
      </section>

      <section class="card pad" style="display: flex; flex-direction: column; gap: 8px">
        <h2 style="font-size: 15px">Mini-Version</h2>
        <p class="hint">Für schwere Tage. Zählt genauso als geschafft.</p>
        ${kind === 'count'
          ? `<div class="field"><label for="f-minival">Mini-Wert</label><input id="f-minival" class="input" name="mini_value" type="number" inputmode="decimal" min="0" value="${esc(f.mini_value ?? h.mini_value ?? '')}" placeholder="10"></div>`
          : `<div class="field"><label for="f-minitext">Was ist die Mini-Version?</label><input id="f-minitext" class="input" name="mini_text" maxlength="60" value="${esc(f.mini_text ?? h.mini_text ?? '')}" placeholder="z. B. 5 Minuten"></div>`}
      </section>

      ${S.hasWithingsSchema ? autoSection(S, h, f, kind) : ''}

      <p class="hint" style="padding: 0 4px">Steigerung und Erinnerungen kommen in einer der nächsten Versionen.</p>
      <p id="form-error" class="small" style="color: var(--danger); padding: 0 4px" role="alert"></p>
      <button type="submit" class="btn">${editing ? 'Speichern' : 'Gewohnheit anlegen'}</button>
      ${editing ? '<button type="button" class="btn danger" data-action="archive" data-id="' + esc(editing.id) + '">Gewohnheit entfernen</button><p class="hint" style="text-align: center">Bisherige Einträge bleiben in deiner Gesamtzahl erhalten.</p>' : ''}
    </form>
  </div>`;
}

function autoSection(S, h, f, kind) {
  const connected = S.withings && S.withings.connected;
  const note = connected ? '' : '<p class="hint">Funktioniert, sobald Withings im Profil verbunden ist.</p>';
  if (kind === 'count') {
    const cur = f.auto_metric ?? h.auto_metric ?? '';
    return `<section class="card pad" style="display: flex; flex-direction: column; gap: 10px">
      <h2 style="font-size: 15px">Wert von Withings übernehmen</h2>
      <div class="field"><label for="f-metric">Woher kommt die Zahl?</label>
        <select id="f-metric" class="input" name="auto_metric">
          <option value="">Ich trage selbst ein</option>
          ${Object.entries(METRICS).map(([k, m]) => `<option value="${k}"${cur === k ? ' selected' : ''}>${m.label}${m.unit !== m.label ? ' (' + m.unit + ')' : ''}</option>`).join('')}
        </select></div>
      <p class="hint">Die Zahl füllt sich dann von selbst. Trägst du selbst etwas ein, hat deine Zahl Vorrang.</p>
      ${note}
    </section>`;
  }
  const on = f.auto_on ?? !!(h.auto_categories && h.auto_categories.length);
  const cats = h.auto_categories || [16, 17];
  const groups = f.auto_groups ?? CATEGORY_GROUPS.filter((g) => g.cats.some((c) => cats.includes(c))).map((g) => g.id);
  const found = new Map();
  for (const w of S.workouts) found.set(w.category, (found.get(w.category) || 0) + 1);
  const foundText = [...found.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([c, n]) => `${categoryName(c)} ${n}×`).join(', ');
  return `<section class="card pad" style="display: flex; flex-direction: column; gap: 12px">
    <label class="switch-row">
      <span><span style="display: block; font-size: 15px; font-weight: 700">Automatisch abhaken</span><span class="hint">wenn Withings ein passendes Training erkennt</span></span>
      <input type="checkbox" class="sw-input" name="auto_on" data-action="form-change"${on ? ' checked' : ''}>
      <span class="switch" aria-hidden="true"></span>
    </label>
    ${on ? `
      <span class="label">Welche Trainingsarten zählen?</span>
      <div class="opts" role="group" aria-label="Trainingsarten">
        ${CATEGORY_GROUPS.map((g) => `<label class="opt"><input type="checkbox" name="auto_groups" value="${g.id}"${groups.includes(g.id) ? ' checked' : ''}><span>${g.label}</span></label>`).join('')}
      </div>
      <div class="switch-row" style="cursor: default">
        <label for="f-automin" style="font-size: 15px; font-weight: 500">Mindestens</label>
        <span style="display: flex; align-items: center; gap: 8px"><input id="f-automin" class="input" name="auto_min" type="number" inputmode="numeric" min="0" value="${esc(f.auto_min ?? h.auto_min_minutes ?? 20)}" style="width: 80px; text-align: center">Minuten</span>
      </div>
      ${foundText ? `<p class="hint">In deinen Withings-Daten: ${esc(foundText)}</p>` : ''}
      <p class="hint">Einen automatischen Haken kannst du jederzeit zurücknehmen – er kommt dann nicht wieder.</p>` : ''}
    ${note}
  </section>`;
}

function ago(iso) {
  if (!iso) return 'noch nie';
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return 'gerade eben';
  if (min < 60) return `vor ${min} Minute${min === 1 ? '' : 'n'}`;
  const h = Math.round(min / 60);
  if (h < 24) return `vor ${h} Stunde${h === 1 ? '' : 'n'}`;
  const d = Math.round(h / 24);
  return `vor ${d} Tag${d === 1 ? '' : 'en'}`;
}

function withingsCard(S) {
  if (!S.hasWithingsSchema) {
    return `<section class="card pad"><b>Withings</b><p class="hint" style="margin-top: 4px">Bitte zuerst das Datenbank-Update <code>003_withings.sql</code> im Supabase SQL-Editor ausführen.</p></section>`;
  }
  const w = S.withings || {};
  const status = S.syncing ? 'Gleicht gerade ab …' : (w.connected ? `Verbunden · zuletzt abgeglichen ${ago(w.last_sync_at)}` : 'Nicht verbunden');
  return `<section style="display: flex; flex-direction: column; gap: 10px">
    <h2 class="h3">Verbindungen</h2>
    <div class="card pad" style="display: flex; flex-direction: column; gap: 14px">
      <div style="display: flex; align-items: center; gap: 12px">
        <div class="hicon" style="width: 44px; height: 44px; border-radius: 14px; background: var(--soft)">${svg('M12 6a6 6 0 1 0 0 12 6 6 0 0 0 0-12zM9 6V3h6v3M9 18v3h6v-3M12 9v3l2 1', 22)}</div>
        <div style="flex: 1"><div style="font-size: 16px; font-weight: 700">Withings</div><div class="small" style="color: ${w.connected ? 'var(--mini-fg)' : 'var(--muted)'}">${status}</div></div>
      </div>
      ${w.connected
        ? `<div class="grid2">
            <button type="button" class="btn ghost" data-action="withings-sync"${S.syncing ? ' disabled' : ''}>Jetzt abgleichen</button>
            <button type="button" class="btn danger" data-action="withings-disconnect">Trennen</button>
          </div>
          <p class="hint">Abgleich passiert automatisch, wenn du die App öffnest.</p>`
        : `<p class="hint">Schritte und Trainings deiner Uhr kommen dann automatisch in die App. Du meldest dich dafür einmal bei Withings an und tippst auf „Erlauben“.</p>
          <button type="button" class="btn" data-action="withings-connect">Mit Withings verbinden</button>`}
    </div>
  </section>`;
}

function tilesCard(S) {
  const tiles = new Set((S.profile && S.profile.tiles) || ['steps', 'training']);
  const defs = [];
  if (S.hasWithingsSchema && ((S.withings && S.withings.connected) || S.activity.length)) {
    defs.push(['steps', 'Schritte', 'heute · Withings'], ['training', 'Training', 'letzte 7 Tage · Withings'], ['active', 'Aktive Minuten', 'heute · Withings'], ['distance', 'Strecke', 'heute · Withings']);
  }
  if (bodyOn(S)) defs.push(['body', 'Körper', 'Gewicht · Renpho']);
  if (!defs.length) return '';
  return `<section style="display: flex; flex-direction: column; gap: 10px">
    <h2 class="h3">Kacheln auf der Übersicht</h2>
    <div class="card list">
      ${defs.map(([id, label, src]) => `<div class="cat-row" style="justify-content: space-between">
        <div><div style="font-size: 16px; font-weight: 600">${label}</div><div class="small muted">${src}</div></div>
        <button type="button" class="switch" role="switch" aria-checked="${tiles.has(id)}" aria-label="${label} anzeigen" data-action="tile-toggle" data-id="${id}"></button>
      </div>`).join('')}
    </div>
  </section>`;
}

function bodyCard(S) {
  if (!S.hasBodySchema) {
    return `<section class="card pad"><b>Körperwerte (Renpho)</b><p class="hint" style="margin-top: 4px">Für den Import bitte zuerst das Datenbank-Update <code>005_koerper.sql</code> im Supabase SQL-Editor ausführen.</p></section>`;
  }
  const on = bodyOn(S);
  const n = (S.body || []).length;
  return `<section class="card pad" style="display: flex; flex-direction: column; gap: 14px">
      <div class="switch-row" style="cursor: default">
        <div><div style="font-size: 16px; font-weight: 700">Körperwerte (Renpho)</div>
          <div class="small muted">${on ? (n ? `${n} Messtage · zuletzt ${shortDate(S.body[n - 1].day)}` : 'Noch nichts importiert') : 'Gewicht, Körperfett, Muskeln als Trend'}</div></div>
        <button type="button" class="switch" role="switch" aria-checked="${on}" aria-label="Körperwerte nutzen" data-action="module-toggle" data-id="body"></button>
      </div>
      ${on ? '<a class="btn ghost" href="#/body-import">Renpho importieren</a>' : ''}
    </section>`;
}

function alphaCard(S) {
  if (!S.hasStrengthSchema) {
    return `<section class="card pad"><b>Alpha Progression</b><p class="hint" style="margin-top: 4px">Für den Import bitte zuerst das Datenbank-Update <code>004_kraft.sql</code> im Supabase SQL-Editor ausführen.</p></section>`;
  }
  const on = alphaOn(S);
  const n = (S.strength || []).length;
  const lastDay = n ? S.strength.map((x) => x.day).sort().pop() : null;
  return `<section class="card pad" style="display: flex; flex-direction: column; gap: 14px">
      <div class="switch-row" style="cursor: default">
        <div><div style="font-size: 16px; font-weight: 700">Alpha Progression</div>
          <div class="small muted">${on ? (n ? `${n} Einheiten · zuletzt ${shortDate(lastDay)}` : 'Noch nichts importiert') : 'Übungen, Sätze und Steigerung aus der App'}</div></div>
        <button type="button" class="switch" role="switch" aria-checked="${on}" aria-label="Alpha Progression nutzen" data-action="module-toggle" data-id="alpha"></button>
      </div>
      ${on ? '<a class="btn ghost" href="#/import">Trainings importieren</a>' : ''}
    </section>`;
}

function installCard(S) {
  if (S.standalone) return '';
  return `<section class="card pad" style="display: flex; flex-direction: column; gap: 10px">
      <div style="display: flex; align-items: center; gap: 12px">
        <img src="icons/icon-192.png" width="44" height="44" alt="" style="border-radius: 12px">
        <div><div style="font-size: 16px; font-weight: 700">Als App installieren</div><div class="small muted">Eigenes Symbol, ohne Adressleiste – und „Teilen → Motivator“ klappt.</div></div>
      </div>
      ${S.canInstall
        ? '<button type="button" class="btn" data-action="install">Motivator installieren</button>'
        : '<p class="hint">Chrome: Menü ⋮ → „App installieren“ (oder „Zum Startbildschirm hinzufügen“ → „Installieren“). Erscheint das nicht, die Seite einmal neu laden und kurz warten.</p>'}
    </section>`;
}

// ───────────── Profil ─────────────

export function profile(S, email) {
  const cats = S.categories.map((c) => `<div class="cat-row">
      <input class="input" value="${esc(c.name)}" maxlength="40" aria-label="Name der Kategorie" data-action="cat-rename" data-id="${esc(c.id)}">
      <select class="input" aria-label="Farbe" data-action="cat-color" data-id="${esc(c.id)}">
        ${COLORS.map((x) => `<option value="${x.id}"${c.color === x.id ? ' selected' : ''}>${x.label}</option>`).join('')}
      </select>
      <button type="button" class="icon-btn" data-action="cat-delete" data-id="${esc(c.id)}" aria-label="Kategorie ${esc(c.name)} löschen" style="border: 0">${svg('M6 6l12 12M18 6L6 18', 18)}</button>
    </div>`).join('');
  return `<div class="app">
    <header class="top"><div><h1>Profil</h1><div class="small muted" style="margin-top: 4px">${esc(email || '')}</div></div></header>
    <div class="wrap" style="margin-top: 8px; gap: 16px">
      <section class="card pad field">
        <label for="p-name">Wie soll ich dich nennen?</label>
        <input id="p-name" class="input" value="${esc((S.profile && S.profile.display_name) || '')}" maxlength="40" data-action="profile-name">
      </section>
      <section style="display: flex; flex-direction: column; gap: 10px">
        <h2 class="h3">Kategorien</h2>
        ${S.categories.length ? `<div class="card list">${cats}</div>` : '<p class="hint" style="padding: 0 4px">Noch keine Kategorien. Du kannst sie hier oder beim Anlegen einer Gewohnheit erstellen.</p>'}
        <form class="card pad" data-form="new-cat" style="display: flex; gap: 10px">
          <input class="input" name="name" maxlength="40" placeholder="Neue Kategorie" aria-label="Neue Kategorie">
          <button type="submit" class="icon-btn" aria-label="Kategorie hinzufügen">${svg(UI_ICONS.plus)}</button>
        </form>
      </section>
      ${installCard(S)}
      ${withingsCard(S)}
      ${alphaCard(S)}
      ${bodyCard(S)}
      ${tilesCard(S)}
      <section style="display: flex; flex-direction: column; gap: 10px">
        <h2 class="h3">Deine Daten</h2>
        <button type="button" class="btn ghost" data-action="export">Alle Daten herunterladen</button>
        <p class="hint" style="padding: 0 4px">Speichert alles als Datei – als Sicherung oder zum Mitnehmen.</p>
      </section>
      <button type="button" class="btn danger" data-action="logout">Abmelden</button>
      <p class="small muted" style="text-align: center">Version ${APP_VERSION}</p>
    </div>
    ${nav('profile')}
  </div>`;
}

// ───────────── Willkommen zurück ─────────────

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

export function login(error) {
  return `<form class="login" data-form="login">
    <div>
      <h1>Motivator</h1>
      <p class="muted" style="margin-top: 6px">Schön, dass du da bist.</p>
    </div>
    <div class="field"><label for="l-mail">E-Mail</label><input id="l-mail" class="input" type="email" name="email" autocomplete="username" required></div>
    <div class="field"><label for="l-pw">Passwort</label><input id="l-pw" class="input" type="password" name="password" autocomplete="current-password" required></div>
    <p class="small" style="color: var(--danger); min-height: 18px" role="alert">${esc(error || '')}</p>
    <button type="submit" class="btn">Anmelden</button>
  </form>`;
}

export function notFound() {
  return `<div class="app"><div class="wrap" style="padding-top: 60px; text-align: center; gap: 16px">
    <p>Das gibt es (nicht mehr).</p><a class="btn" href="#/">Zur Übersicht</a></div></div>`;
}

export function loading(text = 'Lädt …') {
  return `<div class="loading">${esc(text)}</div>`;
}
