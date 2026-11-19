// [A.3] Gestor de layouts: "auth" (tarjeta centrada) y "app" (shell con sidebar). Reutiliza el layout vigente
// al navegar entre rutas del mismo tipo y lo reconstruye al cambiar de sesión.
import { h, icon } from '../core/dom.js';
import { createShell } from './shell.js';

export function createLayouts({ root, routes, getUser, getHousehold, createPrefs, navigate, onLogout }) {
  let current = null;

  function destroy() {
    current?.destroy();
    root.replaceChildren();
    current = null;
  }
  function buildAuth() {
    const viewEl = h('div', { id: 'view', class: 'auth-card' });
    root.append(h('main', { id: 'main', class: 'auth-main', tabindex: '-1' },
      h('div', { class: 'auth-brand' }, icon('wallet'), h('span', {}, 'FinanzasCardenas')), viewEl));
    return { name: 'auth', viewEl, setActive() {}, setHousehold() {}, destroy() {} };
  }
  function buildApp() {
    const user = getUser();
    const shell = createShell({ routes, user, prefs: createPrefs(), householdName: getHousehold(), navigate, onLogout });
    root.append(shell.root);
    return { name: 'app', viewEl: shell.viewEl, setActive: shell.setActive, setHousehold: shell.setHousehold, destroy: shell.destroy };
  }

  return {
    get(name) {
      if (current?.name === name) return current;
      destroy();
      current = name === 'auth' ? buildAuth() : buildApp();
      return current;
    },
    setActive: (route, tab) => current?.setActive(route, tab),
    setHousehold: (name) => current?.setHousehold(name),
    destroy,
  };
}
