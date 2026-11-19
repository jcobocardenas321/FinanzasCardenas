// [A.1] Campo de monto en pesos colombianos (COP, enteros): acepta "1.500.000" y valida 1 … 9.999.999.999.999.
import { parseCop } from '../core/format.js';
import { field } from './form.js';

export const MAX_COP = 9_999_999_999_999;

export function amountField({ id = 'amountCop', label = 'Monto (COP)' } = {}) {
  const f = field({ id, label, inputmode: 'numeric', autocomplete: 'off', maxlength: 17, hint: 'Solo números, sin decimales. Ej.: 1500000' });
  f.input.addEventListener('blur', () => {
    const n = parseCop(f.input.value);
    if (!Number.isNaN(n) && n > 0) f.input.value = new Intl.NumberFormat('es-CO').format(n);
  });
  return f;
}

export function amountRule(value) {
  const n = parseCop(value);
  if (Number.isNaN(n) || n < 1) return 'Ingresa un monto entero mayor a 0';
  return n > MAX_COP ? 'El monto es demasiado grande' : null;
}
