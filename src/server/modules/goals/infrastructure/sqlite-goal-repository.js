// [B.7][A.1] Metas de ahorro y aportes. Solo toca `goals` y `goal_contributions`.
const SAVED = '(SELECT COALESCE(SUM(amount_cop), 0) FROM goal_contributions WHERE goal_id = g.id)';
const COUNT = '(SELECT count(*) FROM goal_contributions WHERE goal_id = g.id)';
const SELECT = `SELECT g.*, ${SAVED} AS saved, ${COUNT} AS contributions FROM goals g`;
const mapGoal = (r) =>
  r && {
    id: r.id, name: r.name, targetAmountCop: r.target_amount_cop, targetDate: r.target_date, status: r.status,
    savedCop: r.saved, contributionsCount: r.contributions, createdBy: r.created_by, createdAt: r.created_at, updatedAt: r.updated_at,
  };
const mapContribution = (r) => r && { id: r.id, goalId: r.goal_id, amountCop: r.amount_cop, contributedOn: r.contributed_on, createdBy: r.created_by, createdAt: r.created_at };
const COLUMNS = { name: 'name', targetAmountCop: 'target_amount_cop', targetDate: 'target_date', status: 'status' };

export function createSqliteGoalRepository(db) {
  const st = {
    byId: db.prepare(`${SELECT} WHERE g.id = ?`),
    insert: db.prepare('INSERT INTO goals (name, target_amount_cop, target_date, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'),
    setStatus: db.prepare('UPDATE goals SET status = ?, updated_at = ? WHERE id = ?'),
    del: db.prepare('DELETE FROM goals WHERE id = ?'),
    contribs: db.prepare('SELECT * FROM goal_contributions WHERE goal_id = ? ORDER BY contributed_on DESC, id DESC'),
    contribById: db.prepare('SELECT * FROM goal_contributions WHERE id = ?'),
    addContrib: db.prepare('INSERT INTO goal_contributions (goal_id, amount_cop, contributed_on, created_by, created_at) VALUES (?, ?, ?, ?, ?)'),
    delContrib: db.prepare('DELETE FROM goal_contributions WHERE id = ?'),
  };
  return {
    findById: (id) => mapGoal(st.byId.get(id)),
    insert: ({ name, targetAmountCop, targetDate, userId, now }) => Number(st.insert.run(name, targetAmountCop, targetDate ?? null, userId, now, now).lastInsertRowid),
    update(id, changes, now) {
      const sets = [];
      const values = [];
      for (const [key, column] of Object.entries(COLUMNS)) {
        if (changes[key] === undefined) continue;
        sets.push(`${column} = ?`);
        values.push(changes[key]);
      }
      if (sets.length) db.prepare(`UPDATE goals SET ${sets.join(', ')}, updated_at = ? WHERE id = ?`).run(...values, now, id);
    },
    setStatus: (id, status, now) => void st.setStatus.run(status, now, id),
    delete: (id) => st.del.run(id).changes > 0,
    list({ status, orderBy, limit, offset }) {
      const clause = status ? 'WHERE g.status = ?' : '';
      const params = status ? [status] : [];
      const total = db.prepare(`SELECT count(*) AS n FROM goals g ${clause}`).get(...params).n;
      const rows = db.prepare(`${SELECT} ${clause} ORDER BY ${orderBy}, g.id ASC LIMIT ? OFFSET ?`).all(...params, limit, offset);
      return { rows: rows.map(mapGoal), total };
    },
    contributions: (goalId) => st.contribs.all(goalId).map(mapContribution),
    findContribution: (id) => mapContribution(st.contribById.get(id)),
    addContribution: ({ goalId, amountCop, contributedOn, userId, now }) => Number(st.addContrib.run(goalId, amountCop, contributedOn, userId, now).lastInsertRowid),
    deleteContribution: (id) => st.delContrib.run(id).changes > 0,
  };
}
