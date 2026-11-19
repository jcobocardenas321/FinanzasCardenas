// [A.1][D.15] Arranque del renderer: cliente API (IPC) -> estado de configuración -> router con guardias.
import { api, initApi } from './core/api.js';
import { startActivityHeartbeat } from './core/activity.js';
import { h } from './core/dom.js';
import { EVENTS, emit, on } from './core/events.js';
import { registerCommands } from './core/commands.js';
import { createPrefs } from './core/prefs.js';
import { navigate, startRouter } from './core/router.js';
import { resetSession, select, setState, subscribe } from './core/store.js';
import { createLayouts } from './layout/layouts.js';
import { loadSetupStatus, logout } from './modules/auth/session.js';
import { ROUTES } from './routes.js';
import { notice } from './ui/dialogs.js';
import { listenToasts, toast } from './ui/toasts.js';

const root = document.getElementById('app');
const prefs = () => createPrefs(select('session.user')?.id ?? null);

const EXPIRED_TEXT = {
  SESSION_IDLE: 'Tu sesión se cerró por inactividad (30 minutos). Inicia sesión de nuevo para continuar.',
  SESSION_EXPIRED: 'Tu sesión expiró. Inicia sesión de nuevo para continuar.',
};

// Saltar al contenido sin que el hash "#main" lo interprete el router.
document.querySelector('.skip-link')?.addEventListener('click', (event) => { event.preventDefault(); document.getElementById('main')?.focus(); });

// Métricas [C.11]: errores de la interfaz (máx. 5 por minuto) y uso por módulo.
let errorBudget = { count: 0, since: Date.now() };
function reportError(name, message) {
  if (!select('session.user')) return;
  if (Date.now() - errorBudget.since > 60_000) errorBudget = { count: 0, since: Date.now() };
  if (errorBudget.count++ >= 5) return;
  api.post('/metrics/events', { kind: 'error', module: 'ui', name: name.slice(0, 60), detail: String(message).slice(0, 2000) }).catch(() => {});
}
window.addEventListener('error', (e) => reportError('window.error', e.message));
window.addEventListener('unhandledrejection', (e) => reportError('unhandledrejection', e.reason?.message ?? e.reason));
const trackUsage = (route) => {
  if (route.nav && select('session.user')) api.post('/metrics/events', { kind: 'module_use', module: route.path, name: 'open' }).catch(() => {});
};

async function boot() {
  try {
    await initApi();
    await loadSetupStatus();
  } catch (error) {
    root.replaceChildren(h('main', { class: 'auth-main' }, h('div', { class: 'auth-card' },
      h('h1', { class: 'auth-title' }, 'No se pudo iniciar la aplicación'), h('p', {}, `No hay conexión con el servidor local: ${error.message}`))));
    return;
  }
  setState('session.status', 'anonymous');
  listenToasts();
  registerCommands({ navigate, toast, getUser: () => select('session.user') });

  async function handleLogout() {
    await logout();
    navigate('login');
    toast.success('Sesión cerrada.');
  }
  const layouts = createLayouts({
    root, routes: ROUTES, navigate, onLogout: handleLogout,
    getUser: () => select('session.user'), getHousehold: () => select('cache.household'), createPrefs: prefs,
  });
  let stopHeartbeat = null;
  on(EVENTS.LOGIN, () => { stopHeartbeat = startActivityHeartbeat(); });
  on(EVENTS.LOGOUT, () => { stopHeartbeat?.(); layouts.destroy(); });
  subscribe('cache.household', (name) => layouts.setHousehold(name));

  let expiring = false;
  on(EVENTS.EXPIRED, async ({ reason }) => {
    if (expiring || !select('session.user')) return;
    expiring = true;
    resetSession();
    emit(EVENTS.LOGOUT, {});
    navigate('login');
    await notice({ title: 'Sesión finalizada', text: EXPIRED_TEXT[reason] ?? 'Tu sesión ya no es válida. Inicia sesión de nuevo.', type: 'info' });
    expiring = false;
  });

  startRouter({
    routes: ROUTES, layouts,
    getSession: () => select('session'),
    getContext: () => ({ api, navigate, toast, prefs: prefs(), user: select('session.user') }),
    onNotice: (code) => { if (code === 'forbidden') toast.warning('No tienes permiso para abrir esa sección.'); },
    onRoute: trackUsage,
  });
}

boot();
