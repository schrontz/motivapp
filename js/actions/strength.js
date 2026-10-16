// Aktionen: Krafttraining – Steigerungsplan anlegen, ändern, löschen.

import * as db from '../db.js';
import { S, go, goBackTo, render, toast, persist } from '../core.js';
import { today, weekStart } from '../dates.js';
import { exerciseHistory, exerciseKey, splitKey, suggestPlan, planMode } from '../strength.js';
import { planFields } from '../views.js';

// Entwurf fürs Plan-Formular – aus dem bestehenden Plan oder als Vorschlag aus dem Verlauf
export function ensurePlanDraft(key, T) {
  if (S.planDraft && S.planDraft.key === key) return;
  const existing = (S.plans || []).find((p) => exerciseKey({ name: p.exercise, equipment: p.equipment }) === key);
  const hist = exerciseHistory(S.strength, key);
  const { name, equipment } = splitKey(key);
  const base = existing ? { ...existing } : (suggestPlan(hist, T) || {
    exercise: name, equipment, sets: 3, start_reps: 10, kg: 0, plus_reps: 2, every_weeks: 2, max_reps: 20, kg_step: 2.5, started_on: weekStart(T)
  });
  ['sets', 'start_reps', 'kg', 'plus_reps', 'every_weeks', 'max_reps', 'kg_step'].forEach((k) => { base[k] = Number(base[k]); });
  S.planDraft = { key, existing: existing || null, plan: base, mode: planMode(hist) };
}

function stepPlan(field, delta) {
  const d = S.planDraft;
  if (!d) return;
  const f = planFields(d.mode).find((x) => x.key === field);
  if (!f) return;
  const p = d.plan;
  p[field] = Math.min(f.max, Math.max(f.min, Math.round((p[field] + delta * f.step) * 100) / 100));
  if (field === 'start_reps' && p.max_reps < p.start_reps) p.max_reps = p.start_reps;
  if (field === 'max_reps' && p.max_reps < p.start_reps) p.max_reps = p.start_reps;
  render();
}

async function savePlanDraft() {
  const d = S.planDraft;
  if (!d) return;
  const p = { ...d.plan };
  if (d.mode && d.mode !== 'kg') { p.kg = 0; p.kg_step = 1; } // ohne Gewicht – Felder nur für die Datenbank füllen
  if (p.max_reps < p.start_reps) { const el = document.getElementById('form-error'); if (el) el.textContent = '„Bis“ muss mindestens so groß sein wie „Start“.'; return; }
  const ex = d.existing;
  // Neues Gewicht, neuer Start oder andere Satzzahl → Plan beginnt diese Woche neu
  if (ex && (Number(ex.kg) !== p.kg || Number(ex.start_reps) !== p.start_reps || Number(ex.sets) !== p.sets)) p.started_on = weekStart(today());
  const saved = await persist(() => db.savePlan(p));
  if (!saved) return;
  S.plans = [...(S.plans || []).filter((x) => x.id !== saved.id), saved];
  S.planDraft = null;
  toast(ex ? 'Plan gespeichert' : 'Plan angelegt – viel Erfolg!');
  goBackTo('#/exercise/' + encodeURIComponent(d.key));
}

async function deletePlanDraft() {
  const d = S.planDraft;
  if (!d || !d.existing) return;
  if (!confirm('Plan löschen? Dein Verlauf bleibt.')) return;
  S.plans = S.plans.filter((x) => x.id !== d.existing.id);
  S.planDraft = null;
  goBackTo('#/exercise/' + encodeURIComponent(d.key));
  await persist(() => db.deletePlan(d.existing.id));
}

export const clicks = {
  'go-back': () => {
    if (history.length > 1) history.back(); else go('#/training');
  },
  'plan-step': ({ id, el }) => stepPlan(id, Number(el.dataset.delta)),
  'plan-save': () => savePlanDraft(),
  'plan-cancel': ({ id }) => {
    S.planDraft = null;
    goBackTo('#/exercise/' + encodeURIComponent(id));
  },
  'plan-delete': () => deletePlanDraft()
};
