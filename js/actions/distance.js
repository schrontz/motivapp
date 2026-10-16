// Aktionen: „Wie weit bin ich gekommen?“ – Zeitraum und Startort (pro Gerät gemerkt).

import { S, local, render } from '../core.js';

export const changes = {
  'dist-range': ({ el }) => {
    S.distRange = el.value;
    local.set('distRange', el.value);
    render();
  },
  'dist-start': ({ el }) => {
    S.distStart = el.value;
    local.set('distStart', el.value);
    render();
  }
};
