// [B.7][A.1] Repositorio de categorías (better-sqlite3).
import { likePattern } from '../../../shared/pagination.js';

const map = (r) =>
  r && {
    id: r.id, name: r.name, kind: r.kind, color: r.color, icon: r.icon, isArchived: r.is_archived === 1,
    createdBy: r.created_by, createdAt: r.created_at, updatedAt: r.updated_at,
  };

export function createSqliteCategoryRepository(db) {
  const st = {
    byId: db.prepare('SELECT * FROM categories WHERE id = ?'),
    byName: db.prepare('SELECT * FROM categories WHERE kind = ? AND name = ?'), // name COLLATE NOCASE
    insert: db.prepare('INSERT INTO categories (name, kind, color, icon, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)'),
    del: db.prepare('DELETE FROM categories WHERE id = ?'),
  };
  const COLUMNS = { name: 'name', color: 'color', icon: 'icon', isArchived: 'is_archived' };
  return {
    findById: (id) => map(st.byId.get(id)),
    findByName: (kind, name) => map(st.byName.get(kind, name)),
    insert: ({ name, kind, color, icon, createdBy, now }) => Number(st.insert.run(name, kind, color, icon, createdBy, now, now).lastInsertRowid),
    update(id, changes, now) {
      const sets = [];
      const values = [];
      for (const [key, column] of Object.entries(COLUMNS)) {
        if (changes[key] === undefined) continue;
        sets.push(`${column} = ?`);
        values.push(typeof changes[key] === 'boolean' ? Number(changes[key]) : changes[key]);
      }
      if (sets.length) db.prepare(`UPDATE categories SET ${sets.join(', ')}, updated_at = ? WHERE id = ?`).run(...values, now, id);
    },
    delete: (id) => st.del.run(id).changes > 0,
    list({ kind, isArchived, q, orderBy, limit, offset }) {
      const where = [];
      const params = [];
      if (kind) (where.push('kind = ?'), params.push(kind));
      if (isArchived !== undefined) (where.push('is_archived = ?'), params.push(isArchived ? 1 : 0));
      if (q) (where.push("name LIKE ? ESCAPE '\\'"), params.push(likePattern(q)));
      const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
      const total = db.prepare(`SELECT count(*) AS n FROM categories ${clause}`).get(...params).n;
      const rows = db.prepare(`SELECT * FROM categories ${clause} ORDER BY ${orderBy}, id ASC LIMIT ? OFFSET ?`).all(...params, limit, offset);
      return { rows: rows.map(map), total };
    },
  };
}
