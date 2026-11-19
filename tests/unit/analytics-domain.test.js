// [C.11] Fechas locales, media/mediana, tendencias descriptivas, estados de presupuesto y progreso de metas.
import assert from 'node:assert/strict';
import test from 'node:test';
import { daysBetween, firstDayOf, lastDayOf, localIsoDate, localYearMonth, monthsBetween, shiftMonth } from '../../src/server/shared/dates.js';
import { resolveDateRange, resolveMonthRange } from '../../src/server/shared/ranges.js';
import { budgetStatus, percentUsed } from '../../src/server/modules/budgets/domain/budget-status.js';
import { progressOf, syncedStatus } from '../../src/server/modules/goals/domain/goal-progress.js';
import { mean, median, summarize } from '../../src/server/modules/analytics/domain/stats.js';
import { describeTrend } from '../../src/server/modules/analytics/domain/trends.js';

test('fechas: se calculan en hora LOCAL, no UTC', () => {
  const d = new Date(2026, 10, 30, 23, 30); // 30-nov-2026 23:30 local
  assert.equal(localIsoDate(d), '2026-11-30');
  assert.equal(localYearMonth(d), '2026-11');
});

test('shiftMonth / monthsBetween / límites de mes (incluye bisiesto y cambio de año)', () => {
  assert.equal(shiftMonth('2026-01', -1), '2025-12');
  assert.equal(shiftMonth('2026-11', 14), '2028-01');
  assert.deepEqual(monthsBetween('2026-11', '2027-02'), ['2026-11', '2026-12', '2027-01', '2027-02']);
  assert.equal(lastDayOf('2028-02'), '2028-02-29');
  assert.equal(lastDayOf('2026-02'), '2026-02-28');
  assert.equal(firstDayOf('2026-07'), '2026-07-01');
  assert.equal(daysBetween('2026-11-12', '2026-12-12'), 30);
  assert.equal(daysBetween('2026-11-12', '2026-11-10'), -2);
});

test('rangos: por defecto el mes actual; valida orden y tamaño', () => {
  const clock = { now: () => new Date(2026, 10, 12, 12) };
  assert.deepEqual(resolveDateRange({}, clock), { from: '2026-11-01', to: '2026-11-30' });
  assert.throws(() => resolveDateRange({ from: '2026-12-01', to: '2026-11-01' }, clock), (e) => 'from' in e.fields);
  assert.throws(() => resolveDateRange({ from: '2000-01-01', to: '2026-01-01' }, clock, { maxDays: 365 }), (e) => 'to' in e.fields);
  assert.deepEqual(resolveMonthRange({}, { defaultEnd: '2026-11', defaultMonths: 12 }), { from: '2025-12', to: '2026-11' });
  assert.throws(() => resolveMonthRange({ from: '2020-01', to: '2026-01' }, { defaultEnd: '2026-11', maxMonths: 60 }), (e) => 'to' in e.fields);
});

test('media y mediana: impar, par, vacío, un valor y desordenado', () => {
  assert.equal(median([5, 1, 3]), 3);
  assert.equal(median([4, 1, 3, 2]), 2.5);
  assert.equal(median([7]), 7);
  assert.equal(median([]), null);
  assert.equal(mean([]), null);
  assert.equal(mean([1, 2]), 1.5);
  assert.equal(mean([1, 1, 2]), 1.33);
  assert.deepEqual(summarize([100, 300, 200]), { count: 3, totalCop: 600, mean: 200, median: 200 });
  const input = [3, 1, 2];
  median(input);
  assert.deepEqual(input, [3, 1, 2], 'no muta la entrada');
});

const pts = (...v) => v.map((x, i) => ({ month: `2026-0${i + 1}`, totalCop: x, hasData: x > 0 }));

test('tendencia: up / down / flat con umbral del 5 % sobre el promedio previo', () => {
  assert.equal(describeTrend(pts(100, 100, 120)).direction, 'up');
  assert.equal(describeTrend(pts(100, 100, 80)).direction, 'down');
  assert.equal(describeTrend(pts(100, 100, 104)).direction, 'flat');
  assert.equal(describeTrend(pts(100, 100, 105)).direction, 'flat');
});

test('tendencia: variación mensual y casos insuficientes (sin proyecciones)', () => {
  const t = describeTrend(pts(100, 150, 0));
  assert.deepEqual(t.monthly.map((m) => m.changePct), [null, 50, -100]);
  assert.equal(describeTrend(pts(100)).direction, 'insufficient');
  assert.equal(describeTrend(pts(0, 0, 50)).direction, 'insufficient');
  assert.equal(describeTrend([]).direction, 'insufficient');
  assert.equal(describeTrend(pts(0, 100)).monthly[1].changePct, null, 'sin división por cero');
  assert.deepEqual(Object.keys(describeTrend(pts(1, 2, 3))).sort(), ['direction', 'lastVsAveragePct', 'lastVsPreviousPct', 'monthly']);
});

test('presupuesto: ok < umbral <= warning <= 100 % < over', () => {
  const s = (spentCop, warningPct = 80) => budgetStatus({ amountCop: 100_000, spentCop, warningPct });
  assert.equal(s(0), 'ok');
  assert.equal(s(79_999), 'ok');
  assert.equal(s(80_000), 'warning');
  assert.equal(s(100_000), 'warning');
  assert.equal(s(100_001), 'over');
  assert.equal(s(85_000, 90), 'ok');
  assert.equal(percentUsed(300_000, 100_000), 33.3);
});

test('metas: progreso, restante y estado automático', () => {
  assert.deepEqual(progressOf(1000, 250), { savedCop: 250, remainingCop: 750, percent: 25 });
  assert.equal(progressOf(1000, 1500).remainingCop, 0);
  assert.equal(progressOf(1000, 1500).percent, 150);
  assert.equal(syncedStatus({ status: 'active', targetAmountCop: 1000 }, 1000), 'completed');
  assert.equal(syncedStatus({ status: 'completed', targetAmountCop: 1000 }, 999), 'active');
  assert.equal(syncedStatus({ status: 'archived', targetAmountCop: 1000 }, 5000), 'archived');
});
