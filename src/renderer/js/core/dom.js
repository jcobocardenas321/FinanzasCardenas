// [B.5] Construcción segura del DOM: nunca innerHTML; todo texto entra como nodo de texto (anti-XSS).
export function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(props ?? {})) {
    if (value === undefined || value === null || value === false) continue;
    if (key === 'class') el.className = value;
    else if (key === 'on') for (const [name, fn] of Object.entries(value)) el.addEventListener(name, fn);
    else if (key === 'dataset') Object.assign(el.dataset, value);
    else el.setAttribute(key, value === true ? '' : String(value));
  }
  el.append(...children.flat(Infinity).filter((c) => c !== null && c !== undefined && c !== false));
  return el;
}

/** Icono FontAwesome decorativo (oculto a lectores de pantalla). */
export const icon = (name, extra = '') => h('i', { class: `fa-solid fa-${name} ${extra}`.trim(), 'aria-hidden': 'true' });
