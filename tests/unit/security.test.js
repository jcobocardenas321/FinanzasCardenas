// [D.12] scrypt, tokens, clave de recuperación y contraseñas temporales.
import assert from 'node:assert/strict';
import test from 'node:test';
import { checkPassword } from '../../src/server/shared/password-policy.js';
import { generateTemporaryPassword } from '../../src/server/infrastructure/security/password-generator.js';
import { generateRecoveryKey, hashRecoveryKey, normalizeRecoveryKey, recoveryKeyMatches } from '../../src/server/infrastructure/security/recovery-key.js';
import { createScryptHasher } from '../../src/server/infrastructure/security/scrypt-hasher.js';
import { createTokenService } from '../../src/server/infrastructure/security/token.js';

const hasher = createScryptHasher({ N: 2 ** 10 });

test('scrypt: hash con formato versionado y sal distinta cada vez', async () => {
  const [a, b] = await Promise.all([hasher.hash('Clave-Segura-2026!'), hasher.hash('Clave-Segura-2026!')]);
  assert.match(a, /^scrypt\$1024\$8\$1\$[A-Za-z0-9+/=]+\$[A-Za-z0-9+/=]+$/);
  assert.notEqual(a, b);
});

test('scrypt: verifica la correcta y rechaza la incorrecta', async () => {
  const h = await hasher.hash('Clave-Segura-2026!');
  assert.equal(await hasher.verify('Clave-Segura-2026!', h), true);
  assert.equal(await hasher.verify('clave-segura-2026!', h), false);
});

test('scrypt: hashes mal formados no lanzan, devuelven false', async () => {
  for (const bad of [null, '', 'x', 'scrypt$1$2', 'bcrypt$1$2$3$4$5', 'scrypt$a$b$c$d$e']) {
    assert.equal(await hasher.verify('x', bad), false);
  }
});

test('scrypt: verifica hashes creados con otros parámetros (los lee del propio hash)', async () => {
  const h = await createScryptHasher({ N: 2 ** 11, r: 8, p: 1 }).hash('Clave-Segura-2026!');
  assert.equal(await hasher.verify('Clave-Segura-2026!', h), true);
});

test('scrypt: verifyDummy siempre devuelve false', async () => assert.equal(await hasher.verifyDummy('lo-que-sea'), false));

test('scrypt: usa parámetros seguros por defecto (N=32768, r=8, p=1, keyLen=64) y tiempo de verificación adecuado', async () => {
  const prodHasher = createScryptHasher();
  const pwd = 'Clave-Segura-2026!';
  const h = await prodHasher.hash(pwd);
  const parts = h.split('$');
  assert.equal(parts[0], 'scrypt');
  assert.equal(parts[1], '32768');
  assert.equal(parts[2], '8');
  assert.equal(parts[3], '1');
  const salt = Buffer.from(parts[4], 'base64');
  const key = Buffer.from(parts[5], 'base64');
  assert.equal(salt.length, 16, 'la sal debe tener 16 bytes');
  assert.equal(key.length, 64, 'la clave derivada debe tener 64 bytes');

  const start = performance.now();
  const ok = await prodHasher.verify(pwd, h);
  const duration = performance.now() - start;
  assert.equal(ok, true);
  assert.ok(duration >= 5, `la verificación scrypt debe requerir trabajo de CPU (fue ${duration.toFixed(1)} ms)`);
  assert.ok(duration < 2000, `la verificación no debe demorar más de 2000 ms (fue ${duration.toFixed(1)} ms)`);
});

test('tokens: únicos, opacos y con id = SHA-256 estable', () => {
  const t = createTokenService();
  const a = t.generate();
  const b = t.generate();
  assert.notEqual(a.token, b.token);
  assert.equal(a.token.length, 43);
  assert.equal(t.idOf(a.token), a.id);
  assert.match(a.id, /^[0-9a-f]{64}$/);
});

test('clave de recuperación: 8 grupos de 4, alfabeto sin I/O/0/1, normalizable', () => {
  const k = generateRecoveryKey();
  assert.match(k, /^([A-HJ-NP-Z2-9]{4}-){7}[A-HJ-NP-Z2-9]{4}$/);
  assert.notEqual(k, generateRecoveryKey());
  assert.equal(normalizeRecoveryKey(k.toLowerCase().replaceAll('-', ' ')), k.replaceAll('-', ''));
});

test('clave de recuperación: coincide solo con su hash (tolera formato)', () => {
  const k = generateRecoveryKey();
  const stored = hashRecoveryKey(k);
  assert.equal(recoveryKeyMatches(k.toLowerCase(), stored), true);
  assert.equal(recoveryKeyMatches(generateRecoveryKey(), stored), false);
  assert.equal(recoveryKeyMatches(k, null), false);
  assert.equal(recoveryKeyMatches(k, 'corto'), false);
});

test('contraseñas temporales: siempre cumplen la política fuerte', () => {
  for (let i = 0; i < 300; i += 1) assert.deepEqual(checkPassword(generateTemporaryPassword()), []);
});
