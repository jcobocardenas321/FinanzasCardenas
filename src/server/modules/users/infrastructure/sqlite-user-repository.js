// [B.7][D.13] Repositorio de usuarios sobre better-sqlite3 (síncrono, sentencias preparadas).
import { likePattern } from '../../../shared/pagination.js';

const map = (r) =>
  r && {
    id: r.id,
    username: r.username,
    displayName: r.display_name,
    passwordHash: r.password_hash,
    role: r.role,
    isActive: r.is_active === 1,
    mustChangePassword: r.must_change_password === 1,
    failedAttempts: r.failed_attempts,
    lockedAt: r.locked_at,
    lastLoginAt: r.last_login_at,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };

const UPDATABLE = { displayName: 'display_name', role: 'role', isActive: 'is_active' };

export function createSqliteUserRepository(db) {
  const st = {
    count: db.prepare('SELECT count(*) AS n FROM users'),
    activeAdmins: db.prepare("SELECT count(*) AS n FROM users WHERE role = 'admin' AND is_active = 1"),
    byId: db.prepare('SELECT * FROM users WHERE id = ?'),
    byUsername: db.prepare('SELECT * FROM users WHERE username = ?'), // columna COLLATE NOCASE
    insert: db.prepare(
      'INSERT INTO users (username, display_name, password_hash, role, must_change_password, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    ),
    setPassword: db.prepare(
      'UPDATE users SET password_hash = ?, must_change_password = ?, failed_attempts = 0, locked_at = NULL, updated_at = ? WHERE id = ?',
    ),
    fail: db.prepare(
      `UPDATE users SET failed_attempts = failed_attempts + 1,
         locked_at = CASE WHEN failed_attempts + 1 >= ? THEN ? ELSE locked_at END, updated_at = ?
       WHERE id = ? RETURNING failed_attempts, locked_at`,
    ),
    success: db.prepare('UPDATE users SET failed_attempts = 0, last_login_at = ?, updated_at = ? WHERE id = ?'),
    unlock: db.prepare('UPDATE users SET failed_attempts = 0, locked_at = NULL, updated_at = ? WHERE id = ?'),
  };

  return {
    count: () => st.count.get().n,
    countActiveAdmins: () => st.activeAdmins.get().n,
    findById: (id) => map(st.byId.get(id)),
    findByUsername: (username) => map(st.byUsername.get(username)),
    insert: ({ username, displayName, passwordHash, role, mustChangePassword, now }) =>
      Number(st.insert.run(username, displayName, passwordHash, role, mustChangePassword ? 1 : 0, now, now).lastInsertRowid),
    update(id, changes, now) {
      const sets = [];
      const values = [];
      for (const [key, column] of Object.entries(UPDATABLE)) {
        if (changes[key] === undefined) continue;
        sets.push(`${column} = ?`);
        values.push(typeof changes[key] === 'boolean' ? Number(changes[key]) : changes[key]);
      }
      if (sets.length === 0) return;
      db.prepare(`UPDATE users SET ${sets.join(', ')}, updated_at = ? WHERE id = ?`).run(...values, now, id);
    },
    setPassword: (id, hash, mustChange, now) => void st.setPassword.run(hash, mustChange ? 1 : 0, now, id),
    registerFailure: (id, max, now) => {
      const r = st.fail.get(max, now, now, id);
      return { failedAttempts: r.failed_attempts, lockedAt: r.locked_at };
    },
    registerSuccess: (id, now) => void st.success.run(now, now, id),
    unlock: (id, now) => st.unlock.run(now, id).changes > 0,
    list({ q, role, isActive, orderBy, limit, offset }) {
      const where = [];
      const params = [];
      if (q) {
        where.push("(username LIKE ? ESCAPE '\\' OR display_name LIKE ? ESCAPE '\\')");
        params.push(likePattern(q), likePattern(q));
      }
      if (role) (where.push('role = ?'), params.push(role));
      if (isActive !== undefined) (where.push('is_active = ?'), params.push(isActive ? 1 : 0));
      const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
      const total = db.prepare(`SELECT count(*) AS n FROM users ${clause}`).get(...params).n;
      const rows = db.prepare(`SELECT * FROM users ${clause} ORDER BY ${orderBy}, id ASC LIMIT ? OFFSET ?`).all(...params, limit, offset);
      return { rows: rows.map(map), total };
    },
  };
}
