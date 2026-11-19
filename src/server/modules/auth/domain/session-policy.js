// [D.12] Sesión: duración 24 h con renovación DESLIZANTE, cierre por inactividad 30 min, bloqueo a los 5 intentos.
// Implementación literal de SKILLS.md (Opción A de la ambigüedad #6): como la inactividad (30 min) es menor
// que la duración (24 h), en la práctica manda la inactividad; las 24 h solo vencen si no hubo actividad.
export const SESSION_TTL_MS = 24 * 60 * 60 * 1000;
export const IDLE_TIMEOUT_MS = 30 * 60 * 1000;
export const MAX_FAILED_ATTEMPTS = 5;
/** Renovación persistida como máximo una vez por este intervalo (evita escribir en cada petición). */
export const TOUCH_INTERVAL_MS = 60 * 1000;

/** @returns {'ok'|'revoked'|'expired'|'idle'} */
export function evaluateSession(session, nowMs) {
  if (session.revokedAt) return 'revoked';
  if (nowMs > Date.parse(session.expiresAt)) return 'expired';
  if (nowMs - Date.parse(session.lastActivityAt) > IDLE_TIMEOUT_MS) return 'idle';
  return 'ok';
}

export const shouldTouch = (session, nowMs, intervalMs = TOUCH_INTERVAL_MS) =>
  nowMs - Date.parse(session.lastActivityAt) >= intervalMs;
