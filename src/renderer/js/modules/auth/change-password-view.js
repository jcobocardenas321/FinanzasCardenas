// [D.12] Cambio de contraseña (obligatorio tras un reset del Administrador; opcional desde el menú de usuario).
import { api } from '../../core/api.js';
import { h } from '../../core/dom.js';
import { bindForm, compose, field, matches, passwordChecklist, passwordError, required } from '../../ui/form.js';
import { toast } from '../../ui/toasts.js';
import { logout, refreshUser } from './session.js';

export function mount(container, { navigate, user }) {
  const forced = user?.mustChangePassword === true;
  const f = {
    currentPassword: field({ id: 'currentPassword', label: 'Contraseña actual', type: 'password', autocomplete: 'current-password', maxlength: 128 }),
    newPassword: field({ id: 'newPassword', label: 'Nueva contraseña', type: 'password', autocomplete: 'new-password', maxlength: 128 }),
    confirm: field({ id: 'confirm', label: 'Confirmar nueva contraseña', type: 'password', autocomplete: 'new-password', maxlength: 128 }),
  };
  const submit = h('button', { type: 'submit', class: 'btn btn--primary btn--block' }, 'Cambiar contraseña');
  const formError = h('div', { class: 'form-error', role: 'alert' });
  const form = h('form', { class: 'form', 'aria-labelledby': 'page-title' }, formError, f.currentPassword.root, f.newPassword.root,
    passwordChecklist(f.newPassword.input, () => user?.username ?? ''), f.confirm.root, submit);
  container.append(
    h('h1', { id: 'page-title', class: 'auth-title' }, 'Cambiar contraseña'),
    forced ? h('div', { class: 'alert alert--info', role: 'note' }, 'Un administrador restableció tu contraseña. Debes elegir una nueva para continuar.') : null,
    form,
    h('p', { class: 'auth-links' },
      forced ? null : h('a', { href: '#/dashboard' }, 'Cancelar'),
      forced ? h('button', { type: 'button', class: 'link-btn', on: { click: async () => { await logout(); navigate('login'); } } }, 'Cerrar sesión') : null));

  bindForm({
    form, submit, formError,
    fields: {
      currentPassword: { field: f.currentPassword, validate: required('La contraseña actual') },
      newPassword: { field: f.newPassword, validate: (v) => (v ? passwordError(v, user?.username ?? '') : 'La nueva contraseña es obligatoria') },
      confirm: { field: f.confirm, validate: compose(required('La confirmación'), matches('newPassword', 'Las contraseñas no coinciden')) },
    },
    async onSubmit(v) {
      await api.post('/auth/change-password', { currentPassword: v.currentPassword, newPassword: v.newPassword });
      await refreshUser();
      toast.success('Contraseña actualizada.');
      navigate('dashboard');
    },
  });
}
