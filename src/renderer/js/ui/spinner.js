// [A.4] Spinner en botones durante una acción. Mantiene el ancho y bloquea el doble envío.
import { h } from '../core/dom.js';

export function setBusy(button, busy, busyLabel = 'Procesando…') {
  if (busy) {
    button.dataset.label = button.textContent;
    button.disabled = true;
    button.setAttribute('aria-busy', 'true');
    button.replaceChildren(h('span', { class: 'spinner', 'aria-hidden': 'true' }), ` ${busyLabel}`);
  } else {
    button.disabled = false;
    button.removeAttribute('aria-busy');
    button.textContent = button.dataset.label ?? button.textContent;
  }
}
