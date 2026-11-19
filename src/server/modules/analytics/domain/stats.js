// [C.11] Estadísticas descriptivas: SOLO media y mediana (sin predicciones). Funciones puras.
export function mean(values) {
  if (values.length === 0) return null;
  return Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 100) / 100;
}

export function median(values) {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 === 1 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

export const summarize = (values) => ({
  count: values.length,
  totalCop: values.reduce((a, b) => a + b, 0),
  mean: mean(values),
  median: median(values),
});
