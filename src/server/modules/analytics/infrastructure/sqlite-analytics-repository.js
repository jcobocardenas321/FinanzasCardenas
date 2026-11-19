// [B.8][C.11] Lecturas SOLO de la tabla agregada agg_monthly_category (+ nombre/color de categorías para etiquetar).
// Es un read model: no consulta `transactions`.
export function createSqliteAnalyticsRepository(db) {
  const st = {
    allTime: db.prepare('SELECT kind, SUM(total_cop) AS total, SUM(tx_count) AS n FROM agg_monthly_category GROUP BY kind'),
    month: db.prepare('SELECT kind, SUM(total_cop) AS total, SUM(tx_count) AS n FROM agg_monthly_category WHERE year_month = ? GROUP BY kind'),
    series: db.prepare(
      `SELECT year_month, kind, SUM(total_cop) AS total, SUM(tx_count) AS n FROM agg_monthly_category
       WHERE year_month >= ? AND year_month <= ? GROUP BY year_month, kind`,
    ),
    breakdown: db.prepare(
      `SELECT a.category_id, c.name, c.color, c.icon, a.total_cop, a.tx_count FROM agg_monthly_category a
       JOIN categories c ON c.id = a.category_id WHERE a.year_month = ? AND a.kind = ? ORDER BY a.total_cop DESC, c.name`,
    ),
    spent: db.prepare("SELECT category_id, total_cop FROM agg_monthly_category WHERE year_month = ? AND kind = 'expense'"),
  };
  const byKind = (rows) => Object.fromEntries(rows.map((r) => [r.kind, { totalCop: r.total, count: r.n }]));
  return {
    totalsAllTime: () => byKind(st.allTime.all()),
    totalsOfMonth: (month) => byKind(st.month.all(month)),
    monthlySeries: (from, to) => st.series.all(from, to).map((r) => ({ month: r.year_month, kind: r.kind, totalCop: r.total, count: r.n })),
    breakdown: (month, kind) => st.breakdown.all(month, kind).map((r) => ({ categoryId: r.category_id, name: r.name, color: r.color, icon: r.icon, totalCop: r.total_cop, count: r.tx_count })),
    spentByCategory: (month) => st.spent.all(month).map((r) => ({ categoryId: r.category_id, spentCop: r.total_cop })),
  };
}
