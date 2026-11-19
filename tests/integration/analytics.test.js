// [C.11] Analítica: KPI, series, pastel, media/mediana y EDA. Lee de la tabla agregada.
import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, test } from 'node:test';
import { createTestContainer, rejects } from '../helpers/fixtures.js';
import { seedLedger } from '../helpers/ledger.js';

describe('analytics', () => {
  let c, an, ids, add, admin;
  beforeEach(async () => { ({ c, ids, add, admin } = await seedLedger()); an = c.services.analytics; });
  afterEach(() => c.cleanup());

  test('KPI: Balance Total = Σ ingresos − Σ gastos y Ahorro Mensual = ingresos − gastos del mes (COP)', async () => {
    const k = an.kpis({});
    assert.equal(k.month, '2026-11', 'por defecto, el mes actual del reloj');
    assert.deepEqual([k.totalIncomeCop, k.totalExpenseCop, k.balanceTotalCop], [15_000_000, 4_300_000, 10_700_000]);
    assert.deepEqual([k.incomeMonthCop, k.expenseMonthCop, k.ahorroMensualCop], [3_000_000, 300_000, 2_700_000]);
    assert.equal(an.kpis({ month: '2026-10' }).ahorroMensualCop, 2_000_000);
    assert.equal(an.kpis({ month: '2026-08' }).ahorroMensualCop, 0);
    await rejects(async () => an.kpis({ month: '2026-13' }), { fields: 'month' });
  });

  test('KPI sin datos: todo en cero', () => {
    const empty = createTestContainer();
    try { assert.deepEqual(empty.services.analytics.kpis({}).balanceTotalCop, 0); } finally { empty.cleanup(); }
  });

  test('lee de la tabla AGREGADA: una fila agregada sin movimientos se refleja (no recalcula sobre transactions)', () => {
    c.db.prepare("INSERT INTO agg_monthly_category (year_month, kind, category_id, total_cop, tx_count) VALUES ('2030-01', 'income', ?, 777, 1)").run(ids.salario);
    assert.equal(an.kpis({ month: '2030-01' }).incomeMonthCop, 777);
    assert.equal(c.db.prepare("SELECT count(*) AS n FROM transactions WHERE occurred_on LIKE '2030-%'").get().n, 0);
  });

  test('serie mensual: 12 meses continuos, meses vacíos en 0 con hasData:false, y Σ neto = balance', () => {
    const s = an.series({});
    assert.deepEqual([s.from, s.to, s.points.length], ['2025-12', '2026-11', 12]);
    const aug = s.points.find((p) => p.month === '2026-08');
    assert.deepEqual([aug.incomeCop, aug.expenseCop, aug.netCop, aug.hasData], [0, 0, 0, false]);
    const jun = s.points.find((p) => p.month === '2026-06');
    assert.deepEqual([jun.incomeCop, jun.expenseCop, jun.netCop, jun.txCount], [3_000_000, 1_000_000, 2_000_000, 3]);
    assert.equal(s.points.reduce((a, p) => a + p.netCop, 0), 10_700_000);
    assert.deepEqual(an.series({ from: '2026-10', to: '2026-11' }).points.map((p) => p.month), ['2026-10', '2026-11']);
  });

  test('serie: valida granularidad, orden y tamaño', async () => {
    await rejects(async () => an.series({ granularity: 'day' }), { fields: 'granularity' });
    await rejects(async () => an.series({ from: '2026-11', to: '2026-01' }), { fields: 'from' });
    await rejects(async () => an.series({ from: '2000-01', to: '2026-11' }), { fields: 'to' });
  });

  test('pastel: total, porcentaje por categoría, orden descendente; mes vacío sin categorías', () => {
    const oct = an.breakdown({ month: '2026-10', kind: 'expense' });
    assert.deepEqual(oct.categories.map((x) => [x.name, x.totalCop, x.percent]), [['Vivienda', 600_000, 60], ['Alimentación', 400_000, 40]]);
    assert.equal(oct.totalCop, 1_000_000);
    assert.deepEqual(an.breakdown({}).categories.map((x) => x.percent), [100], 'por defecto: gastos del mes actual');
    assert.deepEqual(an.breakdown({ month: '2026-08' }), { month: '2026-08', kind: 'expense', totalCop: 0, categories: [] });
    assert.equal(an.breakdown({ month: '2026-10', kind: 'income' }).categories[0].name, 'Salario');
  });

  test('media y mediana por movimiento; rango con precisión de día; vacío = null', () => {
    add('expense', ids.transporte, 50_000, '2026-10-20', 'Bus');
    const oct = an.stats({ from: '2026-10-01', to: '2026-10-31' });
    assert.deepEqual(oct.expense, { count: 3, totalCop: 1_050_000, mean: 350_000, median: 400_000 });
    assert.deepEqual(oct.income, { count: 1, totalCop: 3_000_000, mean: 3_000_000, median: 3_000_000 });
    assert.equal(an.stats({ from: '2026-10-20', to: '2026-10-20' }).expense.count, 1);
    assert.deepEqual(an.stats({ from: '2026-08-01', to: '2026-08-31' }).expense, { count: 0, totalCop: 0, mean: null, median: null });
    assert.equal(an.stats({}).expense.count, 1, 'por defecto, el mes actual');
  });

  test('EDA: nulos (notas y autor), meses sin datos y tendencia plana en la ventana por defecto', () => {
    c.db.prepare("UPDATE transactions SET created_by = NULL WHERE occurred_on LIKE '2026-07-%'").run();
    const e = an.eda({});
    assert.deepEqual([e.from, e.to, e.includesIncompleteMonth], ['2026-05', '2026-10', false]);
    assert.equal(e.nulls.totalTransactions, 12);
    assert.deepEqual(e.nulls.notes, { nullCount: 10, nullPct: 83.3 });
    assert.deepEqual(e.nulls.createdBy, { nullCount: 3, nullPct: 25 });
    assert.deepEqual(e.missingMonths, ['2026-05', '2026-08']);
    assert.equal(e.trends.expense.direction, 'flat');
    assert.equal(e.trends.income.direction, 'flat');
  });

  test('EDA: tendencia al alza descriptiva y aviso de mes incompleto', () => {
    add('expense', ids.transporte, 1_000_000, '2026-10-25', 'Viaje');
    const e = an.eda({});
    assert.equal(e.trends.expense.direction, 'up');
    assert.equal(e.trends.expense.lastVsAveragePct, 100);
    assert.equal(an.eda({ to: '2026-11' }).includesIncompleteMonth, true);
    assert.equal(Object.keys(e.trends.expense).some((k) => /forecast|predict|projection/i.test(k)), false);
  });

  test('puerto getSpentByCategory (lo consume budgets): gasto del mes desde la tabla agregada', () => {
    assert.deepEqual(an.getSpentByCategory('2026-10').map((x) => [x.categoryId, x.spentCop]).sort(), [[ids.vivienda, 600_000], [ids.comida, 400_000]].sort());
    assert.deepEqual(an.getSpentByCategory('2026-08'), []);
    assert.throws(() => an.getSpentByCategory('octubre'), (e) => 'month' in e.fields);
    assert.ok(admin.id);
  });
});
