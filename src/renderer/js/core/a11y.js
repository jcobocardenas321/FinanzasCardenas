// [A.2] Accesibilidad WCAG AA: anuncios a lectores de pantalla y gestión de foco.
const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

/** Elementos enfocables visibles (getClientRects funciona también con position:fixed). */
export const focusables = (container) => [...container.querySelectorAll(FOCUSABLE)].filter((el) => el.getClientRects().length > 0);

/** Anuncia un mensaje en la región aria-live="polite" de index.html. */
export function announce(message) {
  const region = document.getElementById('live-region');
  if (!region) return;
  region.textContent = '';
  setTimeout(() => { region.textContent = message; }, 50);
}

/** Atrapa el foco con Tab dentro de `container`. @returns {() => void} liberar */
export function trapFocus(container) {
  const onKeydown = (event) => {
    if (event.key !== 'Tab') return;
    const items = focusables(container);
    if (items.length === 0) return;
    const first = items[0];
    const last = items.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  };
  container.addEventListener('keydown', onKeydown);
  return () => container.removeEventListener('keydown', onKeydown);
}
