// [C.11] Formato regional es-CO: pesos colombianos sin decimales, fechas y meses.
const cop = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });
export const formatCop = (n) => cop.format(n);

const pad = (n) => String(n).padStart(2, '0');
/** Mes actual en HORA LOCAL (AAAA-MM). */
export const currentMonth = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;

export function formatMonth(yearMonth) {
  const [y, m] = yearMonth.split('-').map(Number);
  return new Intl.DateTimeFormat('es-CO', { month: 'long', year: 'numeric' }).format(new Date(y, m - 1, 1));
}

/** "1.500.000" | "$ 1500000" -> 1500000. NaN si no es un entero válido (sin decimales). */
export function parseCop(text) {
  const digits = String(text).replace(/[\s$.]/g, '');
  return /^\d+$/.test(digits) ? Number(digits) : Number.NaN;
}

/** Fecha AAAA-MM-DD -> "5 nov 2026" (sin desfase de zona horaria). */
export function formatDate(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(y, m - 1, d)));
}

/** Hoy en HORA LOCAL (AAAA-MM-DD). */
export const todayIso = (d = new Date()) => `${currentMonth(d)}-${pad(d.getDate())}`;

export function shiftMonth(yearMonth, delta) {
  const [y, m] = yearMonth.split('-').map(Number);
  const total = y * 12 + (m - 1) + delta;
  return `${Math.floor(total / 12)}-${pad((total % 12) + 1)}`;
}
export const monthBounds = (yearMonth) => {
  const [y, m] = yearMonth.split('-').map(Number);
  return { from: `${yearMonth}-01`, to: `${yearMonth}-${pad(new Date(Date.UTC(y, m, 0)).getUTCDate())}` };
};
export const formatMonthShort = (yearMonth) => {
  const [y, m] = yearMonth.split('-').map(Number);
  return new Intl.DateTimeFormat('es-CO', { month: 'short', year: '2-digit' }).format(new Date(y, m - 1, 1));
};
