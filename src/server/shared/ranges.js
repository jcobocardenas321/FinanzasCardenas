// [C.11] Rangos de fechas / meses validados (por defecto: mes actual).
import { validationError } from './errors.js';
import { firstDayOf, lastDayOf, localYearMonth, monthsBetween, daysBetween } from './dates.js';
import { validate } from './validation.js';

/** from/to (AAAA-MM-DD). Por defecto: el mes actual completo. */
export function resolveDateRange(query, clock, { maxDays = 3660 } = {}) {
  const q = validate(query, { from: { type: 'date' }, to: { type: 'date' } }, { partial: true });
  const month = localYearMonth(clock.now());
  const from = q.from ?? firstDayOf(month);
  const to = q.to ?? lastDayOf(month);
  if (from > to) throw validationError({ from: 'La fecha inicial no puede ser posterior a la final' });
  if (daysBetween(from, to) > maxDays) throw validationError({ to: `El rango no puede superar ${maxDays} días` });
  return { from, to };
}

/** from/to (AAAA-MM). Por defecto: los últimos `defaultMonths` meses terminando en `defaultEnd`. */
export function resolveMonthRange(query, { defaultEnd, defaultMonths = 12, maxMonths = 60 }) {
  const q = validate(query, { from: { type: 'month' }, to: { type: 'month' } }, { partial: true });
  const to = q.to ?? defaultEnd;
  const [y, m] = to.split('-').map(Number);
  const startTotal = y * 12 + (m - 1) - (defaultMonths - 1);
  const from = q.from ?? `${Math.floor(startTotal / 12)}-${String((startTotal % 12) + 1).padStart(2, '0')}`;
  if (from > to) throw validationError({ from: 'El mes inicial no puede ser posterior al final' });
  if (monthsBetween(from, to).length > maxMonths) throw validationError({ to: `El rango no puede superar ${maxMonths} meses` });
  return { from, to };
}
