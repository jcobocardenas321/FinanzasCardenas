// [Alcance: reportes] Resumen, detalle imprimible y CSV exportable (sin librerías de PDF).
import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, test } from 'node:test';
import { createReportsService, MAX_DETAIL_ROWS, MAX_EXPORT_ROWS } from '../../src/server/modules/reports/application/reports-service.js';
import { rejects } from '../helpers/fixtures.js';
import { seedLedger } from '../helpers/ledger.js';

describe('reports', () => {
  let c, ids, add, rep;
  beforeEach(async () => { ({ c, ids, add } = await seedLedger()); rep = c.services.reports; });
  afterEach(() => c.cleanup());

  test('resumen del mes actual por defecto, con totales, categorías y porcentajes', () => {
    const s = rep.summary({});
    assert.deepEqual(s.range, { from: '2026-11-01', to: '2026-11-30' });
    assert.deepEqual(s.totals, { incomeCop: 3_000_000, expenseCop: 300_000, netCop: 2_700_000, incomeCount: 1, expenseCount: 1 });
    assert.deepEqual(s.byCategory.expense.map((x) => [x.name, x.percent]), [['Vivienda', 100]]);
  });

  test('resumen de varios meses: por categoría ordenado, por mes y porcentajes que suman 100', () => {
    const s = rep.summary({ from: '2026-06-01', to: '2026-10-31' });
    assert.deepEqual(s.byCategory.expense.map((x) => [x.name, x.totalCop, x.percent]), [['Vivienda', 2_400_000, 60], ['Alimentación', 1_600_000, 40]]);
    assert.deepEqual(s.byMonth.map((m) => m.month), ['2026-06', '2026-07', '2026-09', '2026-10']);
    assert.deepEqual(s.byMonth[0], { month: '2026-06', incomeCop: 3_000_000, expenseCop: 1_000_000, netCop: 2_000_000 });
    assert.equal(s.byCategory.expense.reduce((a, x) => a + x.percent, 0), 100);
  });

  test('precisión de día: solo cuenta los movimientos dentro del rango exacto', () => {
    add('expense', ids.transporte, 10_000, '2026-11-06', 'A');
    add('expense', ids.transporte, 20_000, '2026-11-20', 'B');
    const s = rep.summary({ from: '2026-11-05', to: '2026-11-10' });
    assert.equal(s.totals.expenseCop, 310_000);
    assert.equal(s.totals.incomeCop, 0);
  });

  test('CONSISTENCIA: el resumen (filas) coincide con los KPI (tabla agregada) mes a mes', () => {
    for (const m of ['2026-06', '2026-07', '2026-08', '2026-09', '2026-10', '2026-11']) {
      const s = rep.summary({ from: `${m}-01`, to: `${m}-28` });
      const k = c.services.analytics.kpis({ month: m });
      assert.equal(s.totals.incomeCop, k.incomeMonthCop, m);
      assert.equal(s.totals.expenseCop, k.expenseMonthCop, m);
    }
  });

  test('detalle: filtros por tipo y categoría, orden por fecha, y bandera truncated', () => {
    const d = rep.detail({ from: '2026-06-01', to: '2026-10-31', kind: 'expense', categoryId: String(ids.comida) });
    assert.equal(d.total, 4);
    assert.equal(d.truncated, false);
    assert.deepEqual(d.rows.map((r) => r.occurredOn), ['2026-06-10', '2026-07-10', '2026-09-10', '2026-10-10']);
    const fake = createReportsService({ source: { count: () => MAX_DETAIL_ROWS + 1, rows: (f, limit) => { assert.equal(limit, MAX_DETAIL_ROWS); return []; } }, clock: c.clock });
    assert.equal(fake.detail({}).truncated, true);
  });

  test('CSV: BOM, encabezado en español, CRLF, tipos legibles y nombre de archivo', () => {
    const { filename, content } = rep.csv({ from: '2026-10-01', to: '2026-10-31' });
    assert.equal(filename, 'movimientos_2026-10-01_2026-10-31.csv');
    assert.equal(content.charCodeAt(0), 0xfeff);
    const lines = content.slice(1).split('\r\n');
    assert.equal(lines[0], 'Fecha,Tipo,Categoría,Descripción,Monto (COP),Notas');
    assert.equal(lines[1], '2026-10-01,Ingreso,Salario,Nómina 2026-10,3000000,');
    assert.equal(lines[2], '2026-10-05,Gasto,Vivienda,Arriendo 2026-10,600000,octubre');
    assert.equal(lines.length, 5, '3 filas + encabezado + salto final');
  });

  test('CSV: escapa comas y comillas, neutraliza fórmulas y admite punto y coma', () => {
    add('expense', ids.transporte, 5_000, '2026-11-07', 'Taxi, "rápido"');
    add('expense', ids.transporte, 6_000, '2026-11-08', '=HYPERLINK("http://malo")', '+573001234567');
    const text = rep.csv({ from: '2026-11-07', to: '2026-11-08' }).content;
    assert.ok(text.includes('"Taxi, ""rápido"""'));
    assert.ok(text.includes(`"'=HYPERLINK(""http://malo"")"`));
    assert.ok(text.includes(",'+573001234567"));
    const semi = rep.csv({ from: '2026-11-07', to: '2026-11-07', delimiter: 'semicolon' }).content;
    assert.ok(semi.includes('Fecha;Tipo;Categoría'));
    assert.ok(semi.includes('Taxi, ""rápido""') || semi.includes('"Taxi, ""rápido"""'));
  });

  test('CSV: filtros, rango vacío y límite de exportación', async () => {
    assert.equal(rep.csv({ from: '2026-08-01', to: '2026-08-31' }).content.slice(1).split('\r\n').length, 2);
    assert.equal(rep.csv({ from: '2026-06-01', to: '2026-10-31', kind: 'income' }).content.split('\r\n').length, 6);
    const big = createReportsService({ source: { count: () => MAX_EXPORT_ROWS + 1, rows: () => [] }, clock: c.clock });
    await rejects(async () => big.csv({}), { fields: 'to', status: 400 });
    await rejects(async () => rep.csv({ delimiter: 'tab' }), { fields: 'delimiter' });
    await rejects(async () => rep.csv({ from: '2026-12-01', to: '2026-11-01' }), { fields: 'from' });
  });
});
