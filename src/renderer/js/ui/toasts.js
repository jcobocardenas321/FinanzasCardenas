// [A.2][A.4] Toasts no bloqueantes propios. Éxito/info se descartan solos; los errores duran más.
// Se pausan al pasar el cursor o enfocar; tienen botón de cierre accesible. Todo texto vía textContent.
import { h, icon } from '../core/dom.js';
import { EVENTS, on } from '../core/events.js';

const ICONS = { success: 'circle-check', error: 'circle-exclamation', info: 'circle-info', warning: 'triangle-exclamation' };
const DURATION = { success: 6000, info: 6000, warning: 9000, error: 12000 };
const MAX_VISIBLE = 4;

function region() {
  let el = document.getElementById('toast-region');
  if (!el) {
    el = h('div', { id: 'toast-region', role: 'region', 'aria-label': 'Notificaciones' });
    document.body.append(el);
  }
  return el;
}

/** @param {{ type?: 'success'|'error'|'info'|'warning', message: string, title?: string }} options */
export function toast({ type = 'info', message, title }) {
  const root = region();
  const node = h('div', { class: `toast toast--${type}`, role: type === 'error' ? 'alert' : 'status' },
    icon(ICONS[type] ?? ICONS.info, 'toast__icon'),
    h('div', { class: 'toast__body' }, title ? h('strong', { class: 'toast__title' }, title) : null, h('span', {}, message)),
    h('button', { type: 'button', class: 'toast__close', 'aria-label': 'Cerrar notificación', on: { click: () => close() } }, icon('xmark')));

  let timer = null;
  const close = () => { clearTimeout(timer); node.remove(); };
  const start = () => { clearTimeout(timer); timer = setTimeout(close, DURATION[type] ?? 6000); };
  node.addEventListener('mouseenter', () => clearTimeout(timer));
  node.addEventListener('mouseleave', start);
  node.addEventListener('focusin', () => clearTimeout(timer));
  node.addEventListener('focusout', start);

  root.append(node);
  while (root.children.length > MAX_VISIBLE) root.firstElementChild.remove();
  start();
  return close;
}

for (const type of ['success', 'error', 'info', 'warning']) toast[type] = (message, title) => toast({ type, message, title });

/** Permite lanzar toasts desde cualquier módulo con emit(EVENTS.TOAST, { type, message }). */
export const listenToasts = () => on(EVENTS.TOAST, (detail) => toast(detail));
