// [A.3][A.2] Layout principal de la aplicación: header (hamburguesa + menú de usuario), sidebar colapsable con
// "pin" y main. Móvil (< 768 px): el sidebar es un cajón con foco atrapado, Esc y fondo para cerrar.
//
// Sidebar (preferencias por usuario en LocalStorage: sidebar.collapsed / sidebar.pinned):
//   - expandido: ancho completo.
//   - contraído (rail): solo íconos; si NO está anclado, se expande al pasar el cursor o enfocar con teclado.
//   - anclado (pin): el menú contraído NO se expande al pasar el cursor.
import { focusables, trapFocus } from '../core/a11y.js';
import { h, icon } from '../core/dom.js';
import { EVENTS, emit } from '../core/events.js';
import { setState } from '../core/store.js';

export function createShell({ routes, user, prefs, householdName, navigate, onLogout }) {
  const mobileQuery = window.matchMedia('(max-width: 767.98px)');
  const cleanups = [];
  const listen = (target, type, fn) => { target.addEventListener(type, fn); cleanups.push(() => target.removeEventListener(type, fn)); };

  let collapsed = prefs.get('sidebar.collapsed', false) === true;
  let pinned = prefs.get('sidebar.pinned', false) === true;
  let peek = false;
  let drawerOpen = false;
  let releaseTrap = null;

  // ---------- Header ----------
  const hamburger = h('button', { type: 'button', class: 'icon-btn hamburger', 'aria-label': 'Abrir menú de navegación', 'aria-expanded': 'false', 'aria-controls': 'sidebar' }, icon('bars'));
  const household = h('span', { class: 'household' }, householdName ?? '');
  const userBtn = h('button', { type: 'button', id: 'user-menu-btn', class: 'user-btn', 'aria-haspopup': 'menu', 'aria-expanded': 'false', 'aria-controls': 'user-menu' },
    icon('circle-user'), h('span', { class: 'user-btn__name' }, user.displayName), icon('chevron-down', 'user-btn__chevron'));
  const menuActions = [
    { label: 'Apariencia de la app', icon: 'palette', run: () => navigate('settings/appearance') },
    { label: 'Cambiar contraseña', icon: 'key', run: () => navigate('change-password') },
    { label: 'Cerrar sesión', icon: 'right-from-bracket', run: () => onLogout() },
  ];
  const menu = h('ul', { id: 'user-menu', class: 'menu', role: 'menu', 'aria-labelledby': 'user-menu-btn', hidden: true },
    menuActions.map((a) => h('li', { role: 'none' },
      h('button', { type: 'button', role: 'menuitem', class: 'menu__item', tabindex: '-1', on: { click: () => { closeMenu(false); a.run(); } } }, icon(a.icon), a.label))));
  const header = h('header', { class: 'app-header' },
    hamburger, h('a', { class: 'brand', href: '#/dashboard' }, icon('wallet'), 'FinanzasCardenas'), household,
    h('div', { class: 'user-menu' }, userBtn, menu));

  // ---------- Sidebar ----------
  const links = routes.filter((r) => r.nav && (!r.roles || r.roles.includes(user.role))).map((r) =>
    h('a', { class: 'nav-link', href: `#/${r.path}`, title: r.nav.label, dataset: { route: r.path } }, icon(r.nav.icon, 'nav-link__icon'), h('span', { class: 'nav-link__label' }, r.nav.label)));
  const collapseLabel = h('span', { class: 'sidebar__tool-label' });
  const collapseBtn = h('button', { type: 'button', class: 'sidebar__tool', 'aria-controls': 'sidebar' }, icon('angles-left', 'sidebar__tool-icon'), collapseLabel);
  const pinBtn = h('button', { type: 'button', class: 'sidebar__tool', 'aria-pressed': 'false', title: 'Anclar: evita que el menú contraído se expanda al pasar el cursor' },
    icon('thumbtack'), h('span', { class: 'sidebar__tool-label' }, 'Anclar menú'));
  const sidebar = h('nav', { id: 'sidebar', class: 'sidebar', 'aria-label': 'Navegación principal' },
    h('ul', { class: 'nav-list' }, links.map((a) => h('li', {}, a))), h('div', { class: 'sidebar__tools' }, collapseBtn, pinBtn));
  const backdrop = h('div', { class: 'app-backdrop', hidden: true });

  // ---------- Main ----------
  const viewEl = h('div', { id: 'view' });
  const main = h('main', { id: 'main', class: 'app-main', tabindex: '-1' }, viewEl);
  const app = h('div', { class: 'app' }, header, backdrop, sidebar, main);

  function apply() {
    const mobile = mobileQuery.matches;
    app.dataset.sidebar = collapsed ? 'rail' : 'expanded';
    app.dataset.pinned = String(pinned);
    app.dataset.peek = String(peek && collapsed && !pinned && !mobile);
    app.dataset.mobile = String(mobile);
    app.dataset.drawer = drawerOpen ? 'open' : 'closed';
    sidebar.inert = mobile && !drawerOpen; // el cajón cerrado no debe poder enfocarse con Tab
    backdrop.hidden = !drawerOpen || !mobile;
    hamburger.setAttribute('aria-expanded', String(drawerOpen));
    hamburger.setAttribute('aria-label', drawerOpen ? 'Cerrar menú' : 'Abrir menú');
    collapseBtn.setAttribute('aria-expanded', String(!collapsed));
    collapseLabel.textContent = collapsed ? 'Expandir menú' : 'Contraer menú';
    pinBtn.setAttribute('aria-pressed', String(pinned));
    setState('ui.sidebar', { collapsed, pinned, drawerOpen });
  }
  const setPeek = (value) => { if (peek !== value) { peek = value; apply(); } };

  listen(collapseBtn, 'click', () => { collapsed = !collapsed; prefs.set('sidebar.collapsed', collapsed); emit(EVENTS.SIDEBAR, { collapsed, pinned }); apply(); });
  listen(pinBtn, 'click', () => { pinned = !pinned; prefs.set('sidebar.pinned', pinned); emit(EVENTS.SIDEBAR, { collapsed, pinned }); apply(); });
  listen(sidebar, 'mouseenter', () => setPeek(true));
  listen(sidebar, 'mouseleave', () => setPeek(false));
  listen(sidebar, 'focusin', () => setPeek(true));
  listen(sidebar, 'focusout', (event) => { if (!sidebar.contains(event.relatedTarget)) setPeek(false); });

  // ---------- Cajón móvil ----------
  function openDrawer() {
    if (!mobileQuery.matches) return;
    drawerOpen = true;
    apply();
    releaseTrap = trapFocus(sidebar);
    focusables(sidebar)[0]?.focus();
  }
  function closeDrawer(returnFocus = true) {
    if (!drawerOpen) return;
    drawerOpen = false;
    releaseTrap?.();
    releaseTrap = null;
    apply();
    if (returnFocus && mobileQuery.matches) hamburger.focus();
  }
  listen(hamburger, 'click', () => {
    if (!mobileQuery.matches) return;
    if (drawerOpen) closeDrawer();
    else openDrawer();
  });
  listen(backdrop, 'click', () => closeDrawer());
  listen(sidebar, 'click', (event) => { if (event.target.closest('a.nav-link') && mobileQuery.matches) closeDrawer(false); });
  const onBreakpoint = () => { if (!mobileQuery.matches) closeDrawer(false); apply(); };
  mobileQuery.addEventListener('change', onBreakpoint);
  cleanups.push(() => mobileQuery.removeEventListener('change', onBreakpoint));

  // Ctrl+B del menú nativo: contrae/expande el sidebar (en móvil abre/cierra el cajón).
  listen(window, EVENTS.COMMAND, (event) => {
    if (event.detail?.name !== 'toggle-sidebar') return;
    if (mobileQuery.matches) { if (drawerOpen) closeDrawer(); else openDrawer(); } else collapseBtn.click();
  });

  // ---------- Menú de usuario (menu button WAI-ARIA) ----------
  const items = () => [...menu.querySelectorAll('[role="menuitem"]')];
  function openMenu() {
    menu.hidden = false;
    userBtn.setAttribute('aria-expanded', 'true');
    items()[0]?.focus();
  }
  function closeMenu(returnFocus = true) {
    if (menu.hidden) return;
    menu.hidden = true;
    userBtn.setAttribute('aria-expanded', 'false');
    if (returnFocus) userBtn.focus();
  }
  listen(userBtn, 'click', () => (menu.hidden ? openMenu() : closeMenu()));
  listen(userBtn, 'keydown', (event) => { if (event.key === 'ArrowDown') { event.preventDefault(); if (menu.hidden) openMenu(); } });
  listen(menu, 'keydown', (event) => {
    const list = items();
    const i = list.indexOf(document.activeElement);
    const target = { ArrowDown: list[(i + 1) % list.length], ArrowUp: list[(i - 1 + list.length) % list.length], Home: list[0], End: list.at(-1) }[event.key];
    if (target) { event.preventDefault(); target.focus(); }
    else if (event.key === 'Tab') closeMenu(false);
  });
  listen(document, 'pointerdown', (event) => { if (!menu.hidden && !event.target.closest('.user-menu')) closeMenu(false); });
  listen(document, 'keydown', (event) => {
    if (event.key !== 'Escape') return;
    if (!menu.hidden) closeMenu();
    else if (drawerOpen) closeDrawer();
  });

  apply();
  return {
    root: app,
    viewEl,
    /** Marca la sección activa (aria-current="page"). */
    setActive(route) {
      for (const a of links) {
        if (a.dataset.route === route.path) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
      }
    },
    setHousehold: (name) => { household.textContent = name ?? ''; },
    destroy() { releaseTrap?.(); cleanups.forEach((fn) => fn()); app.remove(); },
  };
}
