// [A.1][B.5] Store de Transacciones: filtros, paginación, orden y datos del listado EN MEMORIA (los datos
// financieros nunca van a LocalStorage). Cada escritura emite fc:data:mutated para que el Panel se refresque.
import { EVENTS, emit } from '../../core/events.js';

const NO_FILTERS = () => ({ q: '', categoryId: '', from: '', to: '' });

export function createTransactionsStore({ api }) {
  const listeners = new Set();
  const state = { kind: null, filters: NO_FILTERS(), page: 1, pageSize: 10, sort: 'occurred_on:desc', rows: [], meta: { page: 1, pageSize: 10, total: 0, totalPages: 0 }, loading: false, loaded: false, error: null };
  let seq = 0;
  const notify = () => listeners.forEach((fn) => fn(state));

  async function load() {
    const mine = ++seq;
    state.loading = true;
    state.error = null;
    notify();
    try {
      const { data, meta } = await api.get('/transactions', { query: { page: state.page, pageSize: state.pageSize, sort: state.sort, kind: state.kind ?? undefined, ...state.filters } });
      if (mine !== seq) return; // llegó una respuesta más nueva
      Object.assign(state, { rows: data, meta, loaded: true });
    } catch (error) {
      if (mine === seq) state.error = error;
    } finally {
      if (mine === seq) { state.loading = false; notify(); }
    }
  }
  const mutate = async (call, action) => {
    const result = await call();
    emit(EVENTS.MUTATED, { entity: 'transaction', action });
    await load();
    return result;
  };

  return {
    state,
    load,
    hasFilters: () => Object.values(state.filters).some(Boolean),
    subscribe: (fn) => { listeners.add(fn); return () => listeners.delete(fn); },
    setKind: (kind) => { state.kind = kind; state.page = 1; return load(); },
    setFilters: (partial) => { Object.assign(state.filters, partial); state.page = 1; return load(); },
    clearFilters: () => { state.filters = NO_FILTERS(); state.page = 1; return load(); },
    setPaging: ({ page, pageSize, sort }) => { Object.assign(state, { page, pageSize, sort }); return load(); },
    create: (input) => mutate(() => api.post('/transactions', input), 'create'),
    update: (id, input) => mutate(() => api.patch(`/transactions/${id}`, input), 'update'),
    remove: (id) => mutate(() => api.delete(`/transactions/${id}`), 'delete'),
  };
}
