// [A.2][A.4][B.5] Backend SweetAlert2 del adaptador de diálogos (build ESM sin estilos incrustados).
// Ruta ABSOLUTA desde la raíz del servidor (estable ante cualquier profundidad de módulo). El CSS se enlaza en index.html.
import Swal from '/vendor/sweetalert2/sweetalert2.esm.js';

export const name = 'sweetalert2';

export async function confirm({ title, text = '', confirmText = 'Confirmar', cancelText = 'Cancelar', danger = false }) {
  const result = await Swal.fire({
    title,
    text,
    icon: danger ? 'warning' : 'question',
    showCancelButton: true,
    confirmButtonText: confirmText,
    cancelButtonText: cancelText,
    focusCancel: danger,
    reverseButtons: true,
    returnFocus: true,
  });
  return result.isConfirmed === true;
}

export async function notice({ title, text = '', type = 'info', okText = 'Entendido' }) {
  await Swal.fire({ title, text, icon: type, confirmButtonText: okText, returnFocus: true });
}
