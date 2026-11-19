// [D.15][D.12][D.13][A.1] E2E HTTP: servidor Express REAL (puerto efímero, SQLite temporal) probado con fetch.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { after, before, describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { startServer } from '../../src/server/server.js';
import { createFakeClock, FAST, STRONG } from '../helpers/fixtures.js';
import { tempDir } from '../helpers/db.js';

const KEY = 'test-launch-key-0123456789';
const RENDERER = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../src/renderer');

describe('API HTTP', () => {
  let srv, dir, clock;
  before(async () => {
    dir = tempDir('fc-e2e-');
    clock = createFakeClock();
    srv = await startServer({ dbPath: `${dir}/e2e.db`, recoveryDir: `${dir}/rec`, rendererDir: RENDERER, launchKey: KEY, version: '9.9.9', clock, ...FAST });
  });
  after(async () => { await srv.close(); fs.rmSync(dir, { recursive: true, force: true }); });

  /** Llamada a la API; devuelve { status, body, headers }. */
  async function call(method, url, { body, token, key = KEY, headers = {}, raw } = {}) {
    const h = { ...headers };
    if (key) h['X-Launch-Key'] = key;
    if (token) h.Authorization = `Bearer ${token}`;
    if (body !== undefined || raw !== undefined) h['Content-Type'] = 'application/json';
    const res = await fetch(`${srv.baseUrl}/api/v1${url}`, { method, headers: h, body: raw ?? (body === undefined ? undefined : JSON.stringify(body)) });
    const text = await res.text();
    return { status: res.status, headers: res.headers, body: text ? JSON.parse(text) : null };
  }
  const login = async (username, password = STRONG) => (await call('POST', '/auth/login', { body: { username, password } }));
  const tokenOf = async (u, p) => (await login(u, p)).body.data.token;
  let adminToken, catIds;

  describe('arranque del servidor', () => {
    test('escucha en 127.0.0.1 con puerto efímero asignado por el sistema', () => {
      assert.match(srv.baseUrl, /^http:\/\/127\.0\.0\.1:\d+$/);
      assert.ok(srv.port > 1023);
      assert.equal(new URL(srv.baseUrl).hostname, '127.0.0.1');
    });
    test('dos instancias reciben puertos distintos (no hay puerto fijo)', async () => {
      const d2 = tempDir('fc-e2e2-');
      const s2 = await startServer({ dbPath: `${d2}/x.db`, recoveryDir: `${d2}/r`, launchKey: KEY, ...FAST });
      try { assert.notEqual(s2.port, srv.port); } finally { await s2.close(); fs.rmSync(d2, { recursive: true, force: true }); }
    });
    test('rechaza una launchKey demasiado corta', async () => {
      await assert.rejects(() => startServer({ dbPath: ':memory:', recoveryDir: dir, launchKey: 'corta', ...FAST }), /launchKey/);
    });
  });

  describe('X-Launch-Key y guardia de Host', () => {
    test('sin cabecera -> 403 FORBIDDEN_LAUNCH_KEY (incluso en /health)', async () => {
      const r = await call('GET', '/health', { key: null });
      assert.equal(r.status, 403);
      assert.equal(r.body.error.code, 'FORBIDDEN_LAUNCH_KEY');
    });
    test('clave incorrecta -> 403; clave correcta -> 200', async () => {
      assert.equal((await call('GET', '/health', { key: 'otra-clave-distinta-123' })).status, 403);
      const ok = await call('GET', '/health');
      assert.equal(ok.status, 200);
      assert.equal(ok.body.data.status, 'ok');
      assert.equal(ok.body.data.version, '9.9.9');
    });
    test('la clave se exige también en rutas protegidas y de auth', async () => {
      for (const [m, u] of [['GET', '/auth/setup-status'], ['POST', '/auth/login'], ['GET', '/transactions'], ['GET', '/users']]) {
        assert.equal((await call(m, u, { key: null })).status, 403, `${m} ${u}`);
      }
    });
    test('Host distinto de 127.0.0.1:<puerto> -> 403 INVALID_HOST (anti DNS rebinding)', async () => {
      const r = await new Promise((resolve, reject) => {
        const req = http.request({ host: '127.0.0.1', port: srv.port, path: '/api/v1/health', headers: { Host: 'evil.example.com', 'X-Launch-Key': KEY } }, (res) => {
          let d = ''; res.on('data', (c) => (d += c)); res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(d) }));
        });
        req.on('error', reject); req.end();
      });
      assert.equal(r.status, 403);
      assert.equal(r.body.error.code, 'INVALID_HOST');
    });
    test('los errores incluyen requestId y coincide con la cabecera X-Request-Id', async () => {
      const r = await call('GET', '/health', { key: null });
      assert.equal(r.body.error.requestId, r.headers.get('x-request-id'));
      assert.match(r.body.error.requestId, /^[0-9a-f-]{36}$/);
    });
  });

  describe('renderer estático y cabeceras de seguridad', () => {
    test('GET / sirve index.html con la CSP estricta por cabecera (sin necesitar la clave)', async () => {
      const res = await fetch(`${srv.baseUrl}/`);
      assert.equal(res.status, 200);
      const csp = res.headers.get('content-security-policy');
      for (const d of ["default-src 'self'", "script-src 'self'", "style-src 'self'", "object-src 'none'", "frame-ancestors 'none'"]) assert.ok(csp.includes(d), d);
      assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
      assert.ok((await res.text()).includes('<title>FinanzasCardenas</title>'));
    });
    test('módulos JS con MIME correcto y rutas /vendor y /js estables', async () => {
      const js = await fetch(`${srv.baseUrl}/js/core/api.js`);
      assert.match(js.headers.get('content-type'), /javascript/);
      assert.equal((await fetch(`${srv.baseUrl}/css/tokens.css`)).status, 200);
    });
    test('no expone archivos fuera del renderer ni dotfiles', async () => {
      assert.equal((await fetch(`${srv.baseUrl}/..%2f..%2fpackage.json`)).status, 404);
      assert.equal((await fetch(`${srv.baseUrl}/nope.txt`)).status, 404);
    });
    test('las respuestas de la API no se cachean', async () => {
      assert.equal((await call('GET', '/health')).headers.get('cache-control'), 'no-store');
    });
  });

  describe('autenticación y flujo de setup', () => {
    test('rutas protegidas sin token o con token inválido -> 401', async () => {
      for (const u of ['/transactions', '/categories', '/users']) {
        assert.equal((await call('GET', u)).body.error.code, 'UNAUTHENTICATED');
        assert.equal((await call('GET', u, { token: 'inventado' })).status, 401);
      }
      assert.equal((await call('GET', '/transactions', { headers: { Authorization: 'Basic abc' } })).status, 401);
    });

    test('setup-status -> setup (201) -> segundo setup 409; contraseña débil 400 con campo', async () => {
      assert.deepEqual((await call('GET', '/auth/setup-status')).body.data, { needsSetup: true });
      const weak = await call('POST', '/auth/setup', { body: { username: 'admin', displayName: 'Admin', password: 'debil' } });
      assert.equal(weak.status, 400);
      assert.ok(weak.body.error.fields.password);
      const ok = await call('POST', '/auth/setup', { body: { username: 'admin', displayName: 'Admin', password: STRONG } });
      assert.equal(ok.status, 201);
      assert.match(ok.body.data.recoveryKey, /^([A-HJ-NP-Z2-9]{4}-){7}[A-HJ-NP-Z2-9]{4}$/);
      assert.ok(fs.existsSync(path.join(dir, 'rec', 'recovery-key.txt')));
      assert.equal(JSON.stringify(ok.body).includes('scrypt'), false);
      assert.equal((await call('POST', '/auth/setup', { body: { username: 'otro', displayName: 'O', password: STRONG } })).body.error.code, 'SETUP_DONE');
      assert.deepEqual((await call('GET', '/auth/setup-status')).body.data, { needsSetup: false });
    });

    test('login, sesión y logout (la sesión cerrada deja de valer)', async () => {
      const bad = await login('admin', 'incorrecta');
      assert.equal(bad.status, 401);
      assert.equal(bad.body.error.code, 'INVALID_CREDENTIALS');
      assert.equal(bad.body.error.details.attemptsRemaining, 4);
      const ok = await login('admin');
      assert.equal(ok.status, 200);
      adminToken = ok.body.data.token;
      const s = await call('GET', '/auth/session', { token: adminToken });
      assert.equal(s.body.data.user.username, 'admin');
      assert.equal(s.body.data.idleTimeoutMs, 1_800_000);
      const other = await tokenOf('admin');
      assert.equal((await call('POST', '/auth/logout', { token: other })).status, 204);
      assert.equal((await call('GET', '/auth/session', { token: other })).status, 401);
      assert.equal((await call('GET', '/auth/session', { token: adminToken })).status, 200, 'sin logout global');
    });

    test('cuerpo JSON inválido -> 400; cuerpo gigante -> 413', async () => {
      const bad = await call('POST', '/auth/login', { raw: '{no es json' });
      assert.equal(bad.status, 400);
      assert.equal(bad.body.error.code, 'VALIDATION_ERROR');
      const big = await call('POST', '/auth/login', { raw: JSON.stringify({ username: 'x'.repeat(200_000) }) });
      assert.equal(big.status, 413);
    });

    test('ruta inexistente de la API -> 404 NOT_FOUND con el mismo formato', async () => {
      const r = await call('GET', '/nada-por-aqui', { token: adminToken });
      assert.equal(r.status, 404);
      assert.equal(r.body.error.code, 'NOT_FOUND');
    });
  });

  describe('roles, bloqueo y cambio obligatorio de contraseña', () => {
    let editorId, editorToken;
    test('Admin crea un Editor; el Editor queda obligado a cambiar la contraseña', async () => {
      const c = await call('POST', '/users', { token: adminToken, body: { username: 'ana', displayName: 'Ana', role: 'editor', password: STRONG } });
      assert.equal(c.status, 201);
      editorId = c.body.data.id;
      assert.equal(c.body.data.mustChangePassword, true);
      const dup = await call('POST', '/users', { token: adminToken, body: { username: 'ANA', displayName: 'X', role: 'editor', password: STRONG } });
      assert.equal(dup.status, 409);
      assert.ok(dup.body.error.fields.username);
      editorToken = await tokenOf('ana');
    });

    test('con cambio pendiente solo se permite /auth/session, /auth/change-password y logout (403 en el resto)', async () => {
      const blocked = await call('GET', '/categories', { token: editorToken });
      assert.equal(blocked.status, 403);
      assert.equal(blocked.body.error.code, 'PASSWORD_CHANGE_REQUIRED');
      assert.equal((await call('GET', '/auth/session', { token: editorToken })).status, 200);
      const wrong = await call('POST', '/auth/change-password', { token: editorToken, body: { currentPassword: 'x', newPassword: 'Nueva-Clave-2027!' } });
      assert.equal(wrong.status, 400);
      assert.ok(wrong.body.error.fields.currentPassword);
      const ok = await call('POST', '/auth/change-password', { token: editorToken, body: { currentPassword: STRONG, newPassword: 'Nueva-Clave-2027!' } });
      assert.equal(ok.status, 200);
      assert.equal((await call('GET', '/categories', { token: editorToken })).status, 200);
    });

    test('RBAC: el Editor recibe 403 FORBIDDEN en /users y en acciones de Admin; el Admin sí accede', async () => {
      for (const [m, u] of [['GET', '/users'], ['POST', '/users'], ['GET', `/users/${editorId}`], ['POST', `/users/${editorId}/reset-password`], ['POST', `/users/${editorId}/unlock`]]) {
        const r = await call(m, u, { token: editorToken, body: m === 'POST' ? {} : undefined });
        assert.equal(r.status, 403, `${m} ${u}`);
        assert.equal(r.body.error.code, 'FORBIDDEN');
      }
      const list = await call('GET', '/users?sort=username:asc', { token: adminToken });
      assert.equal(list.status, 200);
      assert.deepEqual(list.body.data.map((u) => u.username), ['admin', 'ana']);
      assert.equal(list.body.meta.total, 2);
    });

    test('5 intentos fallidos -> 423 ACCOUNT_LOCKED, la clave correcta tampoco entra, y solo el Admin desbloquea', async () => {
      for (let i = 0; i < 4; i += 1) assert.equal((await login('ana', 'mala')).status, 401);
      const fifth = await login('ana', 'mala');
      assert.equal(fifth.status, 423);
      assert.equal(fifth.body.error.code, 'ACCOUNT_LOCKED');
      assert.equal((await login('ana', 'Nueva-Clave-2027!')).status, 423);
      assert.equal((await call('POST', `/users/${editorId}/unlock`, { token: editorToken })).status, 401, 'su sesión ya no vale: está bloqueada');
      assert.equal((await call('POST', `/users/${editorId}/unlock`, { token: adminToken })).status, 200);
      assert.equal((await login('ana', 'Nueva-Clave-2027!')).status, 200);
    });

    test('reset de contraseña por el Admin devuelve una temporal que obliga a cambiarla', async () => {
      const r = await call('POST', `/users/${editorId}/reset-password`, { token: adminToken });
      assert.equal(r.status, 200);
      const l = await login('ana', r.body.data.temporaryPassword);
      assert.equal(l.status, 200);
      assert.equal(l.body.data.user.mustChangePassword, true);
    });

    test('LAST_ADMIN: no se puede degradar ni desactivar al único Admin (409)', async () => {
      const me = (await call('GET', '/auth/session', { token: adminToken })).body.data.user;
      const r = await call('PATCH', `/users/${me.id}`, { token: adminToken, body: { role: 'editor' } });
      assert.equal(r.status, 409);
      assert.equal(r.body.error.code, 'LAST_ADMIN');
    });
  });

  describe('categorías y movimientos', () => {
    test('categorías de ejemplo y CRUD', async () => {
      const l = await call('GET', '/categories?kind=expense', { token: adminToken });
      assert.equal(l.body.meta.total, 7);
      catIds = Object.fromEntries((await call('GET', '/categories', { token: adminToken })).body.data.map((c) => [c.name, c.id]));
      const c = await call('POST', '/categories', { token: adminToken, body: { name: 'Mascotas', kind: 'expense', color: '#123abc' } });
      assert.equal(c.status, 201);
      assert.equal((await call('POST', '/categories', { token: adminToken, body: { name: 'mascotas', kind: 'expense' } })).status, 409);
      assert.equal((await call('POST', '/categories', { token: adminToken, body: { name: 'X', kind: 'expense', color: 'azul' } })).body.error.fields.color.length > 0, true);
      assert.equal((await call('DELETE', `/categories/${c.body.data.id}`, { token: adminToken })).status, 204);
    });

    test('crear movimientos: 201, validación por campo 400 y categoría de otro tipo 400', async () => {
      const mk = (over) => ({ kind: 'expense', amountCop: 120_000, categoryId: catIds.Vivienda, occurredOn: '2026-11-05', description: 'Arriendo', ...over });
      const ok = await call('POST', '/transactions', { token: adminToken, body: mk() });
      assert.equal(ok.status, 201);
      assert.equal(ok.body.data.category.name, 'Vivienda');
      const bad = await call('POST', '/transactions', { token: adminToken, body: mk({ amountCop: -5, occurredOn: '2026-02-31', description: '' }) });
      assert.equal(bad.status, 400);
      assert.deepEqual(Object.keys(bad.body.error.fields).sort(), ['amountCop', 'description', 'occurredOn']);
      const wrongKind = await call('POST', '/transactions', { token: adminToken, body: mk({ categoryId: catIds.Salario }) });
      assert.ok(wrongKind.body.error.fields.categoryId);
      for (const [d, a, c, desc] of [['2026-11-10', 80_000, 'Alimentación', 'Mercado'], ['2026-10-20', 45_000, 'Transporte', 'Bus']]) {
        await call('POST', '/transactions', { token: adminToken, body: mk({ occurredOn: d, amountCop: a, categoryId: catIds[c], description: desc }) });
      }
      await call('POST', '/transactions', { token: adminToken, body: { kind: 'income', amountCop: 3_000_000, categoryId: catIds.Salario, occurredOn: '2026-11-01', description: 'Nómina' } });
    });

    test('listado con filtros, orden, paginación y meta; orden inválido -> 400', async () => {
      const all = await call('GET', '/transactions', { token: adminToken });
      assert.equal(all.body.meta.total, 4);
      assert.deepEqual(all.body.data.map((t) => t.occurredOn), ['2026-11-10', '2026-11-05', '2026-11-01', '2026-10-20']);
      const f = await call('GET', '/transactions?kind=expense&from=2026-11-01&sort=amount_cop:desc&pageSize=1&page=2', { token: adminToken });
      assert.equal(f.body.data[0].description, 'Mercado');
      assert.deepEqual(f.body.meta, { page: 2, pageSize: 1, total: 2, totalPages: 2 });
      assert.equal((await call('GET', '/transactions?q=n%C3%B3mina', { token: adminToken })).body.meta.total, 1);
      const inj = await call('GET', '/transactions?sort=amount_cop;DROP%20TABLE%20users:asc', { token: adminToken });
      assert.equal(inj.status, 400);
      assert.ok(inj.body.error.fields.sort);
    });

    test('editar y borrar; ids inválidos o inexistentes -> 404', async () => {
      const id = (await call('GET', '/transactions?q=Bus', { token: adminToken })).body.data[0].id;
      const u = await call('PATCH', `/transactions/${id}`, { token: adminToken, body: { amountCop: 50_000 } });
      assert.equal(u.body.data.amountCop, 50_000);
      assert.equal((await call('DELETE', `/transactions/${id}`, { token: adminToken })).status, 204);
      assert.equal((await call('GET', `/transactions/${id}`, { token: adminToken })).status, 404);
      assert.equal((await call('GET', '/transactions/abc', { token: adminToken })).status, 404);
    });

    test('borrar una categoría con movimientos -> 409 IN_USE', async () => {
      const r = await call('DELETE', `/categories/${catIds.Vivienda}`, { token: adminToken });
      assert.equal(r.status, 409);
      assert.equal(r.body.error.code, 'IN_USE');
    });

    test('los agregados mensuales quedaron consistentes con los movimientos tras todo el flujo HTTP', () => {
      const before = srv.container.repos.transactions.readAggregates();
      srv.container.repos.transactions.rebuildAggregates(clock.now().toISOString());
      assert.deepEqual(srv.container.repos.transactions.readAggregates(), before);
      assert.ok(before.length >= 3);
    });
  });

  describe('sesión: inactividad y recuperación por clave', () => {
    test('30 min sin actividad -> 401 SESSION_IDLE y el token queda invalidado', async () => {
      const t = await tokenOf('admin');
      clock.minutes(29);
      assert.equal((await call('GET', '/transactions', { token: t })).status, 200);
      clock.minutes(31);
      const r = await call('GET', '/transactions', { token: t });
      assert.equal(r.status, 401);
      assert.equal(r.body.error.code, 'SESSION_IDLE');
      assert.equal((await call('GET', '/transactions', { token: t })).body.error.code, 'UNAUTHENTICATED');
    });

    test('POST /auth/recover: clave inválida 401; clave válida restablece, rota la clave y entra con la nueva contraseña', async () => {
      const keyFile = fs.readFileSync(path.join(dir, 'rec', 'recovery-key.txt'), 'utf8');
      const key = keyFile.split('\n')[2];
      assert.equal((await call('POST', '/auth/recover', { body: { username: 'admin', recoveryKey: 'AAAA-BBBB', newPassword: 'Recuperada-2028!' } })).body.error.code, 'INVALID_RECOVERY');
      const ok = await call('POST', '/auth/recover', { body: { username: 'admin', recoveryKey: key, newPassword: 'Recuperada-2028!' } });
      assert.equal(ok.status, 200);
      assert.notEqual(ok.body.data.recoveryKey, key);
      assert.equal((await login('admin', STRONG)).status, 401);
      assert.equal((await login('admin', 'Recuperada-2028!')).status, 200);
    });
  });
});
