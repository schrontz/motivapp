// Gewohnheiten: Liste, Detail mit Kalender/Statistik, Formular.

import { categoryName, CATEGORY_GROUPS, METRICS, workoutCounts, matchesCategories, dedupeWorkouts } from '../auto.js';
import { monthName, monthShort, WEEKDAYS_SHORT, parseDay } from '../dates.js';
import { svg, habitIcon, HABIT_ICONS, UI_ICONS } from '../icons.js';
import { habitStats, scheduleText } from '../stats.js';
import { hintCard, sheet } from './overview.js';
import { colorOf, esc, fmt, nav, notFound, timeOf } from './ui.js';
import { usualLine } from './remind.js';

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
    const disabled = c.future || c.state === 'before';
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
        <div><h1 style="font-size: 28px">${esc(h.name)}</h1><div class="small muted">${esc(scheduleText(h))}${cat ? ' · ' + esc(cat.name) : ''}${h.mini_text ? ' · Mini: ' + esc(h.mini_text) : ''}</div>${usualLine(S, h, T)}</div>
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
      ${pauseCard(S, T, h)}
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
    ${S.pauseSheet ? pauseSheet(S, T) : ''}
  </div>`;
}

export function trainingsSection(S, h, T) {
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

export function periodsCard(h, periods, col) {
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
    <div class="wrap" style="margin-top: 8px">${body}${active.length ? pauseCard(S, T, null) : ''}</div>
    ${nav('habits')}
    ${S.pauseSheet ? pauseSheet(S, T) : ''}
  </div>`;
}

// ───────────── Pausen ─────────────

const WD = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];

export function pauseRange(p) {
  const a = parseDay(p.start_day);
  const b = parseDay(p.end_day);
  const day = (d, withMonth) => `${WD[d.getDay()]} ${d.getDate()}.${withMonth ? ' ' + monthShort(toKey(d)) : ''}`;
  if (p.start_day === p.end_day) return day(a, true);
  const sameMonth = p.start_day.slice(0, 7) === p.end_day.slice(0, 7);
  return `${day(a, !sameMonth)} – ${day(b, true)}`;
}

function toKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

// Aktuelle und geplante Pausen + Knopf. habit = null → „für alle Gewohnheiten“
export function pauseCard(S, T, habit) {
  const mine = S.pauses.filter((p) => p.end_day >= T && (habit ? p.habit_id === habit.id : p.habit_id == null))
    .sort((a, b) => (a.start_day < b.start_day ? -1 : 1));
  const global = habit ? S.pauses.filter((p) => p.end_day >= T && p.habit_id == null) : [];
  const rows = mine.map((p) => `<div class="cat-row" style="justify-content: space-between">
      <div><div style="font-size: 15px; font-weight: 600">${pauseRange(p)}</div><div class="small muted">${p.start_day <= T ? 'läuft gerade' : 'geplant'}</div></div>
      <button type="button" class="icon-btn" data-action="pause-delete" data-id="${esc(p.id)}" aria-label="Pause ${pauseRange(p)} entfernen" style="border: 0">${svg('M6 6l12 12M18 6L6 18', 18)}</button>
    </div>`).join('');
  const globalNote = global.length ? `<p class="hint">Dazu ${global.length === 1 ? 'eine Pause' : global.length + ' Pausen'} für alle Gewohnheiten: ${global.map(pauseRange).join(', ')}.</p>` : '';
  return `<section class="card pad" style="display: flex; flex-direction: column; gap: 10px">
    <div class="section-head" style="margin: 0"><h2 style="font-size: 17px">${habit ? 'Pausen' : 'Pause für alles'}</h2><span class="small muted">${habit ? 'zählen nicht gegen dich' : 'Urlaub, krank, Wochenende'}</span></div>
    ${rows ? `<div class="list" style="margin: 0 -16px">${rows}</div>` : ''}
    ${globalNote}
    <button type="button" class="btn ghost" data-action="pause-open" data-id="${habit ? esc(habit.id) : 'all'}">${habit ? 'Pause einlegen' : 'Alle Gewohnheiten pausieren'}</button>
  </section>`;
}

export function pauseSheet(S, T) {
  const ps = S.pauseSheet;
  const h = ps.habitId ? S.habits.find((x) => x.id === ps.habitId) : null;
  const title = h ? `Pause für ${esc(h.name)}` : 'Pause für alle Gewohnheiten';
  const quick = [['today', 'Heute'], ['weekend', 'Wochenende'], ['week', 'Nächste 7 Tage']]
    .map(([k, l]) => `<button type="button" class="chip" data-action="pause-quick" data-id="${k}">${l}</button>`).join('');
  return `<button type="button" class="scrim" data-action="pause-close" aria-label="Schließen"></button>
  <form class="sheet" data-form="pause" role="dialog" aria-modal="true" aria-label="${title}">
    <div class="handle"></div>
    <h2 style="font-size: 22px">${title}</h2>
    <div style="display: flex; gap: 8px; flex-wrap: wrap">${quick}</div>
    <div class="grid2">
      <div class="field"><label for="ps-from">Von</label><input id="ps-from" class="input" type="date" name="from" value="${esc(ps.from)}" required></div>
      <div class="field"><label for="ps-to">Bis</label><input id="ps-to" class="input" type="date" name="to" value="${esc(ps.to)}" required></div>
    </div>
    <p class="small" style="color: var(--danger); min-height: 18px" id="pause-error" role="alert"></p>
    <button type="submit" class="btn">Pause eintragen</button>
    <p class="small muted" style="text-align: center">Pausentage zählen nicht gegen dich – nicht in den Ringen, nicht in der Quote.${h ? '' : ' Gilt für alle Gewohnheiten.'}</p>
  </form>`;
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

export function autoSection(S, h, f, kind) {
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
