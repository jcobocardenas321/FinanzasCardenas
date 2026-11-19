// [D.12] Inicio de sesión: errores inline, aviso de intentos restantes y de cuenta bloqueada.
import { h } from '../../core/dom.js';
import { bindForm, field, required } from '../../ui/form.js';
import { login } from './session.js';

export function mount(container, { navigate }) {
  const f = {
    username: field({ id: 'username', label: 'Usuario', autocomplete: 'username', maxlength: 64, spellcheck: false }),
    password: field({ id: 'password', label: 'Contraseña', type: 'password', autocomplete: 'current-password', maxlength: 256 }),
  };
  const submit = h('button', { type: 'submit', class: 'btn btn--primary btn--block' }, 'Iniciar sesión');
  const formError = h('div', { class: 'form-error', role: 'alert' });
  const form = h('form', { class: 'form', 'aria-labelledby': 'page-title' }, formError, f.username.root, f.password.root, submit);
  container.append(
    h('h1', { id: 'page-title', class: 'auth-title' }, 'Iniciar sesión'),
    form,
    h('p', { class: 'auth-links' }, h('a', { href: '#/recover' }, 'Olvidé mi contraseña (Administrador)')));

  bindForm({
    form, submit, formError, errorFocus: 'password',
    fields: { username: { field: f.username, validate: required('El usuario') }, password: { field: f.password, validate: required('La contraseña') } },
    async onSubmit(v) {
      try {
        await login(v.username.trim(), v.password);
      } catch (error) {
        f.password.input.value = '';
        if (error.code === 'INVALID_CREDENTIALS' && error.details?.attemptsRemaining !== undefined) {
          error.message = `${error.message}. Te quedan ${error.details.attemptsRemaining} intento(s) antes del bloqueo.`;
        }
        throw error;
      }
      navigate('dashboard');
    },
  });
}
