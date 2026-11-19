// [D.12] Sesiones en SQLite. El id es el SHA-256 del token.
export function createSqliteSessionRepository(db) {
  const map = (r) =>
    r && { id: r.id, userId: r.user_id, createdAt: r.created_at, lastActivityAt: r.last_activity_at, expiresAt: r.expires_at, revokedAt: r.revoked_at };
  const st = {
    insert: db.prepare('INSERT INTO sessions (id, user_id, created_at, last_activity_at, expires_at) VALUES (?, ?, ?, ?, ?)'),
    find: db.prepare('SELECT * FROM sessions WHERE id = ?'),
    touch: db.prepare('UPDATE sessions SET last_activity_at = ?, expires_at = ? WHERE id = ? AND revoked_at IS NULL'),
    revoke: db.prepare('UPDATE sessions SET revoked_at = ? WHERE id = ? AND revoked_at IS NULL'),
    revokeAll: db.prepare('UPDATE sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL'),
    revokeAllExcept: db.prepare('UPDATE sessions SET revoked_at = ? WHERE user_id = ? AND id <> ? AND revoked_at IS NULL'),
    purge: db.prepare('DELETE FROM sessions WHERE expires_at < ? OR (revoked_at IS NOT NULL AND revoked_at < ?)'),
  };
  return {
    insert: (s) => void st.insert.run(s.id, s.userId, s.createdAt, s.lastActivityAt, s.expiresAt),
    findById: (id) => map(st.find.get(id)),
    touch: (id, lastActivityAt, expiresAt) => void st.touch.run(lastActivityAt, expiresAt, id),
    revoke: (id, now) => void st.revoke.run(now, id),
    revokeAllForUser: (userId, now, { exceptId } = {}) =>
      void (exceptId ? st.revokeAllExcept.run(now, userId, exceptId) : st.revokeAll.run(now, userId)),
    purge: (beforeIso) => st.purge.run(beforeIso, beforeIso).changes,
  };
}
