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
  const from7 = addDaysStr(today, -6);
  const recent = workouts.filter((w) => w.day >= from7 && w.day <= today && !WALKING.has(w.category));
  const minutes = recent.reduce((s, w) => s + Number(w.duration_min || 0), 0);
  return {
    steps: { value: t.steps ?? null, avg7: n ? Math.round(sum / n) : null },
    training: { count: recent.length, minutes: Math.round(minutes) },
    active: { value: t.active_minutes ?? null },
    distance: { value: t.distance_m != null ? Math.round(t.distance_m / 100) / 10 : null }
  };
}
