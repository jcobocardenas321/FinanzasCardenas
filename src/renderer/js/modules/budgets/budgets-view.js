// [A.1] Presupuestos mensuales por categoría de gasto: barras de progreso con estado en TEXTO + ícono
// (En orden / Alerta / Superado), resumen de alertas y alta/edición en modal. El umbral viene de Configuración.
import { categoriesFor, getCategories } from '../../core/categories.js';
import { h, icon } from '../../core/dom.js';
import { EVENTS, emit } from '../../core/events.js';
import { currentMonth, formatCop, formatMonth, shiftMonth } from '../../core/format.js';
import { confirm } from '../../ui/dialogs.js';
import { emptyState, errorState } from '../../ui/empty-state.js';
import { bindForm, selectField } from '../../ui/form.js';
import { dialogButtons, openFormDialog } from '../../ui/form-dialog.js';
import { amountField, amountRule } from '../../ui/money.js';
import { badge, pageHeader } from '../../ui/page-header.js';
import { progressBar } from '../../ui/progress.js';
import { skeletonRows } from '../../ui/skeleton.js';
import { parseCop } from '../../core/format.js';

const STATUS = { ok: ['En orden', 'ok', 'circle-check'], warning: ['Alerta', 'warning', 'triangle-exclamation'], over: ['Superado', 'over', 'circle-exclamation'] };

function openBudgetDialog({ options, item, month, save }) {
  return openFormDialog({
    title: item ? 'Editar presupuesto' : 'Agregar presupuesto', description: `Mes: ${formatMonth(month)}`,
    build({ close }) {
      const f = { categoryId: selectField({ id: 'categoryId', label: 'Categoría de gasto', options }), amountCop: amountField() };
      if (item) { f.categoryId.input.value = String(item.categoryId); f.categoryId.input.disabled = true; f.amountCop.input.value = new Intl.NumberFormat('es-CO').format(item.amountCop); }
      const buttons = dialogButtons({ close });
      const formError = h('div', { class: 'form-error', role: 'alert' });
      const form = h('form', { class: 'form' }, formError, f.categoryId.root, f.amountCop.root, buttons.node);
      bindForm({ form, submit: buttons.submit, formError,
        fields: { categoryId: { field: f.categoryId, validate: (v) => (v ? null : 'Selecciona una categoría') }, amountCop: { field: f.amountCop, validate: amountRule } },
        async onSubmit(v) { await save(Number(v.categoryId), parseCop(v.amountCop)); close(true); } });
      return form;
    },
  });
}

export function mount(container, { api, toast }) {
  let month = currentMonth();
  let view = null;
  let alive = true;
  const label = h('span', { class: 'month-label', 'aria-live': 'polite' });
  const body = h('div', { class: 'page' });
  const prev = h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Mes anterior', on: { click: () => go(-1) } }, icon('chevron-left'));
  const next = h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Mes siguiente', on: { click: () => go(1) } }, icon('chevron-right'));
  const addBtn = h('button', { type: 'button', class: 'btn btn--primary', on: { click: () => openForm(null) } }, icon('plus'), ' Agregar presupuesto');
  container.append(h('div', { class: 'page' }, pageHeader('Presupuestos', addBtn), h('div', { class: 'month-nav', role: 'group', 'aria-label': 'Mes del presupuesto' }, prev, label, next), body));

  const go = (d) => { month = shiftMonth(month, d); load(); };
  const changed = (action) => { emit(EVENTS.MUTATED, { entity: 'budget', action }); return load(); };

  function render() {
    const { items, totals, warningThresholdPct } = view;
    if (items.length === 0) {
      body.replaceChildren(emptyState({ icon: 'scale-balanced', title: 'Aún no hay presupuestos este mes', text: 'Define cuánto quieres gastar por categoría y te avisaremos al acercarte al límite.', actionLabel: 'Agregar presupuesto', onAction: () => openForm(null) }));
      return;
    }
    const names = (s) => items.filter((i) => i.status === s).map((i) => i.category.name).join(', ');
    const alerts = h('div', { class: 'page', 'aria-live': 'polite' },
      items.some((i) => i.status === 'over') ? h('div', { class: 'alert alert--over', role: 'status' }, h('strong', {}, icon('circle-exclamation'), ' Superaste el presupuesto en: '), names('over')) : null,
      items.some((i) => i.status === 'warning') ? h('div', { class: 'alert alert--warning', role: 'status' }, h('strong', {}, icon('triangle-exclamation'), ` Cerca del límite (${warningThresholdPct} %) en: `), names('warning')) : null);
    const list = h('ul', { class: 'budget-list', 'aria-label': `Presupuestos de ${formatMonth(month)}` }, items.map((i) => {
      const [text, kind, ic] = STATUS[i.status];
      return h('li', { class: 'budget' },
        h('div', { class: 'budget__top' }, h('h2', { class: 'budget__name' }, i.category.name), badge(text, kind, ic)),
        progressBar({ percent: i.percentUsed, status: i.status, label: `${i.category.name}: ${i.percentUsed} % del presupuesto usado` }),
        h('div', { class: 'budget__nums' }, h('span', {}, `Presupuesto: ${formatCop(i.amountCop)}`), h('span', {}, `Gastado: ${formatCop(i.spentCop)} (${i.percentUsed} %)`),
          h('span', {}, i.remainingCop >= 0 ? `Disponible: ${formatCop(i.remainingCop)}` : `Excedido por: ${formatCop(-i.remainingCop)}`)),
        h('div', { class: 'budget__actions' },
          h('button', { type: 'button', class: 'btn btn--secondary btn--sm', 'aria-label': `Editar presupuesto de ${i.category.name}`, on: { click: () => openForm(i) } }, icon('pen'), ' Editar'),
          h('button', { type: 'button', class: 'btn btn--secondary btn--sm', 'aria-label': `Eliminar presupuesto de ${i.category.name}`, on: { click: () => remove(i) } }, icon('trash'), ' Eliminar')));
    }));
    body.replaceChildren(h('p', { class: 'page-subtitle' }, `Presupuestado ${formatCop(totals.budgetCop)} · Gastado ${formatCop(totals.spentCop)} · ${totals.remainingCop >= 0 ? 'Disponible' : 'Excedido'} ${formatCop(Math.abs(totals.remainingCop))}`), alerts, list);
  }
  async function load() {
    label.textContent = formatMonth(month);
    body.setAttribute('aria-busy', 'true');
    body.replaceChildren(skeletonRows(4));
    try { view = (await api.get('/budgets', { query: { month } })).data; if (alive) render(); }
    catch (error) { if (alive) body.replaceChildren(errorState({ message: error.message, onRetry: load })); }
    finally { body.removeAttribute('aria-busy'); }
  }
  async function openForm(item) {
    const all = await getCategories(api);
    const used = new Set((view?.items ?? []).map((i) => i.categoryId));
    const options = item ? [{ value: item.categoryId, label: item.category.name }]
      : [{ value: '', label: 'Selecciona una categoría' }, ...categoriesFor(all, 'expense').filter((c) => !used.has(c.id)).map((c) => ({ value: c.id, label: c.name }))];
    if (!item && options.length === 1) { toast.info('Ya tienes presupuesto para todas las categorías de gasto de este mes.'); return; }
    const saved = await openBudgetDialog({ options, item, month, save: (categoryId, amountCop) => api.put(`/budgets/${categoryId}/${month}`, { amountCop }) });
    if (saved) { toast.success('Presupuesto guardado.'); await changed('upsert'); }
  }
  async function remove(i) {
    if (!(await confirm({ title: '¿Eliminar este presupuesto?', text: `Se quitará el presupuesto de ${i.category.name} para ${formatMonth(month)}.`, confirmText: 'Eliminar', danger: true }))) return;
    try { await api.delete(`/budgets/${i.categoryId}/${month}`); toast.success('Presupuesto eliminado.'); await changed('delete'); } catch (error) { toast.error(error.message); }
  }
  load();
  return { destroy() { alive = false; } };
}
