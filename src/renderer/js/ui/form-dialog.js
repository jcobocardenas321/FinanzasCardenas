// [A.4] Modal de formulario basado en <dialog>: foco atrapado y Esc nativos, aria-labelledby, devuelve el foco.
// El fondo no cierra el diálogo (evita perder datos por un clic accidental).
import { h, icon } from '../core/dom.js';

let seq = 0;

/**
 * @param {{ title: string, description?: string, build: (ctx: { close: (value?: unknown) => void, dialog: HTMLDialogElement }) => Node }} o
 * @returns {Promise<unknown>} valor pasado a close(value); undefined si se cancela
 */
export function openFormDialog({ title, description, build }) {
  return new Promise((resolve) => {
    const id = `fd-${(seq += 1)}`;
    let result;
    const dialog = h('dialog', { class: 'fc-dialog fc-dialog--form', 'aria-labelledby': `${id}-title` });
    const close = (value) => { result = value; dialog.close(); };
    dialog.append(
      h('div', { class: 'fc-dialog__head' },
        h('h2', { id: `${id}-title`, class: 'fc-dialog__title' }, title),
        h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Cerrar sin guardar', on: { click: () => close() } }, icon('xmark'))),
      description ? h('p', { class: 'fc-dialog__text' }, description) : null,
      build({ close, dialog }));
    const previous = document.activeElement;
    dialog.addEventListener('close', () => { dialog.remove(); previous?.focus?.(); resolve(result); });
    document.body.append(dialog);
    dialog.showModal();
    dialog.querySelector('input:not([type=hidden]), select, textarea')?.focus();
  });
}

/** Botones estándar de un formulario en modal: Cancelar (cierra sin guardar) y Guardar (submit). */
export function dialogButtons({ close, label = 'Guardar' }) {
  const submit = h('button', { type: 'submit', class: 'btn btn--primary' }, label);
  return { submit, node: h('div', { class: 'fc-dialog__actions' }, h('button', { type: 'button', class: 'btn btn--secondary', on: { click: () => close() } }, 'Cancelar'), submit) };
}
