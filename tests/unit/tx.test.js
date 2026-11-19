// [B.7] withTransaction: COMMIT/ROLLBACK y rechazo de funciones async.
import assert from 'node:assert/strict';
import test from 'node:test';
import { withTransaction } from '../../src/server/infrastructure/db/tx.js';
import { openDatabase } from '../../src/server/infrastructure/db/connection.js';

function memoryDb() {
  const db = openDatabase(':memory:');
  db.exec('CREATE TABLE t (id INTEGER PRIMARY KEY, v TEXT NOT NULL)');
  return db;
}

test('hace COMMIT y devuelve el valor de la función', () => {
  const db = memoryDb();
  const id = withTransaction(db, () => db.prepare("INSERT INTO t (v) VALUES ('a')").run().lastInsertRowid);
  assert.equal(Number(id), 1);
  assert.equal(db.prepare('SELECT count(*) AS n FROM t').get().n, 1);
  db.close();
});

test('hace ROLLBACK completo si la función lanza', () => {
  const db = memoryDb();
  assert.throws(
    () =>
      withTransaction(db, () => {
        db.prepare("INSERT INTO t (v) VALUES ('a')").run();
        db.prepare("INSERT INTO t (v) VALUES ('b')").run();
        throw new Error('boom');
      }),
    /boom/,
  );
  assert.equal(db.prepare('SELECT count(*) AS n FROM t').get().n, 0);
  db.close();
});

test('rechaza funciones async (COMMIT prematuro)', () => {
  const db = memoryDb();
  assert.throws(() => withTransaction(db, async () => {}), TypeError);
  db.close();
});
