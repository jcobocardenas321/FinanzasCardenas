// [A.4] Validación declarativa, paginación y utilidades de consulta.
import assert from 'node:assert/strict';
import test from 'node:test';
import { buildMeta, likePattern, parsePaging } from '../../src/server/shared/pagination.js';
import { isValidDate, parseId, validate } from '../../src/server/shared/validation.js';

const fieldsOf = (fn) => { try { fn(); } catch (e) { return e.fields; } throw new Error('no lanzó'); };

test('validate: limpia, recorta y descarta claves desconocidas', () => {
  const out = validate({ name: '  Ana  ', extra: 1 }, { name: { type: 'string', max: 10 } });
  assert.deepEqual(out, { name: 'Ana' });
});

test('validate: obligatorios, tipos y rangos con mensajes por campo', () => {
  const f = fieldsOf(() => validate({ n: 1.5, s: '', k: 'z', d: '2026-02-30' }, {
    n: { type: 'int' }, s: { type: 'string' }, k: { type: 'enum', values: ['a', 'b'] }, d: { type: 'date' }, missing: { type: 'string' },
  }));
  assert.deepEqual(Object.keys(f).sort(), ['d', 'k', 'missing', 'n', 's']);
});

test('validate: partial permite omitir campos; nullable acepta null', () => {
  assert.deepEqual(validate({}, { a: { type: 'string' } }, { partial: true }), {});
  assert.deepEqual(validate({ a: null }, { a: { type: 'string', nullable: true } }), { a: null });
  assert.ok(fieldsOf(() => validate({ a: null }, { a: { type: 'string' } })).a);
});

test('validate: int estricto salvo coerce (query strings); rechaza no seguros', () => {
  assert.ok(fieldsOf(() => validate({ n: '5' }, { n: { type: 'int' } })).n);
  assert.equal(validate({ n: '5' }, { n: { type: 'int', coerce: true } }).n, 5);
  assert.ok(fieldsOf(() => validate({ n: 2 ** 60 }, { n: { type: 'int' } })).n);
});

test('validate: entrada no objeto se trata como vacía', () => {
  assert.ok(fieldsOf(() => validate(undefined, { a: { type: 'string' } })).a);
  assert.ok(fieldsOf(() => validate([1], { a: { type: 'string' } })).a);
});

test('isValidDate: calendario real (bisiestos incluidos)', () => {
  assert.equal(isValidDate('2028-02-29'), true);
  assert.equal(isValidDate('2026-02-29'), false);
  assert.equal(isValidDate('2026-13-01'), false);
  assert.equal(isValidDate('26-01-01'), false);
});

test('parseId: solo enteros positivos, si no 404', () => {
  assert.equal(parseId('42'), 42);
  for (const bad of ['0', '-1', 'abc', '1.5', '007', '99999999999999999']) assert.throws(() => parseId(bad), { code: 'NOT_FOUND' });
});

const opts = { sortable: { name: 'name', created_at: 't.created_at' }, defaultSort: 'name:asc' };

test('parsePaging: valores por defecto y cálculo de offset', () => {
  assert.deepEqual(parsePaging({}, opts), { page: 1, pageSize: 20, limit: 20, offset: 0, orderBy: 'name ASC', sort: 'name:asc' });
  const p = parsePaging({ page: '3', pageSize: '10', sort: 'created_at:desc' }, opts);
  assert.equal(p.offset, 20);
  assert.equal(p.orderBy, 't.created_at DESC');
});

test('parsePaging: orden fuera de la lista blanca o inyección -> 400', () => {
  for (const sort of ['password_hash:asc', 'name:sideways', 'name;DROP TABLE users:asc', 'toString:asc']) {
    assert.ok(fieldsOf(() => parsePaging({ sort }, opts)).sort, sort);
  }
});

test('parsePaging: límites de page/pageSize', () => {
  assert.ok(fieldsOf(() => parsePaging({ pageSize: '101' }, opts)).pageSize);
  assert.ok(fieldsOf(() => parsePaging({ page: '0' }, opts)).page);
});

test('buildMeta y likePattern', () => {
  assert.deepEqual(buildMeta(45, 2, 20), { page: 2, pageSize: 20, total: 45, totalPages: 3 });
  assert.equal(likePattern('50%_\\'), '%50\\%\\_\\\\%');
});
