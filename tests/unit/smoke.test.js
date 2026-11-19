// Prueba trivial: confirma que `node --test` descubre y ejecuta las pruebas del proyecto.
import assert from 'node:assert/strict';
import test from 'node:test';

test('el runner de node:test funciona', () => {
  assert.equal(1 + 1, 2);
});

test('el entorno cumple engines (Node >= 22)', () => {
  assert.ok(Number(process.versions.node.split('.')[0]) >= 22);
});
