// [A.2][A.3] Router por hash (#/modulo/pestaña): guardias de sesión y rol, carga dinámica de vistas,
// gestión de foco y título. Las funciones puras (parseHash, resolveRoute, decide) se prueban con node:test.

/** '#/transactions/income?x=1' -> { path: 'transactions', tab: 'income', query } */
export function parseHash(hash) {
  const raw = String(hash ?? '').replace(/^#\/?/, '');
  const [pathPart, queryPart = ''] = raw.split('?');
  const safe = (s) => { try { return decodeURIComponent(s); } catch { return ''; } };
  const [path = '', tab = null] = pathPart.split('/').filter(Boolean).slice(0, 2).map(safe);
  return { path, tab, query: Object.fromEntries(new URLSearchParams(queryPart)) };
}

export const resolveRoute = (routes, path) => routes.find((r) => r.path === path) ?? null;

const AUTH_ONLY_PUBLIC = new Set(['login', 'setup', 'recover']);

/** Guardia pura. @returns {{ allow: true } | { redirect: string, notice?: string }} */
export function decide({ route, session }) {
  const { user, needsSetup } = session;
  if (needsSetup === true && route.path !== 'setup') return { redirect: 'setup' };
  if (needsSetup === false && route.path === 'setup') return { redirect: user ? 'dashboard' : 'login' };
  if (!route.public && !user) return { redirect: 'login' };
  if (route.public && user && AUTH_ONLY_PUBLIC.has(route.path)) return { redirect: 'dashboard' };
  if (user?.mustChangePassword && route.path !== 'change-password') return { redirect: 'change-password' };
  if (route.roles && !route.roles.includes(user?.role)) return { redirect: 'dashboard', notice: 'forbidden' };
  return { allow: true };
}

export const navigate = (path, { replace = false } = {}) => {
  const target = `#/${path}`;
  if (replace) location.replace(target);
  else location.hash = target;
};

/**
 * @param {{ routes: object[], layouts: { get(name: string): { viewEl: HTMLElement }, setActive(route, tab): void },
 *           getSession: () => object, getContext: () => object, onNotice?: (code: string) => void, onRoute?: (route, tab) => void }} deps
 */
export function startRouter({ routes, layouts, getSession, getContext, onNotice, onRoute }) {
  let token = 0;
  let current = null; // { handle }

  async function render() {
    const mine = ++token;
    const parsed = parseHash(location.hash);
    const rawPath = String(location.hash ?? '').replace(/^#\/?/, '').split('?')[0];
    const route = resolveRoute(routes, rawPath) ?? resolveRoute(routes, parsed.path) ?? resolveRoute(routes, parsed.path === '' ? 'dashboard' : 'not-found');
    const verdict = decide({ route, session: getSession() });
    if (verdict.redirect) {
      if (verdict.notice) onNotice?.(verdict.notice);
      navigate(verdict.redirect, { replace: true });
      return;
    }
    const tabs = route.tabs ?? [];
    const saved = tabs.length ? getContext().prefs?.get(`tab.${route.path}`) : null;
    const pick = [parsed.tab, saved].find((id) => tabs.some((t) => t.id === id));
    const tab = tabs.length ? (pick ?? tabs[0].id) : null;

    const loaded = await route.view(); // import() dinámico; puede tardar
    if (mine !== token) return; // otra navegación se adelantó
    await current?.handle?.destroy?.();
    const layout = layouts.get(route.layout ?? 'app');
    layout.viewEl.replaceChildren();
    current = { handle: await loaded.mount(layout.viewEl, { ...getContext(), route, tab, params: parsed.query }) };
    if (mine !== token) return;

    layouts.setActive(route, tab);
    document.title = `${route.title} · FinanzasCardenas`;
    const heading = layout.viewEl.querySelector('h1');
    if (heading) { heading.tabIndex = -1; heading.focus({ preventScroll: false }); }
    onRoute?.(route, tab);
  }

  window.addEventListener('hashchange', render);
  render();
  return { refresh: render, stop: () => window.removeEventListener('hashchange', render) };
}
