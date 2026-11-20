/* global document, window, location, MouseEvent, KeyboardEvent, MutationObserver */
// [A.2][A.3][A.4][D.12] Recorrido E2E del renderer en Electron REAL (setup, login, dashboard, sidebar, tabs, teclado,
// móvil, anti-XSS, roles, expiración) con auditoría de accesibilidad axe-core (WCAG 2.0/2.1 A y AA) en cada pantalla.
// Uso: npm run smoke:ui   (Linux sin pantalla: xvfb-run -a npx electron --no-sandbox scripts/smoke-ui.mjs)
import { app, dialog } from 'electron';
import Database from 'better-sqlite3';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'fc-ui-'));
app.setPath('userData', userData);
const axeSource = fs.readFileSync(createRequire(import.meta.url).resolve('axe-core/axe.min.js'), 'utf8');
setTimeout(() => { console.log('UI_RESULT ' + JSON.stringify({ passed: false, error: 'watchdog: timeout' })); app.exit(2); }, 290_000).unref();

const logs = [];
app.on('browser-window-created', (_e, w) => w.webContents.on('console-message', (ev) => logs.push({ level: String(ev.level), message: ev.message })));
// El diálogo de guardado nativo se sustituye por un espía (no hay humano): guarda en userData/saves o simula "Cancelar".
const saves = [];
let nextCancel = false;
dialog.showSaveDialog = async (_w, opts) => {
  const rec = { defaultPath: opts.defaultPath, filters: opts.filters };
  saves.push(rec);
  if (nextCancel) { nextCancel = false; return { canceled: true }; }
  rec.file = path.join(userData, 'saves', path.basename(opts.defaultPath));
  fs.mkdirSync(path.dirname(rec.file), { recursive: true });
  return { canceled: false, filePath: rec.file };
};
await import(path.join(root, 'src/main/main.js'));

const STRONG = 'Clave-Segura-2026!';

app.whenReady().then(async () => {
  const { BrowserWindow } = await import('electron');
  let win;
  for (let i = 0; i < 100 && !(win = BrowserWindow.getAllWindows()[0]); i += 1) await new Promise((r) => setTimeout(r, 100));
  const steps = [];
  const ev = (js) => win.webContents.executeJavaScript(js, true);
  const inPage = (fn, ...args) => ev(`(${fn.toString()})(...${JSON.stringify(args)})`);
  const step = async (name, fn) => {
    try { const r = await fn(); steps.push({ name, ok: r === true || r?.ok === true, ...(r === true ? {} : { detail: r }) }); }
    catch (error) { steps.push({ name, ok: false, detail: String(error?.message ?? error) }); }
    console.log(`STEP [${steps.length}] ${steps.at(-1)?.ok ? 'OK' : 'FAIL'}: ${name}`);
  };
  const installHelpers = () => inPage(() => {
    window.__t = {
      sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
      async waitFor(fn, timeout = 5000) { const t0 = Date.now(); while (Date.now() - t0 < timeout) { try { const v = fn(); if (v) return v; } catch { /* reintenta */ } await this.sleep(40); } return null; },
      set(id, value) { const el = document.getElementById(id); el.value = value; el.dispatchEvent(new Event('input', { bubbles: true })); if (el.tagName === 'SELECT') el.dispatchEvent(new Event('change', { bubbles: true })); },
      key(el, key) { el.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true })); },
      submit() { document.querySelector('form button[type=submit]').click(); },
      idle() { return this.waitFor(() => !document.querySelector('[aria-busy="true"]') && !document.querySelector('[data-skeleton]')); },
      async nav(route, title) { document.querySelector(`a[data-route="${route}"]`).click(); return this.waitFor(() => document.querySelector('h1')?.textContent === title && location.hash.startsWith(`#/${route}`)); },
      rows() { return document.querySelectorAll('.table-scroll:not([hidden]) .data-table tbody tr').length; },
      btn(text) { return [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === text); },
      option(id, text) { return [...document.getElementById(id).options].find((o) => o.textContent === text)?.value; },
      txt(sel) { return (document.querySelector(sel)?.textContent ?? '').replace(/\s+/g, ' ').trim(); },
    };
  });
  const axeCheck = (label, ready) => step(`axe WCAG A/AA: ${label}`, async () => {
    if (ready) { const found = await inPage(async (sel) => Boolean(await window.__t.waitFor(() => document.querySelector(sel))), ready); if (!found) return { ok: false, error: `la vista no llegó a montarse (${ready})` }; }
    await new Promise((r) => setTimeout(r, 600)); // deja terminar los fundidos de entrada (axe mediría opacidad parcial)
    if ((await ev('typeof window.axe')) === 'undefined') await ev(axeSource);
    const violations = await ev(`axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] } })
      .then((r) => r.violations.map((v) => ({ id: v.id, impact: v.impact, targets: v.nodes.slice(0, 3).map((n) => n.target.join(' ')) })))`);
    return violations.length === 0 ? true : { ok: false, violations };
  });
  const login = (username, password) => inPage(async (u, p) => {
    await window.__t.waitFor(() => location.hash === '#/login' && document.getElementById('username'));
    window.__t.set('username', u); window.__t.set('password', p); window.__t.submit();
  }, username, password);

  await new Promise((r) => setTimeout(r, 1500));
  await installHelpers();

  // ---------- A. Primer arranque: setup ----------
  await step('primer arranque: redirige a #/setup y enfoca el h1', () => inPage(async () => {
    const ok = await window.__t.waitFor(() => location.hash === '#/setup' && document.querySelector('h1'));
    return { ok: Boolean(ok) && document.title.startsWith('Configuración inicial') && document.activeElement === document.querySelector('h1'), hash: location.hash, title: document.title };
  }));
  await axeCheck('setup', '#confirm');
  await step('validación inline: 4 errores bajo sus campos, aria-invalid, foco en el primero y anuncio', () => inPage(async () => {
    window.__t.submit(); await window.__t.sleep(250);
    const errs = [...document.querySelectorAll('.field__error')].filter((e) => e.textContent.trim());
    const inputs = [...document.querySelectorAll('input[aria-invalid="true"]')];
    const linked = inputs.every((i) => i.getAttribute('aria-describedby').includes(`${i.id}-error`));
    return { ok: errs.length === 4 && inputs.length === 4 && linked && document.activeElement.id === 'username' && /campo/.test(document.getElementById('live-region').textContent), errs: errs.map((e) => e.textContent) };
  }));
  await step('contraseña débil y confirmación distinta: errores del cliente y lista de requisitos', () => inPage(async () => {
    for (const [id, v] of [['username', 'admin'], ['displayName', 'Admin'], ['password', 'clavecorta'], ['confirm', 'otra']]) window.__t.set(id, v);
    window.__t.submit(); await window.__t.sleep(250);
    return { ok: document.getElementById('password-error').textContent.startsWith('Falta:') && /no coinciden/.test(document.getElementById('confirm-error').textContent) && document.querySelectorAll('.pw-rule[data-ok="true"]').length === 2,
      pw: document.getElementById('password-error').textContent };
  }));
  await step('setup válido: muestra la clave una sola vez y no deja continuar hasta confirmar', () => inPage(async (pw) => {
    window.__t.set('password', pw); window.__t.set('confirm', pw); window.__t.submit();
    const box = await window.__t.waitFor(() => document.querySelector('.key-box'));
    const next = [...document.querySelectorAll('button')].find((b) => b.textContent === 'Continuar');
    const before = next.disabled;
    const check = document.getElementById('key-saved'); check.checked = true; check.dispatchEvent(new Event('change', { bubbles: true }));
    const after = next.disabled; next.click();
    await window.__t.waitFor(() => location.hash === '#/login');
    return { ok: /^([A-HJ-NP-Z2-9]{4}-){7}[A-HJ-NP-Z2-9]{4}$/.test(box.textContent) && before === true && after === false && location.hash === '#/login' && !document.querySelector('.key-box') && Boolean(document.querySelector('.toast--success')), hash: location.hash };
  }, STRONG));

  // ---------- B. Login ----------
  await axeCheck('login', 'form #password');
  await step('login incorrecto: error inline con intentos restantes, campo vaciado y foco en la contraseña', () => inPage(async () => {
    await window.__t.waitFor(() => document.getElementById('username') && document.getElementById('password'));
    window.__t.set('username', 'admin'); window.__t.set('password', 'mala'); window.__t.submit();
    await window.__t.waitFor(() => document.querySelector('.form-error')?.textContent);
    return { ok: /Te quedan 4 intento/.test(document.querySelector('.form-error').textContent) && document.getElementById('password').value === '' && document.activeElement.id === 'password' && document.querySelector('.form-error').getAttribute('role') === 'alert' };
  }));
  await step('login correcto: esqueleto mientras carga y luego estado vacío guiado con acción', () => inPage(async (pw) => {
    await window.__t.waitFor(() => document.getElementById('password'));
    window.__sk = false;
    new MutationObserver(() => { if (document.querySelector('[data-skeleton]')) window.__sk = true; }).observe(document.body, { childList: true, subtree: true });
    const of = window.fetch; window.__tok = null;
    window.fetch = (u, o) => { const a = o?.headers?.Authorization; if (a) window.__tok = a.replace('Bearer ', ''); return of(u, o); };
    window.__t.set('username', 'admin'); window.__t.set('password', pw); window.__t.submit();
    const cta = await window.__t.waitFor(() => [...document.querySelectorAll('.empty-state button')].find((b) => b.textContent === 'Agrega tu primer ingreso'));
    return { ok: Boolean(cta) && window.__sk === true && location.hash === '#/dashboard' && document.activeElement === document.querySelector('h1') && document.querySelector('h1').textContent === 'Panel de control' && !document.querySelector('[aria-busy="true"]'), sk: window.__sk };
  }, STRONG));
  await axeCheck('panel de control (sidebar expandido)', '.empty-state');

  // ---------- C. Sidebar: colapsar, pin y persistencia ----------
  await step('sidebar: colapsar -> rail, hover expande, anclar lo impide, preferencias en LocalStorage por usuario', () => inPage(async () => {
    const appEl = document.querySelector('.app'); const sb = document.getElementById('sidebar');
    const [collapse, pin] = document.querySelectorAll('.sidebar__tool');
    collapse.click(); await window.__t.sleep(120);
    const rail = appEl.dataset.sidebar === 'rail';
    const labelHidden = document.querySelector('.nav-link__label').getBoundingClientRect().width <= 1;
    sb.dispatchEvent(new MouseEvent('mouseenter')); await window.__t.sleep(80); const peek = appEl.dataset.peek;
    sb.dispatchEvent(new MouseEvent('mouseleave')); await window.__t.sleep(80); const peekOff = appEl.dataset.peek;
    pin.click(); await window.__t.sleep(80);
    sb.dispatchEvent(new MouseEvent('mouseenter')); await window.__t.sleep(80); const peekPinned = appEl.dataset.peek;
    return { ok: rail && labelHidden && peek === 'true' && peekOff === 'false' && peekPinned === 'false' && pin.getAttribute('aria-pressed') === 'true'
      && localStorage.getItem('fc.ui.1.sidebar.collapsed') === 'true' && localStorage.getItem('fc.ui.1.sidebar.pinned') === 'true' && document.querySelector('.sidebar__tool').getAttribute('aria-expanded') === 'false', rail, labelHidden, peek, peekOff, peekPinned };
  }));
  await step('recargar: el token NO persiste (vuelve a #/login) pero las preferencias de UI sí', async () => {
    win.webContents.reload();
    await new Promise((r) => setTimeout(r, 1800)); await installHelpers();
    const hashAfterReload = await inPage(async () => { await window.__t.waitFor(() => location.hash === '#/login'); return location.hash; });
    await inPage(() => { const of = window.fetch; window.__tok = null; window.fetch = (u, o) => { const a = o?.headers?.Authorization; if (a) window.__tok = a.replace('Bearer ', ''); return of(u, o); }; });
    await login('admin', STRONG);
    const state = await inPage(async () => {
      await window.__t.waitFor(() => location.hash === '#/dashboard' && document.querySelector('.app'));
      const a = document.querySelector('.app');
      return { sidebar: a.dataset.sidebar, pinned: a.dataset.pinned };
    });
    return { ok: hashAfterReload === '#/login' && state.sidebar === 'rail' && state.pinned === 'true', hashAfterReload, ...state };
  });
  await step('almacenamiento: solo claves fc.ui.<id>.* de la lista blanca; sessionStorage vacío; el token no está en ninguna parte', () => inPage(() => {
    const keys = Object.keys(localStorage);
    const values = keys.map((k) => localStorage.getItem(k)).join('|');
    const re = /^fc\.ui\.\d+\.(sidebar\.(collapsed|pinned)|table\.[a-z0-9_-]+\.(pageSize|sort)|tab\.[a-z0-9_-]+|dashboard\.month|theme|mode|geometry|geo|fontSize|reducedMotion|background|bg|anim|accentColor|language|highContrast|a11y\.[a-zA-Z0-9_-]+)$/;
    return { ok: keys.length > 0 && keys.every((k) => re.test(k)) && sessionStorage.length === 0 && Boolean(window.__tok) && !values.includes(window.__tok) && !document.cookie, keys };
  }));

  // ---------- D. Tabs con teclado ----------
  await step('tabs: flechas/Inicio/Fin cambian la pestaña, mantienen el foco, actualizan la URL y guardan la preferencia', () => inPage(async () => {
    document.querySelector('a[data-route="transactions"]').click();
    await window.__t.waitFor(() => document.querySelector('[role="tab"]'));
    const sel = () => document.querySelector('[role="tab"][aria-selected="true"]');
    const t0 = sel(); t0.focus();
    window.__t.key(t0, 'ArrowRight'); await window.__t.sleep(60);
    const a = [sel().dataset.tab, location.hash, document.activeElement.dataset.tab];
    window.__t.key(document.activeElement, 'End'); await window.__t.sleep(60);
    const b = sel().dataset.tab;
    window.__t.key(document.activeElement, 'Home'); await window.__t.sleep(60);
    const c = sel().dataset.tab;
    window.__t.key(document.activeElement, 'End'); await window.__t.sleep(60);
    const panel = document.querySelector('[role="tabpanel"]');
    return { ok: a[0] === 'income' && a[1] === '#/transactions/income' && a[2] === 'income' && b === 'expense' && c === 'all' && sel().dataset.tab === 'expense'
      && localStorage.getItem('fc.ui.1.tab.transactions') === '"expense"' && panel.getAttribute('aria-labelledby') === 'tabs-transactions-tab-expense'
      && [...document.querySelectorAll('[role="tab"]')].filter((t) => t.tabIndex === 0).length === 1, a, b, c };
  }));
  await axeCheck('transacciones con pestañas (sidebar contraído)', '[role="tabpanel"] .empty-state');
  await step('la pestaña guardada se restaura al volver al módulo', () => inPage(async () => {
    document.querySelector('a[data-route="goals"]').click(); await window.__t.waitFor(() => location.hash === '#/goals');
    await window.__t.waitFor(() => document.querySelector('h1')?.textContent === 'Metas de ahorro');
    document.querySelector('a[data-route="transactions"]').click();
    await window.__t.waitFor(() => document.querySelector('h1')?.textContent === 'Transacciones' && location.hash === '#/transactions/expense');
    return { ok: location.hash === '#/transactions/expense' && document.querySelector('[role="tab"][aria-selected="true"]')?.dataset.tab === 'expense', hash: location.hash };
  }));
  await step('estado vacío del panel: la acción "Agrega tu primer ingreso" lleva a Transacciones > Ingresos', () => inPage(async () => {
    document.querySelector('a[data-route="dashboard"]').click();
    await window.__t.waitFor(() => document.querySelector('h1')?.textContent === 'Panel de control');
    const cta = await window.__t.waitFor(() => [...document.querySelectorAll('.empty-state button')].find((b) => b.textContent === 'Agrega tu primer ingreso'));
    cta.click();
    await window.__t.waitFor(() => location.hash === '#/transactions/income' && document.querySelector('h1')?.textContent === 'Transacciones' && document.querySelector('[role="tab"][aria-selected="true"]')?.dataset.tab === 'income');
    return { ok: location.hash === '#/transactions/income' && document.querySelector('[role="tab"][aria-selected="true"]')?.dataset.tab === 'income', hash: location.hash };
  }));

  // ---------- E. Menú de usuario con teclado ----------
  await step('menú de usuario: ArrowDown abre, flechas navegan, Esc cierra y devuelve el foco', () => inPage(async () => {
    const btn = document.getElementById('user-menu-btn'); btn.focus();
    window.__t.key(btn, 'ArrowDown'); await window.__t.sleep(60);
    const items = [...document.querySelectorAll('[role="menuitem"]')];
    const opened = btn.getAttribute('aria-expanded') === 'true' && document.activeElement === items[0];
    window.__t.key(items[0], 'ArrowDown'); const second = document.activeElement === items[1];
    window.__t.key(items[1], 'ArrowDown'); const third = document.activeElement === items[2];
    window.__t.key(items[2], 'ArrowDown'); const wrap = document.activeElement === items[0];
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); await window.__t.sleep(60);
    return { ok: opened && second && third && wrap && btn.getAttribute('aria-expanded') === 'false' && document.activeElement === btn && document.getElementById('user-menu').hidden, opened, second, third, wrap, expanded: btn.getAttribute('aria-expanded'), active: document.activeElement?.outerHTML.slice(0, 90), menuHidden: document.getElementById('user-menu').hidden, items: items.length };
  }));

  // ---------- F. Móvil: cajón con foco atrapado ----------
  win.setContentSize(420, 800); await new Promise((r) => setTimeout(r, 500));
  await step('móvil (420 px): hamburguesa visible, sidebar fuera de pantalla e inerte', () => inPage(() => {
    const burger = document.querySelector('.hamburger'); const sb = document.getElementById('sidebar');
    return { ok: burger.getClientRects().length > 0 && sb.inert === true && sb.getBoundingClientRect().right <= 1 && document.querySelector('.app').dataset.mobile === 'true' && burger.getAttribute('aria-expanded') === 'false' };
  }));
  await step('móvil: abrir cajón atrapa el foco, Tab cicla, Esc cierra y devuelve el foco a la hamburguesa', () => inPage(async () => {
    const burger = document.querySelector('.hamburger'); const sb = document.getElementById('sidebar');
    burger.click(); await window.__t.sleep(150);
    const open = document.querySelector('.app').dataset.drawer === 'open' && burger.getAttribute('aria-expanded') === 'true' && sb.contains(document.activeElement) && sb.inert === false;
    const list = [...sb.querySelectorAll('a,button')].filter((e) => e.getClientRects().length > 0);
    list.at(-1).focus(); window.__t.key(list.at(-1), 'Tab');
    const wrapped = document.activeElement === list[0];
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); await window.__t.sleep(150);
    const closed = document.querySelector('.app').dataset.drawer === 'closed' && document.activeElement === burger && sb.inert === true;
    burger.click(); await window.__t.sleep(120);
    document.querySelector('a[data-route="goals"]').click(); await window.__t.waitFor(() => location.hash === '#/goals');
    return { ok: open && wrapped && closed && document.querySelector('.app').dataset.drawer === 'closed', open, wrapped, closed };
  }));
  win.setContentSize(1280, 800); await new Promise((r) => setTimeout(r, 400));


  // ====================== FASE 3b: módulos de datos (Admin, escritorio) ======================
  await step('transacciones: el modal valida inline (3 errores), enfoca el primer campo y se abre desde el estado vacío', () => inPage(async () => {
    const T = window.__t;
    location.hash = '#/transactions/income';
    await T.waitFor(() => document.querySelector('h1')?.textContent === 'Transacciones' && document.querySelector('[role="tab"][aria-selected="true"]')?.dataset.tab === 'income');
    const cta = await T.waitFor(() => [...document.querySelectorAll('.empty-state button')].find((b) => b.textContent === 'Agrega tu primer ingreso'));
    cta.click();
    const dlg = await T.waitFor(() => document.querySelector('dialog[open]'));
    const kind = document.getElementById('kind').value;
    dlg.querySelector('form button[type="submit"]').click(); await T.sleep(300);
    const errs = ['categoryId', 'amountCop', 'description'].filter((id) => document.getElementById(`${id}-error`).textContent.trim());
    return { ok: kind === 'income' && errs.length === 3 && dlg.contains(document.activeElement) && document.activeElement.id === 'categoryId' && Boolean(dlg.getAttribute('aria-labelledby')), kind, errs, active: document.activeElement?.id };
  }));
  await axeCheck('formulario de movimiento (modal abierto)', 'dialog[open] #amountCop');
  await step('transacciones: crear un ingreso desde el modal -> toast, fila en la tabla con signo y monto', () => inPage(async () => {
    const T = window.__t;
    T.set('categoryId', T.option('categoryId', 'Salario')); T.set('amountCop', '3.000.000'); T.set('description', 'Nómina noviembre');
    document.querySelector('dialog[open] form button[type="submit"]').click();
    await T.waitFor(() => !document.querySelector('dialog'));
    const toast = await T.waitFor(() => [...document.querySelectorAll('.toast--success')].find((t) => t.textContent.includes('Movimiento guardado')));
    await T.idle();
    const row = T.txt('.data-table tbody tr');
    return { ok: Boolean(toast) && row.includes('Nómina noviembre') && row.includes('3.000.000') && row.includes('+') && T.rows() === 1, row };
  }));
  await step('transacciones: un gasto creado desde la pestaña Ingresos no aparece ahí pero sí en Todos y Gastos (misma tabla, filtro kind)', () => inPage(async () => {
    const T = window.__t;
    T.btn('Nuevo movimiento').click();
    await T.waitFor(() => document.querySelector('dialog[open]'));
    T.set('kind', 'expense'); await T.sleep(60);
    T.set('categoryId', T.option('categoryId', 'Vivienda')); T.set('amountCop', '300000'); T.set('description', 'Arriendo noviembre');
    document.querySelector('dialog[open] form button[type="submit"]').click();
    await T.waitFor(() => !document.querySelector('dialog')); await T.idle();
    const income = T.rows();
    document.getElementById('tabs-transactions-tab-all').click(); await T.sleep(150); await T.idle();
    const all = T.rows();
    document.getElementById('tabs-transactions-tab-expense').click(); await T.sleep(150); await T.idle();
    const expense = T.rows();
    document.getElementById('tabs-transactions-tab-all').click(); await T.sleep(150); await T.idle();
    return { ok: income === 1 && all === 2 && expense === 1, income, all, expense };
  }));
  await step('transacciones: filtros por categoría, búsqueda, fechas (sin resultados + limpiar), orden y tamaño de página', () => inPage(async () => {
    const T = window.__t;
    T.set('f-category', T.option('f-category', 'Vivienda')); await T.sleep(200); await T.idle();
    const byCat = [T.rows(), T.txt('.data-table tbody tr')];
    T.set('f-category', ''); await T.sleep(200); await T.idle();
    T.set('f-q', 'Nómina'); await T.sleep(600); await T.idle();
    const bySearch = [T.rows(), T.txt('.data-table tbody tr')];
    T.set('f-q', ''); await T.sleep(600); await T.idle();
    document.getElementById('f-from').value = '2099-01-01'; document.getElementById('f-from').dispatchEvent(new Event('change', { bubbles: true }));
    await T.sleep(250); await T.idle();
    const empty = T.txt('.empty-state');
    T.btn('Limpiar filtros').click(); await T.sleep(250); await T.idle();
    const restored = T.rows();
    const sortBtn = [...document.querySelectorAll('.th-sort')].find((b) => b.textContent.includes('Monto'));
    sortBtn.click(); await T.sleep(250); await T.idle();
    const asc = [sortBtn.closest('th').getAttribute('aria-sort'), T.txt('.data-table tbody tr')];
    sortBtn.click(); await T.sleep(250); await T.idle();
    const desc = [sortBtn.closest('th').getAttribute('aria-sort'), T.txt('.data-table tbody tr')];
    const size = document.getElementById('transactions-size'); size.value = '20'; size.dispatchEvent(new Event('change', { bubbles: true })); await T.sleep(250);
    return { ok: byCat[0] === 1 && byCat[1].includes('Arriendo') && bySearch[0] === 1 && bySearch[1].includes('Nómina') && empty.includes('Sin resultados') && restored === 2
      && asc[0] === 'ascending' && asc[1].includes('Arriendo') && desc[0] === 'descending' && desc[1].includes('Nómina')
      && localStorage.getItem('fc.ui.1.table.transactions.pageSize') === '20' && localStorage.getItem('fc.ui.1.table.transactions.sort') === '"amount_cop:desc"', byCat, bySearch, empty, restored, asc, desc };
  }));
  await axeCheck('transacciones con datos, filtros y tabla ordenable', '.data-table tbody td');
  await step('borrar con confirmación: cancelar conserva la fila, confirmar la elimina', () => inPage(async () => {
    const T = window.__t;
    T.btn('Nuevo movimiento').click(); await T.waitFor(() => document.querySelector('dialog[open]'));
    T.set('kind', 'expense'); await T.sleep(60); T.set('categoryId', T.option('categoryId', 'Transporte')); T.set('amountCop', '5000'); T.set('description', 'Para borrar');
    document.querySelector('dialog[open] form button[type="submit"]').click(); await T.waitFor(() => !document.querySelector('dialog')); await T.idle();
    const del = () => [...document.querySelectorAll('button')].find((b) => b.getAttribute('aria-label') === 'Eliminar movimiento: Para borrar');
    del().click(); await T.waitFor(() => document.querySelector('.swal2-popup'));
    document.querySelector('.swal2-cancel').click(); await T.sleep(400);
    const kept = Boolean(del());
    del().click(); await T.waitFor(() => document.querySelector('.swal2-popup')); document.querySelector('.swal2-confirm').click();
    await T.waitFor(() => !del()); await T.idle();
    return { ok: kept && !del() && T.rows() === 2 && Boolean([...document.querySelectorAll('.toast--success')].find((t) => t.textContent.includes('eliminado'))), kept };
  }));

  await step('panel: KPI actualizados con el movimiento creado en la UI y 3 gráficos SVG accesibles (role="img", aria-label, tabla de datos)', () => inPage(async () => {
    const T = window.__t;
    await T.nav('dashboard', 'Panel de control'); await T.idle();
    await T.waitFor(() => document.querySelectorAll('svg[role="img"]').length === 3);
    const kpis = [...document.querySelectorAll('.kpi')].map((k) => k.textContent.replace(/\s+/g, ' '));
    const svgs = [...document.querySelectorAll('svg[role="img"]')];
    const tables = [...document.querySelectorAll('.chart-card table.sr-only')];
    const wrap = document.querySelector('.chart-wrap'); wrap.focus();
    window.__t.key(wrap, 'ArrowRight'); await T.sleep(80);
    const tip = document.querySelector('.chart-tooltip');
    return { ok: kpis.length === 2 && kpis[0].includes('Balance Total') && kpis[0].includes('2.700.000') && kpis[1].includes('2.700.000') && svgs.length === 3 && svgs.every((s) => s.getAttribute('aria-label').length > 40)
      && tables.length === 3 && tables.every((t) => t.querySelectorAll('tbody tr').length > 0) && !tip.hidden && tip.textContent.length > 10 && document.querySelectorAll('.chart-legend li').length >= 4,
      kpis, labels: svgs.map((s) => s.getAttribute('aria-label').slice(0, 60)), tip: tip.textContent };
  }));
  await axeCheck('panel con KPI y gráficos de barras, líneas y pastel', '.chart-card');

  await step('categorías: validación inline, crear «Mascotas», filtrar, archivar y ver archivadas', () => inPage(async () => {
    const T = window.__t;
    await T.nav('categories', 'Categorías'); await T.idle();
    const base = T.rows();
    T.btn('Nueva categoría').click(); await T.waitFor(() => document.querySelector('dialog[open]'));
    document.querySelector('dialog[open] form button[type="submit"]').click(); await T.sleep(250);
    const err = document.getElementById('name-error').textContent;
    T.set('name', 'Mascotas'); document.querySelector('dialog[open] form button[type="submit"]').click();
    await T.waitFor(() => !document.querySelector('dialog')); await T.idle();
    const created = T.rows();
    T.set('c-q', 'Mascotas'); await T.sleep(600); await T.idle();
    const filtered = [T.rows(), T.txt('.data-table tbody tr')];
    [...document.querySelectorAll('button')].find((b) => b.getAttribute('aria-label') === 'Archivar categoría: Mascotas').click(); await T.sleep(300); await T.idle();
    const gone = document.querySelector('.empty-state') !== null;
    T.set('c-archived', 'true'); await T.sleep(300); await T.idle();
    const archived = T.txt('.data-table tbody tr');
    T.set('c-archived', 'false'); T.set('c-q', ''); await T.sleep(600); await T.idle();
    return { ok: base === 9 && /obligatorio/.test(err) && created === 10 && filtered[0] === 1 && gone && archived.includes('Mascotas') && archived.includes('Archivada'), base, err, created, filtered, gone, archived };
  }));
  await axeCheck('categorías', '.data-table tbody td');

  await step('presupuestos: asignar a Vivienda y ver la barra pasar de «Alerta» a «Superado» (clase y texto)', () => inPage(async () => {
    const T = window.__t;
    await T.nav('budgets', 'Presupuestos'); await T.idle();
    const empty = Boolean(document.querySelector('.empty-state'));
    T.btn('Agregar presupuesto').click(); await T.waitFor(() => document.querySelector('dialog[open]'));
    T.set('categoryId', T.option('categoryId', 'Vivienda')); T.set('amountCop', '350000');
    document.querySelector('dialog[open] form button[type="submit"]').click(); await T.waitFor(() => !document.querySelector('dialog')); await T.idle();
    const bar = () => document.querySelector('.budget .progress');
    const warn = [T.txt('.budget .badge'), bar().querySelector('.progress__bar').className, bar().getAttribute('aria-valuenow'), T.txt('.alert--warning')];
    [...document.querySelectorAll('button')].find((b) => b.getAttribute('aria-label') === 'Editar presupuesto de Vivienda').click();
    await T.waitFor(() => document.querySelector('dialog[open]'));
    T.set('amountCop', '250000'); document.querySelector('dialog[open] form button[type="submit"]').click();
    await T.waitFor(() => !document.querySelector('dialog')); await T.idle();
    const over = [T.txt('.budget .badge'), bar().querySelector('.progress__bar').className, T.txt('.alert--over')];
    return { ok: empty && warn[0].includes('Alerta') && warn[1].includes('progress__bar--warning') && warn[2] === '86' && warn[3].includes('Vivienda')
      && over[0].includes('Superado') && over[1].includes('progress__bar--over') && over[2].includes('Superaste') && T.txt('.budget__nums').includes('Excedido'), warn, over };
  }));
  await axeCheck('presupuestos con barras de progreso y alertas', '.budget .progress');

  await step('metas: crear «Vacaciones» y aportar 250.000 -> el anillo pasa de 0 % a 25 % y la tarjeta se actualiza', () => inPage(async () => {
    const T = window.__t;
    await T.nav('goals', 'Metas de ahorro'); await T.idle();
    const empty = Boolean(document.querySelector('.empty-state'));
    T.btn('Nueva meta').click(); await T.waitFor(() => document.querySelector('dialog[open]'));
    T.set('name', 'Vacaciones'); T.set('targetAmountCop', '1.000.000'); document.querySelector('dialog[open] form button[type="submit"]').click();
    await T.waitFor(() => !document.querySelector('dialog')); await T.idle();
    const ring = () => document.querySelector('.goal .ring');
    const before = ring().getAttribute('aria-valuenow');
    [...document.querySelectorAll('button')].find((b) => b.getAttribute('aria-label') === 'Aportar a la meta Vacaciones').click();
    await T.waitFor(() => document.querySelector('dialog[open]'));
    T.set('amountCop', '250.000'); document.querySelector('dialog[open] form button[type="submit"]').click();
    await T.waitFor(() => !document.querySelector('dialog')); await T.idle(); await T.sleep(200);
    return { ok: empty && before === '0' && ring().getAttribute('aria-valuenow') === '25' && T.txt('.goal__meta').includes('250.000') && T.txt('.goal__meta').includes('750.000') && /Aporte registrado/.test(T.txt('#toast-region')), before, now: ring().getAttribute('aria-valuenow'), meta: T.txt('.goal__meta') };
  }));
  await axeCheck('metas con anillo de progreso', '.goal .ring');

  await step('reportes: el resumen muestra ingresos, gastos y neto del mes y la pestaña Detalle lista los movimientos', () => inPage(async () => {
    const T = window.__t;
    await T.nav('reports', 'Reportes'); await T.idle();
    await T.waitFor(() => document.querySelectorAll('.kpi').length === 3);
    const kpis = [...document.querySelectorAll('.kpi')].map((k) => k.textContent.replace(/\s+/g, ' '));
    document.getElementById('tabs-reports-tab-detail').click(); await T.sleep(200); await T.idle();
    return { ok: kpis[0].includes('3.000.000') && kpis[1].includes('300.000') && kpis[2].includes('2.700.000') && T.rows() === 2 && T.txt('.table-info').includes('2 de 2'), kpis, rows: T.rows() };
  }));
  await axeCheck('reportes (detalle)', '.data-table tbody td');
  await step('reportes: «Exportar CSV» abre el diálogo de guardado NATIVO y guarda movimientos_<desde>_<hasta>.csv (BOM, encabezado, 2 movimientos); cancelar no escribe nada', async () => {
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const range = await inPage(async () => {
      const T = window.__t;
      document.getElementById('tabs-reports-tab-summary').click(); await T.sleep(200);
      const r = { from: document.getElementById('r-from').value, to: document.getElementById('r-to').value };
      T.btn('Exportar CSV').click();
      return r;
    });
    for (let i = 0; i < 80 && !(saves[0]?.file && fs.existsSync(saves[0].file)); i += 1) await wait(100);
    const d = saves[0];
    const bytes = d?.file && fs.existsSync(d.file) ? fs.readFileSync(d.file) : Buffer.alloc(0);
    const text = bytes.toString('utf8');
    const saved = await inPage(async () => Boolean(await window.__t.waitFor(() => [...document.querySelectorAll('.toast--success')].find((t) => t.textContent.includes('Archivo guardado')))));
    nextCancel = true;
    await inPage(() => { window.__t.btn('Exportar CSV').click(); });
    for (let i = 0; i < 50 && saves.length < 2; i += 1) await wait(100);
    const cancelled = await inPage(async () => Boolean(await window.__t.waitFor(() => [...document.querySelectorAll('.toast--info')].find((t) => t.textContent.includes('Exportación cancelada')))));
    return { ok: path.basename(d?.defaultPath ?? '') === `movimientos_${range.from}_${range.to}.csv` && d.filters[0].extensions.includes('csv') && [...bytes.subarray(0, 3)].join() === '239,187,191'
      && text.includes('Fecha,Tipo,Categoría,Descripción,Monto (COP),Notas') && text.includes('Nómina noviembre') && text.includes('Arriendo noviembre') && saved
      && saves.length === 2 && !saves[1].file && cancelled, dialog: d?.defaultPath, size: bytes.length, saves: saves.length, saved, cancelled };
  });

  await step('usuarios (Admin): crear un Editor desde el modal (contraseña débil -> error inline) y restablecer su contraseña (temporal visible una vez)', () => inPage(async (pw) => {
    const T = window.__t;
    let stage = 'inicio';
    try {
      stage = 'ir a Usuarios'; await T.nav('users', 'Usuarios'); await T.idle();
      stage = 'abrir «Nuevo usuario»'; T.btn('Nuevo usuario').click(); await T.waitFor(() => document.querySelector('dialog[open]'));
      stage = 'contraseña débil'; T.set('username', 'luis'); T.set('displayName', 'Luis Pérez'); T.set('password', 'debil');
      document.querySelector('dialog[open] form button[type="submit"]').click(); await T.sleep(250);
      const weak = document.getElementById('password-error').textContent;
      stage = 'guardar usuario válido'; T.set('password', pw); document.querySelector('dialog[open] form button[type="submit"]').click();
      await T.waitFor(() => !document.querySelector('dialog')); await T.idle();
      stage = 'esperar la fila de luis'; await T.waitFor(() => [...document.querySelectorAll('.data-table tbody tr')].some((r) => r.textContent.includes('luis')));
      const rows = [...document.querySelectorAll('.data-table tbody tr')].map((r) => r.textContent.replace(/\s+/g, ' '));
      const luis = rows.find((r) => r.includes('luis'));
      stage = 'botón Restablecer'; const resetBtn = [...document.querySelectorAll('button')].find((b) => b.getAttribute('aria-label') === 'Restablecer contraseña de luis');
      resetBtn.click();
      stage = 'confirmación SweetAlert'; await T.waitFor(() => document.querySelector('.swal2-popup')); document.querySelector('.swal2-confirm').click();
      stage = 'diálogo de contraseña temporal'; const temp = await T.waitFor(() => document.querySelector('dialog[open] .temp-pass'));
      const pass = temp?.textContent ?? '';
      stage = 'botón Listo'; T.btn('Listo').click();
      await T.waitFor(() => !document.querySelector('.temp-pass')); // el evento `close` retira el diálogo en la tarea siguiente
      return { ok: /Falta/.test(weak) && rows.length === 2 && Boolean(luis) && luis.includes('Editor') && luis.includes('Debe cambiar contraseña') && pass.length === 16 && !document.querySelector('.temp-pass'), weak, luis, passLen: pass.length, rowCount: rows.length };
    } catch (error) {
      return { ok: false, stage, error: error.message, hash: location.hash, h1: document.querySelector('h1')?.textContent, dialogs: document.querySelectorAll('dialog[open]').length, swal: Boolean(document.querySelector('.swal2-popup')),
        buttons: [...document.querySelectorAll('button')].map((b) => b.getAttribute('aria-label') ?? b.textContent.trim()).filter(Boolean).slice(0, 25), toasts: [...document.querySelectorAll('.toast')].map((t) => t.textContent.slice(0, 60)) };
    }
  }, STRONG));
  await axeCheck('usuarios', '.data-table tbody td');

  await step('configuración: guardar nombre del hogar y umbral -> toast y el encabezado se actualiza', () => inPage(async () => {
    const T = window.__t;
    await T.nav('settings', 'Configuración'); await T.waitFor(() => document.getElementById('householdName'));
    T.set('budgetWarningThresholdPct', '10'); T.submit(); await T.sleep(250);
    const bad = document.getElementById('budgetWarningThresholdPct-error').textContent;
    T.set('householdName', 'Casa Cárdenas'); T.set('budgetWarningThresholdPct', '90'); T.submit();
    await T.waitFor(() => document.querySelector('.household')?.textContent === 'Casa Cárdenas');
    return { ok: /entre 50 y 100/.test(bad) && document.querySelector('.household').textContent === 'Casa Cárdenas' && Boolean([...document.querySelectorAll('.toast--success')].find((t) => t.textContent.includes('Configuración guardada'))), bad };
  }));
  await axeCheck('configuración', '#householdName');

  await step('apariencia: abrir desde el menú de usuario, cambiar tema a claro y luego a oscuro con respuesta en tiempo real', () => inPage(async () => {
    const userBtn = document.getElementById('user-menu-btn');
    userBtn.click();
    await window.__t.sleep(80);
    const item = [...document.querySelectorAll('[role="menuitem"]')].find((b) => b.textContent.includes('Apariencia'));
    item.click();
    await window.__t.waitFor(() => location.hash === '#/settings/appearance' && document.getElementById('appearance-content'));

    const lightBtn = await window.__t.waitFor(() => document.querySelector('button[data-theme-value="light"]'));
    lightBtn.click();
    await window.__t.sleep(100);
    const isLight = document.documentElement.dataset.theme === 'light' && localStorage.getItem('fc.ui.1.theme') === '"light"';

    const darkBtn = await window.__t.waitFor(() => document.querySelector('button[data-theme-value="dark"]'));
    darkBtn.click();
    await window.__t.sleep(100);
    const isDark = document.documentElement.dataset.theme === 'dark' && localStorage.getItem('fc.ui.1.theme') === '"dark"';

    return { ok: isLight && isDark, isLight, isDark };
  }));
  await axeCheck('apariencia de la app', '.appearance-layout');

  await step('panel de control liquid glass: el botón flotante abre el drawer, las pestañas funcionan y se cierra correctamente', () => inPage(async () => {
    const toggle = document.getElementById('panel-toggle');
    toggle.click();
    await window.__t.waitFor(() => document.getElementById('control-panel')?.classList.contains('is-open'));
    const panel = document.getElementById('control-panel');
    const title = document.getElementById('cp-title');
    const isVisible = panel && !panel.hidden && title && title.textContent.includes('Panel de control');

    const geoTab = document.querySelector('[data-cp-tab="geometry"]');
    if (geoTab) {
      geoTab.click();
      await window.__t.sleep(50);
    }

    const closeBtn = document.getElementById('cp-close');
    closeBtn.click();
    await window.__t.waitFor(() => !panel.classList.contains('is-open'));
    return { ok: Boolean(isVisible && !panel.classList.contains('is-open')) };
  }));

  await step('LocalStorage: solo preferencias de UI; NINGÚN dato financiero ni el token', () => inPage(() => {
    const keys = Object.keys(localStorage);
    const values = keys.map((k) => `${k}=${localStorage.getItem(k)}`).join('|');
    const re = /^fc\.ui\.\d+\.(sidebar\.(collapsed|pinned)|table\.[a-z0-9_-]+\.(pageSize|sort)|tab\.[a-z0-9_-]+|dashboard\.month|theme|mode|geometry|geo|fontSize|reducedMotion|background|bg|anim|accentColor|language|highContrast|a11y\.[a-zA-Z0-9_-]+)$/;
    const secrets = ['Nómina', 'Arriendo', '3.000.000', '300000', 'Vacaciones', 'Mascotas', 'luis', 'Casa Cárdenas'];
    return { ok: keys.every((k) => re.test(k)) && !secrets.some((x) => values.includes(x)) && !values.includes(window.__tok) && sessionStorage.length === 0, keys };
  }));

  // ---------- G. Roles, anti-XSS y cambio obligatorio ----------
  await step('el Admin crea un Editor con un nombre malicioso y cierra sesión: toast, layout destruido', () => inPage(async (pw) => {
    const { api } = await import('/js/core/api.js');
    const created = await api.post('/users', { username: 'ana', displayName: '<img src=x onerror="window.__xss=1">', role: 'editor', password: pw });
    document.getElementById('user-menu-btn').click();
    [...document.querySelectorAll('[role="menuitem"]')].find((b) => b.textContent.includes('Cerrar sesión')).click();
    await window.__t.waitFor(() => location.hash === '#/login');
    const toast = await window.__t.waitFor(() => [...document.querySelectorAll('.toast')].find((t) => t.textContent.includes('Sesión cerrada')));
    return { ok: created.data.mustChangePassword === true && Boolean(toast) && toast.getAttribute('role') === 'status' && !document.querySelector('.app') && Boolean(document.getElementById('toast-region').getAttribute('aria-label')) };
  }, STRONG));
  await login('ana', STRONG);
  await step('Editor con contraseña restablecida: forzado a /change-password y no puede saltarse el guardia', () => inPage(async () => {
    await window.__t.waitFor(() => location.hash === '#/change-password' && document.querySelector('.alert--info'));
    location.hash = '#/dashboard'; await window.__t.sleep(400);
    return { ok: location.hash === '#/change-password' && !document.querySelector('.app') && document.title.startsWith('Cambiar contraseña'), hash: location.hash };
  }));
  await axeCheck('cambio de contraseña obligatorio', '#currentPassword');
  await step('cambio de contraseña: errores inline del servidor y del cliente, luego entra al panel', () => inPage(async () => {
    window.__t.set('currentPassword', 'incorrecta-1234'); window.__t.set('newPassword', 'Nueva-Clave-2027!'); window.__t.set('confirm', 'Nueva-Clave-2027!'); window.__t.submit();
    await window.__t.waitFor(() => document.getElementById('currentPassword-error').textContent);
    const serverErr = document.getElementById('currentPassword-error').textContent;
    window.__t.set('currentPassword', 'Clave-Segura-2026!'); window.__t.set('newPassword', 'debil'); window.__t.set('confirm', 'debil'); window.__t.submit(); await window.__t.sleep(200);
    const clientErr = document.getElementById('newPassword-error').textContent;
    window.__t.set('newPassword', 'Nueva-Clave-2027!'); window.__t.set('confirm', 'Nueva-Clave-2027!'); window.__t.submit();
    await window.__t.waitFor(() => location.hash === '#/dashboard' && document.querySelector('.app'));
    return { ok: /incorrecta/.test(serverErr) && clientErr.startsWith('Falta:') && location.hash === '#/dashboard', serverErr, clientErr };
  }));
  await step('anti-XSS: el nombre con HTML se muestra como texto; no se crea <img> ni se ejecuta onerror', () => inPage(async () => {
    await window.__t.sleep(300);
    const name = document.querySelector('.user-btn__name');
    return { ok: name.textContent === '<img src=x onerror="window.__xss=1">' && !document.querySelector('header img') && window.__xss === undefined, text: name.textContent };
  }));
  await step('rol Editor: no ve "Usuarios" en el menú y /users redirige al panel con aviso', () => inPage(async () => {
    const hasLink = Boolean(document.querySelector('a[data-route="users"]'));
    location.hash = '#/users'; await window.__t.waitFor(() => location.hash === '#/dashboard');
    const toast = await window.__t.waitFor(() => [...document.querySelectorAll('.toast--warning')].find((t) => t.textContent.includes('No tienes permiso')));
    return { ok: !hasLink && Boolean(toast) && location.hash === '#/dashboard', hasLink };
  }));

  // ---------- H. Expiración por inactividad (30 min) ----------
  await step('inactividad: el servidor invalida la sesión y el cliente muestra el modal y vuelve a /login', async () => {
    const db = new Database(path.join(userData, 'data', 'finanzas.db'));
    db.prepare("UPDATE sessions SET last_activity_at = '2000-01-01T00:00:00.000Z' WHERE revoked_at IS NULL").run();
    db.close();
    return inPage(async () => {
      document.querySelector('a[data-route="goals"]').click();
      const pop = await window.__t.waitFor(() => document.querySelector('.swal2-popup'));
      const text = pop?.textContent ?? '';
      const onLogin = location.hash === '#/login' && !document.querySelector('.app');
      document.querySelector('.swal2-confirm')?.click();
      await window.__t.sleep(300);
      return { ok: /inactividad/.test(text) && onLogin && !document.querySelector('.swal2-popup'), text: text.slice(0, 80), hash: location.hash };
    });
  });

  // ---------- Resumen ----------
  const noise = /status of 401/;
  const consoleProblems = logs.filter((l) => (/error/i.test(l.level) || /Content Security Policy|Refused to/i.test(l.message)) && !noise.test(l.message));
  steps.push({ name: 'consola sin errores ni violaciones de CSP (los 401 esperados se ignoran)', ok: consoleProblems.length === 0, ...(consoleProblems.length ? { detail: consoleProblems.slice(0, 5) } : {}) });

  const passed = steps.every((s) => s.ok);
  console.log('UI_RESULT ' + JSON.stringify({ passed, total: steps.length, failed: steps.filter((s) => !s.ok), steps: steps.map((s) => `${s.ok ? 'OK ' : 'FAIL'} ${s.name}`) }, null, 2));
  app.on('will-quit', () => { fs.rmSync(userData, { recursive: true, force: true }); });
  app.quit();
  setTimeout(() => app.exit(passed ? 0 : 1), 4000).unref();
  app.on('quit', (_e, code) => process.exit(passed ? code : 1));
});
