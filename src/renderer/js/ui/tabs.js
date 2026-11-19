// [A.2] Pestañas WAI-ARIA: role tablist/tab/tabpanel, tabindex itinerante y flechas/Inicio/Fin.
import { h } from '../core/dom.js';

/**
 * @param {{ idBase: string, label: string, tabs: { id: string, label: string }[], active: string, onChange: (id: string) => void }} o
 * @returns {{ tablist: HTMLElement, panel: HTMLElement, select(id: string, focus?: boolean): void }}
 */
export function createTabs({ idBase, label, tabs, active, onChange }) {
  const panel = h('div', { role: 'tabpanel', id: `${idBase}-panel`, tabindex: '0' });
  const buttons = tabs.map((t) => h('button', {
    type: 'button', role: 'tab', id: `${idBase}-tab-${t.id}`, class: 'tab', 'aria-controls': `${idBase}-panel`, dataset: { tab: t.id },
    on: { click: () => select(t.id) },
  }, t.label));
  const tablist = h('div', { role: 'tablist', 'aria-label': label, class: 'tabs' }, buttons);

  function select(id, focus = false) {
    buttons.forEach((b) => {
      const on = b.dataset.tab === id;
      b.setAttribute('aria-selected', String(on));
      b.tabIndex = on ? 0 : -1;
      if (on && focus) b.focus();
    });
    panel.setAttribute('aria-labelledby', `${idBase}-tab-${id}`);
    onChange(id);
  }

  tablist.addEventListener('keydown', (event) => {
    const i = buttons.findIndex((b) => b.dataset.tab === document.activeElement?.dataset?.tab);
    if (i < 0) return;
    const move = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: buttons.length - 1 }[event.key];
    if (move === undefined) return;
    event.preventDefault();
    select(buttons[(move + buttons.length) % buttons.length].dataset.tab, true);
  });

  select(active);
  return { tablist, panel, select };
}
