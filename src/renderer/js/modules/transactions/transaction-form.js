// [A.1][A.4] Formulario de movimiento en modal, con validación inline por campo (los errores del servidor se
// asignan al campo con el mismo nombre: kind, categoryId, amountCop, occurredOn, description, notes).
import { categoriesFor } from '../../core/categories.js';
import { h } from '../../core/dom.js';
import { parseCop, todayIso } from '../../core/format.js';
import { bindForm, field, required, selectField, textareaField } from '../../ui/form.js';
import { dialogButtons, openFormDialog } from '../../ui/form-dialog.js';
import { amountField, amountRule } from '../../ui/money.js';

const KINDS = [{ value: 'income', label: 'Ingreso' }, { value: 'expense', label: 'Gasto' }];

/** @returns {Promise<true|undefined>} true si se guardó. `save(payload)` crea o actualiza (lo decide quien llama). */
export function openTransactionDialog({ categories, tx = null, defaultKind = 'expense', save }) {
  return openFormDialog({
    title: tx ? 'Editar movimiento' : 'Nuevo movimiento',
    build({ close }) {
      const f = {
        kind: selectField({ id: 'kind', label: 'Tipo', options: KINDS, value: tx?.kind ?? defaultKind }),
        categoryId: selectField({ id: 'categoryId', label: 'Categoría' }),
        amountCop: amountField(),
        occurredOn: field({ id: 'occurredOn', label: 'Fecha', type: 'date' }),
        description: field({ id: 'description', label: 'Descripción', maxlength: 160, autocomplete: 'off' }),
        notes: textareaField({ id: 'notes', label: 'Notas (opcional)', maxlength: 1000 }),
      };
      const fillCategories = () => {
        const keep = tx && tx.kind === f.kind.input.value ? tx.categoryId : null;
        const options = categoriesFor(categories, f.kind.input.value, keep).map((c) => ({ value: c.id, label: c.isArchived ? `${c.name} (archivada)` : c.name }));
        f.categoryId.setOptions([{ value: '', label: 'Selecciona una categoría' }, ...options], keep ?? '');
      };
      fillCategories();
      f.kind.input.addEventListener('change', fillCategories);
      if (tx) {
        f.amountCop.input.value = new Intl.NumberFormat('es-CO').format(tx.amountCop);
        f.occurredOn.input.value = tx.occurredOn;
        f.description.input.value = tx.description;
        f.notes.input.value = tx.notes ?? '';
      } else {
        f.occurredOn.input.value = todayIso();
      }

      const buttons = dialogButtons({ close });
      const formError = h('div', { class: 'form-error', role: 'alert' });
      const form = h('form', { class: 'form' }, formError, f.kind.root, f.categoryId.root, f.amountCop.root, f.occurredOn.root, f.description.root, f.notes.root, buttons.node);
      bindForm({
        form, submit: buttons.submit, formError,
        fields: {
          kind: { field: f.kind },
          categoryId: { field: f.categoryId, validate: (v) => (v ? null : 'Selecciona una categoría') },
          amountCop: { field: f.amountCop, validate: amountRule },
          occurredOn: { field: f.occurredOn, validate: (v) => (/^\d{4}-\d{2}-\d{2}$/.test(v) ? null : 'Selecciona una fecha válida') },
          description: { field: f.description, validate: required('La descripción') },
          notes: { field: f.notes },
        },
        async onSubmit(v) {
          await save({ kind: v.kind, categoryId: Number(v.categoryId), amountCop: parseCop(v.amountCop), occurredOn: v.occurredOn, description: v.description.trim(), notes: v.notes.trim() || null });
          close(true);
        },
      });
      return form;
    },
  });
}
