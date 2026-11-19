// [D.15] Canales IPC. TODOS validan que el mensaje venga de la ventana principal y del servidor local.
// printToPDF: el renderer pide imprimir; el PROCESO PRINCIPAL genera el PDF (A4) y muestra el diálogo de guardado.
import { app, ipcMain } from 'electron';
import { isTrustedSender } from './security.js';

const FOOTER = '<div style="font-size:9px;width:100%;text-align:center;color:#555;"><span class="pageNumber"></span> / <span class="totalPages"></span></div>';

/** @param {{ apiConfig: { baseUrl: string, launchKey: string }, getWindow: () => Electron.BrowserWindow, files: { saveBytes: Function } }} deps */
export function registerIpc({ apiConfig, getWindow, files }) {
  const guard = (event) => {
    if (!isTrustedSender(event, apiConfig.baseUrl, getWindow()?.webContents)) throw new Error('origen no autorizado');
  };

  ipcMain.handle('app:get-info', (event) => { guard(event); return { name: app.getName(), version: app.getVersion() }; });
  ipcMain.handle('app:get-api-config', (event) => { guard(event); return { baseUrl: apiConfig.baseUrl, launchKey: apiConfig.launchKey }; });

  // CSV (u otro archivo permitido): el renderer envía los bytes; la ruta la elige el usuario en el diálogo nativo.
  ipcMain.handle('app:save-file', (event, { kind, suggestedName, bytes } = {}) => {
    guard(event);
    return files.saveBytes({ kind, suggestedName, bytes });
  });

  // Reportes: imprimir la vista actual a PDF A4 (con estilos @media print) y guardarlo con el diálogo nativo.
  ipcMain.handle('app:print-pdf', async (event, options = {}) => {
    guard(event);
    const data = await getWindow().webContents.printToPDF({
      pageSize: 'A4',
      landscape: options.landscape === true,
      printBackground: true,
      margins: { top: 0.4, bottom: 0.5, left: 0.4, right: 0.4 }, // pulgadas
      displayHeaderFooter: true,
      headerTemplate: '<span></span>',
      footerTemplate: FOOTER,
    });
    return files.saveBytes({ kind: 'pdf', suggestedName: options.suggestedName, bytes: new Uint8Array(data) });
  });
}
