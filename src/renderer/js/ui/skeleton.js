// [A.4] Esqueletos de carga (se ocultan a lectores de pantalla; el contenedor padre usa aria-busy).
import { h } from '../core/dom.js';

export const skeletonCards = (count = 2) =>
  h('div', { class: 'skeleton-group skeleton-group--cards', 'data-skeleton': 'cards', 'aria-hidden': 'true' },
    Array.from({ length: count }, () => h('div', { class: 'skeleton skeleton--card' })));

export const skeletonRows = (count = 5) =>
  h('div', { class: 'skeleton-group', 'data-skeleton': 'rows', 'aria-hidden': 'true' },
    Array.from({ length: count }, () => h('div', { class: 'skeleton skeleton--row' })));
