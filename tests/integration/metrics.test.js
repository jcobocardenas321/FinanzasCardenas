// [C.11] Métricas locales: errores, uso por módulo y métricas personalizadas.
import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, test } from 'node:test';
import { errorHandler } from '../../src/server/infrastructure/http/middlewares/error-handler.js';
import { createMetricsService, RETENTION_DAYS } from '../../src/server/modules/metrics/application/metrics-service.js';
import { createTestContainer, rejects, setupAdmin, silentLogger } from '../helpers/fixtures.js';

describe('metrics', () => {
  let c, m, admin;
  beforeEach(async () => { c = createTestContainer(); m = c.services.metrics; admin = (await setupAdmin(c)).admin; });
  afterEach(() => c.cleanup());
  const ev = (over = {}) => ({ kind: 'module_use', module: 'transactions', name: 'open', ...over });

  test('registra eventos con el usuario y valida el formato', async () => {
    const { id } = m.record(admin, ev());
    assert.equal(c.db.prepare('SELECT user_id FROM metric_events WHERE id = ?').get(id).user_id, admin.id);
    await rejects(async () => m.record(admin, ev({ kind: 'otro' })), { fields: 'kind' });
    await rejects(async () => m.record(admin, ev({ module: 'a b!' })), { fields: 'module' });
    await rejects(async () => m.record(admin, ev({ name: '' })), { fields: 'name' });
    await rejects(async () => m.record(admin, ev({ detail: 'x'.repeat(2001) })), { fields: 'detail' });
  });

  test('uso por módulo, errores y métricas personalizadas en el rango (mes actual por defecto)', () => {
    for (const mod of ['transactions', 'transactions', 'budgets']) m.record(admin, ev({ module: mod }));
    m.record(admin, ev({ kind: 'error', module: 'ui', name: 'TypeError', detail: 'x is undefined' }));
    m.record(admin, ev({ kind: 'custom', module: 'dashboard', name: 'export_csv' }));
    const u = m.usage({});
    assert.deepEqual(u.modules.map((x) => [x.module, x.uses]), [['transactions', 2], ['budgets', 1]]);
    assert.equal(u.errors.total, 1);
    assert.deepEqual(u.errors.byModule, [{ module: 'ui', count: 1 }]);
    assert.equal(u.errors.recent[0].detail, 'x is undefined');
    assert.deepEqual(u.custom, [{ module: 'dashboard', name: 'export_csv', count: 1 }]);
  });

  test('el rango excluye eventos de otros meses', () => {
    m.record(admin, ev());
    c.clock.advance(40 * 86_400_000);
    m.record(admin, ev({ module: 'goals' }));
    assert.deepEqual(m.usage({}).modules.map((x) => x.module), ['goals']);
    assert.equal(m.usage({ from: '2026-11-01', to: '2026-12-31' }).modules.length, 2);
  });

  test(`conserva ${RETENTION_DAYS} días y purga lo anterior`, () => {
    m.record(admin, ev());
    c.clock.advance((RETENTION_DAYS - 1) * 86_400_000);
    assert.equal(m.purgeOld(), 0);
    c.clock.advance(2 * 86_400_000);
    assert.equal(m.purgeOld(), 1);
  });

  test('un error 500 se registra en metric_events vía el manejador HTTP, sin romper la respuesta', () => {
    const calls = [];
    const handler = errorHandler(silentLogger, (info) => { calls.push(info); m.recordInternalError(info); });
    const res = { statusCode: 0, body: null, status(s) { this.statusCode = s; return this; }, json(b) { this.body = b; } };
    handler(new Error('fallo inesperado'), { id: 'req-123', method: 'GET', originalUrl: '/api/v1/budgets?month=2026-11', auth: { user: { id: admin.id } } }, res, () => {});
    assert.equal(res.statusCode, 500);
    assert.equal(res.body.error.code, 'INTERNAL');
    assert.equal(res.body.error.message, 'Error interno del servidor', 'no filtra el detalle al cliente');
    assert.equal(calls[0].path, '/api/v1/budgets');
    const row = c.db.prepare("SELECT * FROM metric_events WHERE kind = 'error'").get();
    assert.deepEqual([row.module, row.name, row.user_id], ['http', 'GET /api/v1/budgets', admin.id]);
    assert.ok(row.detail.includes('fallo inesperado') && row.detail.includes('req-123'));
  });

  test('registrar un error interno nunca lanza, aunque la escritura falle', () => {
    const svc = createMetricsService({ repo: { insert() { throw new Error('disco lleno'); } }, clock: c.clock, logger: silentLogger });
    assert.doesNotThrow(() => svc.recordInternalError({ method: 'GET', path: '/x', message: 'm', requestId: 'r', userId: null }));
  });
});
