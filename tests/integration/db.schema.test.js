// [B.7] El DDL V1 aplicado a SQLite real vía better-sqlite3: PRAGMA, FKs, CHECKs, triggers y unicidad.
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { createTestDb } from '../helpers/db.js';

describe('esquema V1 (001_initial.sql)', () => {
  let ctx;
  before(() => {
    ctx = createTestDb({ upTo: 1 });
    ctx.db.prepare("INSERT INTO categories (name, kind) VALUES ('Vivienda','expense')").run(); // id 1
    ctx.db.prepare("INSERT INTO categories (name, kind) VALUES ('Salario','income')").run(); // id 2
  });
  after(() => ctx.cleanup());

  const addTx = (kind, amount, categoryId, date = '2026-11-12') =>
    ctx.db
      .prepare('INSERT INTO transactions (kind, amount_cop, category_id, occurred_on, description) VALUES (?, ?, ?, ?, ?)')
      .run(kind, amount, categoryId, date, 'x');

  test('PRAGMA foreign_keys activo y journal_mode WAL', () => {
    assert.equal(ctx.db.pragma('foreign_keys', { simple: true }), 1);
    assert.equal(ctx.db.pragma('journal_mode', { simple: true }), 'wal');
  });

  test('crea las 11 tablas esperadas (10 de negocio + schema_migrations)', () => {
    const names = ctx.db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
      .all()
      .map((r) => r.name);
    assert.deepEqual(names, [
      'agg_monthly_category', 'app_settings', 'budgets', 'categories', 'goal_contributions',
      'goals', 'metric_events', 'schema_migrations', 'sessions', 'transactions', 'users',
    ]);
  });

  test('acepta un movimiento válido', () => {
    assert.equal(Number(addTx('expense', 1500, 1).changes), 1);
  });

  test('rechaza montos <= 0 y fechas mal formadas (CHECK)', () => {
    assert.throws(() => addTx('expense', 0, 1), /CHECK constraint failed/);
    assert.throws(() => addTx('expense', 100, 1, '12/11/2026'), /CHECK constraint failed/);
  });

  test('el tipo de la transacción debe coincidir con el de la categoría (trigger)', () => {
    assert.throws(() => addTx('income', 100, 1), /must match/);
    assert.throws(() => ctx.db.prepare('UPDATE transactions SET kind = ? WHERE id = 1').run('income'), /must match/);
  });

  test('FK RESTRICT: no se borra una categoría con movimientos', () => {
    assert.throws(() => ctx.db.prepare('DELETE FROM categories WHERE id = 1').run(), /FOREIGN KEY constraint failed/);
  });

  test('FK: rechaza movimientos con categoría inexistente', () => {
    assert.throws(() => addTx('expense', 100, 999), /FOREIGN KEY constraint failed/);
  });

  test('username único sin distinguir mayúsculas y rol restringido', () => {
    const insert = ctx.db.prepare("INSERT INTO users (username, display_name, password_hash, role) VALUES (?, 'N', 'h', ?)");
    insert.run('Jaco', 'admin');
    assert.throws(() => insert.run('jaco', 'editor'), /UNIQUE constraint failed/);
    assert.throws(() => insert.run('otro', 'superuser'), /CHECK constraint failed/);
  });

  test('presupuesto único por categoría y mes', () => {
    const insert = ctx.db.prepare("INSERT INTO budgets (category_id, year_month, amount_cop) VALUES (1, '2026-11', 500000)");
    insert.run();
    assert.throws(() => insert.run(), /UNIQUE constraint failed/);
  });

  test('borrar un usuario conserva sus movimientos (ON DELETE SET NULL)', () => {
    ctx.db.prepare("INSERT INTO users (username, display_name, password_hash, role) VALUES ('temporal', 'T', 'h', 'editor')").run();
    const uid = ctx.db.prepare("SELECT id FROM users WHERE username = 'temporal'").get().id;
    const txId = Number(
      ctx.db
        .prepare("INSERT INTO transactions (kind, amount_cop, category_id, occurred_on, description, created_by) VALUES ('expense', 10, 1, '2026-11-12', 'x', ?)")
        .run(uid).lastInsertRowid,
    );
    ctx.db.prepare('DELETE FROM users WHERE id = ?').run(uid);
    assert.equal(ctx.db.prepare('SELECT created_by FROM transactions WHERE id = ?').get(txId).created_by, null);
  });
});
