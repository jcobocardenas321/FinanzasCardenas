// [D.12] Recuperación del Administrador con la clave de recuperación (de un solo uso: se entrega una nueva).
import { api } from '../../core/api.js';
import { h } from '../../core/dom.js';
import { bindForm, compose, field, matches, passwordChecklist, passwordError, required } from '../../ui/form.js';
import { toast } from '../../ui/toasts.js';
import { renderRecoveryKey } from './recovery-key-panel.js';

export function mount(container, { navigate }) {
  const f = {
    username: field({ id: 'username', label: 'Usuario administrador', autocomplete: 'username', maxlength: 64, spellcheck: false }),
    recoveryKey: field({ id: 'recoveryKey', label: 'Clave de recuperación', autocomplete: 'off', maxlength: 100, spellcheck: false, hint: 'Formato XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX' }),
    newPassword: field({ id: 'newPassword', label: 'Nueva contraseña', type: 'password', autocomplete: 'new-password', maxlength: 128 }),
    confirm: field({ id: 'confirm', label: 'Confirmar nueva contraseña', type: 'password', autocomplete: 'new-password', maxlength: 128 }),
  };
  const submit = h('button', { type: 'submit', class: 'btn btn--primary btn--block' }, 'Restablecer contraseña');
  const formError = h('div', { class: 'form-error', role: 'alert' });
  const form = h('form', { class: 'form', 'aria-labelledby': 'page-title' }, formError, f.username.root, f.recoveryKey.root, f.newPassword.root,
    passwordChecklist(f.newPassword.input, () => f.username.input.value), f.confirm.root, submit);
  container.append(
    h('h1', { id: 'page-title', class: 'auth-title' }, 'Recuperar acceso'),
    h('p', { class: 'auth-text' }, 'Solo para Administradores. Los demás usuarios deben pedir a un Administrador que restablezca su contraseña.'),
    form,
    h('p', { class: 'auth-links' }, h('a', { href: '#/login' }, 'Volver a iniciar sesión')));

  bindForm({
    form, submit, formError,
    fields: {
      username: { field: f.username, validate: required('El usuario') },
      recoveryKey: { field: f.recoveryKey, validate: required('La clave de recuperación') },
      newPassword: { field: f.newPassword, validate: (v, all) => (v ? passwordError(v, all.username) : 'La contraseña es obligatoria') },
      confirm: { field: f.confirm, validate: compose(required('La confirmación'), matches('newPassword', 'Las contraseñas no coinciden')) },
    },
    async onSubmit(v) {
      const { data } = await api.post('/auth/recover', { username: v.username.trim(), recoveryKey: v.recoveryKey, newPassword: v.newPassword }, { auth: false });
      container.replaceChildren();
      renderRecoveryKey(container, {
        title: 'Contraseña restablecida: nueva clave de recuperación', recoveryKey: data.recoveryKey, file: data.recoveryKeyFile,
        onDone: () => { toast.success('Contraseña restablecida. Inicia sesión con la nueva.'); navigate('login'); },
      });
    },
  });
}
