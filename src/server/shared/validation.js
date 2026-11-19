// [A.4] Validación declarativa de entradas. Devuelve valores limpios o lanza VALIDATION_ERROR con `fields`
// (alimenta la validación inline por campo del frontend).
import { notFound, validationError } from './errors.js';

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

export function isValidDate(value) {
  const m = DATE_RE.exec(value);
  if (!m) return false;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return d.getUTCFullYear() === +m[1] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3];
}

function check(value, rule) {
  switch (rule.type) {
    case 'string': {
      if (typeof value !== 'string') return { error: 'Debe ser texto' };
      const v = rule.trim === false ? value : value.trim();
      if (rule.required !== false && v.length === 0 && !rule.allowEmpty) return { error: 'Es obligatorio' };
      if (rule.min && v.length < rule.min) return { error: `Mínimo ${rule.min} caracteres` };
      if (rule.max && v.length > rule.max) return { error: `Máximo ${rule.max} caracteres` };
      if (rule.pattern && !rule.pattern.test(v)) return { error: rule.patternMessage ?? 'Formato inválido' };
      return { value: v };
    }
    case 'int': {
      let v = value;
      if (rule.coerce && typeof v === 'string' && /^-?\d+$/.test(v.trim())) v = Number(v);
      if (!Number.isSafeInteger(v)) return { error: 'Debe ser un número entero' };
      if (rule.min !== undefined && v < rule.min) return { error: `Debe ser mayor o igual a ${rule.min}` };
      if (rule.max !== undefined && v > rule.max) return { error: `Debe ser menor o igual a ${rule.max}` };
      return { value: v };
    }
    case 'bool': {
      if (typeof value === 'boolean') return { value };
      if (rule.coerce && (value === 'true' || value === 'false')) return { value: value === 'true' };
      return { error: 'Debe ser verdadero o falso' };
    }
    case 'enum':
      return rule.values.includes(value) ? { value } : { error: `Debe ser uno de: ${rule.values.join(', ')}` };
    case 'date':
      return typeof value === 'string' && isValidDate(value) ? { value } : { error: 'Fecha inválida (AAAA-MM-DD)' };
    case 'month':
      return typeof value === 'string' && MONTH_RE.test(value) ? { value } : { error: 'Mes inválido (AAAA-MM)' };
    default:
      throw new Error(`regla desconocida: ${rule.type}`);
  }
}

/**
 * @param {object} input
 * @param {Record<string, object>} schema  campo -> regla { type, required?, nullable?, ... }
 * @param {{ partial?: boolean }} [options]  partial: todos los campos opcionales (PATCH)
 */
export function validate(input, schema, { partial = false } = {}) {
  const src = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
  const out = {};
  const fields = {};
  for (const [key, rule] of Object.entries(schema)) {
    const value = src[key];
    const missing = value === undefined || (value === '' && rule.type !== 'string' && rule.emptyAsMissing);
    if (missing) {
      if (!partial && rule.required !== false) fields[key] = 'Es obligatorio';
      continue;
    }
    if (value === null) {
      if (rule.nullable) out[key] = null;
      else fields[key] = 'No puede ser nulo';
      continue;
    }
    const result = check(value, rule);
    if (result.error) fields[key] = result.error;
    else out[key] = result.value;
  }
  if (Object.keys(fields).length > 0) throw validationError(fields);
  return out;
}

/** Parámetro de ruta /:id -> entero positivo; si no lo es, 404 (no revela nada más). */
export function parseId(value) {
  if (typeof value === 'string' && /^[1-9]\d{0,14}$/.test(value)) return Number(value);
  throw notFound('No encontrado');
}
