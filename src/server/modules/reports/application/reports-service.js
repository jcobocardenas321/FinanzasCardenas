// [Alcance: reportes][C.11] Reportes financieros por RANGO DE FECHAS (día exacto), por eso leen del puerto de solo
// lectura `source` y no de la tabla mensual agregada. El backend entrega DATOS y CSV; la impresión a PDF
// la hace el frontend con Electron (printToPDF). Sin librerías de PDF.
import { validationError } from '../../../shared/errors.js';
import { resolveDateRange } from '../../../shared/ranges.js';
import { validate } from '../../../shared/validation.js';
import { BOM, toCsv } from '../domain/csv.js';

export const MAX_DETAIL_ROWS = 5_000;
export const MAX_EXPORT_ROWS = 50_000;
const KIND_LABEL = { income: 'Ingreso', expense: 'Gasto' };
const CSV_COLUMNS = [
  { header: 'Fecha', get: (t) => t.occurredOn },
  { header: 'Tipo', get: (t) => KIND_LABEL[t.kind] },
  { header: 'Categoría', get: (t) => t.category.name },
  { header: 'Descripción', get: (t) => t.description },
  { header: 'Monto (COP)', get: (t) => t.amountCop },
  { header: 'Notas', get: (t) => t.notes },
];
const pctOf = (part, whole) => (whole === 0 ? 0 : Math.round((part / whole) * 1000) / 10);

export function createReportsService({ source, clock }) {
  const filters = (query) => validate(query, { kind: { type: 'enum', values: ['income', 'expense'] }, categoryId: { type: 'int', coerce: true, min: 1 } }, { partial: true });

  return {
    summary(query) {
      const range = resolveDateRange(query, clock);
      const cats = source.summaryByCategory(range);
      const months = source.summaryByMonth(range);
      const sum = (kind, field) => cats.filter((c) => c.kind === kind).reduce((a, c) => a + c[field], 0);
      const incomeCop = sum('income', 'totalCop');
      const expenseCop = sum('expense', 'totalCop');
      const group = (kind, total) => cats.filter((c) => c.kind === kind).map((c) => ({ categoryId: c.categoryId, name: c.name, color: c.color, totalCop: c.totalCop, count: c.count, percent: pctOf(c.totalCop, total) }));
      const byMonth = new Map();
      for (const m of months) {
        const row = byMonth.get(m.month) ?? { month: m.month, incomeCop: 0, expenseCop: 0, netCop: 0 };
        if (m.kind === 'income') row.incomeCop = m.totalCop; else row.expenseCop = m.totalCop;
        row.netCop = row.incomeCop - row.expenseCop;
        byMonth.set(m.month, row);
      }
      return {
        range,
        totals: { incomeCop, expenseCop, netCop: incomeCop - expenseCop, incomeCount: sum('income', 'count'), expenseCount: sum('expense', 'count') },
        byCategory: { income: group('income', incomeCop), expense: group('expense', expenseCop) },
        byMonth: [...byMonth.values()],
      };
    },

    /** Filas para el reporte imprimible (máx. 5 000; `truncated` avisa si hubo más). */
    detail(query) {
      const range = resolveDateRange(query, clock);
      const f = { ...range, ...filters(query) };
      const total = source.count(f);
      return { range, filters: { kind: f.kind ?? null, categoryId: f.categoryId ?? null }, total, truncated: total > MAX_DETAIL_ROWS, rows: source.rows(f, MAX_DETAIL_ROWS) };
    },

    /** CSV exportable (UTF-8 con BOM, CRLF). `delimiter`: comma (RFC 4180) o semicolon (Excel con configuración regional es-CO). */
    csv(query) {
      const range = resolveDateRange(query, clock);
      const f = { ...range, ...filters(query) };
      const { delimiter = 'comma' } = validate(query, { delimiter: { type: 'enum', values: ['comma', 'semicolon'] } }, { partial: true });
      const total = source.count(f);
      if (total > MAX_EXPORT_ROWS) throw validationError({ to: `Demasiados movimientos (${total}). Máximo ${MAX_EXPORT_ROWS}: reduce el rango.` });
      return {
        filename: `movimientos_${range.from}_${range.to}.csv`,
        content: BOM + toCsv(source.rows(f, MAX_EXPORT_ROWS), CSV_COLUMNS, { delimiter: delimiter === 'semicolon' ? ';' : ',' }),
      };
    },
  };
}
