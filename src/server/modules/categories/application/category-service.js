// [A.1] Casos de uso del catálogo de categorías. El tipo (ingreso/gasto) no cambia una vez creada.
import { conflict, notFound } from '../../../shared/errors.js';
import { buildMeta, parsePaging } from '../../../shared/pagination.js';
import { validate } from '../../../shared/validation.js';
import { COLOR_RE, KINDS } from '../domain/category.js';

const SORTABLE = { name: 'name', kind: 'kind', created_at: 'created_at' };
const FIELDS = {
  name: { type: 'string', max: 40 },
  color: { type: 'string', pattern: COLOR_RE, patternMessage: 'Debe ser un color #RRGGBB' },
  icon: { type: 'string', max: 40, pattern: /^fa-[a-z0-9-]+$/, patternMessage: 'Debe ser una clase de FontAwesome (fa-...)' },
};
const duplicate = () => conflict('Ya existe una categoría con ese nombre y tipo', 'CONFLICT', { name: 'Ya existe una categoría con ese nombre' });

/** Puertos: categories (repo), usage {transactionCount(categoryId)} (lo expone transactions), clock. */
export function createCategoryService({ categories, usage, clock }) {
  const iso = () => clock.now().toISOString();
  const mustFind = (id) => categories.findById(id) ?? (() => { throw notFound('Categoría no encontrada'); })();

  return {
    list(query) {
      const paging = parsePaging(query, { sortable: SORTABLE, defaultSort: 'name:asc', defaultPageSize: 100 });
      const f = validate(query, { kind: { type: 'enum', values: KINDS }, archived: { type: 'bool', coerce: true }, q: { type: 'string', max: 40 } }, { partial: true });
      const { rows, total } = categories.list({ kind: f.kind, isArchived: f.archived, q: f.q, ...paging });
      return { data: rows, meta: buildMeta(total, paging.page, paging.pageSize) };
    },
    get: mustFind,
    create(actor, input) {
      const d = validate(input, { ...FIELDS, kind: { type: 'enum', values: KINDS }, color: { ...FIELDS.color, required: false }, icon: { ...FIELDS.icon, required: false } });
      if (categories.findByName(d.kind, d.name)) throw duplicate();
      const id = categories.insert({ name: d.name, kind: d.kind, color: d.color ?? '#4F46E5', icon: d.icon ?? 'fa-tag', createdBy: actor.id, now: iso() });
      return categories.findById(id);
    },
    update(id, input) {
      const current = mustFind(id);
      const d = validate(input, { ...FIELDS, isArchived: { type: 'bool' } }, { partial: true });
      const clash = d.name && categories.findByName(current.kind, d.name);
      if (clash && clash.id !== id) throw duplicate();
      categories.update(id, d, iso());
      return categories.findById(id);
    },
    /** No se borra una categoría con movimientos: se sugiere archivarla (409 IN_USE). */
    remove(id) {
      mustFind(id);
      if (usage.transactionCount(id) > 0) {
        throw conflict('La categoría tiene movimientos asociados. Archívala en lugar de eliminarla.', 'IN_USE');
      }
      categories.delete(id);
    },
  };
}
