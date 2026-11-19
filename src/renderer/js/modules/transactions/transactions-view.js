// [A.1][A.4] Transacciones: las pestañas Todos / Ingresos / Gastos usan LA MISMA tabla con el filtro `kind`.
// Filtros (búsqueda, categoría, rango de fechas), orden por encabezado, paginación 10/20/50, formulario en modal,
// confirmación de borrado con el adaptador de diálogos y estados vacíos con guía.
import { categoriesFor, getCategories } from '../../core/categories.js';
import { onCommand } from '../../core/commands.js';
import { h, icon } from '../../core/dom.js';
import { formatCop, formatDate } from '../../core/format.js';
import { confirm } from '../../ui/dialogs.js';
import { createDataTable } from '../../ui/data-table.js';
import { emptyState, errorState } from '../../ui/empty-state.js';
import { field, selectField } from '../../ui/form.js';
import { badge, pageHeader } from '../../ui/page-header.js';
import { createTabs } from '../../ui/tabs.js';
import { openTransactionDialog } from './transaction-form.js';
import { createTransactionsStore } from './transactions-store.js';

const KIND_OF_TAB = { all: null, income: 'income', expense: 'expense' };
const EMPTY = {
  all: { title: 'Aún no tienes movimientos', text: 'Registra tu primer ingreso o gasto para empezar a ver tu balance.', action: 'Agrega tu primer ingreso', kind: 'income' },
  income: { title: 'Aún no tienes ingresos', text: 'Registra tu salario u otros ingresos del hogar.', action: 'Agrega tu primer ingreso', kind: 'income' },
  expense: { title: 'Aún no tienes gastos', text: 'Registra tus gastos para controlar a dónde va el dinero.', action: 'Registra tu primer gasto', kind: 'expense' },
};

export function mount(container, { api, prefs, route, tab, toast }) {
  const store = createTransactionsStore({ api });
  let categories = [];
  let activeTab = tab;
  let debounce = null;

  // ---------- filtros ----------
  const q = field({ id: 'f-q', label: 'Buscar', type: 'search', required: false, maxlength: 80, autocomplete: 'off' });
  q.root.classList.add('field--grow');
  const cat = selectField({ id: 'f-category', label: 'Categoría', required: false, options: [{ value: '', label: 'Todas' }] });
  const from = field({ id: 'f-from', label: 'Desde', type: 'date', required: false });
  const to = field({ id: 'f-to', label: 'Hasta', type: 'date', required: false });
  const clearBtn = h('button', { type: 'button', class: 'btn btn--secondary', on: { click: () => resetFilters() } }, icon('filter-circle-xmark'), ' Limpiar filtros');
  const bar = h('form', { class: 'filter-bar', role: 'search', 'aria-label': 'Filtrar movimientos', on: { submit: (e) => e.preventDefault() } }, q.root, cat.root, from.root, to.root, clearBtn);

  function refreshCategoryOptions() {
    const kind = KIND_OF_TAB[activeTab];
    cat.setOptions([{ value: '', label: 'Todas' }, ...categoriesFor(categories, kind).map((c) => ({ value: c.id, label: c.name }))], store.state.filters.categoryId);
    if (cat.input.value !== String(store.state.filters.categoryId)) store.state.filters.categoryId = '';
  }
  function applyDates() {
    const bad = from.input.value && to.input.value && from.input.value > to.input.value;
    to.setError(bad ? 'La fecha final no puede ser anterior a la inicial' : '');
    if (!bad) store.setFilters({ from: from.input.value, to: to.input.value });
  }
  q.input.addEventListener('input', () => { clearTimeout(debounce); debounce = setTimeout(() => store.setFilters({ q: q.input.value.trim() }), 300); });
  cat.input.addEventListener('change', () => store.setFilters({ categoryId: cat.input.value }));
  from.input.addEventListener('change', applyDates);
  to.input.addEventListener('change', applyDates);
  function resetFilters() {
    q.input.value = ''; from.input.value = ''; to.input.value = ''; cat.input.value = ''; to.setError('');
    store.clearFilters();
  }

  // ---------- tabla ----------
  const actionBtn = (iconName, text, label, onClick) => h('button', { type: 'button', class: 'btn btn--secondary btn--sm', 'aria-label': label, on: { click: onClick } }, icon(iconName), ` ${text}`);
  const table = createDataTable({
    id: 'transactions', caption: 'Movimientos', prefs, defaultSort: 'occurred_on:desc',
    onChange: (s) => store.setPaging(s),
    columns: [
      { key: 'occurredOn', label: 'Fecha', sortKey: 'occurred_on', render: (t) => formatDate(t.occurredOn) },
      { key: 'description', label: 'Descripción', sortKey: 'description', render: (t) => h('span', {}, t.description, t.notes ? h('span', { class: 'sr-only' }, ` Notas: ${t.notes}`) : null) },
      { key: 'category', label: 'Categoría', sortKey: 'category', render: (t) => t.category.name },
      { key: 'kind', label: 'Tipo', render: (t) => badge(t.kind === 'income' ? 'Ingreso' : 'Gasto', t.kind === 'income' ? 'ok' : 'over', t.kind === 'income' ? 'arrow-trend-up' : 'arrow-trend-down') },
      { key: 'amountCop', label: 'Monto', sortKey: 'amount_cop', class: 'num', render: (t) => h('span', { class: `amount--${t.kind}` }, `${t.kind === 'income' ? '+' : '−'} ${formatCop(t.amountCop)}`) },
      { key: 'actions', label: 'Acciones', srOnly: true, class: 'actions', render: (t) => h('span', { class: 'page-actions' },
        actionBtn('pen', 'Editar', `Editar movimiento: ${t.description}`, () => openForm(t)),
        actionBtn('trash', 'Eliminar', `Eliminar movimiento: ${t.description}`, () => remove(t))) },
    ],
  });
  Object.assign(store.state, { pageSize: table.state.pageSize, sort: table.state.sort });

  const emptyNode = () => {
    if (store.hasFilters()) return emptyState({ icon: 'filter-circle-xmark', title: 'Sin resultados', text: 'Ningún movimiento coincide con los filtros aplicados.', actionLabel: 'Limpiar filtros', onAction: resetFilters });
    const e = EMPTY[activeTab];
    return emptyState({ icon: 'receipt', title: e.title, text: e.text, actionLabel: e.action, onAction: () => openForm(null, e.kind) });
  };
  const offStore = store.subscribe((s) => {
    table.setLoading(s.loading);
    if (s.loading) return;
    if (s.error) { table.setEmpty(errorState({ message: s.error.message, onRetry: () => store.load() })); return; }
    if (s.meta.total === 0) { table.setEmpty(emptyNode()); return; }
    table.setEmpty(null);
    table.setData({ rows: s.rows, meta: s.meta });
  });

  // ---------- acciones ----------
  async function openForm(tx = null, kind = KIND_OF_TAB[activeTab] ?? 'expense') {
    categories = await getCategories(api);
    const saved = await openTransactionDialog({ categories, tx, defaultKind: kind, save: (payload) => (tx ? store.update(tx.id, payload) : store.create(payload)) });
    if (saved) toast.success(tx ? 'Movimiento actualizado.' : 'Movimiento guardado.');
  }
  async function remove(t) {
    const ok = await confirm({ title: '¿Eliminar este movimiento?', text: `${t.description} · ${formatCop(t.amountCop)}. Esta acción no se puede deshacer.`, confirmText: 'Eliminar', danger: true });
    if (!ok) return;
    try { await store.remove(t.id); toast.success('Movimiento eliminado.'); } catch (error) { toast.error(error.message); }
  }

  // ---------- composición ----------
  const newBtn = h('button', { type: 'button', class: 'btn btn--primary', on: { click: () => openForm() } }, icon('plus'), ' Nuevo movimiento');
  const tabs = createTabs({
    idBase: 'tabs-transactions', label: 'Tipo de movimiento', tabs: route.tabs, active: tab,
    onChange(id) {
      activeTab = id;
      history.replaceState(null, '', `#/${route.path}/${id}`);
      prefs.set(`tab.${route.path}`, id);
      refreshCategoryOptions();
      store.setKind(KIND_OF_TAB[id]);
    },
  });
  tabs.panel.append(h('div', { class: 'page' }, bar, table.root));
  container.append(h('div', { class: 'page' }, pageHeader('Transacciones', newBtn), tabs.tablist, tabs.panel));
  getCategories(api).then((list) => { categories = list; refreshCategoryOptions(); }).catch(() => {});
  const offCommand = onCommand('new-transaction', () => openForm()); // Ctrl+N
  return { destroy() { clearTimeout(debounce); offStore(); offCommand(); } };
}
