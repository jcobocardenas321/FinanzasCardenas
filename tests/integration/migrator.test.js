// [B.7] Migrador: orden, idempotencia, checksum, atomicidad y tolerancia a CRLF.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, test } from 'node:test';
import { openDatabase } from '../../src/server/infrastructure/db/connection.js';
import { MigrationError, runMigrations } from '../../src/server/infrastructure/db/migrator.js';
import { createTestDb, tempDir } from '../helpers/db.js';

describe('runMigrations (directorio temporal)', () => {
  let dir, db;
  const write = (name, sql) => fs.writeFileSync(path.join(dir, name), sql);
  beforeEach(() => {
    dir = tempDir('fc-mig-');
    db = openDatabase(':memory:');
    write('001_a.sql', 'CREATE TABLE a (id INTEGER PRIMARY KEY);');
    write('002_b.sql', 'CREATE TABLE b (id INTEGER PRIMARY KEY);');
    write('notes.txt', 'ignorado');
  });
  afterEach(() => { db.close(); fs.rmSync(dir, { recursive: true, force: true }); });

  test('aplica en orden, registra checksum y es idempotente', () => {
    assert.deepEqual(runMigrations(db, { dir }), { applied: [1, 2], current: 2 });
    const rows = db.prepare('SELECT version, name, checksum FROM schema_migrations ORDER BY version').all();
    assert.deepEqual(rows.map((r) => [r.version, r.name]), [[1, 'a'], [2, 'b']]);
    assert.match(rows[0].checksum, /^[0-9a-f]{64}$/);
    assert.deepEqual(runMigrations(db, { dir }), { applied: [], current: 2 });
  });

  test('aplica solo las nuevas en una ejecución posterior', () => {
    runMigrations(db, { dir });
    write('003_c.sql', 'CREATE TABLE c (id INTEGER PRIMARY KEY);');
    assert.deepEqual(runMigrations(db, { dir }), { applied: [3], current: 3 });
  });

  test('upTo limita la versión', () => {
    assert.deepEqual(runMigrations(db, { dir, upTo: 1 }), { applied: [1], current: 1 });
  });

  test('aborta si una migración ya aplicada fue modificada (checksum)', () => {
    runMigrations(db, { dir });
    write('001_a.sql', 'CREATE TABLE a (id INTEGER PRIMARY KEY, extra TEXT);');
    assert.throws(() => runMigrations(db, { dir }), (e) => e instanceof MigrationError && /modificada/.test(e.message));
  });

  test('el checksum ignora CRLF (autocrlf de Git en Windows)', () => {
    const lf = 'CREATE TABLE a (\n  id INTEGER PRIMARY KEY\n);\n';
    write('001_a.sql', lf);
    runMigrations(db, { dir });
    write('001_a.sql', lf.replaceAll('\n', '\r\n')); // mismo contenido, otro fin de línea
    assert.doesNotThrow(() => runMigrations(db, { dir }));
  });

  test('aborta si falta en disco una migración ya aplicada', () => {
    runMigrations(db, { dir });
    fs.rmSync(path.join(dir, '002_b.sql'));
    assert.throws(() => runMigrations(db, { dir }), /ya no existe/);
  });

  test('una migración que falla hace ROLLBACK completo y no se registra', () => {
    write('003_bad.sql', 'CREATE TABLE ok_table (id INTEGER); INSERT INTO tabla_inexistente VALUES (1);');
    assert.throws(() => runMigrations(db, { dir }), /falló la migración 003_bad\.sql/);
    assert.equal(db.prepare("SELECT count(*) AS n FROM sqlite_master WHERE name = 'ok_table'").get().n, 0);
    assert.equal(db.prepare('SELECT count(*) AS n FROM schema_migrations WHERE version = 3').get().n, 0);
    assert.equal(db.prepare('SELECT count(*) AS n FROM schema_migrations').get().n, 2);
  });

  test('rechaza versiones duplicadas', () => {
    write('002_otra.sql', 'SELECT 1;');
    assert.throws(() => runMigrations(db, { dir }), /duplicada/);
  });
});

test('migraciones reales: 001 (esquema) + 002 (9 categorías de ejemplo)', () => {
  const { db, cleanup } = createTestDb();
  try {
    assert.equal(db.prepare('SELECT MAX(version) AS v FROM schema_migrations').get().v, 2);
    assert.equal(db.prepare('SELECT count(*) AS n FROM categories').get().n, 9);
    assert.equal(db.prepare("SELECT count(*) AS n FROM categories WHERE kind = 'income'").get().n, 2);
  } finally { cleanup(); }
});
