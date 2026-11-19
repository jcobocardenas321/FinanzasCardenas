// [D.15] Smoke de Electron: arranque + endurecimiento + menú nativo + diálogos de guardado + printToPDF + caída del renderer.
// Los diálogos nativos y shell.openExternal se sustituyen por espías (no hay humano que los pulse); todo lo demás es real.
// Uso: npm run smoke   (Linux sin pantalla: xvfb-run -a npx electron --no-sandbox scripts/smoke-electron.mjs)
import { app, BrowserWindow, dialog, Menu, shell } from 'electron';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'fc-smoke-'));
app.setPath('userData', userData);
setTimeout(() => { console.log('SMOKE_RESULT ' + JSON.stringify({ passed: false, error: 'watchdog: timeout' })); app.exit(2); }, 150_000).unref();

const saves = [];
const boxes = [];
const opened = [];
dialog.showSaveDialog = async (_w, opts) => {
  const rec = { defaultPath: opts.defaultPath, filters: opts.filters };
  saves.push(rec);
  rec.file = path.join(userData, 'saves', path.basename(opts.defaultPath));
  fs.mkdirSync(path.dirname(rec.file), { recursive: true });
  return { canceled: false, filePath: rec.file };
};
dialog.showMessageBox = async (a, b) => { boxes.push(b ?? a); return { response: 0 }; };
shell.openExternal = async (url) => { opened.push(url); };

const consoleLines = [];
app.on('browser-window-created', (_e, w) => w.webContents.on('console-message', (event) => consoleLines.push(event.message ?? String(event))));
await import(path.join(root, 'src/main/main.js')); // arranque real de la aplicación

const STRONG = 'Clave-Segura-2026!';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const findItem = (label, items = Menu.getApplicationMenu().items) => {
  for (const item of items) {
    if (item.label === label) return item;
    const inner = item.submenu && findItem(label, item.submenu.items);
    if (inner) return inner;
  }
  return null;
};

app.whenReady().then(async () => {
  let win;
  for (let i = 0; i < 100 && !(win = BrowserWindow.getAllWindows()[0]); i += 1) await sleep(100);
  const checks = [];
  const add = (name, ok, detail = null) => checks.push({ name, ok: Boolean(ok), detail });
  const ev = (js) => win.webContents.executeJavaScript(js, true);
  const waitPage = async (expr, ms = 8000) => { for (let t = 0; t < ms; t += 100) { if (await ev(`Boolean(${expr})`).catch(() => false)) return true; await sleep(100); } return false; };
  const waitSaves = async (n, ms = 12_000) => { for (let t = 0; t < ms && saves.length < n; t += 100) await sleep(100); await sleep(300); return saves[n - 1]; };

  try {
    if (!win) throw new Error('no se creó la ventana');
    if (win.webContents.isLoading()) await new Promise((r) => win.webContents.once('did-finish-load', r));
    await sleep(1200);
    win.focus();

    // ---------- A. Arranque (servidor local, launchKey, IPC) ----------
    const url = new URL(win.webContents.getURL());
    add('la ventana carga desde http://127.0.0.1:<puerto>/', url.protocol === 'http:' && url.hostname === '127.0.0.1', url.origin);
    add('el puerto es efímero (asignado por el SO, no fijo)', Number(url.port) > 1023, url.port);
    const page = await ev(`(async () => {
      const cfg = await window.fc.getApiConfig();
      const noKey = await fetch(cfg.baseUrl + '/api/v1/health');
      const withKey = await fetch(cfg.baseUrl + '/api/v1/health', { headers: { 'X-Launch-Key': cfg.launchKey } });
      const { confirm } = await import('/js/ui/dialogs.js');
      const pending = confirm({ title: 'Prueba', text: 'Adaptador de diálogos', danger: true });
      await new Promise((r) => setTimeout(r, 500));
      const popup = document.querySelector('.swal2-popup');
      const shown = !!popup && getComputedStyle(popup).display !== 'none';
      document.querySelector('.swal2-confirm')?.click();
      const answer = await pending;
      return { cfg, origin: location.origin, noKey: noKey.status, withKey: withKey.status, heading: document.querySelector('h1')?.textContent, route: location.hash, shown, answer,
        req: typeof window.require, proc: typeof window.process, mod: typeof window.module, buf: typeof window.Buffer,
        keys: Object.keys(window.fc).sort(), allFn: Object.values(window.fc).every((f) => typeof f === 'function') };
    })()`);
    add('getApiConfig() devuelve baseUrl del servidor local', page.cfg.baseUrl === page.origin, page.cfg.baseUrl);
    add('launchKey es un UUID único por arranque', /^[0-9a-f-]{36}$/.test(page.cfg.launchKey), `${page.cfg.launchKey.slice(0, 8)}…`);
    add('la API rechaza peticiones sin launchKey (403) y acepta la entregada por IPC (200)', page.noKey === 403 && page.withKey === 200, [page.noKey, page.withKey]);
    add('la interfaz arrancó y el router llevó al primer arranque (#/setup)', page.route === '#/setup' && page.heading === 'Configuración inicial', `${page.route} · ${page.heading}`);
    add('el adaptador de diálogos (SweetAlert2) funciona bajo CSP', page.shown && page.answer === true);
    const dbFile = path.join(userData, 'data', 'finanzas.db');
    add('la base de datos vive en userData (no junto al ejecutable)', fs.existsSync(dbFile), dbFile);

    // ---------- B. Seguridad del renderer y del proceso principal ----------
    add('window.require, window.process, window.module y Buffer NO existen en el renderer', [page.req, page.proc, page.mod, page.buf].every((t) => t === 'undefined'), [page.req, page.proc, page.mod, page.buf]);
    add('window.fc expone SOLO las 5 funciones permitidas', JSON.stringify(page.keys) === '["getApiConfig","getAppInfo","onCommand","printToPdf","saveFile"]' && page.allFn, page.keys);
    const prefs = win.webContents.getLastWebPreferences();
    add('webPreferences: contextIsolation, sandbox y webSecurity activos; sin nodeIntegration ni webview', prefs.contextIsolation === true && prefs.sandbox === true && prefs.webSecurity !== false && prefs.nodeIntegration !== true && prefs.webviewTag !== true, { ci: prefs.contextIsolation, sb: prefs.sandbox, ws: prefs.webSecurity, ni: prefs.nodeIntegration });

    const home = win.webContents.getURL();
    await ev("location.href = 'https://example.com/'").catch(() => {}); await sleep(700);
    const afterExternal = win.webContents.getURL();
    await ev("location.href = 'file:///etc/hostname'").catch(() => {}); await sleep(700);
    add('will-navigate: no se puede salir del servidor local (ni a https externo ni a file://)', new URL(afterExternal).origin === url.origin && new URL(win.webContents.getURL()).origin === url.origin && home.startsWith(url.origin), [afterExternal, win.webContents.getURL()]);

    const isCsp = (l) => /Content Security Policy|Refused to/i.test(l);
    const cspBefore = consoleLines.filter(isCsp).length;
    const windowsBefore = BrowserWindow.getAllWindows().length;
    await ev("window.open('https://example.com/'); window.open('http://example.org/'); window.open('file:///etc/hostname'); window.open('javascript:alert(1)'); 1").catch(() => {});
    await sleep(600);
    add('window.open: nunca crea ventanas; solo https se delega al navegador del sistema', BrowserWindow.getAllWindows().length === windowsBefore && opened.length === 1 && opened[0] === 'https://example.com/', opened);

    add('la CSP bloquea window.open("javascript:…") (violación ESPERADA, provocada por la propia prueba)', consoleLines.filter(isCsp).slice(cspBefore).some((l) => /JavaScript URL/.test(l)));

    const perms = await ev(`(async () => ({
      notifications: await Notification.requestPermission(),
      geolocation: (await navigator.permissions.query({ name: 'geolocation' })).state,
      clipboard: await navigator.clipboard.writeText('FC').then(() => 'ok', (e) => String(e.message)),
    }))()`);
    add('permisos: notificaciones y geolocalización denegadas; el portapapeles sí funciona', perms.notifications === 'denied' && perms.geolocation === 'denied' && perms.clipboard === 'ok', perms);

    const rogue = new BrowserWindow({ show: false, webPreferences: { preload: path.join(root, 'src/preload/preload.cjs'), sandbox: true, contextIsolation: true } });
    await rogue.loadURL('data:text/html,<p>pagina-ajena</p>');
    const rogueResult = await rogue.webContents.executeJavaScript(`(async () => {
      const calls = { getApiConfig: () => window.fc.getApiConfig(), getAppInfo: () => window.fc.getAppInfo(),
        saveFile: () => window.fc.saveFile({ kind: 'csv', suggestedName: 'x.csv', bytes: new Uint8Array([1, 2, 3]) }), printToPdf: () => window.fc.printToPdf({ suggestedName: 'x.pdf' }) };
      const out = {};
      for (const [name, fn] of Object.entries(calls)) out[name] = await fn().then(() => 'PERMITIDO', () => 'denegado');
      return out;
    })()`);
    rogue.destroy();
    add('IPC: una página ajena es rechazada en los 4 canales y no llega a abrirse ningún diálogo', Object.values(rogueResult).every((v) => v === 'denegado') && saves.length === 0, rogueResult);

    // ---------- C. Menú nativo (sin sesión) ----------
    const menu = Menu.getApplicationMenu();
    add('el menú nativo se carga: Archivo, Editar, Ver y Ayuda', JSON.stringify(menu.items.map((i) => i.label)) === '["Archivo","Editar","Ver","Ayuda"]', menu.items.map((i) => i.label));
    const accel = { 'Nuevo movimiento': 'CmdOrCtrl+N', 'Exportar CSV…': 'CmdOrCtrl+E', 'Imprimir a PDF…': 'CmdOrCtrl+P', Recargar: 'CmdOrCtrl+R', 'Alternar sidebar': 'CmdOrCtrl+B' };
    add('atajos de teclado: Ctrl+N, Ctrl+E, Ctrl+P, Ctrl+R y Ctrl+B', Object.entries(accel).every(([label, a]) => findItem(label)?.accelerator === a), Object.fromEntries(Object.keys(accel).map((l) => [l, findItem(l)?.accelerator])));
    await ev('window.__cmds = []; window.fc.onCommand((name) => window.__cmds.push(name)); 1');
    for (const label of ['Nuevo movimiento', 'Exportar CSV…', 'Imprimir a PDF…', 'Alternar sidebar']) findItem(label).click({}, win, win.webContents);
    await sleep(500);
    const sent = await ev('window.__cmds');
    add('cada elemento del menú envía SU comando al renderer por IPC', JSON.stringify(sent) === '["new-transaction","export-csv","print-pdf","toggle-sidebar"]', sent);
    add('sin sesión, los comandos piden iniciar sesión (no abren nada)', await waitPage("[...document.querySelectorAll('.toast--info')].some((t) => t.textContent.includes('Inicia sesión'))") && !saves.length && (await ev("location.hash")) === '#/setup');
    findItem('Acerca de FinanzasCardenas').click({}, win, win.webContents);
    await sleep(300);
    add('Ayuda > Acerca de abre el diálogo con la versión', boxes.length === 1 && boxes[0].message.includes('FinanzasCardenas') && boxes[0].detail.includes(`Electron ${process.versions.electron}`), boxes[0]?.message);

    // ---------- D. Flujos con sesión: Ctrl+N, Ctrl+B, exportar CSV, imprimir a PDF ----------
    const logged = await ev(`(async () => {
      const wait = async (f, t = 6000) => { const t0 = Date.now(); while (Date.now() - t0 < t) { try { if (f()) return true; } catch { /* reintenta */ } await new Promise((r) => setTimeout(r, 50)); } return false; };
      const session = await import('/js/modules/auth/session.js');
      const { api } = await import('/js/core/api.js');
      await api.post('/auth/setup', { username: 'admin', displayName: 'Admin', password: ${JSON.stringify(STRONG)} }, { auth: false });
      await session.loadSetupStatus();
      await session.login('admin', ${JSON.stringify(STRONG)});
      location.hash = '#/dashboard';
      return wait(() => document.querySelector('.app') && document.querySelector('h1')?.textContent === 'Panel de control');
    })()`);
    add('sesión iniciada por la UI real (setup + login) y panel visible', logged);

    findItem('Nuevo movimiento').click({}, win, win.webContents);
    const modal = await waitPage("location.hash.startsWith('#/transactions') && document.querySelector('dialog[open] #amountCop')");
    add('Ctrl+N (Archivo > Nuevo movimiento) navega a Transacciones y abre el modal del formulario', modal, await ev('location.hash'));
    await ev("[...document.querySelectorAll('dialog[open] button')].find((b) => b.textContent === 'Cancelar')?.click(); 1");
    await waitPage('!document.querySelector("dialog[open]")');

    const sidebar = () => ev("document.querySelector('.app')?.dataset.sidebar");
    const s0 = await sidebar();
    findItem('Alternar sidebar').click({}, win, win.webContents);
    await sleep(400);
    const s1 = await sidebar();
    findItem('Alternar sidebar').click({}, win, win.webContents);
    await sleep(400);
    add('Ctrl+B (Ver > Alternar sidebar) contrae y vuelve a expandir el sidebar', s0 === 'expanded' && s1 === 'rail' && (await sidebar()) === 'expanded', [s0, s1]);

    findItem('Exportar CSV…').click({}, win, win.webContents);
    const csvSave = await waitSaves(1);
    const csvBytes = csvSave?.file && fs.existsSync(csvSave.file) ? fs.readFileSync(csvSave.file) : Buffer.alloc(0);
    add('Ctrl+E (Exportar CSV) abre el diálogo de guardado NATIVO (CSV) y escribe el archivo elegido', Boolean(csvSave) && path.basename(csvSave.defaultPath).startsWith('movimientos_') && csvSave.filters[0].extensions[0] === 'csv'
      && [...csvBytes.subarray(0, 3)].join() === '239,187,191' && csvBytes.toString('utf8').includes('Fecha,Tipo,Categoría'), { dialog: csvSave?.defaultPath, size: csvBytes.length });
    add('tras exportar se muestra el toast «Archivo guardado»', await waitPage("[...document.querySelectorAll('.toast--success')].some((t) => t.textContent.includes('Archivo guardado'))"));

    findItem('Imprimir a PDF…').click({}, win, win.webContents);
    const pdfSave = await waitSaves(2);
    const pdf = pdfSave?.file && fs.existsSync(pdfSave.file) ? fs.readFileSync(pdfSave.file) : Buffer.alloc(0);
    const box = /\/MediaBox\s*\[\s*0\s+0\s+([\d.]+)\s+([\d.]+)\s*\]/.exec(pdf.toString('latin1'));
    add('Ctrl+P (Imprimir a PDF): printToPDF genera un PDF > 0 bytes, válido y en tamaño A4 (595,28×841,89 pt ±1,5)', pdf.length > 1000 && pdf.subarray(0, 5).toString() === '%PDF-' && Boolean(box) && Math.abs(Number(box[1]) - 595.28) <= 1.5 && Math.abs(Number(box[2]) - 841.89) <= 1.5
      && /^reporte_\d{4}-\d{2}-\d{2}_\d{4}-\d{2}-\d{2}\.pdf$/.test(path.basename(pdfSave.defaultPath)) && pdfSave.filters[0].extensions[0] === 'pdf', { size: pdf.length, mediaBox: box?.slice(1, 3), name: path.basename(pdfSave?.defaultPath ?? '') });

    const csp = consoleLines.filter((l) => isCsp(l) && !/Running the JavaScript URL/.test(l)); // se excluye solo el ataque de la prueba
    add('sin violaciones de CSP inesperadas en consola', csp.length === 0, csp);

    // ---------- E. Recargar y caída del renderer ----------
    findItem('Recargar').click({}, win, win.webContents);
    await sleep(1800);
    add('Ctrl+R (Ver > Recargar) recarga la interfaz y, al vivir el token solo en memoria, pide iniciar sesión', await waitPage("location.hash === '#/login' && !document.querySelector('.app')"), await ev('location.hash'));

    const boxesBefore = boxes.length;
    win.webContents.forcefullyCrashRenderer();
    for (let t = 0; t < 8000 && boxes.length === boxesBefore; t += 100) await sleep(100);
    const crashBox = boxes.at(-1);
    await sleep(2500);
    add('render-process-gone: el crashHandler muestra el error con "Reiniciar interfaz" / "Salir"', boxes.length === boxesBefore + 1 && crashBox.type === 'error' && crashBox.buttons[0] === 'Reiniciar interfaz', crashBox?.detail);
    add('tras la caída la interfaz se reinicia sola y vuelve a funcionar', await waitPage("document.querySelector('h1')?.textContent === 'Iniciar sesión'", 10_000), await ev('location.hash').catch(() => 'sin respuesta'));
    console.log('SMOKE_PORT ' + url.port);
  } catch (error) {
    add('ejecución sin excepciones', false, String(error?.stack ?? error));
  }
  const passed = checks.every((c) => c.ok);
  console.log('SMOKE_RESULT ' + JSON.stringify({ passed, total: checks.length, checks }, null, 2));
  app.quit(); // dispara before-quit de main.js: cierra Express y la BD
  setTimeout(() => app.exit(passed ? 0 : 1), 4000).unref();
  app.on('will-quit', () => { fs.rmSync(userData, { recursive: true, force: true }); });
  app.on('quit', (_e, code) => process.exit(passed ? code : 1));
});
