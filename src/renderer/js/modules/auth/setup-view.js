// [D.12][D.13] Configuración inicial (primer arranque): crea al Administrador y entrega la clave de recuperación.
import { api } from '../../core/api.js';
import { h } from '../../core/dom.js';
import { setState } from '../../core/store.js';
import { bindForm, compose, field, matches, passwordChecklist, passwordError, pattern, required } from '../../ui/form.js';
import { toast } from '../../ui/toasts.js';
import { renderRecoveryKey } from './recovery-key-panel.js';

export function mount(container, { navigate }) {
  const f = {
    username: field({ id: 'username', label: 'Nombre de usuario', autocomplete: 'username', maxlength: 32, hint: '3 a 32 caracteres: letras, números, punto, guion y guion bajo.' }),
    displayName: field({ id: 'displayName', label: 'Nombre para mostrar', autocomplete: 'name', maxlength: 80 }),
    password: field({ id: 'password', label: 'Contraseña', type: 'password', autocomplete: 'new-password', maxlength: 128 }),
    confirm: field({ id: 'confirm', label: 'Confirmar contraseña', type: 'password', autocomplete: 'new-password', maxlength: 128 }),
  };
  const submit = h('button', { type: 'submit', class: 'btn btn--primary btn--block' }, 'Crear administrador');
  const formError = h('div', { class: 'form-error', role: 'alert' });
  const form = h('form', { class: 'form', 'aria-labelledby': 'page-title' }, formError, f.username.root, f.displayName.root, f.password.root,
    passwordChecklist(f.password.input, () => f.username.input.value), f.confirm.root, submit);
  container.append(
    h('h1', { id: 'page-title', class: 'auth-title' }, 'Configuración inicial'),
    h('p', { class: 'auth-text' }, 'Crea la cuenta del Administrador del hogar. Después podrás agregar a los demás miembros.'),
    form);

  bindForm({
    form, submit, formError,
    fields: {
      username: { field: f.username, validate: compose(required('El usuario'), pattern(/^[A-Za-z0-9._-]{3,32}$/, 'Usa 3 a 32 caracteres: letras, números, punto, guion o guion bajo')) },
      displayName: { field: f.displayName, validate: required('El nombre') },
      password: { field: f.password, validate: (v, all) => (v ? passwordError(v, all.username) : 'La contraseña es obligatoria') },
      confirm: { field: f.confirm, validate: compose(required('La confirmación'), matches('password', 'Las contraseñas no coinciden')) },
    },
    async onSubmit(v) {
      const { data } = await api.post('/auth/setup', { username: v.username.trim(), displayName: v.displayName.trim(), password: v.password }, { auth: false });
      setState('session.needsSetup', false);
      container.replaceChildren();
      renderRecoveryKey(container, {
        title: 'Guarda tu clave de recuperación', recoveryKey: data.recoveryKey, file: data.recoveryKeyFile,
        onDone: () => { toast.success('Cuenta creada. Ya puedes iniciar sesión.'); navigate('login'); },
      });
      container.querySelector('h1').focus?.();
    },
  });
}
