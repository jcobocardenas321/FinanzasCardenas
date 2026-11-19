// [B.7] Transacciones BEGIN/COMMIT/ROLLBACK sobre better-sqlite3.
// REGLA: `fn` debe ser SÍNCRONA. better-sqlite3 confirma la transacción cuando
// `fn` retorna; una función async haría COMMIT antes de terminar su trabajo.
// Las operaciones asíncronas (p. ej. scrypt) se resuelven ANTES de abrir la transacción.

/**
 * Ejecuta `fn` dentro de una transacción. Si lanza, hace ROLLBACK y relanza el error.
 * Las llamadas anidadas se convierten en SAVEPOINT (comportamiento de better-sqlite3).
 * @template T
 * @param {import('better-sqlite3').Database} db
 * @param {() => T} fn
 * @returns {T}
 */
export function withTransaction(db, fn) {
  if (fn.constructor.name === 'AsyncFunction') {
    throw new TypeError('withTransaction requiere una función síncrona');
  }
  return db.transaction(fn)();
}
