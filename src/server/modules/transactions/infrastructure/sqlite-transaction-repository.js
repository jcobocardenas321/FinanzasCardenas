// [B.7][B.8] Repositorio de movimientos + tabla agregada agg_monthly_category (better-sqlite3).
import { likePattern } from '../../../shared/pagination.js';

const SELECT = `SELECT t.*, c.name AS category_name, c.color AS category_color, c.icon AS category_icon
                FROM transactions t JOIN categories c ON c.id = t.category_id`;

const map = (r) =>
  r && {
    id: r.id, kind: r.kind, amountCop: r.amount_cop, categoryId: r.category_id,
    category: { id: r.category_id, name: r.category_name, color: r.category_color, icon: r.category_icon },
    occurredOn: r.occurred_on, description: r.description, notes: r.notes,
    createdBy: r.created_by, updatedBy: r.updated_by, createdAt: r.created_at, updatedAt: r.updated_at,
  };

export function createSqliteTransactionRepository(db) {
  const st = {
    byId: db.prepare(`${SELECT} WHERE t.id = ?`),
    insert: db.prepare(
      `INSERT INTO transactions (kind, amount_cop, category_id, occurred_on, description, notes, created_by, updated_by, created_at, updated_at)
       VALUES (@kind, @amountCop, @categoryId, @occurredOn, @description, @notes, @userId, @userId, @now, @now)`,
    ),
    update: db.prepare(
      `UPDATE transactions SET kind = @kind, amount_cop = @amountCop, category_id = @categoryId, occurred_on = @occurredOn,
         description = @description, notes = @notes, updated_by = @userId, updated_at = @now WHERE id = @id`,
    ),
    del: db.prepare('DELETE FROM transactions WHERE id = ?'),
    aggUpsert: db.prepare(
      `INSERT INTO agg_monthly_category (year_month, kind, category_id, total_cop, tx_count, updated_at) VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT (year_month, kind, category_id) DO UPDATE SET
         total_cop = total_cop + excluded.total_cop, tx_count = tx_count + excluded.tx_count, updated_at = excluded.updated_at`,
    ),
    aggClean: db.prepare('DELETE FROM agg_monthly_category WHERE year_month = ? AND kind = ? AND category_id = ? AND tx_count <= 0'),
    aggAll: db.prepare('SELECT year_month, kind, category_id, total_cop, tx_count FROM agg_monthly_category ORDER BY year_month, kind, category_id'),
  };

  const range = '(@from IS NULL OR t.occurred_on >= @from) AND (@to IS NULL OR t.occurred_on <= @to)';
  const rm = {
    amountsOf: db.prepare(`SELECT t.amount_cop FROM transactions t WHERE t.kind = @kind AND ${range}`),
    quality: db.prepare(
      `SELECT count(*) AS total, COALESCE(SUM(t.notes IS NULL), 0) AS notes_null, COALESCE(SUM(t.created_by IS NULL), 0) AS created_by_null
       FROM transactions t WHERE ${range}`,
    ),
    byCategory: db.prepare(
      `SELECT t.kind, t.category_id, c.name, c.color, SUM(t.amount_cop) AS total, COUNT(*) AS n
       FROM transactions t JOIN categories c ON c.id = t.category_id WHERE ${range}
       GROUP BY t.kind, t.category_id ORDER BY t.kind, total DESC, c.name`,
    ),
    byMonth: db.prepare(
      `SELECT substr(t.occurred_on, 1, 7) AS month, t.kind, SUM(t.amount_cop) AS total, COUNT(*) AS n
       FROM transactions t WHERE ${range} GROUP BY 1, 2 ORDER BY 1`,
    ),
  };
  const exportWhere = (f) => {
    const where = ['t.occurred_on >= @from', 't.occurred_on <= @to'];
    if (f.kind) where.push('t.kind = @kind');
    if (f.categoryId) where.push('t.category_id = @categoryId');
    return where.join(' AND ');
  };
  const nz = (f) => ({ from: f.from ?? null, to: f.to ?? null, kind: f.kind ?? null });

  /** Puerto de SOLO LECTURA que consumen analytics y reports (nunca reciben los métodos de escritura). */
  const readModel = {
    countByCategory: (categoryId) => db.prepare('SELECT count(*) AS n FROM transactions WHERE category_id = ?').get(categoryId).n,
    amounts: ({ kind, from, to }) => rm.amountsOf.all(nz({ kind, from, to })).map((r) => r.amount_cop),
    quality: ({ from, to }) => {
      const r = rm.quality.get(nz({ from, to }));
      return { total: r.total, notesNull: r.notes_null, createdByNull: r.created_by_null };
    },
    summaryByCategory: ({ from, to }) =>
      rm.byCategory.all(nz({ from, to })).map((r) => ({ kind: r.kind, categoryId: r.category_id, name: r.name, color: r.color, totalCop: r.total, count: r.n })),
    summaryByMonth: ({ from, to }) => rm.byMonth.all(nz({ from, to })).map((r) => ({ month: r.month, kind: r.kind, totalCop: r.total, count: r.n })),
    count(f) {
      return db.prepare(`SELECT count(*) AS n FROM transactions t WHERE ${exportWhere(f)}`).get({ from: f.from, to: f.to, kind: f.kind ?? null, categoryId: f.categoryId ?? null }).n;
    },
    rows(f, limit) {
      return db
        .prepare(`${SELECT} WHERE ${exportWhere(f)} ORDER BY t.occurred_on ASC, t.id ASC LIMIT @limit`)
        .all({ from: f.from, to: f.to, kind: f.kind ?? null, categoryId: f.categoryId ?? null, limit })
        .map(map);
    },
  };

  return {
    readModel,
    findById: (id) => map(st.byId.get(id)),
    insert: (t) => Number(st.insert.run({ ...t, notes: t.notes ?? null }).lastInsertRowid),
    update: (t) => void st.update.run({ ...t, notes: t.notes ?? null }),
    delete: (id) => st.del.run(id).changes > 0,

    /** Suma `deltaTotal`/`deltaCount` al agregado del mes/tipo/categoría y elimina la fila si queda en 0. */
    applyAggregateDelta(yearMonth, kind, categoryId, deltaTotal, deltaCount, now) {
      st.aggUpsert.run(yearMonth, kind, categoryId, deltaTotal, deltaCount, now);
      st.aggClean.run(yearMonth, kind, categoryId);
    },
    readAggregates: () => st.aggAll.all(),
    /** Reconstruye la tabla agregada desde `transactions` (mantenimiento y verificación de integridad). */
    rebuildAggregates(now) {
      db.transaction(() => {
        db.exec('DELETE FROM agg_monthly_category');
        db.prepare(
          `INSERT INTO agg_monthly_category (year_month, kind, category_id, total_cop, tx_count, updated_at)
           SELECT substr(occurred_on, 1, 7), kind, category_id, SUM(amount_cop), COUNT(*), ? FROM transactions GROUP BY 1, 2, 3`,
        ).run(now);
      })();
    },

    list({ kind, categoryId, from, to, q, minAmount, maxAmount, orderBy, limit, offset }) {
      const where = [];
      const params = [];
      if (kind) (where.push('t.kind = ?'), params.push(kind));
      if (categoryId) (where.push('t.category_id = ?'), params.push(categoryId));
      if (from) (where.push('t.occurred_on >= ?'), params.push(from));
      if (to) (where.push('t.occurred_on <= ?'), params.push(to));
      if (q) (where.push("t.description LIKE ? ESCAPE '\\'"), params.push(likePattern(q)));
      if (minAmount !== undefined) (where.push('t.amount_cop >= ?'), params.push(minAmount));
      if (maxAmount !== undefined) (where.push('t.amount_cop <= ?'), params.push(maxAmount));
      const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
      const total = db.prepare(`SELECT count(*) AS n FROM transactions t ${clause}`).get(...params).n;
      const rows = db.prepare(`${SELECT} ${clause} ORDER BY ${orderBy}, t.id DESC LIMIT ? OFFSET ?`).all(...params, limit, offset);
      return { rows: rows.map(map), total };
    },
  };
}
