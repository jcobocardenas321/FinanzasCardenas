// [A.1] Metas de ahorro: progreso, aportes y estado automático. Los aportes NO alteran el Balance Total.
import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, test } from 'node:test';
import { rejects, setupAdmin, createTestContainer } from '../helpers/fixtures.js';

describe('goals', () => {
  let c, g, admin;
  beforeEach(async () => { c = createTestContainer(); g = c.services.goals; admin = (await setupAdmin(c)).admin; });
  afterEach(() => c.cleanup());
  const mk = (over = {}) => g.create(admin, { name: 'Vacaciones', targetAmountCop: 1_000_000, ...over });

  test('crea con progreso en cero y valida los campos', async () => {
    const goal = mk({ targetDate: '2026-12-12' });
    assert.deepEqual([goal.status, goal.savedCop, goal.remainingCop, goal.percent, goal.daysLeft, goal.isOverdue], ['active', 0, 1_000_000, 0, 30, false]);
    await rejects(async () => g.create(admin, { name: '', targetAmountCop: 0, targetDate: '2026-02-30' }), { fields: ['name', 'targetAmountCop', 'targetDate'] });
  });

  test('aportes: suma, porcentaje, restante y se completa sola al llegar a la meta', () => {
    const goal = mk();
    const a = g.addContribution(admin, goal.id, { amountCop: 250_000, contributedOn: '2026-11-01' });
    assert.deepEqual([a.goal.savedCop, a.goal.percent, a.goal.remainingCop, a.goal.status, a.goal.contributionsCount], [250_000, 25, 750_000, 'active', 1]);
    const done = g.addContribution(admin, goal.id, { amountCop: 750_000, contributedOn: '2026-11-10' });
    assert.deepEqual([done.goal.status, done.goal.percent, done.goal.remainingCop], ['completed', 100, 0]);
  });

  test('quitar un aporte reactiva una meta completada; subir la meta también', () => {
    const goal = mk();
    const { contribution } = g.addContribution(admin, goal.id, { amountCop: 1_000_000, contributedOn: '2026-11-01' });
    assert.equal(g.get(goal.id).status, 'completed');
    assert.equal(g.update(goal.id, { targetAmountCop: 2_000_000 }).status, 'active');
    assert.equal(g.update(goal.id, { targetAmountCop: 1_000_000 }).status, 'completed');
    assert.equal(g.removeContribution(goal.id, contribution.id).status, 'active');
    assert.equal(g.get(goal.id).savedCop, 0);
  });

  test('"completed" no se puede fijar a mano; archivar bloquea aportes (409) hasta reactivar', async () => {
    const goal = mk();
    await rejects(async () => g.update(goal.id, { status: 'completed' }), { fields: 'status' });
    assert.equal(g.update(goal.id, { status: 'archived' }).status, 'archived');
    await rejects(async () => g.addContribution(admin, goal.id, { amountCop: 1, contributedOn: '2026-11-01' }), { code: 'GOAL_ARCHIVED', status: 409 });
    assert.equal(g.update(goal.id, { status: 'active' }).status, 'active');
    assert.ok(g.addContribution(admin, goal.id, { amountCop: 1, contributedOn: '2026-11-01' }));
  });

  test('metas vencidas: daysLeft negativo e isOverdue solo si siguen activas', () => {
    const late = mk({ targetDate: '2026-11-01' });
    assert.deepEqual([late.daysLeft, late.isOverdue], [-11, true]);
    g.addContribution(admin, late.id, { amountCop: 1_000_000, contributedOn: '2026-10-30' });
    assert.equal(g.get(late.id).isOverdue, false);
    assert.equal(mk({ targetDate: null }).daysLeft, null);
  });

  test('el detalle trae los aportes (más recientes primero); un aporte ajeno da 404', async () => {
    const a = mk();
    const b = mk({ name: 'Moto' });
    g.addContribution(admin, a.id, { amountCop: 10, contributedOn: '2026-11-01' });
    const second = g.addContribution(admin, a.id, { amountCop: 20, contributedOn: '2026-11-05' }).contribution;
    assert.deepEqual(g.get(a.id).contributions.map((x) => x.amountCop), [20, 10]);
    await rejects(async () => g.removeContribution(b.id, second.id), { status: 404 });
  });

  test('lista con filtro por estado, orden whitelisted y paginación; borrar elimina aportes en cascada', async () => {
    const a = mk({ name: 'B meta' });
    mk({ name: 'a meta' });
    g.update(a.id, { status: 'archived' });
    assert.deepEqual(g.list({ sort: 'name:asc' }).data.map((x) => x.name), ['a meta', 'B meta']);
    assert.equal(g.list({ status: 'archived' }).meta.total, 1);
    await rejects(async () => g.list({ sort: 'created_by:asc' }), { fields: 'sort' });
    g.update(a.id, { status: 'active' });
    g.addContribution(admin, a.id, { amountCop: 5, contributedOn: '2026-11-01' });
    g.remove(a.id);
    assert.equal(c.db.prepare('SELECT count(*) AS n FROM goal_contributions').get().n, 0);
    await rejects(async () => g.get(a.id), { status: 404 });
  });

  test('los aportes NO modifican el Balance Total ni los agregados (decisión #8-A)', () => {
    const goal = mk();
    g.addContribution(admin, goal.id, { amountCop: 500_000, contributedOn: '2026-11-01' });
    assert.equal(c.services.analytics.kpis({}).balanceTotalCop, 0);
    assert.equal(c.db.prepare('SELECT count(*) AS n FROM agg_monthly_category').get().n, 0);
  });
});
