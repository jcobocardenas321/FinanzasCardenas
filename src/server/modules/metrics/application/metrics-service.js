// [C.11] Métricas de "Errores", "Uso por módulo" y "Métrica personalizada" (solo locales, retención 90 días).
import { validate } from '../../../shared/validation.js';
import { resolveDateRange } from '../../../shared/ranges.js';

export const RETENTION_DAYS = 90;
const EVENT = {
  kind: { type: 'enum', values: ['error', 'module_use', 'custom'] },
  module: { type: 'string', max: 40, pattern: /^[a-z0-9_-]+$/i, patternMessage: 'Solo letras, números, guion y guion bajo' },
  name: { type: 'string', max: 60 },
  detail: { type: 'string', max: 2000, nullable: true, allowEmpty: true, required: false },
};

export function createMetricsService({ repo, clock, logger }) {
  const iso = () => clock.now().toISOString();
  const nextDay = (d) => new Date(Date.parse(`${d}T00:00:00Z`) + 86_400_000).toISOString();

  return {
    /** Evento enviado por el renderer (error de UI, uso de módulo o métrica personalizada). */
    record(actor, input) {
      const d = validate(input, EVENT);
      return { id: repo.insert({ ...d, detail: d.detail || null, userId: actor.id, now: iso() }) };
    },

    /** Lo invoca el manejador de errores HTTP ante un 500. Nunca lanza (no debe agravar el fallo original). */
    recordInternalError({ method, path, message, requestId, userId }) {
      try {
        repo.insert({ kind: 'error', module: 'http', name: `${method} ${path}`.slice(0, 60), detail: `${message} [${requestId}]`.slice(0, 2000), userId, now: iso() });
      } catch (error) {
        logger?.warn?.(`no se pudo registrar el error en metric_events: ${error.message}`);
      }
    },

    /** Uso por módulo y errores (solo Admin). Fechas en UTC; por defecto, el mes actual. */
    usage(query) {
      const range = resolveDateRange(query, clock, { maxDays: 366 });
      const from = `${range.from}T00:00:00.000Z`;
      const to = nextDay(range.to);
      return {
        range,
        modules: repo.usageByModule(from, to),
        errors: { total: repo.errorCount(from, to), byModule: repo.errorsByModule(from, to), recent: repo.recentErrors(from, to, 20) },
        custom: repo.customEvents(from, to),
      };
    },

    purgeOld() {
      return repo.purgeBefore(new Date(clock.now().getTime() - RETENTION_DAYS * 86_400_000).toISOString());
    },
  };
}
