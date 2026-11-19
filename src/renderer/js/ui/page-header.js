// Encabezado de página (h1 + acciones) y etiquetas de estado con texto + ícono (nunca solo color).
import { h, icon } from '../core/dom.js';

export const pageHeader = (title, ...actions) => h('div', { class: 'page-head' }, h('h1', { class: 'page-title' }, title), actions.length ? h('div', { class: 'page-actions' }, actions) : null);

/** @param {'ok'|'warning'|'over'|'info'|'muted'} kind */
export const badge = (text, kind = 'muted', iconName = null) => h('span', { class: `badge badge--${kind}` }, iconName ? icon(iconName) : null, text);
