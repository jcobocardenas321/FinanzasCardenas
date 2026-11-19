// Ruta desconocida dentro de la aplicación.
import { h } from '../../core/dom.js';
import { emptyState } from '../../ui/empty-state.js';

export function mount(container, { navigate }) {
  container.append(h('div', { class: 'page' }, h('h1', { class: 'page-title' }, 'Página no encontrada'),
    emptyState({ icon: 'map-location-dot', title: 'Esa dirección no existe', text: 'Revisa el menú o vuelve al panel de control.', actionLabel: 'Ir al panel', onAction: () => navigate('dashboard') })));
}
