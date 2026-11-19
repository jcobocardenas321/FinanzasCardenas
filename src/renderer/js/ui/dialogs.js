// [A.2][A.4][B.5] Adaptador de diálogos: contrato estable, backend intercambiable.
//   confirm({ title, text?, confirmText?, cancelText?, danger? }) -> Promise<boolean>
//   notice({ title, text?, type?, okText? })                      -> Promise<void>
// Backend actual: SweetAlert2 (build ESM sin estilos incrustados). Verificado bajo CSP estricta (ADR-002).
// Plan B ya probado: './dialogs.native.js' (<dialog>). Cambiarlo es cambiar esta única línea de import.
import * as backend from './dialogs.swal.js';

export const backendName = backend.name;
export const confirm = (options) => backend.confirm(options);
export const notice = (options) => backend.notice(options);
