// [B.7] Migraciones versionadas con checksum. Tabla: schema_migrations(version, name, checksum, applied_at).
// - Aplica en orden, cada migración dentro de una transacción (si falla, ROLLBACK y no se registra).
// - Si una migración ya aplicada cambió en disco (checksum distinto) aborta el arranque.
// - El checksum normaliza CRLF -> LF para no romperse con el autocrlf de Git en Windows.
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const FILE_RE = /^(\d{3,})_([a-z0-9_]+)\.sql$/;

export class MigrationError extends Error {
  constructor(message, options) {
    super(message, options);
    this.name = 'MigrationError';
  }
}

const checksumOf = (sql) => createHash('sha256').update(sql.replace(/\r\n/g, '\n')).digest('hex');

export function loadMigrations(dir) {
  return fs
    .readdirSync(dir)
    .map((file) => ({ file, m: FILE_RE.exec(file) }))
    .filter((x) => x.m)
    .map(({ file, m }) => {
      const sql = fs.readFileSync(path.join(dir, file), 'utf8');
      return { version: Number(m[1]), name: m[2], file, sql, checksum: checksumOf(sql) };
    })
    .sort((a, b) => a.version - b.version);
}

/**
 * @param {import('better-sqlite3').Database} db
 * @param {{ dir: string, upTo?: number, logger?: { info: Function } }} options
 * @returns {{ applied: number[], current: number }}
 */
export function runMigrations(db, { dir, upTo = Infinity, logger }) {
  db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
    version    INTEGER PRIMARY KEY,
    name       TEXT NOT NULL,
    checksum   TEXT NOT NULL,
    applied_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  )`);

  const files = loadMigrations(dir);
  const seen = new Set();
  for (const f of files) {
    if (seen.has(f.version)) throw new MigrationError(`versión de migración duplicada: ${f.version}`);
    seen.add(f.version);
  }

  const applied = new Map(db.prepare('SELECT version, name, checksum FROM schema_migrations').all().map((r) => [r.version, r]));
  for (const [version, row] of applied) {
    const file = files.find((f) => f.version === version);
    if (!file) throw new MigrationError(`la migración aplicada ${version} (${row.name}) ya no existe en disco`);
    if (file.checksum !== row.checksum) {
      throw new MigrationError(`la migración ${version} (${row.name}) fue modificada después de aplicarse`);
    }
  }

  const insert = db.prepare('INSERT INTO schema_migrations (version, name, checksum) VALUES (?, ?, ?)');
  const newlyApplied = [];
  for (const f of files) {
    if (f.version > upTo || applied.has(f.version)) continue;
    try {
      db.transaction(() => {
        db.exec(f.sql);
        insert.run(f.version, f.name, f.checksum);
      })();
    } catch (error) {
      throw new MigrationError(`falló la migración ${f.file}: ${error.message}`, { cause: error });
    }
    newlyApplied.push(f.version);
    logger?.info?.(`migración aplicada: ${f.file}`);
  }
  const current = db.prepare('SELECT COALESCE(MAX(version), 0) AS v FROM schema_migrations').get().v;
  return { applied: newlyApplied, current };
}
