// Ayudante de pruebas: SQLite REAL (archivo temporal) con las migraciones aplicadas por el migrador. Sin mocks.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { openDatabase } from '../../src/server/infrastructure/db/connection.js';
import { runMigrations } from '../../src/server/infrastructure/db/migrator.js';
import { MIGRATIONS_DIR } from '../../src/server/container.js';

export function tempDir(prefix = 'fc-test-') {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

/** @param {{ upTo?: number }} [options]  upTo: 1 = solo el esquema (sin categorías de ejemplo). */
export function createTestDb({ upTo } = {}) {
  const dir = tempDir();
  const db = openDatabase(path.join(dir, 'test.db'));
  runMigrations(db, { dir: MIGRATIONS_DIR, upTo });
  return {
    db,
    dir,
    cleanup() {
      db.close();
      fs.rmSync(dir, { recursive: true, force: true });
    },
  };
}
