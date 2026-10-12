// Oberfläche: reine Funktionen, die aus dem Zustand HTML erzeugen.
// Alle Texte aus der Datenbank laufen durch esc().

import { svg, habitIcon, HABIT_ICONS, UI_ICONS, COLORS } from './icons.js';
import { longDate, greeting, monthName, monthShort, WEEKDAYS_SHORT, diffDays, parseDay } from './dates.js';
import { todayItems, todayRing, windowQuota, totalHits, habitStats, scheduleText, logOf, isPaused, miniPeriodName, patternHint } from './stats.js';
import { tileValues, categoryName, CATEGORY_GROUPS, METRICS, workoutCounts, matchesCategories } from './auto.js';
import { APP_VERSION } from './config.js';

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
  if (!(S.withings && S.withings.connected) && !S.activity.length) return '';
  if (!show.length) return '';
  const v = tileValues({ activity: S.activity, workouts: S.workouts, today: T });
  const defs = {
    steps: { label: 'Schritte', icon: HABIT_ICONS.steps.path, color: 'teal', value: v.steps.value != null ? fmt(v.steps.value) : '–', sub: v.steps.avg7 != null ? `heute · Ø 7 Tage ${fmt(v.steps.avg7)}` : 'heute' },
    training: { label: 'Training', icon: HABIT_ICONS.dumbbell.path, color: 'blue', value: `${v.training.count}×`, sub: `letzte 7 Tage${v.training.minutes ? ' · ' + hm(v.training.minutes) : ''}` },
    active: { label: 'Aktive Minuten', icon: HABIT_ICONS.run.path, color: 'orange', value: v.active.value != null ? `${v.active.value} min` : '–', sub: 'heute · mittel + intensiv' },
    distance: { label: 'Strecke', icon: HABIT_ICONS.run.path, color: 'purple', value: v.distance.value != null ? `${fmt(v.distance.value)} km` : '–', sub: 'heute' }
  };
  const tiles = show.filter((k) => defs[k]).map((k) => {
    const d = defs[k];
    return `<div class="card tile">
      <div class="tile-head" style="color: var(--c-${d.color})">${svg(d.icon, 18)}<span>${d.label}</span></div>
      <div class="tile-val">${d.value}</div>
      <div class="small muted">${d.sub}</div>
    </div>`;
  }).join('');
  return `<section class="tiles" aria-label="Kennzahlen">${tiles}</section>`;
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
    list = `<div class="card list">${items.map((i) => habitRow(S, i)).join('')}</div>`;
  }

  return `<div class="app">
    <header class="top">
      <div><div class="date">${longDate(T)}</div><h1>${greeting()}${name}</h1></div>
      <a class="icon-btn" href="#/new" aria-label="Neue Gewohnheit anlegen">${svg(UI_ICONS.plus)}</a>
    </header>
    ${chips}
    <div class="wrap">
      ${ringsCard(todayRing(items), windowQuota(shown, S.idx, S.pauses, T, 7), windowQuota(shown, S.idx, S.pauses, T, 30))}
      ${tilesSection(S, T)}
      <section class="total">
        <div class="ico">${svg(UI_ICONS.trend, 22)}</div>
        <div><div class="big">${fmt(total)} Mal drangeblieben</div><div class="small muted">seit Start · diese Zahl kann nur wachsen</div></div>
      </section>
      <div class="section-head"><h2>Heute</h2>${items.length ? '<span class="small muted">Tippen zum Abhaken</span>' : ''}</div>
      ${list}
      ${hints}
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
  const list = S.workouts.filter((w) => w.day >= fromDay && w.day <= T).sort((a, b) => (a.start_at < b.start_at ? 1 : -1));
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
  const tiles = new Set((S.profile && S.profile.tiles) || ['steps', 'training']);
  const tileDefs = [
    ['steps', 'Schritte', 'heute · Withings'],
    ['training', 'Training', 'letzte 7 Tage · Withings'],
    ['active', 'Aktive Minuten', 'heute · Withings'],
    ['distance', 'Strecke', 'heute · Withings']
  ];
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
    <h2 class="h3" style="margin-top: 6px">Kacheln auf der Übersicht</h2>
    <div class="card list">
      ${tileDefs.map(([id, label, src]) => `<div class="cat-row" style="justify-content: space-between">
        <div><div style="font-size: 16px; font-weight: 600">${label}</div><div class="small muted">${src}</div></div>
        <button type="button" class="switch" role="switch" aria-checked="${tiles.has(id)}" aria-label="${label} anzeigen" data-action="tile-toggle" data-id="${id}"></button>
      </div>`).join('')}
    </div>
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
      ${withingsCard(S)}
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
