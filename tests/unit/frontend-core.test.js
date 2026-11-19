// [A.2][A.3][B.5] Lógica pura del frontend: store, preferencias, router (guardias), formularios y reglas del proyecto.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

globalThis.window = new EventTarget(); // el store/eventos usan window; en Node basta un EventTarget
const { EVENTS } = await import('../../src/renderer/js/core/events.js');
const store = await import('../../src/renderer/js/core/store.js');
const { createPrefs } = await import('../../src/renderer/js/core/prefs.js');
const { decide, parseHash, resolveRoute } = await import('../../src/renderer/js/core/router.js');
const { passwordError, passwordRules } = await import('../../src/renderer/js/ui/form.js');
const { formatCop, formatMonth, currentMonth } = await import('../../src/renderer/js/core/format.js');
const { ROUTES } = await import('../../src/renderer/js/routes.js');
const { checkPassword } = await import('../../src/server/shared/password-policy.js');

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

test('store: escritura inmutable por ruta, evento con prev y sin ruido si el valor no cambia', () => {
  store._resetForTests();
  const events = [];
  globalThis.window.addEventListener(EVENTS.STATE, (e) => events.push(e.detail));
  const before = store.getState();
  store.setState('session.user', { id: 1, role: 'admin' });
  assert.notEqual(store.getState(), before, 'el estado raíz es un objeto nuevo');
  assert.equal(before.session.user, null, 'el estado anterior no se muta');
  assert.equal(store.select('session.user.role'), 'admin');
  assert.deepEqual(events.at(-1), { path: 'session.user', value: { id: 1, role: 'admin' }, prev: null });
  const n = events.length;
  store.setState('session.status', store.select('session.status'));
  assert.equal(events.length, n);
});

test('store: subscribe avisa por ruta, ancestros y descendientes, y se puede cancelar', () => {
  store._resetForTests();
  const seen = [];
  const off = store.subscribe('session.user', (value) => seen.push(value));
  store.setState('session.user', { id: 2 });
  store.setState('session.expiresAt', 'x'); // ruta no relacionada
  store.setState('session', { status: 'anonymous', user: null, expiresAt: null, needsSetup: null }); // ancestro
  off();
  store.setState('session.user', { id: 3 });
  assert.deepEqual(seen, [{ id: 2 }, null]);
  store.update('cache.household', () => 'Casa');
  assert.equal(store.select('cache.household'), 'Casa');
});

test('store: resetSession conserva needsSetup y limpia el usuario', () => {
  store._resetForTests();
  store.setState('session.needsSetup', false);
  store.setState('session.user', { id: 1 });
  store.resetSession();
  assert.deepEqual([store.select('session.user'), store.select('session.status'), store.select('session.needsSetup')], [null, 'anonymous', false]);
});

function fakeStorage() {
  const m = new Map();
  return { m, getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v), removeItem: (k) => m.delete(k) };
}

test('prefs: solo claves de UI de la lista blanca, por usuario, con valores simples', () => {
  const storage = fakeStorage();
  const p = createPrefs(7, storage);
  p.set('sidebar.collapsed', true);
  p.set('table.transactions.pageSize', 20);
  p.set('tab.reports', 'detail');
  p.set('dashboard.month', '2026-11');
  assert.equal(p.get('sidebar.collapsed'), true);
  assert.equal(p.get('sidebar.pinned', false), false);
  assert.deepEqual([...storage.m.keys()].sort(), ['fc.ui.7.dashboard.month', 'fc.ui.7.sidebar.collapsed', 'fc.ui.7.tab.reports', 'fc.ui.7.table.transactions.pageSize']);
  assert.equal(createPrefs(8, storage).get('sidebar.collapsed', 'nada'), 'nada', 'aislado por usuario');
  p.remove('sidebar.collapsed');
  assert.equal(p.get('sidebar.collapsed'), null);
});

test('prefs: rechaza claves ajenas a la UI (token, datos financieros) y valores complejos', () => {
  const p = createPrefs(1, fakeStorage());
  for (const key of ['token', 'session.token', 'transactions', 'balance', 'sidebar.collapsed.extra', '../x', 'tab.', 'table.x.balance']) {
    assert.throws(() => p.set(key, 'x'), /no permitida/, key);
    assert.throws(() => p.get(key), /no permitida/, key);
  }
  assert.throws(() => p.set('tab.reports', { a: 1 }), /booleanos, números o textos/);
  assert.throws(() => p.set('tab.reports', 'x'.repeat(101)), /booleanos/);
});

test('prefs: un valor corrupto devuelve el valor por defecto y sin almacenamiento no falla', () => {
  const storage = fakeStorage();
  storage.setItem('fc.ui.1.sidebar.pinned', '{no es json');
  assert.equal(createPrefs(1, storage).get('sidebar.pinned', false), false);
  assert.doesNotThrow(() => createPrefs(1, null).set('sidebar.pinned', true));
});

test('router: parseHash separa módulo, pestaña y consulta; tolera basura', () => {
  assert.deepEqual(parseHash('#/transactions/income?x=1&y=2'), { path: 'transactions', tab: 'income', query: { x: '1', y: '2' } });
  assert.deepEqual(parseHash('#/dashboard'), { path: 'dashboard', tab: null, query: {} });
  assert.deepEqual(parseHash(''), { path: '', tab: null, query: {} });
  assert.equal(parseHash('#/a/b/c/d').tab, 'b');
  assert.equal(parseHash('#/%E0%A4%A').path, '', 'URL mal codificada no lanza');
});

test('router: tabla de rutas coherente (paths únicos, roles válidos, vistas, íconos)', () => {
  const paths = ROUTES.map((r) => r.path);
  assert.equal(new Set(paths).size, paths.length);
  for (const r of ROUTES) {
    assert.equal(typeof r.view, 'function', r.path);
    assert.ok(r.title, r.path);
    for (const role of r.roles ?? []) assert.ok(['admin', 'editor'].includes(role));
    if (r.nav) assert.ok(r.nav.icon && r.nav.label, r.path);
    for (const t of r.tabs ?? []) assert.ok(t.id && t.label);
  }
  assert.deepEqual(resolveRoute(ROUTES, 'users').roles, ['admin']);
  assert.equal(resolveRoute(ROUTES, 'inexistente'), null);
  assert.deepEqual(ROUTES.filter((r) => r.public).map((r) => r.path).sort(), ['login', 'recover', 'setup']);
});

const route = (p) => resolveRoute(ROUTES, p);
const sess = (over = {}) => ({ user: null, needsSetup: false, ...over });
const user = (over = {}) => ({ id: 1, role: 'editor', mustChangePassword: false, ...over });

test('guardia: primer arranque fuerza /setup y después /setup deja de existir', () => {
  assert.deepEqual(decide({ route: route('login'), session: sess({ needsSetup: true }) }), { redirect: 'setup' });
  assert.deepEqual(decide({ route: route('dashboard'), session: sess({ needsSetup: true }) }), { redirect: 'setup' });
  assert.deepEqual(decide({ route: route('setup'), session: sess({ needsSetup: true }) }), { allow: true });
  assert.deepEqual(decide({ route: route('setup'), session: sess() }), { redirect: 'login' });
});

test('guardia: sin sesión solo rutas públicas; con sesión, las públicas redirigen al panel', () => {
  assert.deepEqual(decide({ route: route('transactions'), session: sess() }), { redirect: 'login' });
  assert.deepEqual(decide({ route: route('change-password'), session: sess() }), { redirect: 'login' });
  assert.deepEqual(decide({ route: route('recover'), session: sess() }), { allow: true });
  assert.deepEqual(decide({ route: route('login'), session: sess({ user: user() }) }), { redirect: 'dashboard' });
});

test('guardia: contraseña pendiente de cambio bloquea todo salvo /change-password', () => {
  const s = sess({ user: user({ mustChangePassword: true }) });
  for (const p of ['dashboard', 'transactions', 'settings']) assert.deepEqual(decide({ route: route(p), session: s }), { redirect: 'change-password' }, p);
  assert.deepEqual(decide({ route: route('change-password'), session: s }), { allow: true });
});

test('guardia: rutas por rol (Usuarios solo Admin) avisan con notice', () => {
  assert.deepEqual(decide({ route: route('users'), session: sess({ user: user({ role: 'editor' }) }) }), { redirect: 'dashboard', notice: 'forbidden' });
  assert.deepEqual(decide({ route: route('users'), session: sess({ user: user({ role: 'admin' }) }) }), { allow: true });
});

test('política de contraseña del cliente == política del servidor (misma decisión de válida/inválida)', () => {
  const samples = ['', 'corta', 'Clave-Segura-2026!', 'clave-segura-2026!', 'CLAVE-SEGURA-2026!', 'Clave-Segura-!!!!', 'Clave Segura 2026', 'Ñandú vuela 2026',
    'Admin-Clave-2026!', 'JACO-Clave-2026!', 'abcdefghijkl', '123456789012', 'Abcdefgh1234'];
  for (const username of ['', 'admin', 'jaco']) {
    for (const pw of samples) {
      assert.equal(passwordError(pw, username) === null, checkPassword(pw, { username }).length === 0, `${JSON.stringify(pw.slice(0, 24))} / ${username}`);
    }
  }
  assert.equal(passwordRules('Clave-Segura-2026!', 'jaco').every((r) => r.ok), true);
  assert.ok(checkPassword(`Aa1!${'x'.repeat(130)}`).some((m) => m.includes('Máximo')), 'el tope de 128 lo aplica el servidor (y maxlength en el campo)');
  assert.deepEqual(passwordRules('abc', '').filter((r) => !r.ok).map((r) => r.id), ['len', 'upper', 'digit', 'symbol']);
});

test('formato es-CO: pesos sin decimales y mes en español', () => {
  assert.match(formatCop(1234567), /1\.234\.567/);
  assert.match(formatCop(-300000), /-.*300\.000/);
  assert.equal(formatMonth('2026-11'), 'noviembre de 2026');
  assert.equal(currentMonth(new Date(2026, 10, 30, 23, 30)), '2026-11');
});

test('reglas de la Fase 3: LocalStorage solo en prefs.js, sin storage de token, sin innerHTML ni frameworks', () => {
  const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : e.name.endsWith('.js') ? [path.join(d, e.name)] : []));
  const files = walk(path.join(ROOT, 'src/renderer/js')).map((f) => ({ rel: path.relative(ROOT, f).replaceAll('\\', '/'), src: fs.readFileSync(f, 'utf8') }));
  assert.ok(files.length > 20);
  for (const { rel, src } of files) {
    if (rel !== 'src/renderer/js/core/prefs.js') assert.equal(/localStorage|sessionStorage|indexedDB/.test(src), false, `${rel} usa almacenamiento`);
    assert.equal(/\.innerHTML\s*=|\.outerHTML\s*=|insertAdjacentHTML|document\.write/.test(src), false, `${rel} construye HTML en cadena`);
    assert.equal(/\balert\(|\bconfirm\(|\bprompt\(/.test(src.replace(/\.confirm\(|confirm\(\{|\{ confirm|, confirm|import \{[^}]*confirm/g, '')), false, `${rel} usa diálogos nativos`);
  }
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  const deps = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies });
  assert.deepEqual(deps.filter((d) => /^(react|react-dom|vue|@vue\/.+|angular|@angular\/.+|svelte|jquery|preact|lit|alpinejs|htmx\.org|backbone|ember-source)$/.test(d)), []);
});
