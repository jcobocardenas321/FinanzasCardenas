// [A.4] Formularios accesibles con validación INLINE: cada campo muestra su error justo debajo (aria-describedby,
// aria-invalid), el foco va al primer campo inválido y los errores del servidor (fields) se mapean a sus campos.
import { announce } from '../core/a11y.js';
import { h, icon } from '../core/dom.js';
import { setBusy } from './spinner.js';

export function field({ id, label, type = 'text', autocomplete, hint, maxlength, required = true, spellcheck, inputmode, attrs = {} }) {
  const input = h('input', {
    id, name: id, type, autocomplete, maxlength, inputmode, ...attrs, class: 'input', 'aria-required': required ? 'true' : undefined,
    spellcheck: spellcheck === false ? 'false' : undefined, 'aria-describedby': hint ? `${id}-hint ${id}-error` : `${id}-error`,
  });
  const error = h('div', { id: `${id}-error`, class: 'field__error', 'aria-live': 'polite' });
  let control = input;
  if (type === 'password') {
    const toggle = h('button', { type: 'button', class: 'input-toggle', 'aria-label': 'Mostrar contraseña', 'aria-pressed': 'false' }, icon('eye'));
    toggle.addEventListener('click', () => {
      const show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      toggle.setAttribute('aria-pressed', String(show));
      toggle.replaceChildren(icon(show ? 'eye-slash' : 'eye'));
    });
    control = h('div', { class: 'input-group' }, input, toggle);
  }
  const root = h('div', { class: 'field' },
    h('label', { for: id, class: 'field__label' }, label, required ? h('span', { class: 'field__req', 'aria-hidden': 'true' }, ' *') : null),
    control, hint ? h('div', { id: `${id}-hint`, class: 'field__hint' }, hint) : null, error);
  return {
    id, root, input,
    setError(message) {
      error.textContent = message ?? '';
      if (message) input.setAttribute('aria-invalid', 'true'); else input.removeAttribute('aria-invalid');
      root.classList.toggle('field--invalid', Boolean(message));
    },
  };
}

/** Contenedor común de un control con etiqueta, pista y error inline (mismo contrato que field()). */
function wrapControl({ id, label, control, hint, required }) {
  const error = h('div', { id: `${id}-error`, class: 'field__error', 'aria-live': 'polite' });
  const root = h('div', { class: 'field' },
    h('label', { for: id, class: 'field__label' }, label, required ? h('span', { class: 'field__req', 'aria-hidden': 'true' }, ' *') : null),
    control, hint ? h('div', { id: `${id}-hint`, class: 'field__hint' }, hint) : null, error);
  return {
    id, root, input: control,
    setError(message) {
      error.textContent = message ?? '';
      if (message) control.setAttribute('aria-invalid', 'true'); else control.removeAttribute('aria-invalid');
      root.classList.toggle('field--invalid', Boolean(message));
    },
  };
}
const describedBy = (id, hint) => (hint ? `${id}-hint ${id}-error` : `${id}-error`);

/** Lista desplegable. options: [{ value, label }]. */
export function selectField({ id, label, options = [], required = true, hint, value = '' }) {
  const select = h('select', { id, name: id, class: 'input', 'aria-required': required ? 'true' : undefined, 'aria-describedby': describedBy(id, hint) });
  const f = wrapControl({ id, label, control: select, hint, required });
  f.setOptions = (opts, selected = select.value) => {
    select.replaceChildren(...opts.map((o) => h('option', { value: o.value }, o.label)));
    select.value = opts.some((o) => String(o.value) === String(selected)) ? String(selected) : (opts[0]?.value ?? '');
  };
  f.setOptions(options, value);
  return f;
}

export function textareaField({ id, label, maxlength, required = false, hint, rows = 3 }) {
  const area = h('textarea', { id, name: id, class: 'input', rows, maxlength, 'aria-required': required ? 'true' : undefined, 'aria-describedby': describedBy(id, hint) });
  return wrapControl({ id, label, control: area, hint, required });
}

// ---- validadores (devuelven un mensaje o null) ----
export const required = (label) => (v) => (v.trim() ? null : `${label} es obligatorio`);
export const pattern = (re, message) => (v) => (!v || re.test(v) ? null : message);
export const matches = (other, message) => (v, all) => (v === all[other] ? null : message);
export const compose = (...rules) => (v, all) => { for (const rule of rules) { const m = rule(v, all); if (m) return m; } return null; };

/** Espejo en el cliente de la política del servidor (shared/password-policy.js). El servidor sigue siendo la autoridad. */
export function passwordRules(password, username = '') {
  return [
    { id: 'len', label: 'Al menos 12 caracteres', ok: password.length >= 12 },
    { id: 'lower', label: 'Una letra minúscula', ok: /\p{Ll}/u.test(password) },
    { id: 'upper', label: 'Una letra mayúscula', ok: /\p{Lu}/u.test(password) },
    { id: 'digit', label: 'Un dígito', ok: /\p{N}/u.test(password) },
    { id: 'symbol', label: 'Un símbolo', ok: /[^\p{L}\p{N}]/u.test(password) },
    { id: 'user', label: 'No contiene el nombre de usuario', ok: !(username.length >= 3 && password.toLowerCase().includes(username.toLowerCase())) },
  ];
}
export function passwordError(password, username) {
  const missing = passwordRules(password, username).filter((r) => !r.ok);
  return missing.length ? `Falta: ${missing.map((r) => r.label.toLowerCase()).join('; ')}` : null;
}

/** Lista visible de requisitos que se actualiza al escribir (el estado no depende solo del color). */
export function passwordChecklist(input, getUsername = () => '') {
  const items = passwordRules('', '').map((r) => ({ id: r.id, icon: icon('circle-xmark'), state: h('span', { class: 'sr-only' }, ' (falta)'), li: null, label: r.label }));
  const list = h('ul', { class: 'pw-rules', 'aria-label': 'Requisitos de la contraseña' }, items.map((it) => {
    it.li = h('li', { class: 'pw-rule', dataset: { ok: 'false' } }, it.icon, h('span', {}, it.label), it.state);
    return it.li;
  }));
  const refresh = () => passwordRules(input.value, getUsername()).forEach((r, i) => {
    const it = items[i];
    it.li.dataset.ok = String(r.ok);
    it.icon.className = `fa-solid fa-${r.ok ? 'circle-check' : 'circle-xmark'}`;
    it.state.textContent = r.ok ? ' (cumple)' : ' (falta)';
  });
  input.addEventListener('input', refresh);
  refresh();
  return list;
}

/**
 * @param {{ form: HTMLFormElement, submit: HTMLButtonElement, formError: HTMLElement,
 *           fields: Record<string, { field: ReturnType<typeof field>, validate?: Function }>,
 *           onSubmit: (values: object) => Promise<void>, errorFocus?: string }} o
 */
export function bindForm({ form, submit, formError, fields, onSubmit, errorFocus }) {
  form.noValidate = true; // la validación y sus mensajes los controla esta función (no el navegador)
  const names = Object.keys(fields);
  const values = () => Object.fromEntries(names.map((n) => [n, fields[n].field.input.value]));
  const check = (name) => {
    const { field: f, validate } = fields[name];
    const message = validate?.(f.input.value, values()) ?? null;
    f.setError(message);
    return message;
  };
  for (const n of names) {
    const { input } = fields[n].field;
    input.addEventListener('blur', () => { if (input.value !== '') check(n); });
    input.addEventListener('input', () => { if (input.getAttribute('aria-invalid')) check(n); });
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    formError.textContent = '';
    const problems = names.map((n) => [n, check(n)]).filter(([, m]) => m);
    if (problems.length) {
      fields[problems[0][0]].field.input.focus();
      announce(`${problems.length} campo(s) con errores. ${problems[0][1]}`);
      return;
    }
    setBusy(submit, true);
    try {
      await onSubmit(values());
    } catch (error) {
      const serverFields = Object.entries(error?.fields ?? {}).filter(([k]) => fields[k]);
      if (serverFields.length) {
        for (const [k, message] of serverFields) fields[k].field.setError(message);
        fields[serverFields[0][0]].field.input.focus();
        announce(serverFields[0][1]);
      } else {
        formError.textContent = error?.message ?? 'Ocurrió un error inesperado. Inténtalo de nuevo.';
        if (errorFocus && fields[errorFocus]) fields[errorFocus].field.input.focus();
      }
    } finally {
      if (submit.isConnected) setBusy(submit, false);
    }
  });
}
