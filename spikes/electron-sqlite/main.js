// [B.5][D.15] SPIKE 1: better-sqlite3 dentro de Electron (sin ventana).
// Ejecutar con: npm run spike:sqlite   (o: xvfb-run -a electron --no-sandbox spikes/electron-sqlite/main.js)
// Sale con código 0 si todas las comprobaciones pasan, 1 si alguna falla.
import { app } from 'electron';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openDatabase } from '../../src/server/infrastructure/db/connection.js';
import { withTransaction } from '../../src/server/infrastructure/db/tx.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const ddl = fs.readFileSync(
  path.join(here, '../../src/server/infrastructure/db/migrations/001_initial.sql'),
  'utf8',
);

function check(name, fn) {
  try {
    const detail = fn();
    return { name, ok: true, detail: detail ?? null };
  } catch (error) {
    return { name, ok: false, detail: String(error?.message ?? error) };
  }
}

function expectThrows(fn, fragment) {
  try {
    fn();
  } catch (error) {
    if (!String(error.message).includes(fragment)) {
      throw new Error(`error inesperado: ${error.message}`, { cause: error });
    }
    return `lanzó: ${error.message}`;
  }
  throw new Error('debía lanzar y no lanzó');
}

app.whenReady().then(() => {
  // Datos del spike en un directorio temporal (nunca junto al ejecutable).
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fc-spike-'));
  const dbPath = path.join(dir, 'spike.db');
  const db = openDatabase(dbPath);

  const results = [
    check('runtime', () => ({
      electron: process.versions.electron,
      node: process.versions.node,
      modulesAbi: process.versions.modules,
      napi: process.versions.napi,
      platform: `${process.platform}-${process.arch}`,
    })),
    check('sqlite_version', () => db.prepare('SELECT sqlite_version() AS v').get().v),
    check('pragma foreign_keys=1', () => {
      const v = db.pragma('foreign_keys', { simple: true });
      if (v !== 1) throw new Error(`foreign_keys=${v}`);
    }),
    check('pragma journal_mode=wal', () => {
      const v = db.pragma('journal_mode', { simple: true });
      if (v !== 'wal') throw new Error(`journal_mode=${v}`);
    }),
    check('DDL 001 aplica en una transacción', () => {
      withTransaction(db, () => db.exec(ddl));
      const n = db.prepare("SELECT count(*) AS n FROM sqlite_master WHERE type='table'").get().n;
      return `${n} tablas`;
    }),
    check('FK RESTRICT: no borra categoría con transacciones', () => {
      db.prepare("INSERT INTO categories (name, kind) VALUES ('Vivienda','expense')").run();
      db.prepare(
        "INSERT INTO transactions (kind, amount_cop, category_id, occurred_on, description) VALUES ('expense', 1000, 1, '2026-11-12', 'Arriendo')",
      ).run();
      return expectThrows(() => db.prepare('DELETE FROM categories WHERE id = 1').run(), 'FOREIGN KEY');
    }),
    check('trigger: tipo de transacción debe coincidir con la categoría', () =>
      expectThrows(
        () =>
          db
            .prepare(
              "INSERT INTO transactions (kind, amount_cop, category_id, occurred_on, description) VALUES ('income', 500, 1, '2026-11-12', 'Mal tipo')",
            )
            .run(),
        'must match',
      )),
    check('ROLLBACK ante error dentro de la transacción', () => {
      const before = db.prepare('SELECT count(*) AS n FROM transactions').get().n;
      expectThrows(
        () =>
          withTransaction(db, () => {
            db.prepare(
              "INSERT INTO transactions (kind, amount_cop, category_id, occurred_on, description) VALUES ('expense', 2000, 1, '2026-11-12', 'Temporal')",
            ).run();
            throw new Error('fallo simulado');
          }),
        'fallo simulado',
      );
      const after = db.prepare('SELECT count(*) AS n FROM transactions').get().n;
      if (after !== before) throw new Error(`no hizo rollback (${before} -> ${after})`);
      return `filas antes=${before} después=${after}`;
    }),
    check('withTransaction rechaza funciones async', () =>
      expectThrows(() => withTransaction(db, async () => {}), 'síncrona')),
  ];

  db.close();
  fs.rmSync(dir, { recursive: true, force: true });

  const failed = results.filter((r) => !r.ok);
  console.log(JSON.stringify({ spike: 'electron-better-sqlite3', passed: failed.length === 0, results }, null, 2));
  app.exit(failed.length === 0 ? 0 : 1);
});
