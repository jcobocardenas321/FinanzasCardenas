// [C.11] Eventos de métricas locales (errores, uso por módulo, personalizadas). Solo toca `metric_events`.
export function createSqliteMetricsRepository(db) {
  const st = {
    insert: db.prepare('INSERT INTO metric_events (kind, module, name, detail, user_id, created_at) VALUES (?, ?, ?, ?, ?, ?)'),
    usage: db.prepare(
      `SELECT module, COUNT(*) AS uses, MAX(created_at) AS last_used_at FROM metric_events
       WHERE kind = 'module_use' AND created_at >= ? AND created_at < ? GROUP BY module ORDER BY uses DESC, module`,
    ),
    errorsTotal: db.prepare("SELECT count(*) AS n FROM metric_events WHERE kind = 'error' AND created_at >= ? AND created_at < ?"),
    errorsByModule: db.prepare(
      `SELECT module, COUNT(*) AS n FROM metric_events WHERE kind = 'error' AND created_at >= ? AND created_at < ? GROUP BY module ORDER BY n DESC, module`,
    ),
    errorsRecent: db.prepare(
      `SELECT id, module, name, detail, created_at FROM metric_events WHERE kind = 'error' AND created_at >= ? AND created_at < ?
       ORDER BY created_at DESC, id DESC LIMIT ?`,
    ),
    custom: db.prepare(
      `SELECT module, name, COUNT(*) AS n FROM metric_events WHERE kind = 'custom' AND created_at >= ? AND created_at < ?
       GROUP BY module, name ORDER BY n DESC, module, name`,
    ),
    purge: db.prepare('DELETE FROM metric_events WHERE created_at < ?'),
  };
  return {
    insert: ({ kind, module, name, detail, userId, now }) => Number(st.insert.run(kind, module, name, detail ?? null, userId ?? null, now).lastInsertRowid),
    usageByModule: (from, to) => st.usage.all(from, to).map((r) => ({ module: r.module, uses: r.uses, lastUsedAt: r.last_used_at })),
    errorCount: (from, to) => st.errorsTotal.get(from, to).n,
    errorsByModule: (from, to) => st.errorsByModule.all(from, to).map((r) => ({ module: r.module, count: r.n })),
    recentErrors: (from, to, limit) => st.errorsRecent.all(from, to, limit).map((r) => ({ id: r.id, module: r.module, name: r.name, detail: r.detail, createdAt: r.created_at })),
    customEvents: (from, to) => st.custom.all(from, to).map((r) => ({ module: r.module, name: r.name, count: r.n })),
    purgeBefore: (iso) => st.purge.run(iso).changes,
  };
}
