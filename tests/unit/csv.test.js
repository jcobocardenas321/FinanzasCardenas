// [Alcance: reportes exportables] CSV RFC 4180 + defensa contra CSV injection.
import assert from 'node:assert/strict';
import test from 'node:test';
import { BOM, safeCell, toCsv } from '../../src/server/modules/reports/domain/csv.js';

const cols = [{ header: 'A', get: (r) => r.a }, { header: 'B', get: (r) => r.b }];

test('encabezado, filas, CRLF final y números sin comillas', () => {
  assert.equal(toCsv([{ a: 'x', b: 5 }], cols), 'A,B\r\nx,5\r\n');
  assert.equal(toCsv([], cols), 'A,B\r\n');
});

test('entrecomilla y escapa comas, comillas y saltos de línea', () => {
  assert.equal(toCsv([{ a: 'Hola, "mundo"', b: 'l1\nl2' }], cols), 'A,B\r\n"Hola, ""mundo""","l1\nl2"\r\n');
});

test('con punto y coma como separador, la coma ya no obliga a entrecomillar', () => {
  assert.equal(toCsv([{ a: 'a,b', b: 'c;d' }], cols, { delimiter: ';' }), 'A;B\r\na,b;"c;d"\r\n');
});

test('neutraliza fórmulas (= + - @ tab CR) pero no altera texto normal ni números', () => {
  for (const evil of ['=HYPERLINK("http://x")', '+1+1', '-2+3', '@SUM(A1)', '\tcmd', '\rcmd']) assert.ok(safeCell(evil).startsWith("'"), evil);
  assert.equal(safeCell('Arriendo'), 'Arriendo');
  assert.equal(safeCell(1500), '1500');
  assert.equal(safeCell(null), '');
  assert.equal(safeCell(undefined), '');
  assert.equal(BOM, '\uFEFF');
});
