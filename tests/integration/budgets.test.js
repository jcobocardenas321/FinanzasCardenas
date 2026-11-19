// [A.1][B.6] Presupuestos. El gasto llega por el puerto `spending` (analytics), nunca desde `transactions`.
import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, test } from 'node:test';
import { createBudgetService } from '../../src/server/modules/budgets/application/budget-service.js';
import { createSqliteBudgetRepository } from '../../src/server/modules/budgets/infrastructure/sqlite-budget-repository.js';
import { rejects } from '../helpers/fixtures.js';
import { seedLedger } from '../helpers/ledger.js';

describe('budgets', () => {
  let c, ids, add, admin, b;
  beforeEach(async () => { ({ c, ids, add, admin } = await seedLedger()); b = c.services.budgets; });
  afterEach(() => c.cleanup());

  test('crea/reemplaza (PUT idempotente) y calcula gastado, restante y % con el gasto del mes', () => {
    const r = b.upsert(admin, ids.vivienda, '2026-10', { amountCop: 1_000_000 });
    assert.deepEqual([r.amountCop, r.spentCop, r.remainingCop, r.percentUsed, r.status], [1_000_000, 600_000, 400_000, 60, 'ok']);
    assert.equal(r.category.name, 'Vivienda');
    assert.equal(b.upsert(admin, ids.vivienda, '2026-10', { amountCop: 700_000 }).amountCop, 700_000);
    assert.equal(c.db.prepare('SELECT count(*) AS n FROM budgets').get().n, 1);
  });

  test('estados exactos: 79,9 % ok · 80 % warning · 100 % warning · >100 % over (umbral 80 %)', () => {
    b.upsert(admin, ids.vivienda, '2026-11', { amountCop: 375_000 }); // gasto nov 300.000 = 80 %
    assert.equal(b.list({ month: '2026-11' }).items[0].status, 'warning');
    b.upsert(admin, ids.vivienda, '2026-11', { amountCop: 375_001 });
    assert.equal(b.list({ month: '2026-11' }).items[0].status, 'ok');
    b.upsert(admin, ids.vivienda, '2026-11', { amountCop: 300_000 });
    assert.equal(b.list({ month: '2026-11' }).items[0].status, 'warning');
    b.upsert(admin, ids.vivienda, '2026-11', { amountCop: 299_999 });
    const over = b.list({ month: '2026-11' }).items[0];
    assert.deepEqual([over.status, over.remainingCop], ['over', -1]);
  });

  test('el umbral viene de settings y cambia el estado', () => {
    b.upsert(admin, ids.vivienda, '2026-11', { amountCop: 350_000 }); // 85,7 %
    assert.equal(b.list({ month: '2026-11' }).items[0].status, 'warning');
    c.services.settings.update({ budgetWarningThresholdPct: 90 });
    assert.equal(b.list({ month: '2026-11' }).warningThresholdPct, 90);
    assert.equal(b.list({ month: '2026-11' }).items[0].status, 'ok');
  });

  test('un gasto nuevo se refleja al instante en el presupuesto', () => {
    b.upsert(admin, ids.transporte, '2026-11', { amountCop: 100_000 });
    assert.equal(b.list({}).items[0].spentCop, 0);
    add('expense', ids.transporte, 90_000, '2026-11-08', 'Taxi');
    const item = b.list({}).items[0];
    assert.deepEqual([item.spentCop, item.status], [90_000, 'warning']);
  });

  test('totales del mes y lista vacía en meses sin presupuestos', () => {
    b.upsert(admin, ids.vivienda, '2026-10', { amountCop: 700_000 });
    b.upsert(admin, ids.comida, '2026-10', { amountCop: 300_000 });
    assert.deepEqual(b.list({ month: '2026-10' }).totals, { budgetCop: 1_000_000, spentCop: 1_000_000, remainingCop: 0 });
    assert.deepEqual(b.list({ month: '2026-09' }).items, []);
  });

  test('solo categorías de gasto; categoría inexistente 404; monto y mes inválidos 400', async () => {
    await rejects(async () => b.upsert(admin, ids.salario, '2026-11', { amountCop: 1000 }), { fields: 'categoryId' });
    await rejects(async () => b.upsert(admin, 99999, '2026-11', { amountCop: 1000 }), { status: 404 });
    await rejects(async () => b.upsert(admin, ids.vivienda, '2026-11', { amountCop: 0 }), { fields: 'amountCop' });
    await rejects(async () => b.upsert(admin, ids.vivienda, '2026-13', { amountCop: 1000 }), { fields: 'month' });
    await rejects(async () => b.list({ month: 'x' }), { fields: 'month' });
  });

  test('elimina; borrar uno inexistente da 404; al borrar la categoría sin movimientos se borra su presupuesto', async () => {
    b.upsert(admin, ids.vivienda, '2026-11', { amountCop: 1000 });
    b.remove(ids.vivienda, '2026-11');
    await rejects(async () => b.remove(ids.vivienda, '2026-11'), { status: 404 });
    const free = c.services.categories.create(admin, { name: 'Mascotas', kind: 'expense' });
    b.upsert(admin, free.id, '2026-11', { amountCop: 5000 });
    c.services.categories.remove(free.id);
    assert.equal(c.db.prepare('SELECT count(*) AS n FROM budgets WHERE category_id = ?').get(free.id).n, 0);
  });

  test('DESACOPLADO: con un puerto de gasto falso, budgets usa ese valor (no consulta transactions)', () => {
    const svc = createBudgetService({
      repo: createSqliteBudgetRepository(c.db),
      spending: { getSpentByCategory: () => [{ categoryId: ids.vivienda, spentCop: 50_000 }] },
      categories: { findById: (id) => c.services.categories.get(id) },
      settings: { getBudgetWarningPct: () => 80 },
      clock: c.clock,
    });
    const r = svc.upsert(admin, ids.vivienda, '2026-11', { amountCop: 100_000 });
    assert.deepEqual([r.spentCop, r.percentUsed, r.status], [50_000, 50, 'ok']);
  });
});
