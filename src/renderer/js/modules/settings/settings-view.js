// [A.1] Configuración del hogar: nombre y umbral de alerta de presupuestos. Solo el Admin modifica; el Editor lo ve en lectura.
import { h } from '../../core/dom.js';
import { setState } from '../../core/store.js';
import { bindForm, field, required } from '../../ui/form.js';
import { skeletonRows } from '../../ui/skeleton.js';
import { errorState } from '../../ui/empty-state.js';
import { pageHeader } from '../../ui/page-header.js';

export function mount(container, { api, toast, user }) {
  const canEdit = user?.role === 'admin';
  const body = h('div', { class: 'panel form--narrow' }, skeletonRows(3));
  container.append(h('div', { class: 'page' }, pageHeader('Configuración'), body));
  let alive = true;

  async function load() {
    try {
      const s = (await api.get('/settings')).data;
      if (!alive) return;
      const f = {
        householdName: field({ id: 'householdName', label: 'Nombre del hogar', maxlength: 60, autocomplete: 'off' }),
        budgetWarningThresholdPct: field({ id: 'budgetWarningThresholdPct', label: 'Umbral de alerta de presupuestos (%)', inputmode: 'numeric', maxlength: 3, hint: 'Se avisa cuando el gasto alcanza este porcentaje del presupuesto (50 a 100).' }),
      };
      f.householdName.input.value = s.householdName;
      f.budgetWarningThresholdPct.input.value = String(s.budgetWarningThresholdPct);
      const submit = h('button', { type: 'submit', class: 'btn btn--primary' }, 'Guardar cambios');
      const formError = h('div', { class: 'form-error', role: 'alert' });
      const form = h('form', { class: 'form', 'aria-label': 'Configuración del hogar' }, formError, f.householdName.root, f.budgetWarningThresholdPct.root,
        h('p', { class: 'field__hint' }, `Moneda: ${s.currency} (fija).`), canEdit ? submit : h('p', { class: 'alert alert--info', role: 'note' }, 'Solo un administrador puede modificar la configuración.'));
      if (!canEdit) { f.householdName.input.disabled = true; f.budgetWarningThresholdPct.input.disabled = true; }
      bindForm({ form, submit, formError,
        fields: {
          householdName: { field: f.householdName, validate: required('El nombre del hogar') },
          budgetWarningThresholdPct: { field: f.budgetWarningThresholdPct, validate: (v) => (/^\d{2,3}$/.test(v) && Number(v) >= 50 && Number(v) <= 100 ? null : 'Ingresa un número entero entre 50 y 100') },
        },
        async onSubmit(v) {
          const { data } = await api.put('/settings', { householdName: v.householdName.trim(), budgetWarningThresholdPct: Number(v.budgetWarningThresholdPct) });
          setState('cache.household', data.householdName);
          toast.success('Configuración guardada.');
        } });
      body.replaceChildren(form);
    } catch (error) { if (alive) body.replaceChildren(errorState({ message: error.message, onRetry: load })); }
  }
  load();
  return { destroy() { alive = false; } };
}
