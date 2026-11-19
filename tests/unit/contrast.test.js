// [A.2] WCAG AA: contraste de los tokens de color (texto >= 4.5:1, componentes de UI y foco >= 3:1).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const css = fs.readFileSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../src/renderer/css/tokens.css'), 'utf8');
const tokens = Object.fromEntries([...css.matchAll(/--fc-([a-z0-9-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)].map((m) => [m[1], m[2]]));

const lum = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
export const ratio = (a, b) => { const [x, y] = [lum(tokens[a]), lum(tokens[b])].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

const TEXT = [
  ['text', 'surface'], ['text', 'bg'], ['text-muted', 'surface'], ['text-muted', 'bg'], ['on-primary', 'primary'], ['on-primary', 'primary-hover'],
  ['on-danger', 'danger'], ['on-secondary', 'secondary-bg'], ['primary', 'surface'], ['primary', 'bg'], ['danger', 'surface'], ['danger', 'bg'],
  ['success-text', 'success-bg'], ['success-text', 'surface'], ['error-text', 'error-bg'], ['info-text', 'info-bg'], ['warning-text', 'warning-bg'],
  ['nav-text', 'nav-bg'], ['nav-text', 'nav-hover-bg'], ['nav-active-text', 'nav-active-bg'],
];
const UI = [
  ['border', 'surface'], ['focus', 'surface'], ['focus', 'bg'], ['nav-focus', 'nav-bg'], ['nav-focus', 'nav-hover-bg'], ['danger', 'surface'],
  ['chart-1', 'surface'], ['chart-2', 'surface'], ['chart-3', 'surface'], ['chart-4', 'surface'], ['chart-5', 'surface'], ['chart-6', 'surface'], ['chart-7', 'surface'], ['chart-8', 'surface'],
  ['success-border', 'track'], ['warning-border', 'track'], ['error-border', 'track'], ['primary', 'track'],
  ['success-border', 'success-bg'], ['error-border', 'error-bg'], ['info-border', 'info-bg'], ['warning-border', 'warning-bg'],
];

test('se leyeron todos los tokens de color', () => {
  for (const [a, b] of [...TEXT, ...UI]) assert.ok(tokens[a] && tokens[b], `${a}/${b}`);
});
test('texto: contraste >= 4.5:1 (WCAG AA)', () => {
  for (const [a, b] of TEXT) assert.ok(ratio(a, b) >= 4.5, `${a} sobre ${b}: ${ratio(a, b).toFixed(2)}`);
});
test('componentes de UI, bordes y anillo de foco: contraste >= 3:1 (WCAG 1.4.11)', () => {
  for (const [a, b] of UI) assert.ok(ratio(a, b) >= 3, `${a} sobre ${b}: ${ratio(a, b).toFixed(2)}`);
});
test('el cálculo es correcto (blanco/negro = 21:1)', () => {
  tokens.__w = '#ffffff'; tokens.__b = '#000000';
  assert.equal(Math.round(ratio('__w', '__b')), 21);
});
