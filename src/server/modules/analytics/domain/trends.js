// [C.11] EDA "tendencias": variación mensual DESCRIPTIVA (sin proyecciones ni modelos predictivos).
export const FLAT_THRESHOLD_PCT = 5;
const pct = (now, base) => (base === 0 ? null : Math.round(((now - base) / base) * 1000) / 10);

/**
 * @param {{ month: string, totalCop: number, hasData: boolean }[]} series  meses consecutivos
 * @returns {{ direction: 'up'|'down'|'flat'|'insufficient', lastVsPreviousPct: number|null, lastVsAveragePct: number|null,
 *             monthly: { month: string, totalCop: number, changePct: number|null }[] }}
 */
export function describeTrend(series) {
  const monthly = series.map((p, i) => ({ month: p.month, totalCop: p.totalCop, changePct: i === 0 ? null : pct(p.totalCop, series[i - 1].totalCop) }));
  const last = series.at(-1);
  const previousWithData = series.slice(0, -1).filter((p) => p.hasData);
  if (!last || previousWithData.length === 0) return { direction: 'insufficient', lastVsPreviousPct: null, lastVsAveragePct: null, monthly };
  const avg = previousWithData.reduce((a, p) => a + p.totalCop, 0) / previousWithData.length;
  const lastVsAveragePct = pct(last.totalCop, avg);
  let direction = 'flat';
  if (lastVsAveragePct !== null) {
    if (lastVsAveragePct > FLAT_THRESHOLD_PCT) direction = 'up';
    else if (lastVsAveragePct < -FLAT_THRESHOLD_PCT) direction = 'down';
  }
  return { direction, lastVsPreviousPct: monthly.at(-1).changePct, lastVsAveragePct, monthly };
}
