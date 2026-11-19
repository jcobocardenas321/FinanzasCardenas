// [A.4] Estados vacíos con guía (mensaje + acción) y estado de error con reintento.
import { h, icon } from '../core/dom.js';

/** @param {{ icon?: string, title: string, text?: string, actionLabel?: string, onAction?: () => void, level?: 2|3 }} o */
export function emptyState({ icon: name = 'inbox', title, text, actionLabel, onAction, level = 2 }) {
  return h('section', { class: 'empty-state' },
    icon(name, 'empty-state__icon'),
    h(`h${level}`, { class: 'empty-state__title' }, title),
    text ? h('p', { class: 'empty-state__text' }, text) : null,
    actionLabel ? h('button', { type: 'button', class: 'btn btn--primary', on: { click: () => onAction?.() } }, actionLabel) : null);
}

export const errorState = ({ message, onRetry }) =>
  emptyState({ icon: 'plug-circle-exclamation', title: 'No pudimos cargar los datos', text: message, actionLabel: 'Reintentar', onAction: onRetry });
