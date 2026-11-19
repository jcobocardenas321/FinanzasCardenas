// [B.5] Contrato de eventos del frontend (CustomEvents en window).
export const EVENTS = Object.freeze({
  STATE: 'fc:state:change',
  LOGIN: 'fc:auth:login',
  LOGOUT: 'fc:auth:logout',
  EXPIRED: 'fc:auth:expired', // detail: { reason: 'SESSION_EXPIRED' | 'SESSION_IDLE' | 'UNAUTHENTICATED' }
  MUTATED: 'fc:data:mutated', // detail: { entity, action, id }
  TOAST: 'fc:toast', // detail: { type, message, title? }
  SIDEBAR: 'fc:ui:sidebar', // detail: { collapsed, pinned }
  ROUTE: 'fc:route:change', // detail: { path, tab }
  COMMAND: 'fc:command', // detail: { name } (comandos del menú nativo que atiende el shell, p. ej. toggle-sidebar)
});

export const emit = (name, detail) => window.dispatchEvent(new CustomEvent(name, { detail }));

/** @returns {() => void} función para cancelar la suscripción */
export function on(name, handler) {
  const listener = (event) => handler(event.detail, event);
  window.addEventListener(name, listener);
  return () => window.removeEventListener(name, listener);
}
