// [C.11] Gráficos SVG NATIVOS (sin librerías): barras, líneas y pastel.
// Accesibilidad: <svg role="img" aria-label="…resumen de los datos…">, tabla de datos equivalente (solo lectores de
// pantalla), leyenda con texto, y el contenedor es enfocable: ←/→/Inicio/Fin recorren los datos (tooltip + anuncio).
// Las series se distinguen sin depender del color: leyenda, trama rayada, línea discontinua y marcador distinto.
import { announce } from '../core/a11y.js';
import { h } from '../core/dom.js';
import { formatCop } from '../core/format.js';

const NS = 'http://www.w3.org/2000/svg';
export const svgEl = (tag, attrs = {}, ...children) => {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) if (v !== undefined && v !== null) el.setAttribute(k, String(v));
  el.append(...children);
  return el;
};

// ---------- utilidades puras (probadas con node:test) ----------
/** Máximo "agradable" del eje (1, 2, 5 × 10ⁿ) que contiene al valor. */
export function niceMax(max) {
  if (!(max > 0)) return 1;
  const exp = 10 ** Math.floor(Math.log10(max));
  const f = max / exp;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * exp;
}
/** Rango del eje Y que incluye el cero y admite negativos. */
export function niceRange(values) {
  const hi = Math.max(0, ...values);
  const lo = Math.min(0, ...values);
  return { lo: lo < 0 ? -niceMax(-lo) : 0, hi: hi > 0 ? niceMax(hi) : (lo < 0 ? 0 : 1) };
}
export const ticks = (lo, hi, count = 4) => Array.from({ length: count + 1 }, (_, i) => lo + ((hi - lo) * i) / count);
export const polar = (cx, cy, r, angle) => [cx + r * Math.cos(angle), cy + r * Math.sin(angle)];
export function arcPath(cx, cy, r, a0, a1) {
  const [x0, y0] = polar(cx, cy, r, a0);
  const [x1, y1] = polar(cx, cy, r, a1);
  return `M ${cx} ${cy} L ${x0.toFixed(2)} ${y0.toFixed(2)} A ${r} ${r} 0 ${a1 - a0 > Math.PI ? 1 : 0} 1 ${x1.toFixed(2)} ${y1.toFixed(2)} Z`;
}
export const percentOf = (part, total) => (total === 0 ? 0 : Math.round((part / total) * 1000) / 10);
const compact = new Intl.NumberFormat('es-CO', { notation: 'compact', maximumFractionDigits: 1 });
export const formatAxis = (v) => (v === 0 ? '0' : `${v < 0 ? '−' : ''}$ ${compact.format(Math.abs(v))}`);

// ---------- marco común: tooltip, teclado, leyenda y tabla ----------
let uid = 0;
function frame({ title, svg, items, legend, table, W, H }) {
  const id = `chart-${(uid += 1)}`;
  const tip = h('div', { class: 'chart-tooltip', 'aria-hidden': 'true', hidden: true });
  const wrap = h('div', { class: 'chart-wrap', tabindex: '0', role: 'group', 'aria-roledescription': 'gráfico interactivo', 'aria-label': `${title}. Usa las flechas izquierda y derecha para recorrer los datos.` }, svg, tip);
  let active = -1;
  const show = (i, speak) => {
    active = (i + items.length) % items.length;
    items.forEach((it, n) => it.el.classList.toggle('is-active', n === active));
    const it = items[active];
    tip.hidden = false;
    tip.textContent = it.text;
    tip.style.left = `${(it.x / W) * 100}%`;
    tip.style.top = `${(it.y / H) * 100}%`;
    if (speak) announce(it.text);
  };
  const hide = () => { active = -1; items.forEach((it) => it.el.classList.remove('is-active')); tip.hidden = true; };
  items.forEach((it, i) => it.el.addEventListener('mouseenter', () => show(i, false)));
  wrap.addEventListener('mouseleave', hide);
  wrap.addEventListener('focus', () => { if (active < 0) show(0, true); });
  wrap.addEventListener('blur', hide);
  wrap.addEventListener('keydown', (e) => {
    const next = { ArrowRight: active + 1, ArrowLeft: active - 1, Home: 0, End: items.length - 1 }[e.key];
    if (next === undefined) return;
    e.preventDefault();
    show(next, true);
  });
  return h('section', { class: 'chart-card', 'aria-labelledby': `${id}-h` },
    h('h2', { id: `${id}-h`, class: 'chart-title' }, title), wrap,
    h('ul', { class: 'chart-legend' }, legend.map((l) => h('li', {}, h('span', { class: `swatch f${l.n}${l.hatch ? ' swatch--hatch' : ''}`, 'aria-hidden': 'true' }), l.text))),
    h('table', { class: 'sr-only' }, h('caption', {}, table.caption),
      h('thead', {}, h('tr', {}, table.headers.map((t) => h('th', { scope: 'col' }, t)))),
      h('tbody', {}, table.rows.map((r) => h('tr', {}, r.map((c, i) => (i === 0 ? h('th', { scope: 'row' }, c) : h('td', {}, c))))))));
}

const base = (W, H, label) => svgEl('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': label, focusable: 'false', class: 'chart-svg' }, svgEl('title', {}, label));
const M = { l: 70, r: 16, t: 16, b: 42 };
const summary = (labels, series, fmt) => labels.map((l, i) => `${l}: ${series.map((s) => `${s.name} ${fmt(s.values[i])}`).join(', ')}`).join('. ');

function axes(svg, W, H, lo, hi) {
  const ph = H - M.t - M.b;
  const y = (v) => M.t + ph - ((v - lo) / (hi - lo)) * ph;
  for (const t of ticks(lo, hi)) {
    svg.append(svgEl('line', { class: 'chart-grid', x1: M.l, x2: W - M.r, y1: y(t), y2: y(t) }), svgEl('text', { class: 'chart-text', x: M.l - 8, y: y(t) + 4, 'text-anchor': 'end' }, formatAxis(t)));
  }
  svg.append(svgEl('line', { class: 'chart-axis', x1: M.l, x2: W - M.r, y1: y(0), y2: y(0) }));
  return y;
}

/** Barras agrupadas. series: [{ name, values, n (1–8 color), hatch? }] */
export function barChart({ title, labels, series, formatValue = formatCop }) {
  const W = 640; const H = 320;
  const label = `${title}. ${summary(labels, series, formatValue)}`;
  const svg = base(W, H, label);
  const { lo, hi } = niceRange(series.flatMap((s) => s.values));
  const defs = svgEl('defs');
  const patId = `hatch-${(uid += 1)}`;
  defs.append(svgEl('pattern', { id: patId, width: 6, height: 6, patternUnits: 'userSpaceOnUse' }, svgEl('rect', { width: 6, height: 6, class: `f${series.find((s) => s.hatch)?.n ?? 2}` }), svgEl('path', { d: 'M0 6 L6 0', class: 'hatch-line' })));
  svg.append(defs);
  const y = axes(svg, W, H, lo, hi);
  const gw = (W - M.l - M.r) / labels.length;
  const bw = Math.min(30, (gw * 0.7) / series.length);
  const items = labels.map((l, i) => {
    const x0 = M.l + gw * i;
    const hit = svgEl('rect', { class: 'chart-hit', x: x0, y: M.t, width: gw, height: H - M.t - M.b });
    svg.append(hit);
    series.forEach((s, k) => {
      const bx = x0 + gw / 2 - (bw * series.length) / 2 + bw * k;
      const top = y(Math.max(s.values[i], 0));
      svg.append(svgEl('rect', { class: `chart-bar f${s.n}`, x: bx, y: top, width: bw - 2, height: Math.max(Math.abs(y(s.values[i]) - y(0)), 0), fill: s.hatch ? `url(#${patId})` : undefined }));
    });
    svg.append(svgEl('text', { class: 'chart-text', x: x0 + gw / 2, y: H - 16, 'text-anchor': 'middle' }, l));
    return { el: hit, x: x0 + gw / 2, y: M.t, text: `${l}: ${series.map((s) => `${s.name} ${formatValue(s.values[i])}`).join('; ')}` };
  });
  return frame({ title, label, svg, items, W, H, legend: series.map((s) => ({ n: s.n, hatch: s.hatch, text: s.name })),
    table: { caption: `${title} (datos)`, headers: ['Periodo', ...series.map((s) => s.name)], rows: labels.map((l, i) => [l, ...series.map((s) => formatValue(s.values[i]))]) } });
}

/** Líneas con marcadores. La 2.ª serie en adelante es discontinua. */
export function lineChart({ title, labels, series, formatValue = formatCop }) {
  const W = 640; const H = 320;
  const label = `${title}. ${summary(labels, series, formatValue)}`;
  const svg = base(W, H, label);
  const { lo, hi } = niceRange(series.flatMap((s) => s.values));
  const y = axes(svg, W, H, lo, hi);
  const gw = (W - M.l - M.r) / labels.length;
  const x = (i) => M.l + gw * (i + 0.5);
  series.forEach((s, k) => svg.append(svgEl('path', { class: `chart-line s${s.n}`, 'stroke-dasharray': k > 0 ? '6 4' : undefined, d: s.values.map((v, i) => `${i ? 'L' : 'M'} ${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ') })));
  const items = labels.map((l, i) => {
    const hit = svgEl('rect', { class: 'chart-hit', x: x(i) - gw / 2, y: M.t, width: gw, height: H - M.t - M.b });
    svg.append(hit);
    series.forEach((s, k) => svg.append(k % 2 === 0 ? svgEl('circle', { class: `chart-dot f${s.n}`, cx: x(i), cy: y(s.values[i]), r: 4.5 }) : svgEl('rect', { class: `chart-dot f${s.n}`, x: x(i) - 4, y: y(s.values[i]) - 4, width: 8, height: 8 })));
    svg.append(svgEl('text', { class: 'chart-text', x: x(i), y: H - 16, 'text-anchor': 'middle' }, l));
    return { el: hit, x: x(i), y: M.t, text: `${l}: ${series.map((s) => `${s.name} ${formatValue(s.values[i])}`).join('; ')}` };
  });
  return frame({ title, label, svg, items, W, H, legend: series.map((s) => ({ n: s.n, text: s.name })),
    table: { caption: `${title} (datos)`, headers: ['Periodo', ...series.map((s) => s.name)], rows: labels.map((l, i) => [l, ...series.map((s) => formatValue(s.values[i]))]) } });
}

/** Pastel. slices: [{ label, value }] (color por posición, paleta accesible de 8 tonos). */
export function pieChart({ title, slices, formatValue = formatCop }) {
  const W = 320; const H = 320; const cx = 160; const cy = 160; const r = 140;
  const total = slices.reduce((a, s) => a + s.value, 0);
  const text = (s) => `${s.label}: ${formatValue(s.value)} (${percentOf(s.value, total)} %)`;
  const label = `${title}. ${slices.map(text).join('. ')}`;
  const svg = base(W, H, label);
  let angle = -Math.PI / 2;
  const items = slices.map((s, i) => {
    const sweep = total === 0 ? 0 : (s.value / total) * Math.PI * 2;
    const a0 = angle; angle += sweep;
    const cls = `chart-slice f${(i % 8) + 1}`;
    const el = slices.length === 1 ? svgEl('circle', { class: cls, cx, cy, r }) : svgEl('path', { class: cls, d: arcPath(cx, cy, r, a0, angle - 0.0001) });
    svg.append(el);
    const [ax, ay] = polar(cx, cy, r * 0.62, (a0 + angle) / 2);
    return { el, x: ax, y: ay, text: text(s) };
  });
  return frame({ title, label, svg, items, W, H, legend: slices.map((s, i) => ({ n: (i % 8) + 1, text: `${s.label} · ${percentOf(s.value, total)} %` })),
    table: { caption: `${title} (datos)`, headers: ['Categoría', 'Monto', 'Porcentaje'], rows: slices.map((s) => [s.label, formatValue(s.value), `${percentOf(s.value, total)} %`]) } });
}
