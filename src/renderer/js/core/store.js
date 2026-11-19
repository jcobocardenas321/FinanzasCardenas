// [B.5] Store reactivo propio (sin librerías): estado inmutable por ruta + CustomEvents.
// NO persiste nada: el token y los datos financieros viven solo en memoria. Las preferencias de UI
// se guardan aparte en core/prefs.js (LocalStorage con lista blanca de claves).
import { EVENTS, emit, on } from './events.js';

const initialState = () => ({
  session: { status: 'unknown', user: null, expiresAt: null, needsSetup: null }, // unknown | anonymous | authenticated
  ui: { route: null, sidebar: { collapsed: false, pinned: false, drawerOpen: false } },
  cache: { household: null },
});

let state = initialState();
const keys = (path) => path.split('.');

export const getState = () => state;

/** Lee un valor por ruta, p. ej. select('session.user.role'). */
export const select = (path) => keys(path).reduce((node, key) => node?.[key], state);

/** Escribe por ruta de forma inmutable y emite fc:state:change { path, value, prev } si el valor cambió. */
export function setState(path, value) {
  const prev = select(path);
  if (Object.is(prev, value)) return;
  const k = keys(path);
  const write = (node, i) => ({ ...node, [k[i]]: i === k.length - 1 ? value : write(node?.[k[i]] ?? {}, i + 1) });
  state = write(state, 0);
  emit(EVENTS.STATE, { path, value, prev });
}

export const update = (path, fn) => setState(path, fn(select(path)));

/**
 * Notifica cuando cambia `path` o cualquiera de sus ancestros/descendientes.
 * @returns {() => void} cancelar suscripción
 */
export function subscribe(path, handler) {
  return on(EVENTS.STATE, (change) => {
    const related = change.path === path || change.path.startsWith(`${path}.`) || path.startsWith(`${change.path}.`);
    if (related) handler(select(path), change);
  });
}

/** Cierra la sesión en memoria (conserva needsSetup para el router). */
export const resetSession = () => setState('session', { ...initialState().session, status: 'anonymous', needsSetup: select('session.needsSetup') });

export const _resetForTests = () => { state = initialState(); };
