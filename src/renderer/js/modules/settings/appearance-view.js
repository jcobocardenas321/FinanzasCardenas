// [Fase 7.3] Vista de Apariencia Liquid Glass: Personalización total en tiempo real.
// Integra los 12 temas, 4 modos, 12 geometrías, 12 fondos dinámicos, 12 animaciones y filtros de accesibilidad.
import { h, icon } from '../../core/dom.js';
import { pageHeader } from '../../ui/page-header.js';
import { createPrefs } from '../../core/prefs.js';
import {
  THEME_NAMES,
  MODES,
  MODE_LABEL,
  GEO,
  BGS,
  ANIMS,
  ACCENTS,
  LANGUAGES,
  applyTheme,
} from '../../core/theme.js';
import { openControlPanel } from '../../core/control-panel.js';

const SECTIONS = [
  { id: 'themes', label: 'Temas', icon: 'palette', desc: '12 paletas armónicas y 4 modos de luz' },
  { id: 'geometry', label: 'Geometría', icon: 'shapes', desc: '12 radios, curvaturas y cápsulas' },
  { id: 'backgrounds', label: 'Fondos', icon: 'image', desc: '12 fondos dinámicos y gradientes' },
  { id: 'animations', label: 'Animaciones', icon: 'wand-magic-sparkles', desc: '12 efectos de entrada y transiciones' },
  { id: 'colors', label: 'Colores', icon: 'droplet', desc: 'Acentos luminosos cian y lavanda' },
  { id: 'languages', label: 'Idiomas', icon: 'globe', desc: 'Configuración regional y formatos' },
  { id: 'accessibility', label: 'Accesibilidad', icon: 'universal-access', desc: 'Filtros de daltonismo, foco y contraste' },
];

const COLOR_BLIND_MODES = [
  { id: 'none', label: 'Ninguno', desc: 'Espectro de color estándar sin filtrado' },
  { id: 'protanopia', label: 'Protanopia', desc: 'Ajuste de contraste para percepción de rojos' },
  { id: 'deuteranopia', label: 'Deuteranopia', desc: 'Compensación de espectro para percepción de verdes' },
  { id: 'tritanopia', label: 'Tritanopia', desc: 'Compensación de tonos para percepción de azules' },
];

export function mount(container, context = {}) {
  const prefs = context.prefs ?? createPrefs(context.user?.id ?? 'anon');
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

  function renderSwitch({ title, desc, checked, onToggle, ariaLabel }) {
    const sw = h('button', {
      type: 'button',
      class: 'fc-switch',
      role: 'switch',
      'aria-checked': String(checked),
      'aria-label': ariaLabel ?? title,
      on: {
        click: () => onToggle(!checked),
      },
    });

    return h('div', { class: 'appearance-switch-row' },
      h('div', { class: 'appearance-switch-info' },
        h('span', { class: 'appearance-switch-title' }, title),
        h('span', { class: 'appearance-switch-desc' }, desc),
      ),
      sw,
    );
  }

  function renderContent() {
    const rawTheme = prefs.get('theme', 'dark');
    const currentMode = prefs.get('mode', typeof rawTheme === 'string' ? rawTheme : 'dark');
    const currentThemeIndex = typeof rawTheme === 'number' ? rawTheme : 0;
    const currentGeoIndex = prefs.get('geo', prefs.get('geometry', 'rounded') === 'sharp' ? 0 : 3);
    const currentBgIndex = prefs.get('bg', 0);
    const currentAnimIndex = prefs.get('anim', 2);
    const currentMotion = prefs.get('reducedMotion', false) || prefs.get('a11y.reduceMotion', false);
    const currentFontSize = prefs.get('fontSize', 'normal');
    const currentContrast = prefs.get('highContrast', false) || currentMode === 'contrast';
    const currentLang = prefs.get('language', 'es-CO');
    const currentColorBlind = prefs.get('a11y.colorBlind', 'none');
    const currentUnderline = prefs.get('a11y.underline', false);
    const currentFocusRing = prefs.get('a11y.focusRing', false);

    let sectionEl;

    if (activeSection === 'themes') {
      // Modos de luz (Claro, Oscuro, Alto Contraste, Auto)
      const modeCards = MODES.map((m) => {
        const isSelected = currentMode === m;
        return h('button', {
          type: 'button',
          class: `appearance-card ${isSelected ? 'is-selected' : ''}`,
          role: 'radio',
          'aria-checked': String(isSelected),
          dataset: { themeValue: m }, // Permite compatibilidad con smoke-ui data-theme-value="light" y "dark"
          on: {
            click: () => {
              prefs.set('mode', m);
              if (m === 'light' || m === 'dark' || m === 'contrast') {
                prefs.set('theme', m);
                prefs.set('highContrast', m === 'contrast');
              }
              applyTheme(prefs);
              renderContent();
            },
          },
        },
          icon(m === 'light' ? 'sun' : (m === 'dark' ? 'moon' : (m === 'contrast' ? 'circle-half-stroke' : 'desktop')), 'appearance-card__icon'),
          h('span', { class: 'appearance-card__title' }, MODE_LABEL[m]),
          h('span', { class: 'appearance-card__desc' }, m === 'auto' ? 'Sigue la preferencia del sistema operativo' : `Modo visual ${MODE_LABEL[m]}`),
          isSelected ? h('span', { class: 'appearance-card__badge' }, 'Activo') : null,
        );
      });

      // 12 Temas Liquid Glass (Rotación de tono 30°)
      const themeCards = THEME_NAMES.map((name, i) => {
        const isSelected = currentThemeIndex === i && typeof rawTheme === 'number';
        const swatch = h('div', {
          class: `app-cp-swatch appearance-swatch app-cp-swatch--${i}`,
        });
        return h('button', {
          type: 'button',
          class: `appearance-card ${isSelected ? 'is-selected' : ''}`,
          role: 'radio',
          'aria-checked': String(isSelected),
          dataset: { themeIndex: String(i) },
          on: {
            click: () => {
              prefs.set('theme', i);
              applyTheme(prefs);
              renderContent();
            },
          },
        },
          swatch,
          h('span', { class: 'appearance-card__title' }, name),
          h('span', { class: 'appearance-card__desc' }, `Variante armónica #${i + 1}`),
          isSelected ? h('span', { class: 'appearance-card__badge' }, 'Activo') : null,
        );
      });

      sectionEl = h('div', { class: 'appearance-section' },
        h('div', { class: 'appearance-section__head' },
          h('h2', { class: 'appearance-section__title' }, 'Modos de iluminación'),
          h('p', { class: 'appearance-section__desc' }, 'Selecciona el balance de luminosidad y contraste base.'),
        ),
        h('div', { class: 'appearance-grid', role: 'radiogroup', 'aria-label': 'Selección de modo' }, ...modeCards),
        h('div', { class: 'appearance-section__head app-section-mt' },
          h('h2', { class: 'appearance-section__title' }, '12 Temas Liquid Glass'),
          h('p', { class: 'appearance-section__desc' }, 'Paletas espectrales completas generadas por refracción matemática.'),
        ),
        h('div', { class: 'appearance-grid', role: 'radiogroup', 'aria-label': 'Selección de tema de color' }, ...themeCards),
      );
    } else if (activeSection === 'geometry') {
      const cards = GEO.map((g, i) => {
        const isSelected = currentGeoIndex === i;
        const preview = h('span', { class: `app-cp-preview app-cp-geo-preview--${i}` });
        return h('button', {
          type: 'button',
          class: `appearance-card ${isSelected ? 'is-selected' : ''}`,
          role: 'radio',
          'aria-checked': String(isSelected),
          dataset: { geoIndex: String(i), geometryValue: i === 0 ? 'sharp' : 'rounded' },
          on: {
            click: () => {
              prefs.set('geo', i);
              prefs.set('geometry', i === 0 ? 'sharp' : 'rounded');
              applyTheme(prefs);
              renderContent();
            },
          },
        },
          preview,
          h('span', { class: 'appearance-card__title' }, g.name),
          h('span', { class: 'appearance-card__desc' }, `Radio de esquinas: ${g.r}`),
          isSelected ? h('span', { class: 'appearance-card__badge' }, 'Activo') : null,
        );
      });

      sectionEl = h('div', { class: 'appearance-section' },
        h('div', { class: 'appearance-section__head' },
          h('h2', { class: 'appearance-section__title' }, '12 Estilos de Geometría'),
          h('p', { class: 'appearance-section__desc' }, 'Control de curvatura, radios orgánicos y cápsulas para botones, tarjetas y modales.'),
        ),
        h('div', { class: 'appearance-grid', role: 'radiogroup', 'aria-label': 'Selección de geometría' }, ...cards),
      );
    } else if (activeSection === 'backgrounds') {
      const cards = BGS.map((name, i) => {
        const isSelected = currentBgIndex === i;
        const preview = h('span', { class: `app-cp-preview app-cp-bg-preview--${i}` });
        return h('button', {
          type: 'button',
          class: `appearance-card ${isSelected ? 'is-selected' : ''}`,
          role: 'radio',
          'aria-checked': String(isSelected),
          dataset: { bgIndex: String(i) },
          on: {
            click: () => {
              prefs.set('bg', i);
              applyTheme(prefs);
              renderContent();
            },
          },
        },
          preview,
          h('span', { class: 'appearance-card__title' }, name),
          h('span', { class: 'appearance-card__desc' }, `Fondo atmosférico dinámico #${i + 1}`),
          isSelected ? h('span', { class: 'appearance-card__badge' }, 'Activo') : null,
        );
      });

      sectionEl = h('div', { class: 'appearance-section' },
        h('div', { class: 'appearance-section__head' },
          h('h2', { class: 'appearance-section__title' }, '12 Fondos Dinámicos'),
          h('p', { class: 'appearance-section__desc' }, 'Capas ambientales con refracción óptica, gradientes cósmicos y texturas.'),
        ),
        h('div', { class: 'appearance-grid', role: 'radiogroup', 'aria-label': 'Selección de fondo' }, ...cards),
      );
    } else if (activeSection === 'animations') {
      const switchRow = renderSwitch({
        title: 'Reducir movimiento',
        desc: 'Desactiva animaciones de entrada, modales y transiciones complejas para máximo confort y rendimiento.',
        checked: currentMotion === true,
        ariaLabel: 'Activar reducción de movimiento',
        onToggle: (val) => {
          prefs.set('reducedMotion', val);
          prefs.set('a11y.reduceMotion', val);
          applyTheme(prefs);
          renderContent();
        },
      });

      const cards = ANIMS.map((name, i) => {
        const isSelected = currentAnimIndex === i + 1;
        return h('button', {
          type: 'button',
          class: `appearance-card ${isSelected ? 'is-selected' : ''}`,
          role: 'radio',
          'aria-checked': String(isSelected),
          dataset: { animIndex: String(i + 1) },
          on: {
            click: () => {
              prefs.set('anim', i + 1);
              applyTheme(prefs);
              renderContent();
            },
          },
        },
          icon('play', 'appearance-card__icon'),
          h('span', { class: 'appearance-card__title' }, name),
          h('span', { class: 'appearance-card__desc' }, `Curva y efecto #${i + 1}`),
          isSelected ? h('span', { class: 'appearance-card__badge' }, 'Activo') : null,
        );
      });

      sectionEl = h('div', { class: 'appearance-section' },
        h('div', { class: 'appearance-section__head' },
          h('h2', { class: 'appearance-section__title' }, 'Animaciones y Movimiento'),
          h('p', { class: 'appearance-section__desc' }, '12 efectos de transición de entrada para vistas y modales.'),
        ),
        switchRow,
        h('div', { class: 'appearance-section__head app-section-mt' },
          h('h2', { class: 'appearance-section__title' }, '12 Efectos de Transición'),
          h('p', { class: 'appearance-section__desc' }, 'Selecciona el estilo de entrada predeterminado.'),
        ),
        h('div', { class: 'appearance-grid', role: 'radiogroup', 'aria-label': 'Selección de animación' }, ...cards),
      );
    } else if (activeSection === 'colors') {
      const cards = ACCENTS.map((item) => {
        const isSelected = prefs.get('accentColor', 'cyan') === item.id;
        const swatch = h('div', {
          class: `color-swatch color-swatch--${item.id}`,
        });
        return h('button', {
          type: 'button',
          class: `appearance-card ${isSelected ? 'is-selected' : ''}`,
          role: 'radio',
          'aria-checked': String(isSelected),
          dataset: { accentValue: item.id },
          on: {
            click: () => {
              prefs.set('accentColor', item.id);
              applyTheme(prefs);
              renderContent();
            },
          },
        },
          swatch,
          h('span', { class: 'appearance-card__title' }, item.label),
          h('span', { class: 'appearance-card__desc' }, item.desc),
          isSelected ? h('span', { class: 'appearance-card__badge' }, 'Activo') : null,
        );
      });

      sectionEl = h('div', { class: 'appearance-section' },
        h('div', { class: 'appearance-section__head' },
          h('h2', { class: 'appearance-section__title' }, 'Color de Acento Principal'),
          h('p', { class: 'appearance-section__desc' }, 'Elige el color para botones primarios, enlaces e indicadores activos.'),
        ),
        h('div', { class: 'appearance-grid', role: 'radiogroup', 'aria-label': 'Selección de color de acento' }, ...cards),
      );
    } else if (activeSection === 'languages') {
      const cards = LANGUAGES.map((item) => {
        const isSelected = currentLang === item.id;
        return h('button', {
          type: 'button',
          class: `appearance-card ${isSelected ? 'is-selected' : ''}`,
          role: 'radio',
          'aria-checked': String(isSelected),
          disabled: !item.active,
          on: {
            click: () => {
              if (!item.active) return;
              prefs.set('language', item.id);
              applyTheme(prefs);
              renderContent();
            },
          },
        },
          icon('globe', 'appearance-card__icon'),
          h('span', { class: 'appearance-card__title' }, item.label),
          h('span', { class: 'appearance-card__desc' }, item.desc),
          isSelected ? h('span', { class: 'appearance-card__badge' }, 'Predeterminado') : (!item.active ? h('span', { class: 'appearance-card__badge badge--upcoming' }, 'Próximamente') : null),
        );
      });

      sectionEl = h('div', { class: 'appearance-section' },
        h('div', { class: 'appearance-section__head' },
          h('h2', { class: 'appearance-section__title' }, 'Idioma y Región'),
          h('p', { class: 'appearance-section__desc' }, 'Formato local de moneda ($ COP), separadores numéricos y calendario.'),
        ),
        h('div', { class: 'appearance-grid', role: 'radiogroup', 'aria-label': 'Selección de idioma' }, ...cards),
      );
    } else if (activeSection === 'accessibility') {
      const textSwitch = renderSwitch({
        title: 'Texto grande',
        desc: 'Aumenta el tamaño tipográfico base a 18px para mejorar la legibilidad general de cifras y tablas.',
        checked: currentFontSize === 'large',
        ariaLabel: 'Activar texto grande',
        onToggle: (val) => {
          prefs.set('fontSize', val ? 'large' : 'normal');
          applyTheme(prefs);
          renderContent();
        },
      });

      const contrastSwitch = renderSwitch({
        title: 'Modo Alto Contraste (WCAG AAA)',
        desc: 'Fuerza contraste extremo con fondo negro puro (#000000) y bordes nítidos.',
        checked: currentContrast === true,
        ariaLabel: 'Activar modo alto contraste',
        onToggle: (val) => {
          prefs.set('highContrast', val);
          if (val) {
            prefs.set('theme', 'contrast');
            prefs.set('mode', 'contrast');
          } else {
            prefs.set('theme', 'dark');
            prefs.set('mode', 'dark');
          }
          applyTheme(prefs);
          renderContent();
        },
      });

      const underlineSwitch = renderSwitch({
        title: 'Subrayar enlaces',
        desc: 'Mantiene siempre una línea de subrayado visible debajo de todos los enlaces de navegación.',
        checked: currentUnderline === true,
        ariaLabel: 'Activar subrayado de enlaces',
        onToggle: (val) => {
          prefs.set('a11y.underline', val);
          applyTheme(prefs);
          renderContent();
        },
      });

      const focusSwitch = renderSwitch({
        title: 'Anillo de foco ampliado',
        desc: 'Aumenta el grosor y visibilidad del indicador de teclado en todos los elementos interactivos.',
        checked: currentFocusRing === true,
        ariaLabel: 'Activar anillo de foco ampliado',
        onToggle: (val) => {
          prefs.set('a11y.focusRing', val);
          applyTheme(prefs);
          renderContent();
        },
      });

      const daltonismCards = COLOR_BLIND_MODES.map((mode) => {
        const isSelected = currentColorBlind === mode.id;
        return h('button', {
          type: 'button',
          class: `appearance-card ${isSelected ? 'is-selected' : ''}`,
          role: 'radio',
          'aria-checked': String(isSelected),
          on: {
            click: () => {
              prefs.set('a11y.colorBlind', mode.id);
              applyTheme(prefs);
              renderContent();
            },
          },
        },
          icon('eye', 'appearance-card__icon'),
          h('span', { class: 'appearance-card__title' }, mode.label),
          h('span', { class: 'appearance-card__desc' }, mode.desc),
          isSelected ? h('span', { class: 'appearance-card__badge' }, 'Activo') : null,
        );
      });

      sectionEl = h('div', { class: 'appearance-section' },
        h('div', { class: 'appearance-section__head' },
          h('h2', { class: 'appearance-section__title' }, 'Filtros para Daltonismo'),
          h('p', { class: 'appearance-section__desc' }, 'Aplica matrices de color SVG SVG-FeColorMatrix para protanopia, deuteranopia o tritanopia.'),
        ),
        h('div', { class: 'appearance-grid', role: 'radiogroup', 'aria-label': 'Selección de filtro de daltonismo' }, ...daltonismCards),
        h('div', { class: 'appearance-section__head app-section-mt' },
          h('h2', { class: 'appearance-section__title' }, 'Opciones de Visibilidad y Foco'),
          h('p', { class: 'appearance-section__desc' }, 'Controles diseñados bajo normativas WCAG 2.1 AA/AAA.'),
        ),
        h('div', { class: 'appearance-switch-stack' }, textSwitch, contrastSwitch, underlineSwitch, focusSwitch),
      );
    }

    contentArea.replaceChildren(sectionEl);
  }

  renderContent();

  const openDrawerBtn = h('button', {
    type: 'button',
    class: 'btn btn--secondary btn-open-drawer',
    on: {
      click: () => openControlPanel(),
    },
  },
    icon('sliders'),
    'Abrir panel lateral de control',
  );

  const layout = h('div', { class: 'panel appearance-layout' }, nav, contentArea);
  const page = h('div', { class: 'page' },
    pageHeader('Apariencia de la app', 'Personaliza los temas, fondos, geometrías y accesibilidad del sistema Liquid Glass.'),
    openDrawerBtn,
    layout,
  );

  container.append(page);

  return {
    destroy() {
      // Limpieza
    },
  };
}
