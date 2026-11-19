// [A.3][D.15] Menú nativo: Archivo, Editar, Ver y Ayuda con atajos de teclado. Las acciones de la aplicación se
// envían al renderer como COMANDOS por IPC (el renderer decide cómo ejecutarlos). `buildMenuTemplate` es una
// función pura (sin importar electron) para poder probarla con node:test.

/**
 * @param {{ send: (command: string) => void, reload: () => void, about: () => void, isDev?: boolean, platform?: string }} deps
 */
export function buildMenuTemplate({ send, reload, about, isDev = false, platform = process.platform }) {
  const sep = { type: 'separator' };
  return [
    {
      label: 'Archivo',
      submenu: [
        { label: 'Nuevo movimiento', accelerator: 'CmdOrCtrl+N', click: () => send('new-transaction') },
        { label: 'Exportar CSV…', accelerator: 'CmdOrCtrl+E', click: () => send('export-csv') },
        { label: 'Imprimir a PDF…', accelerator: 'CmdOrCtrl+P', click: () => send('print-pdf') },
        sep,
        platform === 'darwin' ? { role: 'close', label: 'Cerrar ventana' } : { role: 'quit', label: 'Salir' },
      ],
    },
    {
      label: 'Editar',
      submenu: [
        { role: 'undo', label: 'Deshacer' }, { role: 'redo', label: 'Rehacer' }, sep,
        { role: 'cut', label: 'Cortar' }, { role: 'copy', label: 'Copiar' }, { role: 'paste', label: 'Pegar' }, { role: 'selectAll', label: 'Seleccionar todo' },
      ],
    },
    {
      label: 'Ver',
      submenu: [
        { label: 'Recargar', accelerator: 'CmdOrCtrl+R', click: () => reload() },
        { label: 'Alternar sidebar', accelerator: 'CmdOrCtrl+B', click: () => send('toggle-sidebar') },
        sep,
        { role: 'resetZoom', label: 'Tamaño real' }, { role: 'zoomIn', label: 'Acercar' }, { role: 'zoomOut', label: 'Alejar' }, sep,
        { role: 'togglefullscreen', label: 'Pantalla completa' },
        ...(isDev ? [sep, { role: 'toggleDevTools', label: 'Herramientas de desarrollo' }] : []),
      ],
    },
    { label: 'Ayuda', submenu: [{ label: 'Acerca de FinanzasCardenas', click: () => about() }] },
  ];
}

export const installMenu = (Menu, deps) => Menu.setApplicationMenu(Menu.buildFromTemplate(buildMenuTemplate(deps)));
