// [D.15] Mitiga DNS rebinding: solo se atiende `Host: 127.0.0.1:<puerto>` (el puerto se conoce tras escuchar).
import { forbidden } from '../../../shared/errors.js';

export const hostGuard = (allowedHosts) => (req, res, next) =>
  allowedHosts.has(req.headers.host) ? next() : next(forbidden('Host no permitido', 'INVALID_HOST'));
