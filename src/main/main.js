// [D.15] Proceso principal: servidor local (puerto efímero + launchKey), IPC, menú nativo y ventana endurecida.
import { app, BrowserWindow, dialog, Menu, session } from 'electron';
import fs from 'node:fs';
import { createCrashHandler } from './crash.js';
import { createFileService } from './files.js';
import { registerIpc } from './ipc.js';
import { installMenu } from './menu.js';
import { getDataDir } from './paths.js';
import { isPermissionAllowed } from './security.js';
import { bootstrapServer } from './server-bootstrap.js';
import { createMainWindow } from './window.js';

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  let server = null;
  let win = null;
  let closing = false;
  const getWindow = () => win;

  // Ninguna ventana ni contenido puede incrustar <webview> ni abrir ventanas nuevas.
  app.on('web-contents-created', (_e, contents) => {
    contents.on('will-attach-webview', (event) => event.preventDefault());
    contents.setWindowOpenHandler(() => ({ action: 'deny' }));
  });

  app.on('second-instance', () => {
    if (!win) return;
    if (win.isMinimized()) win.restore();
    win.focus();
  });

  app.whenReady().then(async () => {
    try {
      server = await bootstrapServer();
    } catch (error) {
      dialog.showErrorBox('FinanzasCardenas no pudo iniciar', String(error?.message ?? error));
      app.exit(1);
      return;
    }
    getDataDir();
    // Permisos: se deniega todo salvo copiar al portapapeles.
    session.defaultSession.setPermissionRequestHandler((_wc, permission, callback) => callback(isPermissionAllowed(permission)));
    session.defaultSession.setPermissionCheckHandler((_wc, permission) => isPermissionAllowed(permission));

    const files = createFileService({ dialog, fs, getDefaultDir: () => app.getPath('documents'), getWindow });
    registerIpc({ apiConfig: { baseUrl: server.baseUrl, launchKey: server.launchKey }, getWindow, files });

    const onCrash = createCrashHandler({ dialog, getWindow, baseUrl: server.baseUrl, quit: () => app.quit() });
    const open = () => { win = createMainWindow({ baseUrl: server.baseUrl, isDev: !app.isPackaged, onCrash }); return win; };
    open();

    installMenu(Menu, {
      isDev: !app.isPackaged,
      send: (command) => win?.webContents.send('app:command', command),
      reload: () => win?.loadURL(`${server.baseUrl}/`), // la sesión vive solo en memoria: tras recargar hay que iniciar sesión de nuevo
      about: () => dialog.showMessageBox(win, {
        type: 'info', title: 'Acerca de FinanzasCardenas', message: `FinanzasCardenas ${app.getVersion()}`,
        detail: `Gestión de la economía del hogar. Funciona sin conexión: tus datos se guardan solo en este equipo.\n\nElectron ${process.versions.electron} · Node ${process.versions.node}`,
      }),
    });
    app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) open(); });
  });

  // Cierra el servidor y la base de datos de forma ordenada antes de salir.
  app.on('before-quit', (event) => {
    if (closing || !server) return;
    closing = true;
    event.preventDefault();
    server.close().finally(() => app.quit());
  });
  app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
}
