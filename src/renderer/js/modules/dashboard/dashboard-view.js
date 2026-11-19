// [C.11] Panel de control: KPI (Balance Total, Ahorro Mensual) + gráficos SVG nativos (barras, líneas y pastel) que
// consumen /analytics/kpis, /series y /breakdown. Esqueleto al cargar, estado vacío guiado, reintento, y se refresca
// solo con fc:data:mutated (reactividad del frontend; sin SSE ni WebSockets).
import { h } from '../../core/dom.js';
import { EVENTS, on } from '../../core/events.js';
import { currentMonth, formatCop, formatMonth, formatMonthShort, shiftMonth } from '../../core/format.js';
import { barChart, lineChart, pieChart } from '../../ui/charts.js';
import { emptyState, errorState } from '../../ui/empty-state.js';
import { skeletonCards } from '../../ui/skeleton.js';

const kpi = (label, value, note) => h('article', { class: 'kpi' },
  h('h2', { class: 'kpi__label' }, label),
  h('p', { class: `kpi__value${value < 0 ? ' kpi__value--negative' : ''}` }, formatCop(value)),
  h('p', { class: 'kpi__note' }, note));

export function mount(container, { api, navigate }) {
  const month = currentMonth();
  const body = h('div', { class: 'dashboard-body' });
  container.append(h('div', { class: 'page' }, h('h1', { class: 'page-title' }, 'Panel de control'), h('p', { class: 'page-subtitle' }, `Resumen de ${formatMonth(month)}`), body));
  let alive = true;

  function render(k, series, pie) {
    if (k.totalIncomeCop === 0 && k.totalExpenseCop === 0) {
      body.replaceChildren(emptyState({ icon: 'wallet', title: 'Aún no tienes movimientos', text: 'Registra tu primer ingreso para empezar a ver tu balance y tu ahorro mensual.', actionLabel: 'Agrega tu primer ingreso', onAction: () => navigate('transactions/income') }));
      return;
    }
    const last6 = series.points.slice(-6);
    const bars = barChart({
      title: 'Ingresos y gastos de los últimos 6 meses', labels: last6.map((p) => formatMonthShort(p.month)),
      series: [{ name: 'Ingresos', n: 3, values: last6.map((p) => p.incomeCop) }, { name: 'Gastos', n: 2, hatch: true, values: last6.map((p) => p.expenseCop) }],
    });
    const line = lineChart({
      title: 'Ahorro mensual de los últimos 12 meses', labels: series.points.map((p) => formatMonthShort(p.month)),
      series: [{ name: 'Ahorro (ingresos − gastos)', n: 1, values: series.points.map((p) => p.netCop) }],
    });
    const pieNode = pie.categories.length
      ? pieChart({ title: `Gastos por categoría en ${formatMonth(month)}`, slices: pie.categories.map((c) => ({ label: c.name, value: c.totalCop })) })
      : h('section', { class: 'chart-card' }, h('h2', { class: 'chart-title' }, `Gastos por categoría en ${formatMonth(month)}`), h('p', { class: 'kpi__note' }, 'Aún no registras gastos este mes.'));
    body.replaceChildren(
      h('div', { class: 'kpi-grid' }, kpi('Balance Total', k.balanceTotalCop, 'Ingresos − gastos de todo el histórico'), kpi(`Ahorro Mensual · ${formatMonth(k.month)}`, k.ahorroMensualCop, 'Ingresos − gastos del mes')),
      h('div', { class: 'chart-grid-layout' }, bars, line, pieNode));
  }

  async function load() {
    body.setAttribute('aria-busy', 'true');
    body.replaceChildren(skeletonCards(3));
    try {
      const [k, series, pie] = await Promise.all([
        api.get('/analytics/kpis', { query: { month } }),
        api.get('/analytics/series', { query: { from: shiftMonth(month, -11), to: month } }),
        api.get('/analytics/breakdown', { query: { month, kind: 'expense' } }),
      ]);
      if (alive) render(k.data, series.data, pie.data);
    } catch (error) {
      if (alive) body.replaceChildren(errorState({ message: error.message, onRetry: load }));
    } finally {
      body.removeAttribute('aria-busy');
    }
  }
  const off = on(EVENTS.MUTATED, load);
  load();
  return { destroy() { alive = false; off(); } };
}
