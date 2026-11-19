// [D.13] Administración de usuarios (Admin/Editor) contra SQLite real.
import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, test } from 'node:test';
import { checkPassword } from '../../src/server/shared/password-policy.js';
import { addUser, createTestContainer, loginAs, rejects, setupAdmin, STRONG } from '../helpers/fixtures.js';

describe('users', () => {
  let c, users, adminId;
  beforeEach(async () => { c = createTestContainer(); users = c.services.users; adminId = (await setupAdmin(c)).admin.id; });
  afterEach(() => c.cleanup());

  test('crea un Editor que debe cambiar su contraseña; nunca expone el hash', async () => {
    const u = await users.create({ username: 'ana', displayName: 'Ana', role: 'editor', password: STRONG });
    assert.equal(u.mustChangePassword, true);
    assert.equal(u.role, 'editor');
    assert.equal('passwordHash' in u, false);
    assert.equal(JSON.stringify(users.get(u.id)).includes('scrypt'), false);
  });

  test('valida entrada: usuario repetido (sin importar mayúsculas), rol, contraseña débil', async () => {
    await users.create({ username: 'ana', displayName: 'Ana', role: 'editor', password: STRONG });
    await rejects(() => users.create({ username: 'ANA', displayName: 'X', role: 'editor', password: STRONG }), { status: 409, fields: 'username' });
    await rejects(() => users.create({ username: 'bob', displayName: 'B', role: 'root', password: STRONG }), { fields: 'role' });
    await rejects(() => users.create({ username: 'bob', displayName: 'B', role: 'editor', password: 'debil' }), { fields: 'password' });
  });

  test('lista con filtro, orden, paginación y meta', async () => {
    for (const n of ['carla', 'beto', 'dana']) await users.create({ username: n, displayName: n.toUpperCase(), role: 'editor', password: STRONG });
    const all = users.list({});
    assert.equal(all.meta.total, 4);
    assert.deepEqual(all.data.map((u) => u.username), ['admin', 'beto', 'carla', 'dana']);
    const page = users.list({ pageSize: '2', page: '2', sort: 'username:desc' });
    assert.deepEqual(page.data.map((u) => u.username), ['beto', 'admin']);
    assert.deepEqual(page.meta, { page: 2, pageSize: 2, total: 4, totalPages: 2 });
    assert.deepEqual(users.list({ role: 'admin' }).data.map((u) => u.username), ['admin']);
    assert.deepEqual(users.list({ q: 'ARL' }).data.map((u) => u.username), ['carla']);
    await rejects(async () => users.list({ sort: 'password_hash:asc' }), { fields: 'sort' });
  });

  test('protege al último Admin activo (LAST_ADMIN) al degradar o desactivar', async () => {
    await rejects(async () => users.update(adminId, { role: 'editor' }), { code: 'LAST_ADMIN', status: 409 });
    await rejects(async () => users.update(adminId, { isActive: false }), { code: 'LAST_ADMIN' });
    const second = await addUser(c, { username: 'root2', role: 'admin' });
    assert.equal(users.update(adminId, { role: 'editor' }).role, 'editor');
    await rejects(async () => users.update(second.id, { isActive: false }), { code: 'LAST_ADMIN' });
  });

  test('desactivar a un usuario revoca sus sesiones al instante', async () => {
    const ana = await addUser(c, { username: 'ana' });
    const { token } = await loginAs(c, 'ana');
    users.update(ana.id, { isActive: false });
    await rejects(async () => c.services.auth.authenticate(token), { code: 'UNAUTHENTICATED' });
  });

  test('reset de contraseña: temporal fuerte, fuerza cambio, desbloquea y revoca sesiones', async () => {
    const ana = await addUser(c, { username: 'ana' });
    const { token } = await loginAs(c, 'ana');
    for (let i = 0; i < 5; i += 1) await rejects(() => loginAs(c, 'ana', 'mala'), {});
    const { temporaryPassword, user } = await users.resetPassword(ana.id);
    assert.deepEqual(checkPassword(temporaryPassword, { username: 'ana' }), []);
    assert.equal(user.mustChangePassword, true);
    assert.equal(user.isLocked, false);
    await rejects(async () => c.services.auth.authenticate(token), { code: 'UNAUTHENTICATED' });
    const session = await loginAs(c, 'ana', temporaryPassword);
    assert.equal(session.user.mustChangePassword, true);
    await rejects(() => loginAs(c, 'ana', STRONG), { code: 'INVALID_CREDENTIALS' });
  });

  test('404 para usuarios inexistentes', async () => {
    await rejects(async () => users.get(999), { status: 404 });
    await rejects(async () => users.unlock(999), { status: 404 });
    await rejects(() => users.resetPassword(999), { status: 404 });
  });
});
