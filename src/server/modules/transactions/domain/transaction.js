// [A.1] Reglas puras de movimientos: monto entero en COP (> 0) y mes contable derivado de la fecha.
export const KINDS = Object.freeze(['income', 'expense']);
export const MAX_AMOUNT_COP = 9_999_999_999_999;
export const yearMonthOf = (isoDate) => isoDate.slice(0, 7);
