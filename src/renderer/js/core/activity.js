// [D.12] Mientras la persona usa la interfaz, avisa al servidor como máximo cada 5 min (GET /auth/session)
// para que leer o rellenar un formulario largo no cuente como inactividad (cierre a los 30 min).
import { api, hasToken } from './api.js';

const INTERVAL_MS = 5 * 60 * 1000;

export function startActivityHeartbeat() {
  let last = Date.now();
  const ping = () => {
    if (!hasToken() || Date.now() - last < INTERVAL_MS) return;
    last = Date.now();
    api.get('/auth/session').catch(() => {}); // un 401 lo gestiona api.js (evento fc:auth:expired)
  };
  const events = ['pointerdown', 'keydown'];
  events.forEach((e) => window.addEventListener(e, ping, { passive: true }));
  return () => events.forEach((e) => window.removeEventListener(e, ping));
}
