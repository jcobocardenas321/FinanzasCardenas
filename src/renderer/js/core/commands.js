// [A.3][D.15] Comandos del menú nativo (Ctrl+N, Ctrl+E, Ctrl+P, Ctrl+B). El proceso principal solo envía el NOMBRE del
// comando; aquí se decide cómo ejecutarlo. Si la vista destino aún no está abierta, se navega y el comando queda
// pendiente hasta que la vista lo registre con onCommand().
import { EVENTS, emit } from './events.js';

const handlers = new Map();
let pending = null;

const ROUTE_OF = { 'new-transaction': 'transactions/all', 'export-csv': 'reports/summary', 'print-pdf': 'reports/summary' };

/** Las vistas registran aquí lo que hacen ante un comando. @returns {() => void} cancelar */
export function onCommand(name, fn) {
  handlers.set(name, fn);
  if (pending === name) { pending = null; queueMicrotask(fn); }
  return () => { if (handlers.get(name) === fn) handlers.delete(name); };
}

/** @param {{ navigate: (path: string) => void, toast: { info: Function }, getUser: () => object|null }} deps */
export function registerCommands({ navigate, toast, getUser }) {
  if (!window.fc?.onCommand) return () => {}; // fuera de Electron no hay menú nativo
  return window.fc.onCommand((name) => {
    if (name === 'toggle-sidebar') {
      if (getUser()) emit(EVENTS.COMMAND, { name });
      return;
    }
    if (!getUser()) { toast.info('Inicia sesión para usar esta acción.'); return; }
    const run = handlers.get(name);
    if (run) { run(); return; }
    if (ROUTE_OF[name]) { pending = name; navigate(ROUTE_OF[name]); }
  });
}

export const _resetForTests = () => { handlers.clear(); pending = null; };
