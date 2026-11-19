// [D.15] Todas las rutas /api exigen la clave generada en cada arranque (X-Launch-Key), entregada solo al renderer por IPC.
import { createHash, timingSafeEqual } from 'node:crypto';
import { forbidden } from '../../../shared/errors.js';

const digest = (value) => createHash('sha256').update(String(value)).digest();

export function launchKeyGuard(launchKey) {
  const expected = digest(launchKey);
  return (req, res, next) => {
    const given = req.get('x-launch-key');
    if (!given || !timingSafeEqual(digest(given), expected)) {
      return next(forbidden('Clave de arranque inválida', 'FORBIDDEN_LAUNCH_KEY'));
    }
    return next();
  };
}
