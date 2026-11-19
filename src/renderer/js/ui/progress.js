// [A.1] Barras y anillos de progreso accesibles (role="progressbar" + valores). Sin estilos inline en el marcado:
// el ancho se asigna por CSSOM (permitido por la CSP) y el anillo con atributos SVG.
import { h } from '../core/dom.js';

const NS = 'http://www.w3.org/2000/svg';
const svg = (tag, attrs = {}) => { const el = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v)); return el; };

/** @param {{ percent: number, label: string, status?: 'ok'|'warning'|'over' }} o */
export function progressBar({ percent, label, status = 'ok' }) {
  const clamped = Math.max(0, Math.min(100, percent));
  const bar = h('div', { class: `progress__bar progress__bar--${status}` });
  bar.style.width = `${clamped}%`;
  return h('div', { class: 'progress', role: 'progressbar', 'aria-label': label, 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': String(Math.round(clamped)), 'aria-valuetext': `${percent} %` }, bar);
}

/** Anillo de progreso (metas). */
export function progressRing({ percent, label, size = 96 }) {
  const r = 40;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(100, percent));
  const s = svg('svg', { viewBox: '0 0 100 100', width: size, height: size, 'aria-hidden': 'true', focusable: 'false' });
  s.append(svg('circle', { class: 'ring__track', cx: 50, cy: 50, r, fill: 'none', 'stroke-width': 10 }),
    svg('circle', { class: 'ring__value', cx: 50, cy: 50, r, fill: 'none', 'stroke-width': 10, 'stroke-linecap': 'round', 'stroke-dasharray': `${(clamped / 100) * c} ${c}`, transform: 'rotate(-90 50 50)' }));
  return h('div', { class: 'ring', role: 'progressbar', 'aria-label': label, 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': String(Math.round(clamped)), 'aria-valuetext': `${percent} %` },
    s, h('span', { class: 'ring__text', 'aria-hidden': 'true' }, `${Math.round(percent)} %`));
}
