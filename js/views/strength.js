// Krafttraining: Übung, Steigerungsplan, Alpha-Import.

import { monthShort, WEEKDAYS_SHORT, parseDay } from '../dates.js';
import { svg, UI_ICONS } from '../icons.js';
import { exerciseHistory, exerciseKey, splitKey, bestOneRm, setsText, progress, planPreview, planModeOk } from '../strength.js';
import { esc, kgTxt, ladderChips, loading, nav, notFound, shortDate } from './ui.js';

export function planOf(S, key) {
  return (S.plans || []).find((p) => exerciseKey({ name: p.exercise, equipment: p.equipment }) === key) || null;
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

export const PLAN_FIELDS = [
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
