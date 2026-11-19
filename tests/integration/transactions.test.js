// [A.1][B.8] Movimientos + consistencia de agg_monthly_category dentro de la misma transacción SQL.
import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, test } from 'node:test';
import { withTransaction } from '../../src/server/infrastructure/db/tx.js';
import { createTransactionService } from '../../src/server/modules/transactions/application/transaction-service.js';
import { createTestContainer, rejects, setupAdmin } from '../helpers/fixtures.js';

describe('transactions', () => {
  let c, tx, actor, cat;
  beforeEach(async () => {
    c = createTestContainer();
    tx = c.services.transactions;
    actor = (await setupAdmin(c)).admin;
    const find = (name) => c.services.categories.list({ q: name }).data[0];
    cat = { salario: find('Salario'), vivienda: find('Vivienda'), comida: find('Alimentación'), otrosIng: find('Otros ingresos') };
  });
  afterEach(() => c.cleanup());

  const mk = (over = {}) => ({ kind: 'expense', amountCop: 50_000, categoryId: cat.vivienda.id, occurredOn: '2026-11-05', description: 'Gasto', ...over });
  const agg = () => c.repos.transactions.readAggregates().map((r) => [r.year_month, r.kind, r.category_id, r.total_cop, r.tx_count]);
  const rebuilt = () => {
    const before = agg();
    c.repos.transactions.rebuildAggregates('2026-11-12T00:00:00.000Z');
    const after = agg();
    return { before, after };
  };

  describe('CRUD y validación', () => {
    test('crea, devuelve la categoría embebida y registra autor', () => {
      const t = tx.create(actor, mk({ notes: '  nota ' }));
      assert.equal(t.category.name, 'Vivienda');
      assert.equal(t.createdBy, actor.id);
      assert.equal(t.notes, 'nota');
      assert.equal(tx.create(actor, mk({ notes: '' })).notes, null);
    });

    test('valida monto, fecha, tipo y categoría con mensajes por campo', async () => {
      await rejects(async () => tx.create(actor, mk({ amountCop: 0 })), { fields: 'amountCop' });
      await rejects(async () => tx.create(actor, mk({ amountCop: 10.5 })), { fields: 'amountCop' });
      await rejects(async () => tx.create(actor, mk({ amountCop: '100' })), { fields: 'amountCop' });
      await rejects(async () => tx.create(actor, mk({ occurredOn: '2026-02-30' })), { fields: 'occurredOn' });
      await rejects(async () => tx.create(actor, mk({ description: '   ' })), { fields: 'description' });
      await rejects(async () => tx.create(actor, mk({ categoryId: 9999 })), { fields: 'categoryId' });
      await rejects(async () => tx.create(actor, mk({ kind: 'income' })), { fields: 'categoryId' }); // categoría de gasto
      assert.equal(agg().length, 0, 'nada se agregó');
    });

    test('no permite categorías archivadas al crear, pero sí editar movimientos antiguos', async () => {
      const t = tx.create(actor, mk());
      c.services.categories.update(cat.vivienda.id, { isArchived: true });
      await rejects(async () => tx.create(actor, mk()), { fields: 'categoryId' });
      assert.equal(tx.update(actor, t.id, { description: 'Editado' }).description, 'Editado');
    });

    test('actualiza parcialmente y registra quién editó', () => {
      const t = tx.create(actor, mk());
      const u = tx.update(actor, t.id, { amountCop: 75_000, notes: 'x' });
      assert.deepEqual([u.amountCop, u.notes, u.description], [75_000, 'x', 'Gasto']);
      assert.equal(u.updatedBy, actor.id);
    });

    test('elimina y responde 404 después', async () => {
      const t = tx.create(actor, mk());
      tx.remove(t.id);
      await rejects(async () => tx.get(t.id), { status: 404 });
      await rejects(async () => tx.remove(t.id), { status: 404 });
    });
  });

  describe('agregados mensuales', () => {
    test('alta suma al mes/tipo/categoría correctos', () => {
      tx.create(actor, mk({ amountCop: 100 }));
      tx.create(actor, mk({ amountCop: 250 }));
      tx.create(actor, mk({ kind: 'income', categoryId: cat.salario.id, amountCop: 5000, occurredOn: '2026-10-31' }));
      assert.deepEqual(agg(), [
        ['2026-10', 'income', cat.salario.id, 5000, 1],
        ['2026-11', 'expense', cat.vivienda.id, 350, 2],
      ]);
    });

    test('editar monto, fecha (otro mes), categoría y tipo reubica el agregado', () => {
      const t = tx.create(actor, mk({ amountCop: 100 }));
      tx.update(actor, t.id, { amountCop: 300 });
      assert.deepEqual(agg(), [['2026-11', 'expense', cat.vivienda.id, 300, 1]]);
      tx.update(actor, t.id, { occurredOn: '2026-12-01' });
      assert.deepEqual(agg(), [['2026-12', 'expense', cat.vivienda.id, 300, 1]]);
      tx.update(actor, t.id, { categoryId: cat.comida.id });
      assert.deepEqual(agg(), [['2026-12', 'expense', cat.comida.id, 300, 1]]);
      tx.update(actor, t.id, { kind: 'income', categoryId: cat.otrosIng.id });
      assert.deepEqual(agg(), [['2026-12', 'income', cat.otrosIng.id, 300, 1]]);
    });

    test('editar solo la descripción no toca los agregados', () => {
      const t = tx.create(actor, mk());
      const stamp = c.db.prepare('SELECT updated_at FROM agg_monthly_category').get().updated_at;
      c.clock.minutes(5);
      tx.update(actor, t.id, { description: 'otra' });
      assert.equal(c.db.prepare('SELECT updated_at FROM agg_monthly_category').get().updated_at, stamp);
    });

    test('borrar el último movimiento elimina la fila agregada (sin filas en cero)', () => {
      const a = tx.create(actor, mk({ amountCop: 100 }));
      const b = tx.create(actor, mk({ amountCop: 200 }));
      tx.remove(a.id);
      assert.deepEqual(agg(), [['2026-11', 'expense', cat.vivienda.id, 200, 1]]);
      tx.remove(b.id);
      assert.deepEqual(agg(), []);
    });

    test('un fallo al actualizar el agregado deshace TODO (ROLLBACK atómico)', () => {
      const repo = c.repos.transactions;
      const broken = { ...repo, applyAggregateDelta: () => { throw new Error('fallo simulado en agregado'); } };
      const svc = createTransactionService({
        transactions: broken,
        categories: { findById: (id) => c.services.categories.get(id) },
        unitOfWork: { run: (fn) => withTransaction(c.db, fn) },
        clock: c.clock,
      });
      assert.throws(() => svc.create(actor, mk()), /fallo simulado/);
      assert.equal(c.db.prepare('SELECT count(*) AS n FROM transactions').get().n, 0);
      const ok = tx.create(actor, mk({ amountCop: 100 }));
      assert.throws(() => svc.update(actor, ok.id, { amountCop: 999 }), /fallo simulado/);
      assert.equal(tx.get(ok.id).amountCop, 100);
      assert.throws(() => svc.remove(ok.id), /fallo simulado/);
      assert.ok(tx.get(ok.id));
      assert.deepEqual(agg(), [['2026-11', 'expense', cat.vivienda.id, 100, 1]]);
    });

    test('tras 400 operaciones aleatorias, el agregado incremental == reconstrucción desde cero', () => {
      let seed = 20261112;
      const rnd = (n) => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed % n; };
      const exp = [cat.vivienda.id, cat.comida.id];
      const inc = [cat.salario.id, cat.otrosIng.id];
      const ids = [];
      for (let i = 0; i < 400; i += 1) {
        const op = rnd(10);
        const month = String(1 + rnd(4)).padStart(2, '0');
        const kind = rnd(3) === 0 ? 'income' : 'expense';
        const body = { kind, amountCop: 1 + rnd(100_000), categoryId: (kind === 'income' ? inc : exp)[rnd(2)], occurredOn: `2026-${month}-${String(1 + rnd(28)).padStart(2, '0')}`, description: `op${i}` };
        if (op < 5 || ids.length === 0) ids.push(tx.create(actor, body).id);
        else if (op < 8) tx.update(actor, ids[rnd(ids.length)], body);
        else tx.remove(ids.splice(rnd(ids.length), 1)[0]);
      }
      const { before, after } = rebuilt();
      assert.deepEqual(before, after);
      assert.ok(before.length > 0);
      assert.equal(c.db.prepare('SELECT count(*) AS n FROM transactions').get().n, ids.length);
    });
  });

  describe('listado: filtros, orden y paginación', () => {
    beforeEach(() => {
      tx.create(actor, mk({ amountCop: 100, occurredOn: '2026-11-01', description: 'Arriendo noviembre' }));
      tx.create(actor, mk({ amountCop: 300, occurredOn: '2026-11-10', description: 'Mercado 50% off', categoryId: cat.comida.id }));
      tx.create(actor, mk({ amountCop: 200, occurredOn: '2026-10-15', description: 'Mercado_octubre', categoryId: cat.comida.id }));
      tx.create(actor, mk({ kind: 'income', categoryId: cat.salario.id, amountCop: 9000, occurredOn: '2026-11-03', description: 'Nómina' }));
    });
    const descs = (q) => tx.list(q).data.map((t) => t.description);

    test('orden por defecto: fecha descendente', () => {
      assert.deepEqual(descs({}), ['Mercado 50% off', 'Nómina', 'Arriendo noviembre', 'Mercado_octubre']);
      assert.deepEqual(tx.list({}).data.map((t) => t.occurredOn), ['2026-11-10', '2026-11-03', '2026-11-01', '2026-10-15']);
    });

    test('filtros por tipo, categoría, rango de fechas y montos', () => {
      assert.equal(tx.list({ kind: 'income' }).meta.total, 1);
      assert.equal(tx.list({ categoryId: String(cat.comida.id) }).meta.total, 2);
      assert.equal(tx.list({ from: '2026-11-01', to: '2026-11-05' }).meta.total, 2);
      assert.deepEqual(descs({ minAmount: '200', maxAmount: '300', sort: 'amount_cop:asc' }), ['Mercado_octubre', 'Mercado 50% off']);
    });

    test('la búsqueda trata % y _ como texto literal', () => {
      assert.deepEqual(descs({ q: '50%' }), ['Mercado 50% off']);
      assert.deepEqual(descs({ q: 'o_o' }), ['Mercado_octubre']);
      assert.equal(tx.list({ q: '%' }).meta.total, 1);
    });

    test('ordena por monto, descripción y categoría; desempata por id', () => {
      assert.deepEqual(tx.list({ sort: 'amount_cop:desc' }).data.map((t) => t.amountCop), [9000, 300, 200, 100]);
      assert.deepEqual(descs({ sort: 'description:asc' }), ['Arriendo noviembre', 'Mercado 50% off', 'Mercado_octubre', 'Nómina']);
      assert.equal(tx.list({ sort: 'category:asc' }).data[0].category.name, 'Alimentación');
    });

    test('pagina con meta correcta', () => {
      const p = tx.list({ pageSize: '3', page: '2' });
      assert.equal(p.data.length, 1);
      assert.deepEqual(p.meta, { page: 2, pageSize: 3, total: 4, totalPages: 2 });
    });

    test('rechaza orden inválido y rangos incoherentes', async () => {
      await rejects(async () => tx.list({ sort: 'created_by:asc' }), { fields: 'sort' });
      await rejects(async () => tx.list({ from: '2026-12-01', to: '2026-11-01' }), { fields: 'from' });
      await rejects(async () => tx.list({ minAmount: '10', maxAmount: '5' }), { fields: 'minAmount' });
      await rejects(async () => tx.list({ from: 'ayer' }), { fields: 'from' });
    });
  });
});
