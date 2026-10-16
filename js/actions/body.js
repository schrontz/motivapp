// Aktionen: Körperwerte – Zeitraum wählen, weitere Werte auf-/zuklappen.

import { S, local, render } from '../core.js';

export const clicks = {
  'body-more': ({ id }) => {
    if (S.bodyOpen.has(id)) S.bodyOpen.delete(id); else S.bodyOpen.add(id);
    render();
  }
};

export const changes = {
  'body-range': ({ el }) => {
    S.bodyRange = el.value;
    local.set('bodyRange', el.value);
    render();
  }
};
