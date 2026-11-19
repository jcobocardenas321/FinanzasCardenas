// [D.12] Reglas de sesión: 24 h deslizante, 30 min de inactividad, 5 intentos.
import assert from 'node:assert/strict';
import test from 'node:test';
import { evaluateSession, IDLE_TIMEOUT_MS, MAX_FAILED_ATTEMPTS, SESSION_TTL_MS, shouldTouch } from '../../src/server/modules/auth/domain/session-policy.js';

const T0 = Date.parse('2026-11-12T10:00:00.000Z');
const session = (over = {}) => ({
  revokedAt: null,
  lastActivityAt: new Date(T0).toISOString(),
  expiresAt: new Date(T0 + SESSION_TTL_MS).toISOString(),
  ...over,
});

test('constantes exigidas por SKILLS.md', () => {
  assert.equal(SESSION_TTL_MS, 24 * 3600_000);
  assert.equal(IDLE_TIMEOUT_MS, 30 * 60_000);
  assert.equal(MAX_FAILED_ATTEMPTS, 5);
});

test('ok dentro de los 30 minutos (límite inclusivo)', () => {
  assert.equal(evaluateSession(session(), T0 + IDLE_TIMEOUT_MS), 'ok');
});

test('idle pasados 30 minutos sin actividad', () => {
  assert.equal(evaluateSession(session(), T0 + IDLE_TIMEOUT_MS + 1), 'idle');
});

test('expired pasadas las 24 h (tiene prioridad sobre idle)', () => {
  assert.equal(evaluateSession(session(), T0 + SESSION_TTL_MS + 1), 'expired');
});

test('revoked siempre gana', () => {
  assert.equal(evaluateSession(session({ revokedAt: new Date(T0).toISOString() }), T0), 'revoked');
});

test('shouldTouch respeta el intervalo de renovación', () => {
  assert.equal(shouldTouch(session(), T0 + 59_000), false);
  assert.equal(shouldTouch(session(), T0 + 60_000), true);
});
