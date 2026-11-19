// [A.2][A.4] Backend 100 % nativo del adaptador de diálogos, basado en <dialog>.
// showModal() aporta focus trap, aria-modal implícito y cierre con Esc. Todo texto entra por textContent.
export const name = 'native-dialog';

let seq = 0;

function open({ title, text, actions, initialFocus }) {
  return new Promise((resolve) => {
    const id = `fc-dialog-${(seq += 1)}`;
    const dialog = document.createElement('dialog');
    dialog.className = 'fc-dialog';
    dialog.setAttribute('aria-labelledby', `${id}-title`);
    dialog.setAttribute('aria-describedby', `${id}-text`);

    const form = document.createElement('form');
    form.method = 'dialog';

    const h2 = document.createElement('h2');
    h2.id = `${id}-title`;
    h2.className = 'fc-dialog__title';
    h2.textContent = title;

    const p = document.createElement('p');
    p.id = `${id}-text`;
    p.className = 'fc-dialog__text';
    p.textContent = text;

    const bar = document.createElement('div');
    bar.className = 'fc-dialog__actions';
    const buttons = {};
    for (const action of actions) {
      const b = document.createElement('button');
      b.type = 'submit';
      b.value = action.value;
      b.className = `fc-btn ${action.className ?? ''}`.trim();
      b.textContent = action.label;
      buttons[action.value] = b;
      bar.append(b);
    }

    form.append(h2, p, bar);
    dialog.append(form);

    const previouslyFocused = document.activeElement;
    dialog.addEventListener('close', () => {
      const value = dialog.returnValue;
      dialog.remove();
      if (previouslyFocused instanceof HTMLElement) previouslyFocused.focus();
      resolve(value);
    });

    document.body.append(dialog);
    dialog.showModal();
    buttons[initialFocus]?.focus();
  });
}

export async function confirm({ title, text = '', confirmText = 'Confirmar', cancelText = 'Cancelar', danger = false }) {
  const value = await open({
    title,
    text,
    initialFocus: danger ? 'cancel' : 'confirm',
    actions: [
      { value: 'cancel', label: cancelText, className: 'fc-btn--secondary' },
      { value: 'confirm', label: confirmText, className: danger ? 'fc-btn--danger' : 'fc-btn--primary' },
    ],
  });
  return value === 'confirm';
}

export async function notice({ title, text = '', okText = 'Entendido' }) {
  await open({ title, text, initialFocus: 'ok', actions: [{ value: 'ok', label: okText, className: 'fc-btn--primary' }] });
}
