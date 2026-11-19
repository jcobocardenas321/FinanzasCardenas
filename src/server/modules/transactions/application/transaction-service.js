// [A.1][B.8] Ingresos y gastos (CRUD). Cada escritura actualiza agg_monthly_category EN LA MISMA transacción SQL.
import { notFound, validationError } from '../../../shared/errors.js';
import { buildMeta, parsePaging } from '../../../shared/pagination.js';
import { validate } from '../../../shared/validation.js';
import { KINDS, MAX_AMOUNT_COP, yearMonthOf } from '../domain/transaction.js';

const SORTABLE = {
  occurred_on: 't.occurred_on',
  amount_cop: 't.amount_cop',
  description: 't.description COLLATE NOCASE',
  category: 'c.name COLLATE NOCASE',
  created_at: 't.created_at',
};
const SCHEMA = {
  kind: { type: 'enum', values: KINDS },
  amountCop: { type: 'int', min: 1, max: MAX_AMOUNT_COP },
  categoryId: { type: 'int', min: 1 },
  occurredOn: { type: 'date' },
  description: { type: 'string', max: 160 },
  notes: { type: 'string', max: 1000, nullable: true, allowEmpty: true, required: false },
};
const AGG_KEYS = ['kind', 'amountCop', 'categoryId', 'occurredOn'];

export function createTransactionService({ transactions, categories, unitOfWork, clock }) {
  const iso = () => clock.now().toISOString();
  const mustFind = (id) => transactions.findById(id) ?? (() => { throw notFound('Movimiento no encontrado'); })();
  const plain = (t) => ({ kind: t.kind, amountCop: t.amountCop, categoryId: t.categoryId, occurredOn: t.occurredOn, description: t.description, notes: t.notes });

  function assertCategory(t, { rejectArchived }) {
    const category = categories.findById(t.categoryId);
    if (!category) throw validationError({ categoryId: 'La categoría no existe' });
    if (category.kind !== t.kind) throw validationError({ categoryId: 'La categoría no corresponde al tipo de movimiento' });
    if (rejectArchived && category.isArchived) throw validationError({ categoryId: 'La categoría está archivada' });
  }
  const applyAgg = (t, sign, now) => transactions.applyAggregateDelta(yearMonthOf(t.occurredOn), t.kind, t.categoryId, sign * t.amountCop, sign, now);

  return {
    get: mustFind,

    create(actor, input) {
      const d = validate(input, SCHEMA);
      const t = { ...d, notes: d.notes || null };
      assertCategory(t, { rejectArchived: true });
      const now = iso();
      return unitOfWork.run(() => {
        const id = transactions.insert({ ...t, userId: actor.id, now });
        applyAgg(t, +1, now);
        return transactions.findById(id);
      });
    },

    update(actor, id, input) {
      const current = mustFind(id);
      const d = validate(input, SCHEMA, { partial: true });
      const next = { ...plain(current), ...d };
      if (next.notes === '') next.notes = null;
      assertCategory(next, { rejectArchived: d.categoryId !== undefined && d.categoryId !== current.categoryId });
      const now = iso();
      return unitOfWork.run(() => {
        transactions.update({ ...next, id, userId: actor.id, now });
        if (AGG_KEYS.some((k) => next[k] !== current[k])) {
          applyAgg(current, -1, now);
          applyAgg(next, +1, now);
        }
        return transactions.findById(id);
      });
    },

    remove(id) {
      const current = mustFind(id);
      const now = iso();
      unitOfWork.run(() => {
        transactions.delete(id);
        applyAgg(current, -1, now);
      });
    },

    list(query) {
      const paging = parsePaging(query, { sortable: SORTABLE, defaultSort: 'occurred_on:desc' });
      const f = validate(
        query,
        {
          kind: { type: 'enum', values: KINDS },
          categoryId: { type: 'int', coerce: true, min: 1 },
          from: { type: 'date' },
          to: { type: 'date' },
          q: { type: 'string', max: 80 },
          minAmount: { type: 'int', coerce: true, min: 0 },
          maxAmount: { type: 'int', coerce: true, min: 0 },
        },
        { partial: true },
      );
      if (f.from && f.to && f.from > f.to) throw validationError({ from: 'La fecha inicial no puede ser posterior a la final' });
      if (f.minAmount !== undefined && f.maxAmount !== undefined && f.minAmount > f.maxAmount) throw validationError({ minAmount: 'El mínimo no puede superar al máximo' });
      const { rows, total } = transactions.list({ ...f, ...paging });
      return { data: rows, meta: buildMeta(total, paging.page, paging.pageSize) };
    },
  };
}
