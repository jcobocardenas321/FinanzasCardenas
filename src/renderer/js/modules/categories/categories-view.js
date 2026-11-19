// [A.1] Categorías: tabla simple con búsqueda, filtros por tipo y estado, alta/edición en modal y archivado.
import { h, icon } from '../../core/dom.js';
import { EVENTS, emit } from '../../core/events.js';
import { confirm } from '../../ui/dialogs.js';
import { createDataTable } from '../../ui/data-table.js';
import { emptyState, errorState } from '../../ui/empty-state.js';
import { bindForm, field, required, selectField } from '../../ui/form.js';
import { dialogButtons, openFormDialog } from '../../ui/form-dialog.js';
import { badge, pageHeader } from '../../ui/page-header.js';

function openCategoryDialog({ category = null, save }) {
  return openFormDialog({
    title: category ? 'Editar categoría' : 'Nueva categoría',
    build({ close }) {
      const f = {
        name: field({ id: 'name', label: 'Nombre', maxlength: 40, autocomplete: 'off' }),
        kind: selectField({ id: 'kind', label: 'Tipo', options: [{ value: 'income', label: 'Ingreso' }, { value: 'expense', label: 'Gasto' }], value: category?.kind ?? 'expense', hint: category ? 'El tipo no se puede cambiar una vez creada.' : undefined }),
        color: field({ id: 'color', label: 'Color', type: 'color', required: false }),
      };
      f.name.input.value = category?.name ?? '';
      f.color.input.value = (category?.color ?? '#4F46E5').toLowerCase();
      if (category) f.kind.input.disabled = true;
      const buttons = dialogButtons({ close });
      const formError = h('div', { class: 'form-error', role: 'alert' });
      const form = h('form', { class: 'form' }, formError, f.name.root, f.kind.root, f.color.root, buttons.node);
      bindForm({
        form, submit: buttons.submit, formError,
        fields: { name: { field: f.name, validate: required('El nombre') }, kind: { field: f.kind }, color: { field: f.color } },
        async onSubmit(v) { await save({ name: v.name.trim(), kind: v.kind, color: v.color }); close(true); },
      });
      return form;
    },
  });
}

export function mount(container, { api, prefs, toast }) {
  const state = { q: '', kind: '', archived: 'false', page: 1, pageSize: 10, sort: 'name:asc' };
  let seq = 0;
  let timer = null;

  const q = field({ id: 'c-q', label: 'Buscar', type: 'search', required: false, maxlength: 40, autocomplete: 'off' });
  q.root.classList.add('field--grow');
  const kind = selectField({ id: 'c-kind', label: 'Tipo', required: false, options: [{ value: '', label: 'Todos' }, { value: 'income', label: 'Ingresos' }, { value: 'expense', label: 'Gastos' }] });
  const archived = selectField({ id: 'c-archived', label: 'Estado', required: false, value: 'false', options: [{ value: 'false', label: 'Activas' }, { value: 'true', label: 'Archivadas' }, { value: '', label: 'Todas' }] });
  const bar = h('form', { class: 'filter-bar', role: 'search', 'aria-label': 'Filtrar categorías', on: { submit: (e) => e.preventDefault() } }, q.root, kind.root, archived.root);

  const btn = (iconName, text, label, fn) => h('button', { type: 'button', class: 'btn btn--secondary btn--sm', 'aria-label': label, on: { click: fn } }, icon(iconName), ` ${text}`);
  const table = createDataTable({
    id: 'categories', caption: 'Categorías', prefs, defaultSort: 'name:asc',
    onChange: (s) => { Object.assign(state, s); load(); },
    columns: [
      { key: 'name', label: 'Nombre', sortKey: 'name', render: (c) => h('span', {}, h('span', { class: 'swatch-dot', 'aria-hidden': 'true', dataset: { color: c.color } }), c.name) },
      { key: 'kind', label: 'Tipo', sortKey: 'kind', render: (c) => badge(c.kind === 'income' ? 'Ingreso' : 'Gasto', c.kind === 'income' ? 'ok' : 'over', c.kind === 'income' ? 'arrow-trend-up' : 'arrow-trend-down') },
      { key: 'isArchived', label: 'Estado', render: (c) => (c.isArchived ? badge('Archivada', 'muted', 'box-archive') : badge('Activa', 'info', 'circle-check')) },
      { key: 'actions', label: 'Acciones', srOnly: true, class: 'actions', render: (c) => h('span', { class: 'page-actions' },
        btn('pen', 'Editar', `Editar categoría: ${c.name}`, () => edit(c)),
        btn(c.isArchived ? 'box-open' : 'box-archive', c.isArchived ? 'Restaurar' : 'Archivar', `${c.isArchived ? 'Restaurar' : 'Archivar'} categoría: ${c.name}`, () => toggle(c)),
        btn('trash', 'Eliminar', `Eliminar categoría: ${c.name}`, () => remove(c))) },
    ],
  });
  Object.assign(state, { pageSize: table.state.pageSize, sort: table.state.sort });

  async function load() {
    const mine = ++seq;
    table.setLoading(true);
    try {
      const { data, meta } = await api.get('/categories', { query: { page: state.page, pageSize: state.pageSize, sort: state.sort, kind: state.kind, archived: state.archived, q: state.q } });
      if (mine !== seq) return;
      table.setLoading(false);
      if (meta.total === 0) {
        const filtered = state.q || state.kind || state.archived !== 'false';
        table.setEmpty(emptyState({ icon: 'tags', title: filtered ? 'Sin resultados' : 'Aún no tienes categorías', text: filtered ? 'Ninguna categoría coincide con los filtros.' : 'Crea tu primera categoría para clasificar movimientos.', actionLabel: 'Nueva categoría', onAction: () => edit(null) }));
      } else { table.setEmpty(null); table.setData({ rows: data, meta }); }
      for (const dot of container.querySelectorAll('.swatch-dot')) dot.style.backgroundColor = dot.dataset.color; // CSSOM: compatible con la CSP
    } catch (error) {
      if (mine === seq) { table.setLoading(false); table.setEmpty(errorState({ message: error.message, onRetry: load })); }
    }
  }
  const changed = (action) => { emit(EVENTS.MUTATED, { entity: 'category', action }); return load(); };
  async function edit(category) {
    const saved = await openCategoryDialog({ category, save: (p) => (category ? api.patch(`/categories/${category.id}`, { name: p.name, color: p.color }) : api.post('/categories', p)) });
    if (saved) { toast.success(category ? 'Categoría actualizada.' : 'Categoría creada.'); await changed(category ? 'update' : 'create'); }
  }
  async function toggle(c) {
    try { await api.patch(`/categories/${c.id}`, { isArchived: !c.isArchived }); toast.success(c.isArchived ? 'Categoría restaurada.' : 'Categoría archivada.'); await changed('archive'); } catch (error) { toast.error(error.message); }
  }
  async function remove(c) {
    if (!(await confirm({ title: '¿Eliminar esta categoría?', text: `Se eliminará «${c.name}». Si tiene movimientos, archívala en su lugar.`, confirmText: 'Eliminar', danger: true }))) return;
    try { await api.delete(`/categories/${c.id}`); toast.success('Categoría eliminada.'); await changed('delete'); } catch (error) { toast.warning(error.message); }
  }

  q.input.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(() => { state.q = q.input.value.trim(); state.page = 1; load(); }, 300); });
  kind.input.addEventListener('change', () => { state.kind = kind.input.value; state.page = 1; load(); });
  archived.input.addEventListener('change', () => { state.archived = archived.input.value; state.page = 1; load(); });
  container.append(h('div', { class: 'page' }, pageHeader('Categorías', h('button', { type: 'button', class: 'btn btn--primary', on: { click: () => edit(null) } }, icon('plus'), ' Nueva categoría')), bar, table.root));
  load();
  return { destroy() { clearTimeout(timer); seq += 1; } };
}
