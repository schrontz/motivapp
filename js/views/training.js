// Training: Bereich, Einheit (mit Übungen), Schritte.

import { categoryName, workoutCounts, trainingList, trainingSummary, weeklyTrainingCounts, heartZones, stepsSummary } from '../auto.js';
import { longDate, monthShort, WEEKDAYS_SHORT, parseDay } from '../dates.js';
import { svg, UI_ICONS } from '../icons.js';
import { logOf } from '../stats.js';
import { exerciseHistory, exerciseKey, bestOneRm, volume, sessionTarget, setCellText } from '../strength.js';
import { alphaOn, backBar, dayShift, esc, fmt, isoWeekOf, kgTxt, nav, notFound, timeOf, trainings, zonesBar } from './ui.js';

export function sportHabit(S) {
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
      <a class="card pad dist-link" href="#/distance"><span><b>Wie weit bin ich gekommen?</b><br><span class="small muted">Deine Strecke als Kreis auf der Karte</span></span><span aria-hidden="true">›</span></a>
      ${goal ? '' : '<p class="hint" style="padding: 0 4px">Tipp: Leg eine Gewohnheit „Schritte“ an und wähle „Wert von Withings übernehmen: Schritte“ – dann siehst du hier dein Ziel.</p>'}
    </div>
    ${nav('overview')}
  </div>`;
}
