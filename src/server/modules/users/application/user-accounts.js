// [D.12][D.13] Fachada que el módulo auth consume (contrato entre módulos): auth no conoce la tabla users.
import { toPublicUser } from '../domain/user.js';

export function createUserAccounts({ users, clock, maxFailedAttempts }) {
  const iso = () => clock.now().toISOString();
  return {
    hasUsers: () => users.count() > 0,
    findByUsername: (username) => users.findByUsername(username),
    findById: (id) => users.findById(id),
    toPublic: toPublicUser,
    createUser: (input) => users.findById(users.insert({ ...input, now: iso() })),
    setPassword: (id, passwordHash, { mustChange }) => users.setPassword(id, passwordHash, mustChange, iso()),
    registerSuccessfulLogin: (id) => users.registerSuccess(id, iso()),
    registerFailedLogin(id) {
      const r = users.registerFailure(id, maxFailedAttempts, iso());
      return { locked: r.lockedAt !== null, failedAttempts: r.failedAttempts, attemptsRemaining: Math.max(0, maxFailedAttempts - r.failedAttempts) };
    },
  };
}
