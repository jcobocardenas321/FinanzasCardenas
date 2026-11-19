// [A.1][C.11] E2E HTTP de la Fase 2b: budgets, goals, analytics, reports, metrics y settings sobre el servidor real.
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { startTestServer } from '../helpers/http.js';

describe('API HTTP · Fase 2b', () => {
  let t, call, adminToken, editorToken, cat;
  before(async () => {
    t = await startTestServer();
    call = t.call;
    ({ adminToken, editorToken } = await t.bootstrapUsers());
    const list = (await call('GET', '/categories', { token: adminToken })).body.data;
    cat = Object.fromEntries(list.map((c) => [c.name, c.id]));
    const tx = (body) => call('POST', '/transactions', { token: adminToken, body });
    await tx({ kind: 'income', categoryId: cat.Salario, amountCop: 3_000_000, occurredOn: '2026-11-01', description: 'Nómina' });
    await tx({ kind: 'expense', categoryId: cat.Vivienda, amountCop: 300_000, occurredOn: '2026-11-05', description: 'Arriendo' });
    await tx({ kind: 'expense', categoryId: cat.Alimentación, amountCop: 100_000, occurredOn: '2026-10-10', description: '=SUMA(A1)', notes: 'mercado' });
    await tx({ kind: 'income', categoryId: cat.Salario, amountCop: 3_000_000, occurredOn: '2026-10-01', description: 'Nómina oct' });
  });
  after(() => t.close());

  const ROUTES = [
    ['GET', '/budgets'], ['PUT', '/budgets/1/2026-11'], ['GET', '/goals'], ['POST', '/goals'], ['GET', '/analytics/kpis'], ['GET', '/analytics/series'],
    ['GET', '/analytics/breakdown'], ['GET', '/analytics/stats'], ['GET', '/analytics/eda'], ['GET', '/analytics/usage'], ['GET', '/reports/summary'],
    ['GET', '/reports/detail'], ['GET', '/reports/transactions.csv'], ['POST', '/metrics/events'], ['GET', '/settings'], ['PUT', '/settings'],
  ];

  test('TODAS las rutas nuevas exigen X-Launch-Key (403) y Bearer (401)', async () => {
    for (const [m, u] of ROUTES) {
      const noKey = await call(m, u, { key: null, token: adminToken, body: m === 'GET' ? undefined : {} });
      assert.equal(noKey.status, 403, `${m} ${u} sin launchKey`);
      assert.equal(noKey.body.error.code, 'FORBIDDEN_LAUNCH_KEY');
      const noToken = await call(m, u, { body: m === 'GET' ? undefined : {} });
      assert.equal(noToken.status, 401, `${m} ${u} sin token`);
    }
  });

  test('RBAC: el Editor lee settings y analítica pero recibe 403 en PUT /settings y /analytics/usage; el Admin accede', async () => {
    assert.equal((await call('GET', '/settings', { token: editorToken })).status, 200);
    assert.equal((await call('GET', '/analytics/kpis', { token: editorToken })).status, 200);
    for (const [m, u, body] of [['PUT', '/settings', { householdName: 'X' }], ['GET', '/analytics/usage']]) {
      const r = await call(m, u, { token: editorToken, body });
      assert.equal(r.status, 403, `${m} ${u}`);
      assert.equal(r.body.error.code, 'FORBIDDEN');
    }
    assert.equal((await call('PUT', '/settings', { token: adminToken, body: { householdName: 'Casa Cárdenas' } })).body.data.householdName, 'Casa Cárdenas');
    assert.equal((await call('GET', '/analytics/usage', { token: adminToken })).status, 200);
  });

  test('settings: validación 400 por campo y nunca expone la clave de recuperación', async () => {
    const bad = await call('PUT', '/settings', { token: adminToken, body: { budgetWarningThresholdPct: 10 } });
    assert.equal(bad.status, 400);
    assert.ok(bad.body.error.fields.budgetWarningThresholdPct);
    const got = await call('GET', '/settings', { token: editorToken });
    assert.equal(/recovery|hash|scrypt/i.test(got.text), false);
    assert.equal(got.body.data.currency, 'COP');
  });

  test('analytics: KPI con las fórmulas de SKILLS.md, serie, pastel, estadísticas y EDA', async () => {
    const k = (await call('GET', '/analytics/kpis?month=2026-11', { token: editorToken })).body.data;
    assert.deepEqual([k.balanceTotalCop, k.ahorroMensualCop], [5_600_000, 2_700_000]); // (3M+3M) − (300k+100k)
    const s = (await call('GET', '/analytics/series?from=2026-10&to=2026-11', { token: editorToken })).body.data;
    assert.deepEqual(s.points.map((p) => [p.month, p.netCop]), [['2026-10', 2_900_000], ['2026-11', 2_700_000]]);
    const pie = (await call('GET', '/analytics/breakdown?month=2026-11&kind=expense', { token: editorToken })).body.data;
    assert.deepEqual(pie.categories.map((c) => [c.name, c.percent]), [['Vivienda', 100]]);
    const st = (await call('GET', '/analytics/stats?from=2026-10-01&to=2026-11-30', { token: editorToken })).body.data;
    assert.deepEqual([st.expense.mean, st.expense.median, st.income.count], [200_000, 200_000, 2]);
    const eda = (await call('GET', '/analytics/eda?from=2026-09&to=2026-10', { token: editorToken })).body.data;
    assert.deepEqual(eda.missingMonths, ['2026-09']);
    assert.equal(eda.nulls.totalTransactions, 2);
    assert.equal((await call('GET', '/analytics/series?granularity=week', { token: editorToken })).body.error.fields.granularity.length > 0, true);
  });

  test('budgets: PUT idempotente, estado con el gasto real, categoría de ingreso 400, DELETE 204 y luego 404', async () => {
    const put = await call('PUT', `/budgets/${cat.Vivienda}/2026-11`, { token: editorToken, body: { amountCop: 350_000 } });
    assert.equal(put.status, 200);
    assert.deepEqual([put.body.data.spentCop, put.body.data.status], [300_000, 'warning']);
    const list = (await call('GET', '/budgets?month=2026-11', { token: editorToken })).body.data;
    assert.deepEqual([list.items.length, list.totals.remainingCop, list.warningThresholdPct], [1, 50_000, 80]);
    const inc = await call('PUT', `/budgets/${cat.Salario}/2026-11`, { token: editorToken, body: { amountCop: 1000 } });
    assert.equal(inc.status, 400);
    assert.ok(inc.body.error.fields.categoryId);
    assert.equal((await call('PUT', `/budgets/${cat.Vivienda}/2026-13`, { token: editorToken, body: { amountCop: 1000 } })).status, 400);
    assert.equal((await call('DELETE', `/budgets/${cat.Vivienda}/2026-11`, { token: editorToken })).status, 204);
    assert.equal((await call('DELETE', `/budgets/${cat.Vivienda}/2026-11`, { token: editorToken })).status, 404);
  });

  test('goals: crear, aportar hasta completar, quitar aporte, archivar (409 al aportar) y borrar', async () => {
    const goal = (await call('POST', '/goals', { token: editorToken, body: { name: 'Vacaciones', targetAmountCop: 1_000_000, targetDate: '2027-01-15' } })).body.data;
    const c1 = await call('POST', `/goals/${goal.id}/contributions`, { token: editorToken, body: { amountCop: 1_000_000, contributedOn: '2026-11-10' } });
    assert.equal(c1.status, 201);
    assert.deepEqual([c1.body.data.goal.status, c1.body.data.goal.percent], ['completed', 100]);
    const back = await call('DELETE', `/goals/${goal.id}/contributions/${c1.body.data.contribution.id}`, { token: editorToken });
    assert.equal(back.body.data.status, 'active');
    assert.equal((await call('PATCH', `/goals/${goal.id}`, { token: editorToken, body: { status: 'archived' } })).body.data.status, 'archived');
    const blocked = await call('POST', `/goals/${goal.id}/contributions`, { token: editorToken, body: { amountCop: 5, contributedOn: '2026-11-10' } });
    assert.deepEqual([blocked.status, blocked.body.error.code], [409, 'GOAL_ARCHIVED']);
    assert.equal((await call('POST', '/goals', { token: editorToken, body: { name: '', targetAmountCop: -1 } })).status, 400);
    assert.equal((await call('DELETE', `/goals/${goal.id}`, { token: editorToken })).status, 204);
    assert.equal((await call('GET', `/goals/${goal.id}`, { token: editorToken })).status, 404);
  });

  test('reports: resumen y detalle en JSON', async () => {
    const s = (await call('GET', '/reports/summary?from=2026-10-01&to=2026-11-30', { token: editorToken })).body.data;
    assert.deepEqual([s.totals.incomeCop, s.totals.expenseCop, s.totals.netCop], [6_000_000, 400_000, 5_600_000]);
    assert.deepEqual(s.byMonth.map((m) => m.month), ['2026-10', '2026-11']);
    const d = (await call('GET', '/reports/detail?from=2026-10-01&to=2026-10-31&kind=expense', { token: editorToken })).body.data;
    assert.deepEqual([d.total, d.truncated, d.rows.length], [1, false, 1]);
    assert.equal((await call('GET', '/reports/summary?from=2026-12-01&to=2026-11-01', { token: editorToken })).status, 400);
  });

  test('reports CSV: text/csv, adjunto con nombre, BOM, CRLF y fórmulas neutralizadas', async () => {
    const r = await call('GET', '/reports/transactions.csv?from=2026-10-01&to=2026-10-31&delimiter=semicolon', { token: editorToken });
    assert.equal(r.status, 200);
    assert.match(r.headers.get('content-type'), /^text\/csv; charset=utf-8/);
    assert.equal(r.headers.get('content-disposition'), 'attachment; filename="movimientos_2026-10-01_2026-10-31.csv"');
    assert.deepEqual([...r.bytes.subarray(0, 3)], [0xef, 0xbb, 0xbf], 'BOM UTF-8 en los bytes de la respuesta');
    assert.ok(r.text.includes('\r\n') && !/[^\r]\n/.test(r.text.replace(/"[^"]*"/g, '')), 'fin de línea CRLF');
    assert.ok(r.text.includes('Fecha;Tipo;Categoría;Descripción;Monto (COP);Notas\r\n'));
    assert.ok(r.text.includes("'=SUMA(A1)"), 'una descripción que empieza con = no se ejecuta como fórmula en Excel');
    assert.equal((await call('GET', '/reports/transactions.csv?delimiter=tab', { token: editorToken })).status, 400);
  });

  test('metrics: POST /metrics/events 201/400 y el Admin ve el uso por módulo', async () => {
    assert.equal((await call('POST', '/metrics/events', { token: editorToken, body: { kind: 'module_use', module: 'dashboard', name: 'open' } })).status, 201);
    const bad = await call('POST', '/metrics/events', { token: editorToken, body: { kind: 'x', module: 'a b', name: '' } });
    assert.equal(bad.status, 400);
    assert.deepEqual(Object.keys(bad.body.error.fields).sort(), ['kind', 'module', 'name']);
    const usage = (await call('GET', '/analytics/usage', { token: adminToken })).body.data;
    assert.ok(usage.modules.some((m) => m.module === 'dashboard' && m.uses === 1));
  });

  test('un error interno responde 500 genérico y queda registrado en metric_events', async () => {
    const db = t.srv.container.db;
    db.exec('ALTER TABLE budgets RENAME TO budgets_tmp');
    try {
      const r = await call('GET', '/budgets?month=2026-11', { token: editorToken });
      assert.equal(r.status, 500);
      assert.equal(r.body.error.code, 'INTERNAL');
      assert.equal(/budgets|SQLITE|no such table/i.test(r.text), false, 'no filtra detalles internos');
    } finally {
      db.exec('ALTER TABLE budgets_tmp RENAME TO budgets');
    }
    const usage = (await call('GET', '/analytics/usage', { token: adminToken })).body.data;
    assert.equal(usage.errors.total, 1);
    assert.equal(usage.errors.recent[0].module, 'http');
    assert.ok(usage.errors.recent[0].detail.includes(r500id(usage)));
  });

  test('sin tiempo real por servidor: no existen rutas SSE/WebSocket (reactividad = store del frontend)', async () => {
    for (const u of ['/events', '/stream', '/ws', '/analytics/stream']) assert.equal((await call('GET', u, { token: adminToken })).status, 404, u);
  });
});

const r500id = (usage) => usage.errors.recent[0].detail.match(/\[([0-9a-f-]{36})\]/)?.[1] ?? '';
