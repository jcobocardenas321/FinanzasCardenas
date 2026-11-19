// [D.12] Acceso mínimo a app_settings (hash de la clave de recuperación). El módulo settings (Fase 2b) lo ampliará.
export function createSqliteKvRepository(db) {
  const get = db.prepare('SELECT value FROM app_settings WHERE key = ?');
  const set = db.prepare(
    'INSERT INTO app_settings (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at',
  );
  return {
    get: (key) => get.get(key)?.value ?? null,
    set: (key, value, now) => void set.run(key, value, now),
  };
}
