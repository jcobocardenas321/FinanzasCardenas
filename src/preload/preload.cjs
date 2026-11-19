// [D.15] Preload minimalista (sandbox: true exige CommonJS). Solo expone lo estrictamente necesario; los comandos del
// menú se filtran contra una lista blanca y nunca se entrega el objeto `event` de IPC al renderer.
const { contextBridge, ipcRenderer } = require('electron');

const COMMANDS = new Set(['new-transaction', 'export-csv', 'print-pdf', 'toggle-sidebar']);

contextBridge.exposeInMainWorld(
  'fc',
  Object.freeze({
    getAppInfo: () => ipcRenderer.invoke('app:get-info'),
    /** @returns {Promise<{ baseUrl: string, launchKey: string }>} */
    getApiConfig: () => ipcRenderer.invoke('app:get-api-config'),
    /** Guarda bytes con el diálogo nativo. kind: 'csv' | 'pdf'. @returns {Promise<{ canceled: boolean, fileName?: string }>} */
    saveFile: ({ kind, suggestedName, bytes }) => ipcRenderer.invoke('app:save-file', { kind, suggestedName, bytes }),
    /** Imprime la vista actual a PDF (A4) y lo guarda con el diálogo nativo. */
    printToPdf: ({ suggestedName, landscape } = {}) => ipcRenderer.invoke('app:print-pdf', { suggestedName, landscape: landscape === true }),
    /** Comandos del menú nativo. @returns {() => void} cancelar suscripción */
    onCommand: (callback) => {
      const listener = (_event, name) => { if (COMMANDS.has(name)) callback(name); };
      ipcRenderer.on('app:command', listener);
      return () => ipcRenderer.removeListener('app:command', listener);
    },
  }),
);
