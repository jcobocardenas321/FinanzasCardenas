// [A.4][B.5][D.15] SPIKE 2: servidor efímero en 127.0.0.1 con la CSP estricta + ventana Electron sandbox.
// Ejecutar con: npm run spike:csp  (en Linux sin pantalla: xvfb-run -a electron --no-sandbox spikes/csp-modals/main.js)
import { app, BrowserWindow } from 'electron';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const rendererRoot = path.resolve(here, '../../src/renderer');
const spikeRoot = path.join(here, 'public');

// Misma política que la propuesta en Fase 0 (sección 8).
const CSP = [
  "default-src 'self'", "script-src 'self'", "style-src 'self'", "img-src 'self' data:",
  "font-src 'self'", "connect-src 'self'", "object-src 'none'", "base-uri 'none'", "frame-ancestors 'none'",
].join('; ');

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.woff2': 'font/woff2' };

function resolveFile(urlPath) {
  const clean = decodeURIComponent(urlPath.split('?')[0]);
  const [base, rel] = clean.startsWith('/spike/') ? [spikeRoot, clean.slice('/spike/'.length)] : [rendererRoot, clean.slice(1)];
  const file = path.resolve(base, rel);
  return file.startsWith(base + path.sep) ? file : null; // evita path traversal
}

const server = http.createServer((req, res) => {
  const file = resolveFile(req.url);
  if (!file || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
    res.writeHead(404).end('not found');
    return;
  }
  res.writeHead(200, { 'content-type': TYPES[path.extname(file)] ?? 'application/octet-stream', 'content-security-policy': CSP });
  fs.createReadStream(file).pipe(res);
});

app.disableHardwareAcceleration();

// Vigilante: si algo se cuelga, el spike falla en vez de quedarse esperando.
setTimeout(() => {
  console.log(JSON.stringify({ spike: 'csp-modals', error: 'watchdog: timeout global' }));
  app.exit(2);
}, 60000).unref();

async function run() {
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const { port } = server.address();

  const win = new BrowserWindow({ show: false, width: 900, height: 700, webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true } });
  const consoleLines = [];
  win.webContents.on('console-message', (event) => consoleLines.push(event.message ?? String(event)));
  await win.loadURL(`http://127.0.0.1:${port}/spike/index.html`);

  let report = null;
  for (let i = 0; i < 200 && !report; i += 1) {
    await new Promise((r) => setTimeout(r, 100));
    report = await win.webContents.executeJavaScript('window.__report?.done ? window.__report : null');
  }

  const failedChecks = (report?.backends ?? []).flatMap((b) => b.checks.filter((c) => !c.ok).map((c) => `${b.label}: ${c.name}`));
  const summary = {
    spike: 'csp-modals',
    electron: process.versions.electron,
    csp: report?.csp ?? null,
    fontawesomeLoaded: report?.fontawesome ?? null,
    error: report?.error ?? (report ? null : 'timeout'),
    backends: (report?.backends ?? []).map((b) => ({ backend: b.label, passed: b.checks.every((c) => c.ok), checks: b.checks })),
    cspViolations: report?.violations ?? [],
    failedChecks,
    passed: failedChecks.length === 0 && (report?.violations ?? []).length === 0 && !(report?.error),
  };
  console.log(JSON.stringify(summary, null, 2));
  server.close();
  app.exit(summary.passed ? 0 : 1);
}

app.whenReady().then(run).catch((error) => {
  console.log(JSON.stringify({ spike: 'csp-modals', error: String(error?.stack ?? error) }));
  app.exit(1);
});
