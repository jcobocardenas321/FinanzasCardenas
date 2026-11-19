// [A.1] Configuración en app_settings. Solo se leen/escriben las claves de la lista blanca
// (la tabla también guarda el hash de la clave de recuperación: NUNCA debe filtrarse por aquí).
export const SETTING_KEYS = Object.freeze({ householdName: 'household_name', budgetWarningThresholdPct: 'budget_warning_threshold_pct' });

export function createSqliteSettingsRepository(db) {
  const get = db.prepare('SELECT value FROM app_settings WHERE key = ?');
  const set = db.prepare(
    'INSERT INTO app_settings (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at',
  );
  const allowed = new Set(Object.values(SETTING_KEYS));
  const guard = (key) => { if (!allowed.has(key)) throw new Error(`clave de configuración no permitida: ${key}`); };
  return {
    get: (key) => (guard(key), get.get(key)?.value ?? null),
    set: (key, value, now) => (guard(key), void set.run(key, String(value), now)),
  };
}
