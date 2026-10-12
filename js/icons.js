// Strich-Icons (24×24). Werden per Schlüssel in der Datenbank gespeichert.

export const HABIT_ICONS = {
  check: { label: 'Haken', path: 'M5 12.5l4.5 4.5L19 7.5' },
  dumbbell: { label: 'Hantel', path: 'M6 7v10M18 7v10M3 10v4M21 10v4M6 12h12' },
  run: { label: 'Laufen', path: 'M13 4a1.5 1.5 0 1 0 0 .01M7 21l3-6 3 2v4M10 15l1-5 4 3h3M8 9l3-1' },
  steps: { label: 'Schritte', path: 'M8 3c2 0 3 2 3 5s-1 5-3 5-3-2-3-5 1-5 3-5zM6 16h4v2a2 2 0 0 1-4 0zM16 7c2 0 3 2 3 5s-1 5-3 5-3-2-3-5 1-5 3-5zM14 20h4' },
  drop: { label: 'Tropfen', path: 'M12 3c3.5 4.2 6 7.4 6 10.5a6 6 0 0 1-12 0C6 10.4 8.5 7.2 12 3z' },
  chat: { label: 'Sprache', path: 'M4 5h16v11H9l-5 4z' },
  spark: { label: 'Funke', path: 'M12 3l2.2 6.3L20 12l-5.8 2.7L12 21l-2.2-6.3L4 12l5.8-2.7z' },
  book: { label: 'Buch', path: 'M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2zM4 5v16' },
  moon: { label: 'Mond', path: 'M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z' },
  leaf: { label: 'Blatt', path: 'M5 19c0-9 6-14 15-14 0 9-5 15-14 15M5 19l7-7' },
  glass: { label: 'Glas', path: 'M6 3h12l-1.5 17h-9zM6.8 9h10.4' },
  heart: { label: 'Herz', path: 'M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.5-7 10-7 10z' },
  sun: { label: 'Sonne', path: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4' },
  pen: { label: 'Stift', path: 'M4 20l4-1 11-11-3-3L5 16zM14 6l3 3' }
};

export const UI_ICONS = {
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  back: 'M15 5l-7 7 7 7',
  trend: 'M3 17l6-6 4 4 8-8M15 7h6v6',
  home: 'M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16zM12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z',
  list: 'M9 6h11M9 12h11M9 18h11M4 6h1M4 12h1M4 18h1',
  user: 'M12 4a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM4 21c1.5-4 4.5-6 8-6s6.5 2 8 6'
};

export function svg(path, size = 20, width = 2) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${path}"></path></svg>`;
}

export function habitIcon(key, size = 20) {
  return svg((HABIT_ICONS[key] || HABIT_ICONS.check).path, size);
}

export const COLORS = [
  { id: 'blue', label: 'Blau' },
  { id: 'orange', label: 'Orange' },
  { id: 'teal', label: 'Petrol' },
  { id: 'purple', label: 'Lila' },
  { id: 'pink', label: 'Pink' }
];
