// [D.13] Usuarios (solo Admin): tabla con filtros, alta/edición, activar/desactivar, restablecer contraseña
// (la temporal se muestra UNA vez) y desbloqueo. El servidor protege al último Admin (LAST_ADMIN).
import { h, icon } from '../../core/dom.js';
import { confirm } from '../../ui/dialogs.js';
import { createDataTable } from '../../ui/data-table.js';
import { emptyState, errorState } from '../../ui/empty-state.js';
import { bindForm, compose, field, passwordChecklist, passwordError, pattern, required, selectField } from '../../ui/form.js';
import { dialogButtons, openFormDialog } from '../../ui/form-dialog.js';
import { badge, pageHeader } from '../../ui/page-header.js';
import { toast as notify } from '../../ui/toasts.js';

const ROLES = [{ value: 'admin', label: 'Administrador' }, { value: 'editor', label: 'Editor' }];
const when = (iso) => (iso ? new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso)) : 'Nunca');

function openUserDialog({ user, save }) {
  return openFormDialog({
    title: user ? 'Editar usuario' : 'Nuevo usuario',
    description: user ? undefined : 'El usuario deberá cambiar esta contraseña al iniciar sesión.',
    build({ close }) {
      const f = {
        username: field({ id: 'username', label: 'Nombre de usuario', maxlength: 32, autocomplete: 'off', hint: user ? 'No se puede cambiar.' : '3 a 32 caracteres: letras, números, punto, guion y guion bajo.' }),
        displayName: field({ id: 'displayName', label: 'Nombre para mostrar', maxlength: 80, autocomplete: 'off' }),
        role: selectField({ id: 'role', label: 'Rol', options: ROLES, value: user?.role ?? 'editor' }),
        password: field({ id: 'password', label: 'Contraseña inicial', type: 'password', autocomplete: 'new-password', maxlength: 128 }),
      };
      const fields = { displayName: { field: f.displayName, validate: required('El nombre') }, role: { field: f.role } };
      const parts = [f.username.root, f.displayName.root, f.role.root];
      if (user) { f.username.input.value = user.username; f.username.input.disabled = true; f.displayName.input.value = user.displayName; }
      else {
        fields.username = { field: f.username, validate: compose(required('El usuario'), pattern(/^[A-Za-z0-9._-]{3,32}$/, 'Usa 3 a 32 caracteres: letras, números, punto, guion o guion bajo')) };
        fields.password = { field: f.password, validate: (v, all) => (v ? passwordError(v, all.username) : 'La contraseña es obligatoria') };
        parts.push(f.password.root, passwordChecklist(f.password.input, () => f.username.input.value));
      }
      const buttons = dialogButtons({ close });
      const formError = h('div', { class: 'form-error', role: 'alert' });
      const form = h('form', { class: 'form' }, formError, ...parts, buttons.node);
      bindForm({ form, submit: buttons.submit, formError, fields,
        async onSubmit(v) { await save(user ? { displayName: v.displayName.trim(), role: v.role } : { username: v.username.trim(), displayName: v.displayName.trim(), role: v.role, password: v.password }); close(true); } });
      return form;
    },
  });
}

const showTemporaryPassword = (name, password) => openFormDialog({
  title: 'Contraseña temporal', description: `Entrégala a ${name}. Se muestra solo ahora y deberá cambiarla al iniciar sesión.`,
  build: ({ close }) => h('div', { class: 'form' }, h('p', { class: 'temp-pass', tabindex: '0', 'aria-label': 'Contraseña temporal' }, password),
    h('div', { class: 'fc-dialog__actions' },
      h('button', { type: 'button', class: 'btn btn--secondary', on: { click: async () => { try { await navigator.clipboard.writeText(password); notify.success('Contraseña copiada.'); } catch { notify.warning('No se pudo copiar; cópiala manualmente.'); } } } }, icon('copy'), ' Copiar'),
      h('button', { type: 'button', class: 'btn btn--primary', on: { click: () => close() } }, 'Listo'))),
});

export function mount(container, { api, prefs, toast, user: me }) {
  const state = { q: '', role: '', isActive: '', page: 1, pageSize: 10, sort: 'username:asc' };
  let seq = 0;
  let timer = null;
  const q = field({ id: 'u-q', label: 'Buscar', type: 'search', required: false, maxlength: 80, autocomplete: 'off' });
  q.root.classList.add('field--grow');
  const role = selectField({ id: 'u-role', label: 'Rol', required: false, options: [{ value: '', label: 'Todos' }, ...ROLES] });
  const active = selectField({ id: 'u-active', label: 'Estado', required: false, options: [{ value: '', label: 'Todos' }, { value: 'true', label: 'Activos' }, { value: 'false', label: 'Inactivos' }] });
  const bar = h('form', { class: 'filter-bar', role: 'search', 'aria-label': 'Filtrar usuarios', on: { submit: (e) => e.preventDefault() } }, q.root, role.root, active.root);
  const btn = (iconName, text, label, fn) => h('button', { type: 'button', class: 'btn btn--secondary btn--sm', 'aria-label': label, on: { click: fn } }, icon(iconName), ` ${text}`);

  const table = createDataTable({
    id: 'users', caption: 'Usuarios', prefs, defaultSort: 'username:asc',
    onChange: (s) => { Object.assign(state, s); load(); },
    columns: [
      { key: 'username', label: 'Usuario', sortKey: 'username' },
      { key: 'displayName', label: 'Nombre', sortKey: 'display_name' },
      { key: 'role', label: 'Rol', sortKey: 'role', render: (u) => badge(u.role === 'admin' ? 'Administrador' : 'Editor', u.role === 'admin' ? 'info' : 'muted', u.role === 'admin' ? 'user-shield' : 'user-pen') },
      { key: 'status', label: 'Estado', render: (u) => h('span', { class: 'page-actions' }, u.isActive ? badge('Activo', 'ok', 'circle-check') : badge('Inactivo', 'muted', 'ban'), u.isLocked ? badge('Bloqueado', 'over', 'lock') : null, u.mustChangePassword ? badge('Debe cambiar contraseña', 'warning', 'key') : null) },
      { key: 'lastLoginAt', label: 'Último acceso', sortKey: 'last_login_at', render: (u) => when(u.lastLoginAt) },
      { key: 'actions', label: 'Acciones', srOnly: true, class: 'actions', render: (u) => h('span', { class: 'page-actions' },
        btn('pen', 'Editar', `Editar usuario ${u.username}`, () => edit(u)),
        btn('key', 'Restablecer', `Restablecer contraseña de ${u.username}`, () => reset(u)),
        u.isLocked ? btn('lock-open', 'Desbloquear', `Desbloquear a ${u.username}`, () => unlock(u)) : null,
        btn(u.isActive ? 'ban' : 'circle-check', u.isActive ? 'Desactivar' : 'Activar', `${u.isActive ? 'Desactivar' : 'Activar'} a ${u.username}`, () => setActive(u))) },
    ],
  });
  Object.assign(state, { pageSize: table.state.pageSize, sort: table.state.sort });

  async function load() {
    const mine = ++seq;
    table.setLoading(true);
    try {
      const { data, meta } = await api.get('/users', { query: { page: state.page, pageSize: state.pageSize, sort: state.sort, q: state.q, role: state.role, isActive: state.isActive } });
      if (mine !== seq) return;
      table.setLoading(false);
      if (meta.total === 0) table.setEmpty(emptyState({ icon: 'users', title: 'Sin resultados', text: 'Ningún usuario coincide con los filtros.' }));
      else { table.setEmpty(null); table.setData({ rows: data, meta }); }
    } catch (error) { if (mine === seq) { table.setLoading(false); table.setEmpty(errorState({ message: error.message, onRetry: load })); } }
  }
  const attempt = async (fn, okMessage) => { try { await fn(); if (okMessage) toast.success(okMessage); await load(); } catch (error) { toast.error(error.message); } };
  async function edit(u) {
    const saved = await openUserDialog({ user: u, save: (p) => (u ? api.patch(`/users/${u.id}`, p) : api.post('/users', p)) });
    if (saved) { toast.success(u ? 'Usuario actualizado.' : 'Usuario creado.'); await load(); }
  }
  async function reset(u) {
    if (!(await confirm({ title: '¿Restablecer la contraseña?', text: `Se generará una contraseña temporal para ${u.username} y se cerrarán sus sesiones.`, confirmText: 'Restablecer', danger: true }))) return;
    try { const { data } = await api.post(`/users/${u.id}/reset-password`); await load(); await showTemporaryPassword(u.displayName, data.temporaryPassword); } catch (error) { toast.error(error.message); }
  }
  const unlock = (u) => attempt(() => api.post(`/users/${u.id}/unlock`), `${u.username} desbloqueado.`);
  async function setActive(u) {
    if (u.isActive && !(await confirm({ title: '¿Desactivar este usuario?', text: `${u.username} no podrá iniciar sesión y se cerrarán sus sesiones.`, confirmText: 'Desactivar', danger: true }))) return;
    await attempt(() => api.patch(`/users/${u.id}`, { isActive: !u.isActive }), u.isActive ? 'Usuario desactivado.' : 'Usuario activado.');
  }

  q.input.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(() => { state.q = q.input.value.trim(); state.page = 1; load(); }, 300); });
  role.input.addEventListener('change', () => { state.role = role.input.value; state.page = 1; load(); });
  active.input.addEventListener('change', () => { state.isActive = active.input.value; state.page = 1; load(); });
  container.append(h('div', { class: 'page' }, pageHeader('Usuarios', h('button', { type: 'button', class: 'btn btn--primary', on: { click: () => edit(null) } }, icon('user-plus'), ' Nuevo usuario')),
    h('p', { class: 'page-subtitle' }, `Sesión iniciada como ${me?.username ?? ''}.`), bar, table.root));
  load();
  return { destroy() { clearTimeout(timer); seq += 1; } };
}
