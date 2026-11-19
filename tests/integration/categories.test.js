// [A.1] Catálogo de categorías contra SQLite real.
import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, test } from 'node:test';
import { createTestContainer, rejects, setupAdmin } from '../helpers/fixtures.js';

describe('categories', () => {
  let c, cats, actor;
  beforeEach(async () => { c = createTestContainer(); cats = c.services.categories; actor = (await setupAdmin(c)).admin; });
  afterEach(() => c.cleanup());
  const byName = (n) => cats.list({ q: n }).data[0];

  test('arranca con las 9 categorías de ejemplo ordenadas por nombre', () => {
    const l = cats.list({});
    assert.equal(l.meta.total, 9);
    assert.deepEqual(l.data.map((x) => x.name), ['Alimentación', 'Educación', 'Otros gastos', 'Otros ingresos', 'Salario', 'Salud', 'Servicios', 'Transporte', 'Vivienda']);
    assert.equal(cats.list({ kind: 'income' }).meta.total, 2);
    assert.equal(cats.list({ kind: 'expense' }).meta.total, 7);
  });

  test('crea con valores por defecto y valida color e ícono', () => {
    const k = cats.create(actor, { name: 'Mascotas', kind: 'expense' });
    assert.equal(k.color, '#4F46E5');
    assert.equal(k.icon, 'fa-tag');
    assert.equal(k.createdBy, actor.id);
    assert.throws(() => cats.create(actor, { name: 'X', kind: 'expense', color: 'rojo' }), (e) => 'color' in e.fields);
    assert.throws(() => cats.create(actor, { name: 'X', kind: 'expense', icon: '<script>' }), (e) => 'icon' in e.fields);
    assert.throws(() => cats.create(actor, { name: '', kind: 'otro' }), (e) => 'name' in e.fields && 'kind' in e.fields);
  });

  test('el nombre es único por tipo (sin distinguir mayúsculas) pero puede repetirse entre tipos', () => {
    assert.throws(() => cats.create(actor, { name: 'vivienda', kind: 'expense' }), (e) => e.status === 409 && 'name' in e.fields);
    assert.ok(cats.create(actor, { name: 'Vivienda', kind: 'income' }));
  });

  test('actualiza nombre/color/archivado; el tipo es inmutable', () => {
    const { id } = byName('Salud');
    const u = cats.update(id, { name: 'Salud y bienestar', color: '#00ff00', isArchived: true, kind: 'income' });
    assert.deepEqual([u.name, u.color, u.isArchived, u.kind], ['Salud y bienestar', '#00ff00', true, 'expense']);
    assert.throws(() => cats.update(id, { name: 'transporte' }), (e) => e.status === 409);
    assert.equal(cats.update(id, { name: 'SALUD Y BIENESTAR' }).name, 'SALUD Y BIENESTAR', 'puede cambiar su propio nombre de caja');
  });

  test('filtra por archivadas y busca por texto', () => {
    cats.update(byName('Salud').id, { isArchived: true });
    assert.equal(cats.list({ archived: 'true' }).meta.total, 1);
    assert.equal(cats.list({ archived: 'false' }).meta.total, 8);
    assert.deepEqual(cats.list({ q: 'otros' }).data.map((x) => x.name).sort(), ['Otros gastos', 'Otros ingresos']);
  });

  test('elimina una categoría sin uso; con movimientos responde 409 IN_USE', async () => {
    const free = cats.create(actor, { name: 'Temporal', kind: 'expense' });
    cats.remove(free.id);
    await rejects(async () => cats.get(free.id), { status: 404 });
    const used = byName('Vivienda');
    c.services.transactions.create(actor, { kind: 'expense', amountCop: 1000, categoryId: used.id, occurredOn: '2026-11-01', description: 'Arriendo' });
    await rejects(async () => cats.remove(used.id), { code: 'IN_USE', status: 409 });
  });
});
