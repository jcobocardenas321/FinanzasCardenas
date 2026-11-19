// [D.12] Política de contraseñas fuertes.
import assert from 'node:assert/strict';
import test from 'node:test';
import { checkPassword } from '../../src/server/shared/password-policy.js';

test('acepta una contraseña fuerte', () => assert.deepEqual(checkPassword('Clave-Segura-2026!', { username: 'jaco' }), []));

test('reporta cada requisito faltante', () => {
  const p = checkPassword('abc');
  assert.ok(p.some((m) => m.includes('Mínimo 12')));
  assert.ok(p.some((m) => m.includes('mayúscula')));
  assert.ok(p.some((m) => m.includes('dígito')));
  assert.ok(p.some((m) => m.includes('símbolo')));
  assert.equal(p.some((m) => m.includes('minúscula')), false);
});

test('rechaza contraseñas que contienen el usuario (sin distinguir mayúsculas)', () => {
  assert.ok(checkPassword('Mi-JACO-Clave-2026!', { username: 'jaco' }).some((m) => m.includes('nombre de usuario')));
});

test('el límite superior es 128 caracteres', () => {
  assert.ok(checkPassword(`Aa1!${'x'.repeat(130)}`).some((m) => m.includes('Máximo 128')));
});

test('las letras con tilde cuentan como letras y los espacios como símbolo', () => {
  assert.deepEqual(checkPassword('Ñandú vuela 2026'), []);
});
