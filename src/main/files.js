// [D.15] Guardado de archivos con diálogo NATIVO. El renderer nunca elige la ruta: solo sugiere un nombre y envía los
// bytes; la ruta final es la que devuelve showSaveDialog. Sin importar electron (dialog y fs se inyectan).
import path from 'node:path';

export const MAX_BYTES = 50 * 1024 * 1024;
const KINDS = {
  csv: { ext: '.csv', filters: [{ name: 'CSV (Excel)', extensions: ['csv'] }] },
  pdf: { ext: '.pdf', filters: [{ name: 'Documento PDF', extensions: ['pdf'] }] },
};

/** Deja solo el nombre de archivo (sin carpetas), caracteres seguros y la extensión del tipo. */
export function sanitizeFileName(name, ext) {
  const base = path.basename(String(name ?? '').replaceAll('\\', '/')).replace(/[^\p{L}\p{N}._ -]/gu, '_').replace(/^[.\s]+|[.\s]+$/g, '').slice(0, 100);
  const stem = base.toLowerCase().endsWith(ext) ? base.slice(0, -ext.length) : base;
  return `${stem || 'archivo'}${ext}`;
}

/** @param {{ dialog: { showSaveDialog: Function }, fs: { promises: { writeFile: Function } }, getDefaultDir: () => string, getWindow: () => object }} deps */
export function createFileService({ dialog, fs, getDefaultDir, getWindow }) {
  return {
    /** @returns {Promise<{ canceled: true } | { canceled: false, filePath: string, fileName: string, bytes: number }>} */
    async saveBytes({ kind, suggestedName, bytes }) {
      const cfg = Object.hasOwn(KINDS, kind) ? KINDS[kind] : null; // hasOwn: '__proto__' o 'constructor' no son tipos válidos
      if (!cfg) throw new Error('Tipo de archivo no permitido');
      if (!(bytes instanceof Uint8Array || bytes instanceof ArrayBuffer)) throw new Error('Contenido inválido');
      const buffer = Buffer.from(bytes instanceof ArrayBuffer ? new Uint8Array(bytes) : bytes);
      if (buffer.length === 0 || buffer.length > MAX_BYTES) throw new Error('Tamaño de archivo no permitido');

      const result = await dialog.showSaveDialog(getWindow(), {
        title: 'Guardar archivo',
        defaultPath: path.join(getDefaultDir(), sanitizeFileName(suggestedName, cfg.ext)),
        filters: cfg.filters,
      });
      if (result.canceled || !result.filePath) return { canceled: true };
      const target = path.extname(result.filePath).toLowerCase() === cfg.ext ? result.filePath : `${result.filePath}${cfg.ext}`;
      await fs.promises.writeFile(target, buffer);
      return { canceled: false, filePath: target, fileName: path.basename(target), bytes: buffer.length };
    },
  };
}
