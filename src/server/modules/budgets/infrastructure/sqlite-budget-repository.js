// [B.7][A.1] Presupuestos mensuales por categoría. Solo toca la tabla `budgets`.
const map = (r) => r && { id: r.id, categoryId: r.category_id, month: r.year_month, amountCop: r.amount_cop, createdAt: r.created_at, updatedAt: r.updated_at };

export function createSqliteBudgetRepository(db) {
  const st = {
    byMonth: db.prepare('SELECT * FROM budgets WHERE year_month = ? ORDER BY id'),
    find: db.prepare('SELECT * FROM budgets WHERE category_id = ? AND year_month = ?'),
    upsert: db.prepare(
      `INSERT INTO budgets (category_id, year_month, amount_cop, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT (category_id, year_month) DO UPDATE SET amount_cop = excluded.amount_cop, updated_at = excluded.updated_at`,
    ),
    del: db.prepare('DELETE FROM budgets WHERE category_id = ? AND year_month = ?'),
  };
  return {
    listByMonth: (month) => st.byMonth.all(month).map(map),
    find: (categoryId, month) => map(st.find.get(categoryId, month)),
    upsert: ({ categoryId, month, amountCop, userId, now }) => void st.upsert.run(categoryId, month, amountCop, userId, now, now),
    delete: (categoryId, month) => st.del.run(categoryId, month).changes > 0,
  };
}
