// [A.1] Configuración del hogar. La moneda es fija (COP) según [C.11]; solo el Admin modifica.
import { validate } from '../../../shared/validation.js';

export const DEFAULTS = Object.freeze({ householdName: 'Mi hogar', budgetWarningThresholdPct: 80 });

export function createSettingsService({ repo, keys, clock }) {
  const read = () => ({
    householdName: repo.get(keys.householdName) ?? DEFAULTS.householdName,
    currency: 'COP',
    budgetWarningThresholdPct: Number(repo.get(keys.budgetWarningThresholdPct) ?? DEFAULTS.budgetWarningThresholdPct),
  });
  return {
    get: read,
    /** Puerto para budgets: umbral de alerta (% del presupuesto consumido). */
    getBudgetWarningPct: () => read().budgetWarningThresholdPct,
    update(input) {
      const d = validate(input, { householdName: { type: 'string', max: 60 }, budgetWarningThresholdPct: { type: 'int', min: 50, max: 100 } }, { partial: true });
      const now = clock.now().toISOString();
      if (d.householdName !== undefined) repo.set(keys.householdName, d.householdName, now);
      if (d.budgetWarningThresholdPct !== undefined) repo.set(keys.budgetWarningThresholdPct, d.budgetWarningThresholdPct, now);
      return read();
    },
  };
}
