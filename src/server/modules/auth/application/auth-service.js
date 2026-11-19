// [D.12] Autenticación: setup inicial, login con bloqueo, sesión deslizante 24 h + inactividad 30 min,
// cambio de contraseña y recuperación del Admin con clave. Depende solo de puertos inyectados.
import { accountLocked, conflict, unauthenticated, validationError } from '../../../shared/errors.js';
import { checkPassword } from '../../../shared/password-policy.js';
import { displayNameRule, passwordInputRule, usernameRule } from '../../../shared/rules.js';
import { validate } from '../../../shared/validation.js';
import { evaluateSession, IDLE_TIMEOUT_MS, MAX_FAILED_ATTEMPTS, SESSION_TTL_MS, shouldTouch, TOUCH_INTERVAL_MS } from '../domain/session-policy.js';

const KEY_HASH = 'recovery_key_hash';
const KEY_AT = 'recovery_key_created_at';
const invalidCredentials = () => unauthenticated('Usuario o contraseña incorrectos', 'INVALID_CREDENTIALS');

/**
 * Puertos: accounts (fachada de users), sessions, kv, hasher, tokens, recoveryKeys {generate, hash, matches},
 * recoveryFile {write}, clock {now, sleep}, unitOfWork {run}, logger.
 */
export function createAuthService({ accounts, sessions, kv, hasher, tokens, recoveryKeys, recoveryFile, clock, unitOfWork, logger, options = {} }) {
  const cfg = { failureDelayMs: 400, touchIntervalMs: TOUCH_INTERVAL_MS, ...options };
  const iso = (d = clock.now()) => d.toISOString();
  const assertStrong = (password, username, field) => {
    const problems = checkPassword(password, { username });
    if (problems.length) throw validationError({ [field]: problems.join('. ') });
  };
  const saveRecoveryKey = (key, now) => {
    kv.set(KEY_HASH, recoveryKeys.hash(key), now);
    kv.set(KEY_AT, now, now);
  };
  const writeFile = (key, overwrite) => {
    try {
      return recoveryFile.write(key, { overwrite });
    } catch (error) {
      logger?.warn?.(`no se pudo escribir recovery-key.txt: ${error.message}`);
      return null;
    }
  };

  return {
    setupStatus: () => ({ needsSetup: !accounts.hasUsers() }),

    /** Primer arranque: crea el Admin y la clave de recuperación (se muestra una sola vez). */
    async setup(input) {
      const d = validate(input, { username: usernameRule, displayName: displayNameRule, password: passwordInputRule });
      assertStrong(d.password, d.username, 'password');
      const alreadyDone = () => conflict('La configuración inicial ya se realizó', 'SETUP_DONE');
      if (accounts.hasUsers()) throw alreadyDone();
      const passwordHash = await hasher.hash(d.password);
      const recoveryKey = recoveryKeys.generate();
      const now = iso();
      const user = unitOfWork.run(() => {
        if (accounts.hasUsers()) throw alreadyDone();
        const created = accounts.createUser({ username: d.username, displayName: d.displayName, passwordHash, role: 'admin', mustChangePassword: false });
        saveRecoveryKey(recoveryKey, now);
        return created;
      });
      return { user: accounts.toPublic(user), recoveryKey, recoveryKeyFile: writeFile(recoveryKey, false) };
    },

    async login(input) {
      const d = validate(input, { username: { type: 'string', max: 64 }, password: { type: 'string', trim: false, max: 256 } });
      const user = accounts.findByUsername(d.username);
      if (!user || !user.isActive) {
        await hasher.verifyDummy(d.password);
        throw invalidCredentials();
      }
      if (user.lockedAt) throw accountLocked();
      if (!(await hasher.verify(d.password, user.passwordHash))) {
        const r = accounts.registerFailedLogin(user.id);
        if (r.locked) throw accountLocked(`Cuenta bloqueada tras ${MAX_FAILED_ATTEMPTS} intentos fallidos. Solicita el desbloqueo a un administrador.`);
        const err = invalidCredentials();
        err.details = { attemptsRemaining: r.attemptsRemaining };
        throw err;
      }
      accounts.registerSuccessfulLogin(user.id);
      const now = clock.now();
      const { token, id } = tokens.generate();
      const expiresAt = iso(new Date(now.getTime() + SESSION_TTL_MS));
      sessions.insert({ id, userId: user.id, createdAt: iso(now), lastActivityAt: iso(now), expiresAt });
      sessions.purge(iso(new Date(now.getTime() - SESSION_TTL_MS)));
      return { token, expiresAt, idleTimeoutMs: IDLE_TIMEOUT_MS, user: accounts.toPublic(accounts.findById(user.id)) };
    },

    /** Valida el token, aplica expiración/inactividad y renueva (deslizante). Síncrono. */
    authenticate(token) {
      if (!token) throw unauthenticated();
      const id = tokens.idOf(token);
      const session = sessions.findById(id);
      if (!session) throw unauthenticated();
      const now = clock.now();
      const nowMs = now.getTime();
      const state = evaluateSession(session, nowMs);
      if (state === 'revoked') throw unauthenticated();
      if (state !== 'ok') {
        sessions.revoke(id, iso(now));
        throw state === 'expired' ? unauthenticated('Tu sesión expiró. Inicia sesión de nuevo', 'SESSION_EXPIRED') : unauthenticated('Sesión cerrada por inactividad', 'SESSION_IDLE');
      }
      const user = accounts.findById(session.userId);
      if (!user || !user.isActive || user.lockedAt) {
        sessions.revoke(id, iso(now));
        throw unauthenticated();
      }
      let { expiresAt } = session;
      if (shouldTouch(session, nowMs, cfg.touchIntervalMs)) {
        expiresAt = iso(new Date(nowMs + SESSION_TTL_MS));
        sessions.touch(id, iso(now), expiresAt);
      }
      return { user: accounts.toPublic(user), sessionId: id, expiresAt, idleTimeoutMs: IDLE_TIMEOUT_MS };
    },

    /** Solo cierra la sesión actual (SKILLS.md: "Logout global: No"). */
    logout: (sessionId) => sessions.revoke(sessionId, iso()),

    async changePassword({ userId, sessionId, currentPassword, newPassword }) {
      const d = validate({ currentPassword, newPassword }, { currentPassword: passwordInputRule, newPassword: passwordInputRule });
      const user = accounts.findById(userId);
      if (!user || !(await hasher.verify(d.currentPassword, user.passwordHash))) {
        throw validationError({ currentPassword: 'La contraseña actual es incorrecta' });
      }
      if (d.newPassword === d.currentPassword) throw validationError({ newPassword: 'Debe ser distinta de la actual' });
      assertStrong(d.newPassword, user.username, 'newPassword');
      const passwordHash = await hasher.hash(d.newPassword);
      unitOfWork.run(() => {
        accounts.setPassword(userId, passwordHash, { mustChange: false });
        sessions.revokeAllForUser(userId, iso(), { exceptId: sessionId });
      });
      return { user: accounts.toPublic(accounts.findById(userId)) };
    },

    /** Recuperación por clave: restablece la contraseña de un Admin, lo desbloquea y ROTA la clave (de un solo uso). */
    async recover(input) {
      const d = validate(input, { username: { type: 'string', max: 64 }, recoveryKey: { type: 'string', max: 100 }, newPassword: passwordInputRule });
      const user = accounts.findByUsername(d.username);
      const valid = user && user.role === 'admin' && user.isActive && recoveryKeys.matches(d.recoveryKey, kv.get(KEY_HASH));
      if (!valid) {
        if (cfg.failureDelayMs) await clock.sleep(cfg.failureDelayMs);
        throw unauthenticated('Usuario o clave de recuperación inválidos', 'INVALID_RECOVERY');
      }
      assertStrong(d.newPassword, user.username, 'newPassword');
      const passwordHash = await hasher.hash(d.newPassword);
      const newKey = recoveryKeys.generate();
      const now = iso();
      unitOfWork.run(() => {
        accounts.setPassword(user.id, passwordHash, { mustChange: false });
        sessions.revokeAllForUser(user.id, now);
        saveRecoveryKey(newKey, now);
      });
      return { user: accounts.toPublic(accounts.findById(user.id)), recoveryKey: newKey, recoveryKeyFile: writeFile(newKey, true) };
    },

    revokeUserSessions: (userId) => sessions.revokeAllForUser(userId, iso()),
    purgeSessions: () => sessions.purge(iso(new Date(clock.now().getTime() - SESSION_TTL_MS))),
  };
}
