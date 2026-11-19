// [D.15] Si el proceso del renderer se cae, se avisa y se ofrece reiniciar la interfaz (los datos viven en SQLite, a salvo).
/** @param {{ dialog: { showMessageBox: Function }, getWindow: () => object, baseUrl: string, quit: () => void }} deps */
export function createCrashHandler({ dialog, getWindow, baseUrl, quit }) {
  return async (_event, details) => {
    if (details?.reason === 'clean-exit') return;
    const win = getWindow();
    const { response } = await dialog.showMessageBox(win, {
      type: 'error',
      title: 'FinanzasCardenas',
      message: 'La interfaz se cerró inesperadamente.',
      detail: `Motivo: ${details?.reason ?? 'desconocido'}. Tus datos están a salvo en la base de datos local.`,
      buttons: ['Reiniciar interfaz', 'Salir'],
      defaultId: 0,
      cancelId: 1,
    });
    if (response === 0 && win && !win.isDestroyed()) await win.loadURL(`${baseUrl}/`);
    else quit();
  };
}
