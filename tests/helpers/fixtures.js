// Fixtures de pruebas: contenedor REAL (SQLite temporal), reloj controlable y hasher rápido (solo en tests).
import fs from 'node:fs';
import { createContainer } from '../../src/server/container.js';
import { tempDir } from './db.js';

export const STRONG = 'Clave-Segura-2026!';
export const silentLogger = { info() {}, warn() {}, error() {} };

export function createFakeClock(startIso = '2026-11-12T10:00:00.000Z') {
  let t = Date.parse(startIso);
  return {
    now: () => new Date(t),
    sleep: async () => {},
    advance(ms) { t += ms; },
    minutes(n) { t += n * 60_000; },
  };
}

export const FAST = { hasherOptions: { N: 2 ** 10 }, authOptions: { failureDelayMs: 0 }, logger: silentLogger };

export function createTestContainer(options = {}) {
  const dir = tempDir('fc-c-');
  const clock = options.clock ?? createFakeClock();
  const container = createContainer({ dbPath: `${dir}/t.db`, recoveryDir: `${dir}/rec`, clock, ...FAST, ...options });
  return {
    ...container,
    clock,
    dir,
    cleanup() {
      container.close();
      fs.rmSync(dir, { recursive: true, force: true });
    },
  };
}

/** Crea el Admin inicial y devuelve { admin, recoveryKey } (setup real, incluye recovery-key.txt). */
export async function setupAdmin(c, username = 'admin') {
  const r = await c.services.auth.setup({ username, displayName: 'Administrador', password: STRONG });
  return { admin: r.user, recoveryKey: r.recoveryKey, recoveryKeyFile: r.recoveryKeyFile };
}

/** Admin + un usuario extra con contraseña ya cambiada (sin mustChangePassword). */
export async function addUser(c, { username, role = 'editor', password = STRONG }) {
  const created = await c.services.users.create({ username, displayName: username, role, password });
  c.db.prepare('UPDATE users SET must_change_password = 0 WHERE id = ?').run(created.id);
  return { ...created, mustChangePassword: false };
}

export async function loginAs(c, username, password = STRONG) {
  return c.services.auth.login({ username, password });
}

export async function rejects(fn, expected) {
  try {
    await fn();
  } catch (error) {
    for (const [k, v] of Object.entries(expected)) {
      if (k === 'fields') {
        for (const f of Array.isArray(v) ? v : [v]) if (!(f in (error.fields ?? {}))) throw new Error(`faltó el campo inválido "${f}" en ${JSON.stringify(error.fields)}`, { cause: error });
      } else if (error[k] !== v) {
        throw new Error(`esperaba ${k}=${v} pero fue ${error[k]} (${error.message})`, { cause: error });
      }
    }
    return error;
  }
  throw new Error('debía lanzar y no lanzó');
}
