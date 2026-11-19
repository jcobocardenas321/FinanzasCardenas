// [A.4] Tabla de datos accesible: orden por encabezado (aria-sort), paginación 10/20/50, esqueleto de carga y
// región desplazable con teclado. Orden y tamaño de página se guardan como PREFERENCIAS DE UI (no datos).
import { h, icon } from '../core/dom.js';
import { skeletonRows } from './skeleton.js';

/**
 * @param {{ id: string, caption: string, prefs?: object, defaultSort: string, pageSizes?: number[],
 *   columns: { key: string, label: string, sortKey?: string, class?: string, srOnly?: boolean, render?: (row: object) => Node|string }[],
 *   onChange: (state: { page: number, pageSize: number, sort: string }) => void }} o
 */
export function createDataTable({ id, caption, columns, prefs, defaultSort, pageSizes = [10, 20, 50], onChange }) {
  const sortKeys = columns.filter((c) => c.sortKey).map((c) => c.sortKey);
  const okSort = (s) => typeof s === 'string' && sortKeys.includes(s.split(':')[0]) && ['asc', 'desc'].includes(s.split(':')[1]);
  const savedSize = prefs?.get(`table.${id}.pageSize`);
  const savedSort = prefs?.get(`table.${id}.sort`);
  const state = { page: 1, pageSize: pageSizes.includes(savedSize) ? savedSize : pageSizes[0], sort: okSort(savedSort) ? savedSort : defaultSort };
  let hasData = false;

  const capId = `${id}-caption`;
  const headCells = columns.map((c) => {
    if (!c.sortKey) return h('th', { scope: 'col', class: c.class }, c.srOnly ? h('span', { class: 'sr-only' }, c.label) : c.label);
    const iconEl = icon('sort');
    const button = h('button', { type: 'button', class: 'th-sort', on: { click: () => sortBy(c.sortKey) } }, c.label, iconEl);
    return h('th', { scope: 'col', class: c.class, 'aria-sort': 'none', dataset: { sortKey: c.sortKey } }, button);
  });
  const tbody = h('tbody');
  const table = h('table', { class: 'data-table' }, h('caption', { id: capId, class: 'sr-only' }, caption), h('thead', {}, h('tr', {}, headCells)), tbody);
  const scroll = h('div', { class: 'table-scroll', role: 'region', tabindex: '0', 'aria-labelledby': capId }, table);

  const sizeSelect = h('select', { id: `${id}-size`, class: 'input input--sm', on: { change: () => { state.pageSize = Number(sizeSelect.value); state.page = 1; prefs?.set(`table.${id}.pageSize`, state.pageSize); onChange({ ...state }); } } },
    pageSizes.map((n) => h('option', { value: n }, String(n))));
  sizeSelect.value = String(state.pageSize);
  const info = h('p', { class: 'table-info', 'aria-live': 'polite' });
  const pageLabel = h('span', { class: 'table-page' });
  const go = (delta) => { state.page += delta; onChange({ ...state }); };
  const prev = h('button', { type: 'button', class: 'btn btn--secondary btn--sm', on: { click: () => go(-1) } }, icon('chevron-left'), ' Anterior');
  const next = h('button', { type: 'button', class: 'btn btn--secondary btn--sm', on: { click: () => go(1) } }, 'Siguiente ', icon('chevron-right'));
  const footer = h('div', { class: 'table-footer' },
    h('div', { class: 'table-size' }, h('label', { for: `${id}-size` }, 'Filas por página'), sizeSelect), info,
    h('nav', { 'aria-label': `Paginación: ${caption}`, class: 'table-nav' }, prev, pageLabel, next));
  const emptyHost = h('div');
  const root = h('div', { class: 'table-wrap' }, scroll, emptyHost, footer);

  function paintHeaders() {
    const [key, dir] = state.sort.split(':');
    for (const th of headCells.filter((c) => c.dataset.sortKey)) {
      const active = th.dataset.sortKey === key;
      th.setAttribute('aria-sort', active ? (dir === 'asc' ? 'ascending' : 'descending') : 'none');
      th.querySelector('i').className = `fa-solid fa-${active ? (dir === 'asc' ? 'sort-up' : 'sort-down') : 'sort'}`;
    }
  }
  function sortBy(sortKey) {
    const [key, dir] = state.sort.split(':');
    state.sort = `${sortKey}:${key === sortKey && dir === 'asc' ? 'desc' : 'asc'}`;
    state.page = 1;
    prefs?.set(`table.${id}.sort`, state.sort);
    paintHeaders();
    onChange({ ...state });
  }
  paintHeaders();

  return {
    root, state,
    setLoading(loading) {
      root.setAttribute('aria-busy', String(loading));
      root.classList.toggle('is-loading', loading && hasData);
      if (loading && !hasData) tbody.replaceChildren(h('tr', {}, h('td', { colspan: columns.length }, skeletonRows(5))));
    },
    /** Muestra un nodo (estado vacío) en lugar de la tabla; null para volver a la tabla. */
    setEmpty(node) {
      emptyHost.replaceChildren(...(node ? [node] : []));
      scroll.hidden = footer.hidden = Boolean(node);
      if (node) { tbody.replaceChildren(); hasData = false; } // no dejar filas obsoletas ocultas en el DOM
    },
    setData({ rows, meta }) {
      if (rows.length === 0 && meta.total > 0 && state.page > 1) { state.page = meta.totalPages; onChange({ ...state }); return; }
      hasData = true;
      state.page = meta.page;
      tbody.replaceChildren(...rows.map((row) => h('tr', {}, columns.map((c) => h('td', { class: c.class, dataset: { label: c.label } }, c.render ? c.render(row) : String(row[c.key] ?? ''))))));
      const from = meta.total === 0 ? 0 : (meta.page - 1) * meta.pageSize + 1;
      info.textContent = `Mostrando ${from}–${Math.min(meta.page * meta.pageSize, meta.total)} de ${meta.total}`;
      pageLabel.textContent = `Página ${meta.page} de ${Math.max(meta.totalPages, 1)}`;
      prev.disabled = meta.page <= 1;
      next.disabled = meta.page >= meta.totalPages;
    },
  };
}
