// [A.1][C.11] Helpers puros de la Fase 3b: montos COP, fechas, categorías y geometría de los gráficos SVG.
import assert from 'node:assert/strict';
import test from 'node:test';

globalThis.window = new EventTarget();
const fmt = await import('../../src/renderer/js/core/format.js');
const { categoriesFor } = await import('../../src/renderer/js/core/categories.js');
const charts = await import('../../src/renderer/js/ui/charts.js');
const { MAX_COP } = await import('../../src/renderer/js/ui/money.js');
const { amountRule } = await import('../../src/renderer/js/ui/money.js');

test('parseCop: acepta separadores de miles y símbolo; rechaza decimales, texto y vacío', () => {
  assert.equal(fmt.parseCop('1.500.000'), 1500000);
  assert.equal(fmt.parseCop('$ 3000000'), 3000000);
  assert.equal(fmt.parseCop(' 42 '), 42);
  for (const bad of ['', 'abc', '1,5', '12.5a', '-10', '1e3']) assert.ok(Number.isNaN(fmt.parseCop(bad)), bad);
});

test('amountRule: entero entre 1 y 9.999.999.999.999', () => {
  assert.equal(amountRule('1.500.000'), null);
  assert.equal(amountRule(String(MAX_COP)), null);
  for (const bad of ['0', '', 'x', String(MAX_COP + 1)]) assert.ok(amountRule(bad), bad);
});

test('fechas: formatDate sin desfase de zona, shiftMonth y monthBounds (bisiesto)', () => {
  assert.match(fmt.formatDate('2026-11-05'), /5 de nov\.? de 2026/);
  assert.equal(fmt.shiftMonth('2026-01', -1), '2025-12');
  assert.equal(fmt.shiftMonth('2026-11', 14), '2028-01');
  assert.deepEqual(fmt.monthBounds('2028-02'), { from: '2028-02-01', to: '2028-02-29' });
  assert.deepEqual(fmt.monthBounds('2026-02'), { from: '2026-02-01', to: '2026-02-28' });
  assert.equal(fmt.todayIso(new Date(2026, 10, 30, 23, 30)), '2026-11-30');
});

test('categoriesFor: filtra por tipo, oculta archivadas y conserva la ya asignada', () => {
  const list = [{ id: 1, kind: 'income', isArchived: false }, { id: 2, kind: 'expense', isArchived: false }, { id: 3, kind: 'expense', isArchived: true }];
  assert.deepEqual(categoriesFor(list, 'expense').map((c) => c.id), [2]);
  assert.deepEqual(categoriesFor(list, 'expense', 3).map((c) => c.id), [2, 3]);
  assert.deepEqual(categoriesFor(list, null).map((c) => c.id), [1, 2]);
});

test('gráficos: niceMax y niceRange (incluye negativos y vacío)', () => {
  assert.equal(charts.niceMax(0), 1);
  assert.equal(charts.niceMax(3_000_000), 5_000_000);
  assert.equal(charts.niceMax(1_000_000), 1_000_000);
  assert.equal(charts.niceMax(1_000_001), 2_000_000);
  assert.deepEqual(charts.niceRange([100, 300]), { lo: 0, hi: 500 });
  assert.deepEqual(charts.niceRange([-300, 100]), { lo: -500, hi: 100 });
  assert.deepEqual(charts.niceRange([-50]), { lo: -50, hi: 0 });
  assert.deepEqual(charts.niceRange([0, 0]), { lo: 0, hi: 1 });
  assert.deepEqual(charts.ticks(0, 100, 4), [0, 25, 50, 75, 100]);
});

test('gráficos: geometría del pastel y porcentajes', () => {
  const [x, y] = charts.polar(0, 0, 10, 0);
  assert.deepEqual([Math.round(x), Math.round(y)], [10, 0]);
  const half = charts.arcPath(100, 100, 50, -Math.PI / 2, Math.PI / 2 - 0.0001);
  assert.match(half, /^M 100 100 L 100\.00 50\.00 A 50 50 0 0 1 /);
  assert.match(charts.arcPath(100, 100, 50, 0, Math.PI * 1.5), / A 50 50 0 1 1 /, 'arco mayor de 180° usa large-arc-flag');
  assert.equal(charts.percentOf(1, 3), 33.3);
  assert.equal(charts.percentOf(5, 0), 0);
  assert.equal(charts.formatAxis(0), '0');
  assert.match(charts.formatAxis(2_500_000), /^\$ 2,5/);
  assert.match(charts.formatAxis(-1_000_000), /^−/);
});
