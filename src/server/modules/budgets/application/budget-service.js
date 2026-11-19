// [A.1][B.6] Presupuestos mensuales. NO lee `transactions`: el gasto llega por el puerto `spending`
// (getSpentByCategory, expuesto por analytics sobre la tabla agregada).
import { notFound, validationError } from '../../../shared/errors.js';
import { localYearMonth } from '../../../shared/dates.js';
import { validate } from '../../../shared/validation.js';
import { budgetStatus, percentUsed } from '../domain/budget-status.js';

const MAX_BUDGET_COP = 9_999_999_999_999;

/** Puertos: repo, spending {getSpentByCategory(month)}, categories {findById}, settings {getBudgetWarningPct()}, clock. */
export function createBudgetService({ repo, spending, categories, settings, clock }) {
  const monthOf = (value) => validate({ month: value }, { month: { type: 'month' } }).month;

  function present(row, spentMap, warningPct) {
    const spentCop = spentMap.get(row.categoryId) ?? 0;
    const c = categories.findById(row.categoryId);
    return {
      id: row.id,
      categoryId: row.categoryId,
      category: c && { id: c.id, name: c.name, color: c.color, icon: c.icon, isArchived: c.isArchived },
      month: row.month,
      amountCop: row.amountCop,
      spentCop,
      remainingCop: row.amountCop - spentCop,
      percentUsed: percentUsed(row.amountCop, spentCop),
      status: budgetStatus({ amountCop: row.amountCop, spentCop, warningPct }),
    };
  }

  function view(month) {
    const spentMap = new Map(spending.getSpentByCategory(month).map((s) => [s.categoryId, s.spentCop]));
    const warningPct = settings.getBudgetWarningPct();
    const items = repo.listByMonth(month).map((r) => present(r, spentMap, warningPct));
    const totalBudgetCop = items.reduce((a, i) => a + i.amountCop, 0);
    const totalSpentCop = items.reduce((a, i) => a + i.spentCop, 0);
    return { month, warningThresholdPct: warningPct, totals: { budgetCop: totalBudgetCop, spentCop: totalSpentCop, remainingCop: totalBudgetCop - totalSpentCop }, items };
  }

  return {
    list(query) {
      const { month = localYearMonth(clock.now()) } = validate(query, { month: { type: 'month' } }, { partial: true });
      return view(month);
    },

    /** PUT idempotente: crea o reemplaza el presupuesto de (categoría, mes). Solo categorías de gasto. */
    upsert(actor, categoryId, monthParam, input) {
      const month = monthOf(monthParam);
      const { amountCop } = validate(input, { amountCop: { type: 'int', min: 1, max: MAX_BUDGET_COP } });
      const category = categories.findById(categoryId);
      if (!category) throw notFound('Categoría no encontrada');
      if (category.kind !== 'expense') throw validationError({ categoryId: 'Solo las categorías de gasto tienen presupuesto' });
      repo.upsert({ categoryId, month, amountCop, userId: actor.id, now: clock.now().toISOString() });
      return view(month).items.find((i) => i.categoryId === categoryId);
    },

    remove(categoryId, monthParam) {
      const month = monthOf(monthParam);
      if (!repo.delete(categoryId, month)) throw notFound('No hay presupuesto para esa categoría y mes');
    },
  };
}
