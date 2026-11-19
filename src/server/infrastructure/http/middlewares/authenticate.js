// [D.12][D.13] Autenticación por Bearer + RBAC (Admin/Editor). Bloquea todo salvo el cambio de contraseña
// mientras `mustChangePassword` esté activo.
import { forbidden, unauthenticated } from '../../../shared/errors.js';

export function createAuthMiddleware(authService) {
  return {
    authenticate({ allowPasswordChangePending = false } = {}) {
      return (req, res, next) => {
        const header = req.get('authorization') ?? '';
        const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
        if (!token) return next(unauthenticated());
        req.auth = authService.authenticate(token); // lanza 401 (UNAUTHENTICATED | SESSION_EXPIRED | SESSION_IDLE)
        if (req.auth.user.mustChangePassword && !allowPasswordChangePending) {
          return next(forbidden('Debes cambiar tu contraseña antes de continuar', 'PASSWORD_CHANGE_REQUIRED'));
        }
        return next();
      };
    },
    requireRole: (...roles) => (req, res, next) =>
      roles.includes(req.auth?.user.role) ? next() : next(forbidden('Tu rol no permite esta acción')),
  };
}
