// [B.5][B.7] Conexión SQLite con better-sqlite3 (API síncrona).
// Los PRAGMA son por conexión: se fijan aquí y no en las migraciones.
import Database from 'better-sqlite3';

/**
 * @param {string} filePath  Ruta del .db, o ':memory:' (solo pruebas).
 * @param {{ readonly?: boolean }} [options]
 * @returns {import('better-sqlite3').Database}
 */
export function openDatabase(filePath, options = {}) {
  const db = new Database(filePath, { readonly: options.readonly === true });
  db.pragma('foreign_keys = ON');
  db.pragma('busy_timeout = 5000');
  if (filePath !== ':memory:' && !options.readonly) {
    db.pragma('journal_mode = WAL');
    db.pragma('synchronous = NORMAL');
  }
  return db;
}
