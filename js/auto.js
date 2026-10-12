// Withings: Trainingsarten und automatisches Abhaken (reine Funktionen, testbar).

// Withings-Trainingsarten (Kategorie-Nummern laut Withings-API) → deutsche Namen.
// Nicht gelistete Nummern erscheinen als „Art 123“ – so sehen wir, falls die Uhr etwas anderes meldet.
export const CATEGORY_NAMES = {
  1: 'Gehen', 2: 'Laufen', 3: 'Wandern', 4: 'Inlineskaten', 5: 'BMX', 6: 'Radfahren', 7: 'Schwimmen',
  8: 'Surfen', 9: 'Kitesurfen', 10: 'Windsurfen', 11: 'Bodyboard', 12: 'Tennis', 13: 'Tischtennis',
  14: 'Squash', 15: 'Badminton', 16: 'Krafttraining', 17: 'Gymnastik', 18: 'Crosstrainer', 19: 'Pilates',
  20: 'Basketball', 21: 'Fußball', 22: 'Football', 23: 'Rugby', 24: 'Volleyball', 25: 'Wasserball',
  26: 'Reiten', 27: 'Golf', 28: 'Yoga', 29: 'Tanzen', 30: 'Boxen', 31: 'Fechten', 32: 'Ringen',
  33: 'Kampfsport', 34: 'Ski', 35: 'Snowboard', 36: 'Sonstiges', 187: 'Rudern', 188: 'Zumba',
  191: 'Baseball', 192: 'Handball', 193: 'Hockey', 194: 'Eishockey', 195: 'Klettern', 196: 'Eislaufen',
  272: 'Multisport', 306: 'Gehen (drinnen)', 307: 'Laufen (drinnen)', 308: 'Radfahren (drinnen)'
};

export function categoryName(cat) {
  return CATEGORY_NAMES[cat] || `Art ${cat}`;
}

// Gruppen für die Auswahl im Formular. -1 = „alle sonstigen“.
export const CATEGORY_GROUPS = [
  { id: 'kraft', label: 'Krafttraining', cats: [16, 17] },
  { id: 'run', label: 'Laufen', cats: [2, 307] },
  { id: 'bike', label: 'Radfahren', cats: [6, 308] },
  { id: 'swim', label: 'Schwimmen', cats: [7] },
  { id: 'walk', label: 'Gehen & Wandern', cats: [1, 306, 3] },
  { id: 'other', label: 'Sonstiges', cats: [-1] }
];
const GROUPED = new Set(CATEGORY_GROUPS.flatMap((g) => g.cats).filter((c) => c > 0));
export const WALKING = new Set([1, 306]);

export function matchesCategories(cat, list) {
  if (!list || list.length === 0) return false;
  if (list.includes(cat)) return true;
  return list.includes(-1) && !GROUPED.has(cat);
}

export function workoutCounts(habit, w) {
  return matchesCategories(w.category, habit.auto_categories) && Number(w.duration_min) >= (habit.auto_min_minutes || 0);
}

export const METRICS = {
  steps: { label: 'Schritte', unit: 'Schritte', of: (a) => a.steps },
  active: { label: 'Aktive Minuten', unit: 'Min.', of: (a) => a.active_minutes },
  distance: { label: 'Strecke', unit: 'km', of: (a) => (a.distance_m != null ? Math.round(a.distance_m / 100) / 10 : null) }
};

function statusFor(h, v) {
  if (h.target && v >= h.target) return 'done';
  if (h.mini_value != null && v >= h.mini_value) return 'mini';
  return 'partial';
}

// Welche Einträge sollen automatisch gesetzt oder aktualisiert werden?
// Regeln: nur ab dem Starttag, nur in den letzten `lookback` Tagen, nie gegen eine Ablehnung,
// und nie über einen Eintrag, den du selbst gemacht hast.
export function autoLogChanges({ habits, logs, workouts, activity, dismissals, today, lookback = 14 }) {
  const fromDay = addDaysStr(today, -(lookback - 1));
  const logKey = new Map(logs.map((l) => [`${l.habit_id}|${l.day}`, l]));
  const dismissed = new Set(dismissals.map((d) => `${d.habit_id}|${d.day}`));
  const changes = [];
  for (const h of habits) {
    if (h.archived) continue;
    if (h.kind === 'check' && h.auto_categories && h.auto_categories.length) {
      const days = new Map();
      for (const w of workouts) {
        if (w.day < fromDay || w.day > today || w.day < h.start_day) continue;
        if (!workoutCounts(h, w)) continue;
        if (!days.has(w.day)) days.set(w.day, w);
      }
      for (const [day] of days) {
        const key = `${h.id}|${day}`;
        if (dismissed.has(key) || logKey.has(key)) continue;
        changes.push({ habit_id: h.id, day, status: 'done', value: null, source: 'withings' });
      }
    }
    if (h.kind === 'count' && h.auto_metric && METRICS[h.auto_metric]) {
      const metric = METRICS[h.auto_metric];
      for (const a of activity) {
        if (a.day < fromDay || a.day > today || a.day < h.start_day) continue;
        const v = metric.of(a);
        if (v == null || v <= 0) continue;
        const key = `${h.id}|${a.day}`;
        if (dismissed.has(key)) continue;
        const existing = logKey.get(key);
        if (existing && existing.source !== 'withings') continue; // selbst eingetragen → nicht anfassen
        const status = statusFor(h, v);
        if (existing && Number(existing.value) === v && existing.status === status) continue;
        changes.push({ habit_id: h.id, day: a.day, status, value: v, source: 'withings' });
      }
    }
  }
  return changes;
}

function addDaysStr(day, n) {
  const [y, m, d] = day.split('-').map(Number);
  const dt = new Date(y, m - 1, d + n, 12);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

// ───────────── Trainings aufbereiten ─────────────

const UNSPECIFIC = new Set([36, 272]); // Sonstiges, Multisport

function specificity(w) {
  if (UNSPECIFIC.has(w.category)) return 0;
  if (WALKING.has(w.category)) return 1;
  return 2;
}

// Gleichzeitige Trainings (z. B. Uhr erkennt „Sonstiges“ und du startest „Krafttraining“) nur einmal zählen:
// Überlappen sich zwei um mehr als die Hälfte der kürzeren Dauer, bleibt das mit der genaueren Art (bei Gleichstand das längere).
export function dedupeWorkouts(workouts) {
  const list = workouts.slice().sort((a, b) => (a.start_at < b.start_at ? -1 : 1));
  const keep = [];
  for (const w of list) {
    const ws = new Date(w.start_at).getTime();
    const we = new Date(w.end_at).getTime();
    let replaced = false;
    let dropped = false;
    for (let i = 0; i < keep.length; i += 1) {
      const k = keep[i];
      const ks = new Date(k.start_at).getTime();
      const ke = new Date(k.end_at).getTime();
      const overlap = Math.min(we, ke) - Math.max(ws, ks);
      const shorter = Math.max(1, Math.min(we - ws, ke - ks));
      if (!Number.isFinite(overlap) || overlap <= shorter / 2) continue;
      const better = specificity(w) > specificity(k) || (specificity(w) === specificity(k) && w.duration_min > k.duration_min);
      if (better) { keep[i] = w; replaced = true; } else { dropped = true; }
      break;
    }
    if (!replaced && !dropped) keep.push(w);
  }
  return keep;
}

// Trainings ohne Gehen, ohne Doppelte, neueste zuerst
export function trainingList(workouts, fromDay, toDay) {
  return dedupeWorkouts(workouts)
    .filter((w) => w.day >= fromDay && w.day <= toDay && !WALKING.has(w.category))
    .sort((a, b) => (a.start_at < b.start_at ? 1 : -1));
}

export function trainingSummary(list) {
  const minutes = list.reduce((s, w) => s + Number(w.duration_min || 0), 0);
  const withHr = list.filter((w) => w.hr_avg);
  const hr = withHr.length ? Math.round(withHr.reduce((s, w) => s + w.hr_avg, 0) / withHr.length) : null;
  return { count: list.length, minutes: Math.round(minutes), hr };
}

// Trainings pro Kalenderwoche (Mo–So), älteste zuerst
export function weeklyTrainingCounts(workouts, today, weeks = 8) {
  const [y, m, d] = today.split('-').map(Number);
  const t = new Date(y, m - 1, d, 12);
  const monday = new Date(t);
  monday.setDate(t.getDate() - ((t.getDay() + 6) % 7));
  const out = [];
  for (let i = weeks - 1; i >= 0; i -= 1) {
    const start = new Date(monday);
    start.setDate(monday.getDate() - i * 7);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    const from = fmtDay(start);
    const to = fmtDay(end);
    const days = new Set(trainingList(workouts, from, to).map((w) => w.day));
    out.push({ from, to, count: days.size, running: i === 0 });
  }
  return out;
}

function fmtDay(dt) {
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

// Pulszonen in Minuten, falls die Uhr sie liefert (Withings: hr_zone_0…3 in Sekunden)
export function heartZones(w) {
  const d = w.data || {};
  const keys = ['hr_zone_0', 'hr_zone_1', 'hr_zone_2', 'hr_zone_3'];
  if (!keys.some((k) => d[k] != null && Number(d[k]) > 0)) return null;
  const labels = ['Leicht', 'Moderat', 'Intensiv', 'Maximal'];
  return keys.map((k, i) => ({ label: labels[i], minutes: Math.round((Number(d[k]) || 0) / 60) }));
}

// Schritte der letzten n Tage (älteste zuerst) + Auswertung
export function stepsSummary(activity, today, days = 30, goal = null) {
  const byDay = new Map(activity.map((a) => [a.day, a]));
  const list = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const day = addDaysStr(today, -i);
    const a = byDay.get(day);
    list.push({ day, steps: a && a.steps != null ? a.steps : null, distance_m: a ? a.distance_m : null });
  }
  const known = list.filter((x) => x.steps != null);
  const past = known.filter((x) => x.day < today);
  const total = known.reduce((s, x) => s + x.steps, 0);
  const km = Math.round(known.reduce((s, x) => s + (Number(x.distance_m) || 0), 0) / 1000);
  const best = known.reduce((b, x) => (!b || x.steps > b.steps ? x : b), null);
  return {
    list,
    today: (byDay.get(today) || {}).steps ?? null,
    avg: past.length ? Math.round(past.reduce((s, x) => s + x.steps, 0) / past.length) : null,
    best,
    total,
    km,
    daysOverGoal: goal ? known.filter((x) => x.steps >= goal).length : null,
    daysKnown: known.length
  };
}

// Kacheln
export function tileValues({ activity, workouts, today }) {
  const byDay = new Map(activity.map((a) => [a.day, a]));
  const t = byDay.get(today) || {};
  let sum = 0;
  let n = 0;
  for (let i = 1; i <= 7; i += 1) {
    const a = byDay.get(addDaysStr(today, -i));
    if (a && a.steps != null) { sum += a.steps; n += 1; }
  }
  const recent = trainingList(workouts, addDaysStr(today, -6), today);
  const minutes = recent.reduce((s, w) => s + Number(w.duration_min || 0), 0);
  return {
    steps: { value: t.steps ?? null, avg7: n ? Math.round(sum / n) : null },
    training: { count: recent.length, minutes: Math.round(minutes) },
    active: { value: t.active_minutes ?? null },
    distance: { value: t.distance_m != null ? Math.round(t.distance_m / 100) / 10 : null }
  };
}
