// [C.11] Fechas de calendario en HORA LOCAL del equipo (el servidor corre en la máquina del usuario).
// Usar UTC rompería el "mes actual" por las noches (p. ej. UTC-5: 21:00 del día 30 ya es el mes siguiente en UTC).
const pad = (n) => String(n).padStart(2, '0');

export const localIsoDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const localYearMonth = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
export const monthOf = (isoDate) => isoDate.slice(0, 7);

export function shiftMonth(yearMonth, delta) {
  const [y, m] = yearMonth.split('-').map(Number);
  const total = y * 12 + (m - 1) + delta;
  return `${Math.floor(total / 12)}-${pad((total % 12) + 1)}`;
}
export const firstDayOf = (yearMonth) => `${yearMonth}-01`;
export const lastDayOf = (yearMonth) => {
  const [y, m] = yearMonth.split('-').map(Number);
  return `${yearMonth}-${pad(new Date(Date.UTC(y, m, 0)).getUTCDate())}`;
};
/** Lista de meses (AAAA-MM) entre dos meses, ambos inclusive. */
export function monthsBetween(from, to) {
  const out = [];
  for (let m = from; m <= to; m = shiftMonth(m, 1)) out.push(m);
  return out;
}
/** Días entre dos fechas AAAA-MM-DD (b - a). */
export const daysBetween = (a, b) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
