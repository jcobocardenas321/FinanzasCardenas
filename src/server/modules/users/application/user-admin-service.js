// [D.13][D.12] Administración de usuarios (solo Admin): CRUD, reset de contraseña y desbloqueo.
import { conflict, notFound, validationError } from '../../../shared/errors.js';
import { buildMeta, parsePaging } from '../../../shared/pagination.js';
import { displayNameRule, passwordInputRule, usernameRule } from '../../../shared/rules.js';
import { validate } from '../../../shared/validation.js';
import { checkPassword } from '../../../shared/password-policy.js';
import { ROLES, toPublicUser } from '../domain/user.js';

const SORTABLE = { username: 'username', display_name: 'display_name', role: 'role', created_at: 'created_at', last_login_at: 'last_login_at' };

export function createUserAdminService({ users, hasher, generatePassword, sessionRevoker, unitOfWork, clock }) {
  const iso = () => clock.now().toISOString();
  const mustFind = (id) => users.findById(id) ?? (() => { throw notFound('Usuario no encontrado'); })();

  return {
    list(query) {
      const paging = parsePaging(query, { sortable: SORTABLE, defaultSort: 'username:asc' });
      const f = validate(query, { q: { type: 'string', max: 80, allowEmpty: true }, role: { type: 'enum', values: ROLES }, isActive: { type: 'bool', coerce: true } }, { partial: true });
      const { rows, total } = users.list({ ...f, ...paging });
      return { data: rows.map(toPublicUser), meta: buildMeta(total, paging.page, paging.pageSize) };
    },
    get: (id) => toPublicUser(mustFind(id)),

    async create(input) {
      const d = validate(input, { username: usernameRule, displayName: displayNameRule, role: { type: 'enum', values: ROLES }, password: passwordInputRule });
      const problems = checkPassword(d.password, { username: d.username });
      if (problems.length) throw validationError({ password: problems.join('. ') });
      if (users.findByUsername(d.username)) throw conflict('Ese nombre de usuario ya existe', 'CONFLICT', { username: 'Ya está en uso' });
      const passwordHash = await hasher.hash(d.password);
      const id = users.insert({ username: d.username, displayName: d.displayName, passwordHash, role: d.role, mustChangePassword: true, now: iso() });
      return toPublicUser(users.findById(id));
    },

    update(id, input) {
      const target = mustFind(id);
      const d = validate(input, { displayName: displayNameRule, role: { type: 'enum', values: ROLES }, isActive: { type: 'bool' } }, { partial: true });
      const losesAdmin = target.role === 'admin' && target.isActive && (d.role === 'editor' || d.isActive === false);
      return unitOfWork.run(() => {
        if (losesAdmin && users.countActiveAdmins() <= 1) {
          throw conflict('No puedes quitar al último administrador activo', 'LAST_ADMIN');
        }
        users.update(id, d, iso());
        if (d.isActive === false) sessionRevoker.revokeAllForUser(id);
        return toPublicUser(users.findById(id));
      });
    },

    /** Contraseña temporal aleatoria; el usuario debe cambiarla al entrar. También lo desbloquea. */
    async resetPassword(id) {
      const target = mustFind(id);
      let temporaryPassword;
      do temporaryPassword = generatePassword();
      while (checkPassword(temporaryPassword, { username: target.username }).length > 0);
      const passwordHash = await hasher.hash(temporaryPassword);
      unitOfWork.run(() => {
        users.setPassword(id, passwordHash, true, iso());
        sessionRevoker.revokeAllForUser(id);
      });
      return { temporaryPassword, user: toPublicUser(users.findById(id)) };
    },

    unlock(id) {
      mustFind(id);
      users.unlock(id, iso());
      return toPublicUser(users.findById(id));
    },
  };
}
