// [A.3] Comandos del menú nativo en el renderer: ejecución directa, navegación + pendiente y sesión requerida.
import assert from 'node:assert/strict';
import test from 'node:test';

const win = new EventTarget();
globalThis.window = win;
const { EVENTS } = await import('../../src/renderer/js/core/events.js');
const commands = await import('../../src/renderer/js/core/commands.js');

function setup({ user = { id: 1 } } = {}) {
  commands._resetForTests();
  const log = { nav: [], info: [], events: [] };
  let listener;
  win.fc = { onCommand: (cb) => { listener = cb; return () => { listener = null; }; } };
  win.addEventListener(EVENTS.COMMAND, (e) => log.events.push(e.detail));
  const off = commands.registerCommands({ navigate: (p) => log.nav.push(p), toast: { info: (m) => log.info.push(m) }, getUser: () => user });
  return { log, send: (name) => listener?.(name), off, hasListener: () => listener !== null };
}
const tick = () => new Promise((r) => setTimeout(r, 0));

test('un comando con la vista abierta se ejecuta directamente, sin navegar', () => {
  const { log, send } = setup();
  let ran = 0;
  commands.onCommand('new-transaction', () => { ran += 1; });
  send('new-transaction');
  assert.deepEqual([ran, log.nav], [1, []]);
});

test('sin la vista abierta navega a su módulo y la vista lo ejecuta al registrarse', async () => {
  const { log, send } = setup();
  send('export-csv');
  assert.deepEqual(log.nav, ['reports/summary']);
  let ran = 0;
  commands.onCommand('export-csv', () => { ran += 1; }); // la vista se monta y registra su manejador
  await tick();
  assert.equal(ran, 1);
  commands.onCommand('export-csv', () => { ran += 10; });
  await tick();
  assert.equal(ran, 1, 'el comando pendiente se consume una sola vez');
});

test('cada comando navega a su propio módulo', () => {
  const { log, send } = setup();
  send('new-transaction'); send('print-pdf');
  assert.deepEqual(log.nav, ['transactions/all', 'reports/summary']);
});

test('sin sesión: avisa y no navega ni ejecuta; los comandos desconocidos se ignoran', () => {
  const { log, send } = setup({ user: null });
  let ran = 0;
  commands.onCommand('new-transaction', () => { ran += 1; });
  send('new-transaction'); send('print-pdf');
  assert.deepEqual([ran, log.nav, log.info.length], [0, [], 2]);
  const s2 = setup();
  s2.send('rm-rf');
  assert.deepEqual(s2.log.nav, []);
});

test('Ctrl+B: emite el evento del shell solo con sesión iniciada', () => {
  const a = setup();
  a.send('toggle-sidebar');
  assert.deepEqual(a.log.events.at(-1), { name: 'toggle-sidebar' });
  const before = a.log.events.length;
  setup({ user: null }).send('toggle-sidebar');
  assert.equal(a.log.events.length, before, 'sin sesión no se emite ningún evento');
});

test('cancelar la suscripción y cambiar de vista: el manejador viejo no se ejecuta', () => {
  const { send } = setup();
  let ran = 0;
  const off = commands.onCommand('new-transaction', () => { ran += 1; });
  off();
  send('new-transaction');
  assert.equal(ran, 0);
});

test('fuera de Electron (sin window.fc) no registra nada', () => {
  delete win.fc;
  assert.equal(typeof commands.registerCommands({ navigate() {}, toast: {}, getUser: () => ({}) }), 'function');
});
