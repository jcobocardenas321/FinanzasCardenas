// [C.11][B.8] Analítica. KPI, series, desglose y tendencias se leen de la tabla AGREGADA (sin recalcular sobre
// `transactions`). Media/mediana y EDA de nulos necesitan filas individuales: usan el puerto de solo lectura `source`.
import { validate } from '../../../shared/validation.js';
import { validationError } from '../../../shared/errors.js';
import { localYearMonth, monthsBetween, shiftMonth, firstDayOf, lastDayOf } from '../../../shared/dates.js';
import { resolveDateRange, resolveMonthRange } from '../../../shared/ranges.js';
import { summarize } from '../domain/stats.js';
import { describeTrend } from '../domain/trends.js';

const KINDS = ['income', 'expense'];
const monthQuery = { month: { type: 'month' } };
const zero = { totalCop: 0, count: 0 };

export function createAnalyticsService({ repo, source, clock }) {
  const currentMonth = () => localYearMonth(clock.now());

  /** Serie mensual continua (meses sin movimientos = 0 con hasData:false). */
  function filledSeries(from, to) {
    const rows = repo.monthlySeries(from, to);
    return monthsBetween(from, to).map((month) => {
      const inc = rows.find((r) => r.month === month && r.kind === 'income') ?? zero;
      const exp = rows.find((r) => r.month === month && r.kind === 'expense') ?? zero;
      return { month, incomeCop: inc.totalCop, expenseCop: exp.totalCop, netCop: inc.totalCop - exp.totalCop, txCount: inc.count + exp.count, hasData: inc.count + exp.count > 0 };
    });
  }

  return {
    /** Balance Total = Σ ingresos − Σ gastos (COP, todo el histórico). Ahorro Mensual = ingresos − gastos del mes. */
    kpis(query) {
      const { month = currentMonth() } = validate(query, monthQuery, { partial: true });
      const all = repo.totalsAllTime();
      const m = repo.totalsOfMonth(month);
      const totalIncomeCop = all.income?.totalCop ?? 0;
      const totalExpenseCop = all.expense?.totalCop ?? 0;
      const incomeMonthCop = m.income?.totalCop ?? 0;
      const expenseMonthCop = m.expense?.totalCop ?? 0;
      return { month, balanceTotalCop: totalIncomeCop - totalExpenseCop, ahorroMensualCop: incomeMonthCop - expenseMonthCop, incomeMonthCop, expenseMonthCop, totalIncomeCop, totalExpenseCop };
    },

    /** Barras y líneas: ingresos, gastos y neto por mes. */
    series(query) {
      const q = validate(query, { granularity: { type: 'enum', values: ['month'] } }, { partial: true });
      const { from, to } = resolveMonthRange(query, { defaultEnd: currentMonth(), defaultMonths: 12, maxMonths: 60 });
      return { granularity: q.granularity ?? 'month', from, to, points: filledSeries(from, to) };
    },

    /** Pastel: total por categoría del mes y su porcentaje. */
    breakdown(query) {
      const q = validate(query, { ...monthQuery, kind: { type: 'enum', values: KINDS } }, { partial: true });
      const month = q.month ?? currentMonth();
      const kind = q.kind ?? 'expense';
      const rows = repo.breakdown(month, kind);
      const totalCop = rows.reduce((a, r) => a + r.totalCop, 0);
      return { month, kind, totalCop, categories: rows.map((r) => ({ ...r, percent: totalCop === 0 ? 0 : Math.round((r.totalCop / totalCop) * 1000) / 10 })) };
    },

    /** Media y mediana de los montos por movimiento (filas individuales, por eso no sale de la tabla agregada). */
    stats(query) {
      const { from, to } = resolveDateRange(query, clock);
      return { from, to, income: summarize(source.amounts({ kind: 'income', from, to })), expense: summarize(source.amounts({ kind: 'expense', from, to })) };
    },

    /** EDA: valores nulos, meses sin datos y tendencias mensuales (descriptivas). Por defecto: 6 meses COMPLETOS. */
    eda(query) {
      const current = currentMonth();
      const { from, to } = resolveMonthRange(query, { defaultEnd: shiftMonth(current, -1), defaultMonths: 6, maxMonths: 36 });
      const dateFrom = firstDayOf(from);
      const dateTo = lastDayOf(to);
      const q = source.quality({ from: dateFrom, to: dateTo });
      const series = filledSeries(from, to);
      const pctOf = (n) => (q.total === 0 ? 0 : Math.round((n / q.total) * 1000) / 10);
      return {
        from, to,
        includesIncompleteMonth: to >= current,
        nulls: {
          totalTransactions: q.total,
          notes: { nullCount: q.notesNull, nullPct: pctOf(q.notesNull) },
          createdBy: { nullCount: q.createdByNull, nullPct: pctOf(q.createdByNull) },
        },
        missingMonths: series.filter((p) => !p.hasData).map((p) => p.month),
        trends: {
          income: describeTrend(series.map((p) => ({ month: p.month, totalCop: p.incomeCop, hasData: p.incomeCop > 0 }))),
          expense: describeTrend(series.map((p) => ({ month: p.month, totalCop: p.expenseCop, hasData: p.expenseCop > 0 }))),
        },
      };
    },

    /** Puerto para budgets: gasto del mes por categoría, leído de la tabla agregada. */
    getSpentByCategory(month) {
      if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw validationError({ month: 'Mes inválido (AAAA-MM)' });
      return repo.spentByCategory(month);
    },
  };
}
