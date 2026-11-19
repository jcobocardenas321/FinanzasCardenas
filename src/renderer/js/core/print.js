// [Alcance: reportes imprimibles] Imprimir a PDF: el renderer SOLO pide la impresión por IPC; el proceso principal genera
// el PDF (A4, con estilos @media print) y muestra el diálogo de guardado nativo.
/** @param {{ suggestedName: string, landscape?: boolean, toast: { success: Function, info: Function, warning: Function } }} o */
export async function printCurrentViewToPdf({ suggestedName, landscape = false, toast }) {
  if (!window.fc?.printToPdf) {
    toast.warning('La impresión a PDF solo está disponible en la aplicación de escritorio.');
    return null;
  }
  const result = await window.fc.printToPdf({ suggestedName, landscape });
  if (result.canceled) toast.info('Impresión cancelada.');
  else toast.success(`Archivo guardado: ${result.fileName}`);
  return result;
}
