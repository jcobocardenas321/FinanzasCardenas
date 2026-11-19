// [Alcance: reportes exportables] Generador CSV (RFC 4180) puro, sin librerías.
// Seguridad: neutraliza "CSV injection" (celdas que Excel evaluaría como fórmula: = + - @ tab CR).
export const BOM = '\uFEFF'; // para que Excel detecte UTF-8 (tildes y ñ)
const FORMULA_START = /^[=+\-@\t\r]/;

export function safeCell(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number') return String(value);
  const s = String(value);
  return FORMULA_START.test(s) ? `'${s}` : s;
}

function quote(cell, delimiter) {
  return cell.includes(delimiter) || /["\r\n]/.test(cell) ? `"${cell.replaceAll('"', '""')}"` : cell;
}

/**
 * @param {object[]} rows
 * @param {{ header: string, get: (row: object) => unknown }[]} columns
 * @param {{ delimiter?: ',' | ';' }} [options]
 */
export function toCsv(rows, columns, { delimiter = ',' } = {}) {
  const line = (cells) => cells.map((c) => quote(safeCell(c), delimiter)).join(delimiter);
  return [line(columns.map((c) => c.header)), ...rows.map((r) => line(columns.map((c) => c.get(r))))].join('\r\n') + '\r\n';
}
