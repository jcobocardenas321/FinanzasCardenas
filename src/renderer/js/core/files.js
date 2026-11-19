// [Alcance: reportes exportables] Guardar un archivo (CSV) con el diálogo NATIVO del sistema. Si no se ejecuta dentro de
// Electron, cae a una descarga normal del navegador.
import { h } from './dom.js';

/** @param {{ blob: Blob, filename: string, kind: 'csv'|'pdf', toast: { success: Function, info: Function }, cancelText?: string }} o */
export async function saveBlob({ blob, filename, kind, toast, cancelText = 'Guardado cancelado.' }) {
  if (window.fc?.saveFile) {
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const result = await window.fc.saveFile({ kind, suggestedName: filename, bytes });
    if (result.canceled) toast.info(cancelText); else toast.success(`Archivo guardado: ${result.fileName}`);
    return result;
  }
  const url = URL.createObjectURL(blob);
  const link = h('a', { href: url, download: filename });
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  toast.success(`Se descargó ${filename}`);
  return { canceled: false, fileName: filename };
}
