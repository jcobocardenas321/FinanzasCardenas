// [D.12] Servicio de autenticación contra SQLite real y reloj controlado.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { afterEach, beforeEach, describe, test } from 'node:test';
import { addUser, createTestContainer, loginAs, rejects, setupAdmin, STRONG } from '../helpers/fixtures.js';

describe('auth', () => {
  let c, auth;
  beforeEach(() => { c = createTestContainer(); auth = c.services.auth; });
  afterEach(() => c.cleanup());
  const sessionRow = () => c.db.prepare('SELECT * FROM sessions ORDER BY created_at DESC LIMIT 1').get();

  describe('setup inicial', () => {
    test('crea el Admin, entrega la clave una vez y escribe recovery-key.txt', async () => {
      assert.deepEqual(auth.setupStatus(), { needsSetup: true });
      const { admin, recoveryKey, recoveryKeyFile } = await setupAdmin(c);
      assert.equal(admin.role, 'admin');
      assert.equal(admin.mustChangePassword, false);
      assert.equal('passwordHash' in admin, false);
      assert.match(recoveryKey, /^([A-HJ-NP-Z2-9]{4}-){7}[A-HJ-NP-Z2-9]{4}$/);
      assert.ok(fs.readFileSync(recoveryKeyFile, 'utf8').includes(recoveryKey));
      assert.deepEqual(auth.setupStatus(), { needsSetup: false });
      const stored = c.db.prepare("SELECT value FROM app_settings WHERE key = 'recovery_key_hash'").get().value;
      assert.match(stored, /^[0-9a-f]{64}$/);
      assert.equal(JSON.stringify(c.db.prepare('SELECT * FROM app_settings').all()).includes(recoveryKey), false);
    });

    test('solo puede ejecutarse una vez (409 SETUP_DONE)', async () => {
      await setupAdmin(c);
      await rejects(() => setupAdmin(c, 'otro'), { code: 'SETUP_DONE', status: 409 });
    });

    test('exige contraseña fuerte y usuario válido', async () => {
      await rejects(() => auth.setup({ username: 'admin', displayName: 'A', password: 'debil' }), { code: 'VALIDATION_ERROR', fields: 'password' });
      await rejects(() => auth.setup({ username: 'admin', displayName: 'A', password: 'Admin-Clave-2026!' }), { fields: 'password' });
      await rejects(() => auth.setup({ username: 'a b', displayName: 'A', password: STRONG }), { fields: 'username' });
      assert.deepEqual(auth.setupStatus(), { needsSetup: true });
    });
  });

  describe('login y bloqueo', () => {
    beforeEach(async () => { await setupAdmin(c); await addUser(c, { username: 'ana' }); });

    test('login correcto devuelve token opaco, usuario y vencimiento a 24 h', async () => {
      const r = await loginAs(c, 'ANA'); // usuario sin distinguir mayúsculas
      assert.equal(r.user.username, 'ana');
      assert.equal(r.idleTimeoutMs, 1_800_000);
      assert.equal(Date.parse(r.expiresAt) - c.clock.now().getTime(), 86_400_000);
      assert.equal(c.db.prepare('SELECT count(*) AS n FROM sessions WHERE id = ?').get(r.token).n, 0, 'el token no se guarda en claro');
    });

    test('usuario inexistente y contraseña errónea dan el mismo error genérico', async () => {
      const e1 = await rejects(() => loginAs(c, 'nadie', 'x'), { code: 'INVALID_CREDENTIALS', status: 401 });
      const e2 = await rejects(() => loginAs(c, 'ana', 'x'), { code: 'INVALID_CREDENTIALS', status: 401 });
      assert.equal(e1.message, e2.message);
    });

    test('bloquea tras 5 intentos fallidos y NO se desbloquea con la clave correcta', async () => {
      for (const remaining of [4, 3, 2, 1]) {
        const e = await rejects(() => loginAs(c, 'ana', 'mala'), { code: 'INVALID_CREDENTIALS' });
        assert.equal(e.details.attemptsRemaining, remaining);
      }
      await rejects(() => loginAs(c, 'ana', 'mala'), { code: 'ACCOUNT_LOCKED', status: 423 });
      await rejects(() => loginAs(c, 'ana'), { code: 'ACCOUNT_LOCKED', status: 423 });
      const row = c.db.prepare("SELECT failed_attempts, locked_at FROM users WHERE username = 'ana'").get();
      assert.equal(row.failed_attempts, 5);
      assert.ok(row.locked_at);
    });

    test('un login correcto reinicia el contador', async () => {
      for (let i = 0; i < 3; i += 1) await rejects(() => loginAs(c, 'ana', 'mala'), { code: 'INVALID_CREDENTIALS' });
      await loginAs(c, 'ana');
      const e = await rejects(() => loginAs(c, 'ana', 'mala'), { code: 'INVALID_CREDENTIALS' });
      assert.equal(e.details.attemptsRemaining, 4);
    });

    test('solo un Admin desbloquea: tras unlock el usuario entra', async () => {
      for (let i = 0; i < 5; i += 1) await rejects(() => loginAs(c, 'ana', 'mala'), {});
      const ana = c.db.prepare("SELECT id FROM users WHERE username = 'ana'").get().id;
      c.services.users.unlock(ana);
      assert.ok((await loginAs(c, 'ana')).token);
    });

    test('un usuario desactivado no puede entrar', async () => {
      const ana = c.db.prepare("SELECT id FROM users WHERE username = 'ana'").get().id;
      c.services.users.update(ana, { isActive: false });
      await rejects(() => loginAs(c, 'ana'), { code: 'INVALID_CREDENTIALS' });
    });
  });

  describe('sesión: deslizante 24 h + inactividad 30 min', () => {
    let token;
    beforeEach(async () => { await setupAdmin(c); token = (await loginAs(c, 'admin')).token; });

    test('autentica y devuelve el usuario', () => {
      const r = auth.authenticate(token);
      assert.equal(r.user.username, 'admin');
      assert.equal(r.idleTimeoutMs, 1_800_000);
    });

    test('token ausente o inventado -> UNAUTHENTICATED', async () => {
      await rejects(async () => auth.authenticate(''), { code: 'UNAUTHENTICATED' });
      await rejects(async () => auth.authenticate('inventado'), { code: 'UNAUTHENTICATED' });
    });

    test('a los 30 min exactos sigue válida; a 30 min + 1 s se cierra por inactividad', async () => {
      c.clock.minutes(30);
      assert.ok(auth.authenticate(token));
      c.clock.minutes(30);
      c.clock.advance(1000);
      await rejects(async () => auth.authenticate(token), { code: 'SESSION_IDLE', status: 401 });
      await rejects(async () => auth.authenticate(token), { code: 'UNAUTHENTICATED' }); // ya revocada
    });

    test('la actividad renueva: se puede trabajar 3 h seguidas y el vencimiento se desliza', async () => {
      const first = sessionRow().expires_at;
      for (let i = 0; i < 9; i += 1) { c.clock.minutes(20); assert.ok(auth.authenticate(token)); }
      assert.ok(Date.parse(sessionRow().expires_at) - Date.parse(first) >= 3 * 3600_000 - 60_000);
    });

    test('la renovación se persiste como máximo una vez por minuto', () => {
      c.clock.advance(61_000);
      auth.authenticate(token);
      const t1 = sessionRow().last_activity_at;
      c.clock.advance(10_000);
      auth.authenticate(token);
      assert.equal(sessionRow().last_activity_at, t1);
    });

    test('pasadas las 24 h de vencimiento -> SESSION_EXPIRED', async () => {
      c.db.prepare('UPDATE sessions SET expires_at = ?').run(new Date(c.clock.now().getTime() - 1).toISOString());
      await rejects(async () => auth.authenticate(token), { code: 'SESSION_EXPIRED' });
    });

    test('logout cierra solo la sesión actual (sin logout global)', async () => {
      const other = (await loginAs(c, 'admin')).token;
      auth.logout(auth.authenticate(token).sessionId);
      await rejects(async () => auth.authenticate(token), { code: 'UNAUTHENTICATED' });
      assert.ok(auth.authenticate(other));
    });

    test('si el usuario se bloquea o desactiva, su sesión deja de valer', async () => {
      await addUser(c, { username: 'ana' });
      const t = (await loginAs(c, 'ana')).token;
      const id = c.db.prepare("SELECT id FROM users WHERE username = 'ana'").get().id;
      c.db.prepare('UPDATE users SET locked_at = ? WHERE id = ?').run(c.clock.now().toISOString(), id);
      await rejects(async () => auth.authenticate(t), { code: 'UNAUTHENTICATED' });
    });
  });

  describe('cambio de contraseña', () => {
    test('exige la actual, una fuerte y distinta; revoca las otras sesiones', async () => {
      await setupAdmin(c);
      const s1 = await loginAs(c, 'admin');
      const s2 = await loginAs(c, 'admin');
      const me = auth.authenticate(s1.token);
      const call = (body) => auth.changePassword({ userId: me.user.id, sessionId: me.sessionId, ...body });
      await rejects(() => call({ currentPassword: 'mala', newPassword: 'Nueva-Clave-2027!' }), { fields: 'currentPassword' });
      await rejects(() => call({ currentPassword: STRONG, newPassword: 'debil' }), { fields: 'newPassword' });
      await rejects(() => call({ currentPassword: STRONG, newPassword: STRONG }), { fields: 'newPassword' });
      await call({ currentPassword: STRONG, newPassword: 'Nueva-Clave-2027!' });
      assert.ok(auth.authenticate(s1.token), 'la sesión actual se conserva');
      await rejects(async () => auth.authenticate(s2.token), { code: 'UNAUTHENTICATED' });
      await rejects(() => loginAs(c, 'admin', STRONG), { code: 'INVALID_CREDENTIALS' });
      assert.ok(await loginAs(c, 'admin', 'Nueva-Clave-2027!'));
    });
  });

  describe('recuperación con clave', () => {
    test('restablece al Admin, lo desbloquea, revoca sesiones y ROTA la clave (de un solo uso)', async () => {
      const { recoveryKey, recoveryKeyFile } = await setupAdmin(c);
      const old = (await loginAs(c, 'admin')).token;
      for (let i = 0; i < 5; i += 1) await rejects(() => loginAs(c, 'admin', 'mala'), {});
      await rejects(() => loginAs(c, 'admin'), { code: 'ACCOUNT_LOCKED' });

      const r = await auth.recover({ username: 'admin', recoveryKey: recoveryKey.toLowerCase(), newPassword: 'Despues-De-Recuperar-9!' });
      assert.notEqual(r.recoveryKey, recoveryKey);
      assert.ok(fs.readFileSync(recoveryKeyFile, 'utf8').includes(r.recoveryKey), 'el archivo se sobrescribe con la clave nueva');
      assert.equal(fs.readFileSync(recoveryKeyFile, 'utf8').includes(recoveryKey), false);
      await rejects(async () => auth.authenticate(old), { code: 'UNAUTHENTICATED' });
      assert.ok(await loginAs(c, 'admin', 'Despues-De-Recuperar-9!'));
      await rejects(() => auth.recover({ username: 'admin', recoveryKey, newPassword: 'Otra-Clave-Mas-2028!' }), { code: 'INVALID_RECOVERY', status: 401 });
      assert.ok((await auth.recover({ username: 'admin', recoveryKey: r.recoveryKey, newPassword: 'Tercera-Clave-2029!' })).recoveryKey);
    });

    test('clave incorrecta, usuario inexistente o no-Admin -> INVALID_RECOVERY', async () => {
      const { recoveryKey } = await setupAdmin(c);
      await addUser(c, { username: 'ana' });
      const body = { newPassword: 'Despues-De-Recuperar-9!' };
      await rejects(() => auth.recover({ ...body, username: 'admin', recoveryKey: 'AAAA-AAAA' }), { code: 'INVALID_RECOVERY' });
      await rejects(() => auth.recover({ ...body, username: 'nadie', recoveryKey }), { code: 'INVALID_RECOVERY' });
      await rejects(() => auth.recover({ ...body, username: 'ana', recoveryKey }), { code: 'INVALID_RECOVERY' });
    });

    test('con clave válida pero contraseña débil: 400 y la clave NO se consume', async () => {
      const { recoveryKey } = await setupAdmin(c);
      await rejects(() => auth.recover({ username: 'admin', recoveryKey, newPassword: 'debil' }), { code: 'VALIDATION_ERROR', fields: 'newPassword' });
      assert.ok(await auth.recover({ username: 'admin', recoveryKey, newPassword: 'Despues-De-Recuperar-9!' }));
    });
  });
});
