// [D.15] Ventana principal con aislamiento estricto. El renderer se carga desde Express (http://127.0.0.1:<puerto>/).
import { BrowserWindow, shell } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertSecureWebPreferences, isTrustedUrl } from './security.js';

const here = path.dirname(fileURLToPath(import.meta.url));

/** @param {{ baseUrl: string, isDev?: boolean, onCrash: Function }} o */
export function createMainWindow({ baseUrl, isDev = false, onCrash }) {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 360, // [A.3] la hamburguesa aparece en anchos pequeños
    minHeight: 560,
    show: false,
    title: 'FinanzasCardenas',
    webPreferences: {
      preload: path.join(here, '../preload/preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      webviewTag: false,
      devTools: isDev, // en la app empaquetada no hay herramientas de desarrollo
    },
  });
  assertSecureWebPreferences(win.webContents.getLastWebPreferences());

  win.once('ready-to-show', () => win.show());
  // Solo se navega dentro del servidor local; todo lo demás se bloquea (también las redirecciones).
  const block = (event, url) => { if (!isTrustedUrl(url, baseUrl)) event.preventDefault(); };
  win.webContents.on('will-navigate', block);
  win.webContents.on('will-redirect', block);
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) shell.openExternal(url); // enlaces externos: solo https, en el navegador del sistema
    return { action: 'deny' };
  });
  win.webContents.on('render-process-gone', onCrash);

  win.loadURL(`${baseUrl}/`);
  return win;
}
