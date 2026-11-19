// [A.1] Estado de un presupuesto: ok < umbral <= warning <= 100 % < over. Funciones puras.
export const percentUsed = (amountCop, spentCop) => Math.round((spentCop / amountCop) * 1000) / 10;

/** @returns {'ok'|'warning'|'over'} `over` solo si se SUPERA el presupuesto (gastado > monto). */
export function budgetStatus({ amountCop, spentCop, warningPct }) {
  if (spentCop > amountCop) return 'over';
  return (spentCop / amountCop) * 100 >= warningPct ? 'warning' : 'ok';
}
