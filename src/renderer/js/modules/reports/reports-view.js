// [Alcance: reportes] Resumen y detalle por rango de fechas + exportación CSV (api.download). La impresión a PDF
// con Electron (printToPDF) se incorpora en la Fase 5; el backend solo entrega datos y CSV.
import { onCommand } from '../../core/commands.js';
import { h, icon } from '../../core/dom.js';
import { saveBlob } from '../../core/files.js';
import { printCurrentViewToPdf } from '../../core/print.js';
import { currentMonth, formatCop, formatDate, formatMonth, monthBounds, todayIso } from '../../core/format.js';
import { errorState } from '../../ui/empty-state.js';
import { field, selectField } from '../../ui/form.js';
import { pageHeader, badge } from '../../ui/page-header.js';
import { skeletonRows } from '../../ui/skeleton.js';
import { createTabs } from '../../ui/tabs.js';

let seq = 0;
function plainTable({ caption, headers, rows, numFrom = 99 }) {
  const id = `rt-${(seq += 1)}`;
  return h('div', { class: 'panel' }, h('h2', { class: 'chart-title' }, caption),
    h('div', { class: 'table-scroll', role: 'region', tabindex: '0', 'aria-labelledby': id },
      h('table', { class: 'data-table' }, h('caption', { id, class: 'sr-only' }, caption),
        h('thead', {}, h('tr', {}, headers.map((t, i) => h('th', { scope: 'col', class: i >= numFrom ? 'num' : undefined }, t)))),
        h('tbody', {}, rows.length ? rows.map((r) => h('tr', {}, r.map((c, i) => h('td', { class: i >= numFrom ? 'num' : undefined }, c)))) : h('tr', {}, h('td', { colspan: headers.length }, 'Sin datos en este rango.'))))));
}
const kpi = (label, value, cls = '') => h('article', { class: 'kpi' }, h('h2', { class: 'kpi__label' }, label), h('p', { class: `kpi__value ${cls}` }, formatCop(value)));

export function mount(container, { api, route, tab, prefs, toast }) {
  const { from: f0, to: t0 } = monthBounds(currentMonth());
  const from = field({ id: 'r-from', label: 'Desde', type: 'date' });
  const to = field({ id: 'r-to', label: 'Hasta', type: 'date' });
  const sep = selectField({ id: 'r-sep', label: 'Separador del CSV', required: false, options: [{ value: 'comma', label: 'Coma (,)' }, { value: 'semicolon', label: 'Punto y coma (;)' }] });
  from.input.value = f0; to.input.value = t0;
  let active = tab;
  let alive = true;
  const body = h('div', { class: 'page' });
  const printHeader = h('p', { class: 'print-only print-title' }); // solo visible al imprimir
  const range = () => ({ from: from.input.value, to: to.input.value });
  const valid = () => { const bad = from.input.value && to.input.value && from.input.value > to.input.value; to.setError(bad ? 'La fecha final no puede ser anterior a la inicial' : ''); return !bad && from.input.value && to.input.value; };

  async function render() {
    if (!valid()) return;
    printHeader.textContent = `FinanzasCardenas · Reporte financiero del ${formatDate(from.input.value)} al ${formatDate(to.input.value)} · Generado el ${formatDate(todayIso())}`;
    body.setAttribute('aria-busy', 'true');
    body.replaceChildren(skeletonRows(4));
    try {
      if (active === 'summary') {
        const s = (await api.get('/reports/summary', { query: range() })).data;
        if (!alive) return;
        const cats = (list) => list.map((c) => [c.name, formatCop(c.totalCop), `${c.percent} %`]);
        body.replaceChildren(
          h('div', { class: 'summary-grid' }, kpi('Ingresos', s.totals.incomeCop), kpi('Gastos', s.totals.expenseCop), kpi('Neto', s.totals.netCop, s.totals.netCop < 0 ? 'kpi__value--negative' : '')),
          h('div', { class: 'two-col' },
            plainTable({ caption: 'Ingresos por categoría', headers: ['Categoría', 'Monto', '% del total'], rows: cats(s.byCategory.income), numFrom: 1 }),
            plainTable({ caption: 'Gastos por categoría', headers: ['Categoría', 'Monto', '% del total'], rows: cats(s.byCategory.expense), numFrom: 1 })),
          plainTable({ caption: 'Resumen por mes', headers: ['Mes', 'Ingresos', 'Gastos', 'Neto'], rows: s.byMonth.map((m) => [formatMonth(m.month), formatCop(m.incomeCop), formatCop(m.expenseCop), formatCop(m.netCop)]), numFrom: 1 }));
      } else {
        const d = (await api.get('/reports/detail', { query: range() })).data;
        if (!alive) return;
        const shown = d.rows.slice(0, 100);
        body.replaceChildren(h('p', { class: 'table-info', role: 'status' }, `Mostrando ${shown.length} de ${d.total} movimientos. Exporta el CSV para obtenerlos todos.`),
          plainTable({ caption: 'Detalle de movimientos', headers: ['Fecha', 'Tipo', 'Categoría', 'Descripción', 'Monto'], numFrom: 4,
            rows: shown.map((t) => [formatDate(t.occurredOn), badge(t.kind === 'income' ? 'Ingreso' : 'Gasto', t.kind === 'income' ? 'ok' : 'over'), t.category.name, t.description, formatCop(t.amountCop)]) }));
      }
    } catch (error) { if (alive) body.replaceChildren(errorState({ message: error.message, onRetry: render })); }
    finally { body.removeAttribute('aria-busy'); }
  }

  async function exportCsv() {
    if (!valid()) return;
    try {
      const { blob, filename } = await api.download('/reports/transactions.csv', { query: { ...range(), delimiter: sep.input.value } });
      await saveBlob({ blob, filename, kind: 'csv', toast, cancelText: 'Exportación cancelada.' });
    } catch (error) { toast.error(error.message); }
  }
  async function printPdf() {
    if (!valid()) return;
    try { await printCurrentViewToPdf({ suggestedName: `reporte_${from.input.value}_${to.input.value}.pdf`, toast }); } catch (error) { toast.error(error.message); }
  }

  const exportBtn = h('button', { type: 'button', class: 'btn btn--primary', on: { click: exportCsv } }, icon('file-csv'), ' Exportar CSV');
  const printBtn = h('button', { type: 'button', class: 'btn btn--secondary', on: { click: printPdf } }, icon('print'), ' Imprimir a PDF');
  const controls = h('form', { class: 'filter-bar', 'aria-label': 'Rango del reporte', on: { submit: (e) => e.preventDefault() } }, from.root, to.root, sep.root);
  from.input.addEventListener('change', render);
  to.input.addEventListener('change', render);
  const tabs = createTabs({
    idBase: 'tabs-reports', label: 'Secciones del reporte', tabs: route.tabs, active: tab,
    onChange(id) { active = id; history.replaceState(null, '', `#/${route.path}/${id}`); prefs.set(`tab.${route.path}`, id); render(); },
  });
  tabs.panel.append(body);
  container.append(h('div', { class: 'page' }, pageHeader('Reportes', exportBtn, printBtn), printHeader, controls, tabs.tablist, tabs.panel));
  const offExport = onCommand('export-csv', exportCsv); // Ctrl+E
  const offPrint = onCommand('print-pdf', printPdf); // Ctrl+P
  return { destroy() { alive = false; offExport(); offPrint(); } };
}
