// [Fase 7.2a] Cascarón de la vista de Apariencia: personalización del lenguaje Liquid Glass.
import { h, icon } from '../../core/dom.js';
import { pageHeader } from '../../ui/page-header.js';

const SECTIONS = [
  { id: 'themes', label: 'Temas', icon: 'palette', desc: '12 paletas visuales adaptativas' },
  { id: 'geometry', label: 'Geometría', icon: 'shapes', desc: 'Radios, bordes y curvatura' },
  { id: 'backgrounds', label: 'Fondos', icon: 'image', desc: 'Gradientes y destellos de fondo' },
  { id: 'animations', label: 'Animaciones', icon: 'wand-magic-sparkles', desc: 'Velocidad y curvas de aceleración' },
  { id: 'colors', label: 'Colores', icon: 'droplet', desc: 'Tonalidades de acento e indicadores' },
  { id: 'languages', label: 'Idiomas', icon: 'globe', desc: 'Configuración regional y formatos' },
  { id: 'accessibility', label: 'Accesibilidad', icon: 'universal-access', desc: 'Contraste, reducción de movimiento y Daltonismo' },
];

export function mount(container) {
  let activeSection = 'themes';

  const navItems = SECTIONS.map((sec) => {
    const btn = h('button', {
      type: 'button',
      class: `appearance-nav__btn ${sec.id === activeSection ? 'is-active' : ''}`,
      dataset: { section: sec.id },
      'aria-pressed': String(sec.id === activeSection),
    },
      icon(sec.icon, 'appearance-nav__icon'),
      h('div', { class: 'appearance-nav__text' },
        h('strong', {}, sec.label),
        h('small', {}, sec.desc),
      ),
    );

    btn.addEventListener('click', () => {
      activeSection = sec.id;
      navItems.forEach((b) => {
        const isCurrent = b.dataset.section === activeSection;
        b.classList.toggle('is-active', isCurrent);
        b.setAttribute('aria-pressed', String(isCurrent));
      });
      renderContent();
    });

    return btn;
  });

  const nav = h('nav', { class: 'appearance-nav', 'aria-label': 'Secciones de apariencia' }, ...navItems);
  const contentArea = h('div', { class: 'appearance-content', id: 'appearance-content' });

  function renderContent() {
    const current = SECTIONS.find((s) => s.id === activeSection) ?? SECTIONS[0];
    contentArea.replaceChildren(
      h('div', { class: 'appearance-placeholder' },
        h('div', { class: 'appearance-placeholder__badge' }, icon(current.icon), current.label),
        h('h2', { class: 'appearance-placeholder__title' }, `Configuración de ${current.label}`),
        h('p', { class: 'appearance-placeholder__desc' }, current.desc),
        h('div', { class: 'appearance-placeholder__body' },
          h('p', {}, 'Cascarón preparado para la Fase 7.2b.'),
        ),
      ),
    );
  }

  renderContent();

  const layout = h('div', { class: 'panel appearance-layout' }, nav, contentArea);
  const page = h('div', { class: 'page' },
    pageHeader('Apariencia de la app', 'Personaliza los temas, fondos, geometrías y accesibilidad del sistema Liquid Glass.'),
    layout,
  );

  container.append(page);

  return {
    destroy() {
      // Limpieza al desmontar
    },
  };
}
