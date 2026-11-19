// [D.15] Proceso principal: seguridad de URLs/IPC/webPreferences, menú y atajos, guardado nativo y recuperación ante caída.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { createCrashHandler } from '../../src/main/crash.js';
import { createFileService, MAX_BYTES, sanitizeFileName } from '../../src/main/files.js';
import { buildMenuTemplate, installMenu } from '../../src/main/menu.js';
import { assertSecureWebPreferences, isPermissionAllowed, isTrustedSender, isTrustedUrl } from '../../src/main/security.js';
import { tempDir } from '../helpers/db.js';

const BASE = 'http://127.0.0.1:41234';

test('isTrustedUrl: solo el origen exacto del servidor local', () => {
  for (const ok of [`${BASE}/`, `${BASE}/#/login`, `${BASE}/js/main.js?x=1`]) assert.equal(isTrustedUrl(ok, BASE), true, ok);
  for (const bad of ['https://example.com/', 'http://127.0.0.1:41235/', 'http://127.0.0.1/', 'http://localhost:41234/', 'https://127.0.0.1:41234/',
    'http://127.0.0.1:41234.evil.com/', 'http://127.0.0.1:41234@evil.com/', 'file:///etc/passwd', 'javascript:alert(1)', 'data:text/html,x', 'about:blank', '', 'no es url']) {
    assert.equal(isTrustedUrl(bad, BASE), false, bad);
  }
  assert.equal(isTrustedUrl(undefined, BASE), false);
});

test('isTrustedSender: ventana principal + página del servidor local', () => {
  const main = {};
  assert.equal(isTrustedSender({ sender: main, senderFrame: { url: `${BASE}/` } }, BASE, main), true);
  assert.equal(isTrustedSender({ sender: {}, senderFrame: { url: `${BASE}/` } }, BASE, main), false, 'otra ventana');
  assert.equal(isTrustedSender({ sender: main, senderFrame: { url: 'https://evil.com/' } }, BASE, main), false, 'otro origen');
  assert.equal(isTrustedSender({ sender: main, senderFrame: null }, BASE, main), false);
  assert.equal(isTrustedSender({ sender: main, senderFrame: { url: `${BASE}/` } }, BASE, undefined), false, 'sin ventana');
});

test('webPreferences: exige contextIsolation, sandbox y webSecurity; rechaza nodeIntegration y webview', () => {
  const good = { contextIsolation: true, nodeIntegration: false, sandbox: true, webSecurity: true, webviewTag: false, allowRunningInsecureContent: false };
  assert.doesNotThrow(() => assertSecureWebPreferences(good));
  for (const bad of [{ contextIsolation: false }, { nodeIntegration: true }, { sandbox: false }, { webSecurity: false }, { webviewTag: true }, { allowRunningInsecureContent: true }]) {
    assert.throws(() => assertSecureWebPreferences({ ...good, ...bad }), /Configuración de seguridad inválida/, JSON.stringify(bad));
  }
  assert.throws(() => assertSecureWebPreferences({}), /contextIsolation/);
});

test('permisos: solo el portapapeles; el resto se deniega', () => {
  assert.equal(isPermissionAllowed('clipboard-sanitized-write'), true);
  for (const p of ['geolocation', 'notifications', 'media', 'clipboard-read', 'midi', 'openExternal', 'fullscreen', 'unknown']) assert.equal(isPermissionAllowed(p), false, p);
});

const flat = (items) => items.flatMap((i) => (i.submenu ? [i, ...flat(i.submenu)] : [i]));
function menuWith(over = {}) {
  const calls = [];
  const template = buildMenuTemplate({ send: (c) => calls.push(['send', c]), reload: () => calls.push(['reload']), about: () => calls.push(['about']), platform: 'win32', ...over });
  return { template, calls, items: flat(template), find: (label) => flat(template).find((i) => i.label === label) };
}

test('menú: estructura Archivo / Editar / Ver / Ayuda', () => {
  const { template } = menuWith();
  assert.deepEqual(template.map((m) => m.label), ['Archivo', 'Editar', 'Ver', 'Ayuda']);
});

test('menú: cada atajo está definido y dispara SU comando', () => {
  const { find, calls } = menuWith();
  const expected = [['Nuevo movimiento', 'CmdOrCtrl+N', ['send', 'new-transaction']], ['Exportar CSV…', 'CmdOrCtrl+E', ['send', 'export-csv']],
    ['Imprimir a PDF…', 'CmdOrCtrl+P', ['send', 'print-pdf']], ['Alternar sidebar', 'CmdOrCtrl+B', ['send', 'toggle-sidebar']], ['Recargar', 'CmdOrCtrl+R', ['reload']]];
  for (const [label, accelerator, call] of expected) {
    const item = find(label);
    assert.ok(item, label);
    assert.equal(item.accelerator, accelerator, label);
    calls.length = 0;
    item.click();
    assert.deepEqual(calls, [call], label);
  }
  find('Acerca de FinanzasCardenas').click();
  assert.deepEqual(calls.at(-1), ['about']);
});

test('menú: los atajos son únicos y Editar usa roles del sistema', () => {
  const { items } = menuWith();
  const accels = items.map((i) => i.accelerator).filter(Boolean);
  assert.equal(new Set(accels).size, accels.length);
  assert.deepEqual(items.filter((i) => ['undo', 'redo', 'cut', 'copy', 'paste', 'selectAll'].includes(i.role)).map((i) => i.role), ['undo', 'redo', 'cut', 'copy', 'paste', 'selectAll']);
});

test('menú: las herramientas de desarrollo solo existen en desarrollo; Salir/Cerrar según plataforma', () => {
  assert.equal(menuWith().items.some((i) => i.role === 'toggleDevTools'), false);
  assert.equal(menuWith({ isDev: true }).items.some((i) => i.role === 'toggleDevTools'), true);
  assert.ok(menuWith({ platform: 'win32' }).items.some((i) => i.role === 'quit'));
  assert.ok(menuWith({ platform: 'darwin' }).items.some((i) => i.role === 'close'));
});

test('installMenu: construye y registra la plantilla', () => {
  let built = null; let set = null;
  installMenu({ buildFromTemplate: (t) => { built = t; return { id: 'menu' }; }, setApplicationMenu: (m) => { set = m; } }, { send() {}, reload() {}, about() {} });
  assert.equal(built.length, 4);
  assert.deepEqual(set, { id: 'menu' });
});

test('sanitizeFileName: sin rutas, caracteres seguros y extensión correcta', () => {
  assert.equal(sanitizeFileName('movimientos_2026-11-01_2026-11-30.csv', '.csv'), 'movimientos_2026-11-01_2026-11-30.csv');
  assert.equal(sanitizeFileName('../../etc/passwd', '.csv'), 'passwd.csv');
  assert.equal(sanitizeFileName('C:\\Users\\x\\reporte.PDF', '.pdf'), 'reporte.pdf');
  assert.equal(sanitizeFileName('a<b>:"c|?*.csv', '.csv'), 'a_b___c___.csv');
  assert.equal(sanitizeFileName('', '.pdf'), 'archivo.pdf');
  assert.equal(sanitizeFileName(null, '.csv'), 'archivo.csv');
  assert.equal(sanitizeFileName('...', '.csv'), 'archivo.csv');
  assert.equal(sanitizeFileName('informe del mes', '.pdf'), 'informe del mes.pdf');
  assert.ok(sanitizeFileName('x'.repeat(500), '.csv').length <= 104);
  assert.equal(sanitizeFileName('Ñandú Ahorro.csv', '.csv'), 'Ñandú Ahorro.csv');
});

function fileFixture(dialogResult) {
  const dir = tempDir('fc-files-');
  const calls = [];
  const dialog = { showSaveDialog: async (win, opts) => { calls.push({ win, opts }); return typeof dialogResult === 'function' ? dialogResult(opts, dir) : dialogResult; } };
  return { dir, calls, svc: createFileService({ dialog, fs, getDefaultDir: () => '/docs', getWindow: () => ({ id: 'win' }) }) };
}

test('saveBytes: abre el diálogo nativo con nombre seguro y filtro, y escribe SOLO donde el usuario eligió', async () => {
  const f = fileFixture((_o, dir) => ({ canceled: false, filePath: path.join(dir, 'elegido.csv') }));
  const r = await f.svc.saveBytes({ kind: 'csv', suggestedName: '../../malo.csv', bytes: new TextEncoder().encode('a,b\r\n1,2\r\n') });
  assert.deepEqual([r.canceled, r.fileName, r.bytes], [false, 'elegido.csv', 10]);
  assert.equal(fs.readFileSync(r.filePath, 'utf8'), 'a,b\r\n1,2\r\n');
  assert.equal(f.calls[0].opts.defaultPath, path.join('/docs', 'malo.csv'));
  assert.deepEqual(f.calls[0].opts.filters[0].extensions, ['csv']);
  assert.deepEqual(f.calls[0].win, { id: 'win' });
  fs.rmSync(f.dir, { recursive: true, force: true });
});

test('saveBytes: si el usuario cancela no se escribe nada; si omite la extensión se añade', async () => {
  const cancel = fileFixture({ canceled: true });
  assert.deepEqual(await cancel.svc.saveBytes({ kind: 'pdf', suggestedName: 'r.pdf', bytes: new Uint8Array([1]) }), { canceled: true });
  assert.deepEqual(await fileFixture({ canceled: false }).svc.saveBytes({ kind: 'pdf', suggestedName: 'r', bytes: new Uint8Array([1]) }), { canceled: true });
  const noExt = fileFixture((_o, dir) => ({ canceled: false, filePath: path.join(dir, 'sinext') }));
  const r = await noExt.svc.saveBytes({ kind: 'pdf', suggestedName: 'r', bytes: new Uint8Array([37, 80, 68, 70]) });
  assert.equal(r.fileName, 'sinext.pdf');
  assert.ok(fs.existsSync(r.filePath));
  fs.rmSync(noExt.dir, { recursive: true, force: true });
});

test('saveBytes: rechaza tipos no permitidos, contenido inválido, vacío y demasiado grande (sin abrir el diálogo)', async () => {
  const f = fileFixture({ canceled: true });
  const bytes = new Uint8Array([1]);
  await assert.rejects(() => f.svc.saveBytes({ kind: 'exe', suggestedName: 'x', bytes }), /Tipo de archivo/);
  for (const k of ['__proto__', 'constructor', 'toString', undefined, null, 42]) await assert.rejects(() => f.svc.saveBytes({ kind: k, suggestedName: 'x', bytes }), /Tipo de archivo/, String(k));
  await assert.rejects(() => f.svc.saveBytes({ kind: 'csv', suggestedName: 'x', bytes: 'texto' }), /Contenido inválido/);
  await assert.rejects(() => f.svc.saveBytes({ kind: 'csv', suggestedName: 'x', bytes: new Uint8Array(0) }), /Tamaño/);
  await assert.rejects(() => f.svc.saveBytes({ kind: 'csv', suggestedName: 'x', bytes: new Uint8Array(MAX_BYTES + 1) }), /Tamaño/);
  assert.equal(f.calls.length, 0);
});

function crashFixture(response) {
  const log = { loaded: [], quit: 0, box: null };
  const win = { isDestroyed: () => false, loadURL: async (u) => { log.loaded.push(u); } };
  const handler = createCrashHandler({ dialog: { showMessageBox: async (w, o) => { log.box = o; return { response }; } }, getWindow: () => win, baseUrl: BASE, quit: () => { log.quit += 1; } });
  return { log, handler };
}

test('render-process-gone: avisa con un diálogo de error y reinicia la interfaz', async () => {
  const { log, handler } = crashFixture(0);
  await handler({}, { reason: 'crashed' });
  assert.equal(log.box.type, 'error');
  assert.deepEqual(log.box.buttons, ['Reiniciar interfaz', 'Salir']);
  assert.match(log.box.detail, /crashed/);
  assert.deepEqual([log.loaded, log.quit], [[`${BASE}/`], 0]);
});

test('render-process-gone: "Salir" cierra la aplicación; una salida limpia se ignora', async () => {
  const a = crashFixture(1);
  await a.handler({}, { reason: 'oom' });
  assert.deepEqual([a.log.loaded.length, a.log.quit], [0, 1]);
  const b = crashFixture(0);
  await b.handler({}, { reason: 'clean-exit' });
  assert.equal(b.log.box, null);
});
