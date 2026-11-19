// [A.1] Metas de ahorro: tarjetas con anillo de progreso, aportes en modal y estado automático (completada).
// Los aportes son informativos: no alteran el Balance Total.
import { h, icon } from '../../core/dom.js';
import { EVENTS, emit } from '../../core/events.js';
import { formatCop, formatDate, parseCop, todayIso } from '../../core/format.js';
import { confirm } from '../../ui/dialogs.js';
import { emptyState, errorState } from '../../ui/empty-state.js';
import { bindForm, field, required, selectField } from '../../ui/form.js';
import { dialogButtons, openFormDialog } from '../../ui/form-dialog.js';
import { amountField, amountRule } from '../../ui/money.js';
import { badge, pageHeader } from '../../ui/page-header.js';
import { progressRing } from '../../ui/progress.js';
import { skeletonCards } from '../../ui/skeleton.js';

const STATUS = { active: ['Activa', 'info', 'bullseye'], completed: ['Completada', 'ok', 'circle-check'], archived: ['Archivada', 'muted', 'box-archive'] };

function openGoalDialog({ goal, save }) {
  return openFormDialog({
    title: goal ? 'Editar meta' : 'Nueva meta de ahorro',
    build({ close }) {
      const f = { name: field({ id: 'name', label: 'Nombre de la meta', maxlength: 80, autocomplete: 'off' }), targetAmountCop: amountField({ id: 'targetAmountCop', label: 'Monto objetivo (COP)' }), targetDate: field({ id: 'targetDate', label: 'Fecha límite (opcional)', type: 'date', required: false }) };
      if (goal) { f.name.input.value = goal.name; f.targetAmountCop.input.value = new Intl.NumberFormat('es-CO').format(goal.targetAmountCop); f.targetDate.input.value = goal.targetDate ?? ''; }
      const buttons = dialogButtons({ close });
      const formError = h('div', { class: 'form-error', role: 'alert' });
      const form = h('form', { class: 'form' }, formError, f.name.root, f.targetAmountCop.root, f.targetDate.root, buttons.node);
      bindForm({ form, submit: buttons.submit, formError,
        fields: { name: { field: f.name, validate: required('El nombre') }, targetAmountCop: { field: f.targetAmountCop, validate: amountRule }, targetDate: { field: f.targetDate } },
        async onSubmit(v) { await save({ name: v.name.trim(), targetAmountCop: parseCop(v.targetAmountCop), targetDate: v.targetDate || null }); close(true); } });
      return form;
    },
  });
}

function openContributionDialog({ goal, save }) {
  return openFormDialog({
    title: `Aportar a «${goal.name}»`, description: `Ahorrado: ${formatCop(goal.savedCop)} de ${formatCop(goal.targetAmountCop)}.`,
    build({ close }) {
      const f = { amountCop: amountField(), contributedOn: field({ id: 'contributedOn', label: 'Fecha del aporte', type: 'date' }) };
      f.contributedOn.input.value = todayIso();
      const buttons = dialogButtons({ close, label: 'Registrar aporte' });
      const formError = h('div', { class: 'form-error', role: 'alert' });
      const form = h('form', { class: 'form' }, formError, f.amountCop.root, f.contributedOn.root, buttons.node);
      bindForm({ form, submit: buttons.submit, formError,
        fields: { amountCop: { field: f.amountCop, validate: amountRule }, contributedOn: { field: f.contributedOn, validate: (v) => (/^\d{4}-\d{2}-\d{2}$/.test(v) ? null : 'Selecciona una fecha válida') } },
        async onSubmit(v) { await save({ amountCop: parseCop(v.amountCop), contributedOn: v.contributedOn }); close(true); } });
      return form;
    },
  });
}

export function mount(container, { api, toast }) {
  let alive = true;
  let status = '';
  const body = h('div', { class: 'page' });
  const filter = selectField({ id: 'g-status', label: 'Mostrar', required: false, options: [{ value: '', label: 'Todas' }, { value: 'active', label: 'Activas' }, { value: 'completed', label: 'Completadas' }, { value: 'archived', label: 'Archivadas' }] });
  filter.input.addEventListener('change', () => { status = filter.input.value; load(); });
  const newBtn = h('button', { type: 'button', class: 'btn btn--primary', on: { click: () => openGoal(null) } }, icon('plus'), ' Nueva meta');
  container.append(h('div', { class: 'page' }, pageHeader('Metas de ahorro', newBtn), h('div', { class: 'filter-bar' }, filter.root), body));
  const changed = (action) => { emit(EVENTS.MUTATED, { entity: 'goal', action }); return load(); };

  const dateInfo = (g) => {
    if (g.targetDate === null) return 'Sin fecha límite';
    if (g.isOverdue) return `Vencida hace ${-g.daysLeft} día(s) · ${formatDate(g.targetDate)}`;
    return `${g.daysLeft === 0 ? 'Vence hoy' : `Faltan ${g.daysLeft} día(s)`} · ${formatDate(g.targetDate)}`;
  };
  const card = (g) => {
    const [text, kind, ic] = STATUS[g.status];
    const btn = (iconName, label, aria, fn, primary = false, disabled = false) => h('button', { type: 'button', class: `btn ${primary ? 'btn--primary' : 'btn--secondary'} btn--sm`, 'aria-label': aria, disabled, on: { click: fn } }, icon(iconName), ` ${label}`);
    return h('li', { class: 'goal' },
      h('div', { class: 'goal__head' }, progressRing({ percent: g.percent, label: `${g.name}: ${g.percent} % ahorrado` }),
        h('div', {}, h('h2', { class: 'goal__title' }, g.name), badge(text, kind, ic))),
      h('div', { class: 'goal__meta' }, h('span', {}, `Ahorrado: ${formatCop(g.savedCop)} de ${formatCop(g.targetAmountCop)}`), h('span', {}, g.remainingCop > 0 ? `Falta: ${formatCop(g.remainingCop)}` : '¡Meta alcanzada!'), h('span', {}, dateInfo(g))),
      h('div', { class: 'goal__actions' },
        btn('piggy-bank', 'Aportar', `Aportar a la meta ${g.name}`, () => contribute(g), true, g.status === 'archived'),
        btn('pen', 'Editar', `Editar meta ${g.name}`, () => openGoal(g)),
        btn(g.status === 'archived' ? 'box-open' : 'box-archive', g.status === 'archived' ? 'Reactivar' : 'Archivar', `${g.status === 'archived' ? 'Reactivar' : 'Archivar'} meta ${g.name}`, () => archive(g)),
        btn('trash', 'Eliminar', `Eliminar meta ${g.name}`, () => remove(g))));
  };
  async function load() {
    body.setAttribute('aria-busy', 'true');
    body.replaceChildren(skeletonCards(3));
    try {
      const { data } = await api.get('/goals', { query: { status, pageSize: 100, sort: 'created_at:desc' } });
      if (!alive) return;
      body.replaceChildren(data.length ? h('ul', { class: 'goal-grid', 'aria-label': 'Metas de ahorro' }, data.map(card))
        : emptyState({ icon: 'bullseye', title: status ? 'No hay metas con ese estado' : 'Aún no tienes metas de ahorro', text: 'Define una meta, por ejemplo un viaje o un fondo de emergencia, y registra tus aportes.', actionLabel: 'Crea tu primera meta', onAction: () => openGoal(null) }));
    } catch (error) { if (alive) body.replaceChildren(errorState({ message: error.message, onRetry: load })); }
    finally { body.removeAttribute('aria-busy'); }
  }
  async function openGoal(goal) {
    const saved = await openGoalDialog({ goal, save: (p) => (goal ? api.patch(`/goals/${goal.id}`, p) : api.post('/goals', p)) });
    if (saved) { toast.success(goal ? 'Meta actualizada.' : 'Meta creada.'); await changed(goal ? 'update' : 'create'); }
  }
  async function contribute(g) {
    const saved = await openContributionDialog({ goal: g, save: (p) => api.post(`/goals/${g.id}/contributions`, p) });
    if (saved) { toast.success('Aporte registrado.'); await changed('contribute'); }
  }
  async function archive(g) {
    try { await api.patch(`/goals/${g.id}`, { status: g.status === 'archived' ? 'active' : 'archived' }); toast.success(g.status === 'archived' ? 'Meta reactivada.' : 'Meta archivada.'); await changed('status'); } catch (error) { toast.error(error.message); }
  }
  async function remove(g) {
    if (!(await confirm({ title: '¿Eliminar esta meta?', text: `Se eliminará «${g.name}» y todos sus aportes.`, confirmText: 'Eliminar', danger: true }))) return;
    try { await api.delete(`/goals/${g.id}`); toast.success('Meta eliminada.'); await changed('delete'); } catch (error) { toast.error(error.message); }
  }
  load();
  return { destroy() { alive = false; } };
}
