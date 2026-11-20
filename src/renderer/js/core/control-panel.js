// [Fase 7.3] Controlador del Drawer Panel de Control lateral (Offcanvas) de Liquid Glass.
// Maneja 12 temas, 4 modos, 12 geometrías, 12 fondos dinámicos, 12 animaciones y accesibilidad.
// Construcción segura del DOM con h() (sin innerHTML/outerHTML).
import { h } from './dom.js';
import {
  THEME_NAMES,
  MODES,
  MODE_LABEL,
  MODE_ICON,
  GEO,
  BGS,
  ANIMS,
  PANEL_TABS,
  applyTheme,
  getPrefs,
} from './theme.js';
import { toast } from '../ui/toasts.js';

let activeTab = 'themes';
let currentPrefs = null;
let lastFocus = null;

function $(selector, root = document) {
  return root.querySelector(selector);
}

function $$(selector, root = document) {
  return Array.from(root.querySelectorAll(selector));
}

function svgIcon(name, cls = 'app-icon') {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', cls);
  svg.setAttribute('aria-hidden', 'true');
  const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
  use.setAttribute('href', `#i-${name}`);
  svg.appendChild(use);
  return svg;
}

function focusables(root) {
  return $$('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])', root)
    .filter((el) => el.offsetParent !== null || el.getClientRects().length > 0);
}

function trapFocus(element) {
  const handleKeyDown = (event) => {
    if (event.key !== 'Tab') return;
    const items = focusables(element);
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };
  element.addEventListener('keydown', handleKeyDown);
  return () => element.removeEventListener('keydown', handleKeyDown);
}

export function openControlPanel(tab) {
  const panel = $('#control-panel');
  const backdrop = $('#panel-backdrop');
  const toggle = $('#panel-toggle');
  if (!panel || !backdrop) return;

  if (tab) activeTab = tab;
  lastFocus = document.activeElement;

  panel.hidden = false;
  backdrop.hidden = false;
  requestAnimationFrame(() => {
    panel.classList.add('is-open');
  });
  document.body.classList.add('panel-open');
  if (toggle) toggle.setAttribute('aria-expanded', 'true');

  renderPanel();

  const activeBtn = $(`[data-cp-tab="${activeTab}"]`);
  if (activeBtn) activeBtn.focus();

  if (panel._cleanup) panel._cleanup();
  panel._cleanup = trapFocus(panel);
}

export function closeControlPanel() {
  const panel = $('#control-panel');
  const backdrop = $('#panel-backdrop');
  const toggle = $('#panel-toggle');
  if (!panel || !backdrop) return;

  panel.classList.remove('is-open');
  if (panel._cleanup) {
    panel._cleanup();
    panel._cleanup = null;
  }

  window.setTimeout(() => {
    panel.hidden = true;
    backdrop.hidden = true;
    $('#cp-tabs')?.replaceChildren();
    $('#cp-panels')?.replaceChildren();
  }, 220);

  document.body.classList.remove('panel-open');
  if (toggle) toggle.setAttribute('aria-expanded', 'false');
  if (lastFocus && typeof lastFocus.focus === 'function') lastFocus.focus();
}

function openResetModal() {
  const root = $('#modal-root');
  if (!root) return;

  const backdrop = h('div', { class: 'app-modal-backdrop', id: 'reset-modal-backdrop' });

  const closeModal = () => {
    cleanup();
    backdrop.remove();
    document.body.classList.remove('modal-open');
    const resetBtn = $('#cp-reset');
    if (resetBtn) resetBtn.focus();
  };

  const handleConfirmReset = () => {
    const prefs = getPrefs(currentPrefs);
    const keysToReset = [
      'theme', 'mode', 'geometry', 'geo', 'background', 'bg',
      'anim', 'accentColor', 'reducedMotion', 'fontSize', 'highContrast',
      'a11y.reduceMotion', 'a11y.underline', 'a11y.focusRing',
      'a11y.colorBlind', 'a11y.fontScale', 'a11y.lineHeight', 'a11y.letterSpacing',
    ];
    keysToReset.forEach((k) => prefs.remove(k));
    applyTheme(prefs);
    renderPanel();
    closeModal();
    toast.success('Apariencia restablecida a los valores predeterminados.');
  };

  const modal = h('section', {
    class: 'app-modal',
    role: 'dialog',
    'aria-modal': 'true',
    'aria-labelledby': 'reset-modal-title',
  },
    h('div', { class: 'app-modal-head' },
      h('h2', { id: 'reset-modal-title' }, 'Restablecer apariencia'),
      h('button', {
        type: 'button',
        class: 'app-icon-btn',
        'aria-label': 'Cerrar modal',
        on: { click: closeModal },
      }, svgIcon('close')),
    ),
    h('div', { class: 'app-modal-body' },
      h('p', {}, '¿Seguro que quieres restablecer la apariencia de la app a los valores predeterminados de Liquid Glass? Se borrarán tus configuraciones de temas, modos, geometrías, fondos, animaciones y accesibilidad.'),
    ),
    h('div', { class: 'app-modal-foot' },
      h('button', { type: 'button', class: 'app-btn', on: { click: closeModal } }, 'Cancelar'),
      h('button', { type: 'button', class: 'app-btn app-btn--danger', on: { click: handleConfirmReset } }, 'Sí, restablecer'),
    ),
  );

  backdrop.appendChild(modal);
  root.appendChild(backdrop);
  document.body.classList.add('modal-open');

  const cleanup = trapFocus(modal);

  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) closeModal();
  });

  modal.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal();
  });

  const cancelBtn = modal.querySelector('.app-btn');
  if (cancelBtn) cancelBtn.focus();
}

function renderTabContent(tabId) {
  const prefs = getPrefs(currentPrefs);

  if (tabId === 'themes') {
    const rawTheme = prefs.get('theme', 0);
    const currentTheme = typeof rawTheme === 'number' ? rawTheme : 0;
    const currentMode = prefs.get('mode', typeof rawTheme === 'string' ? rawTheme : 'dark');

    const themeButtons = THEME_NAMES.map((name, i) =>
      h('button', {
        type: 'button',
        class: 'app-cp-choice',
        'aria-pressed': String(currentTheme === i),
        dataset: { theme: String(i) },
        on: {
          click: () => {
            prefs.set('theme', i);
            applyTheme(prefs);
            renderPanel();
          },
        },
      },
        h('span', { class: `app-cp-swatch app-cp-swatch--${i}` }),
        h('span', {}, name),
      ));

    const modeButtons = MODES.map((m) =>
      h('button', {
        type: 'button',
        class: 'app-cp-choice',
        'aria-pressed': String(currentMode === m),
        dataset: { mode: m },
        on: {
          click: () => {
            prefs.set('mode', m);
            if (['light', 'dark', 'contrast'].includes(m)) {
              prefs.set('theme', m);
              prefs.set('highContrast', m === 'contrast');
            }
            applyTheme(prefs);
            renderPanel();
          },
        },
      },
        svgIcon(MODE_ICON[m]),
        h('span', {}, MODE_LABEL[m]),
      ));

    return [
      h('div', { class: 'app-cp-section' },
        h('strong', {}, 'Temas (12 colores Liquid Glass)'),
        h('div', { class: 'app-cp-grid' }, ...themeButtons),
        h('small', { class: 'app-muted' }, 'Variantes con rotación de tono armónica de 30°.'),
      ),
      h('div', { class: 'app-cp-section' },
        h('strong', {}, 'Modo de luz'),
        h('div', { class: 'app-cp-grid' }, ...modeButtons),
        h('small', { class: 'app-muted' }, 'Claro, oscuro, alto contraste y automático.'),
      ),
    ];
  }

  if (tabId === 'geometry') {
    let currentGeo = prefs.get('geo', null);
    if (currentGeo === null) {
      currentGeo = prefs.get('geometry', 'rounded') === 'sharp' ? 0 : 3;
    }

    const geoButtons = GEO.map((g, i) =>
      h('button', {
        type: 'button',
        class: 'app-cp-choice',
        'aria-pressed': String(currentGeo === i),
        dataset: { geo: String(i) },
        on: {
          click: () => {
            prefs.set('geo', i);
            prefs.set('geometry', i === 0 ? 'sharp' : 'rounded');
            applyTheme(prefs);
            renderPanel();
          },
        },
      },
        h('span', { class: `app-cp-preview app-cp-geo-preview--${i}` }),
        h('span', {}, g.name),
      ));

    return [
      h('div', { class: 'app-cp-section' },
        h('strong', {}, 'Geometría (12 estilos de bordes)'),
        h('div', { class: 'app-cp-grid' }, ...geoButtons),
        h('small', { class: 'app-muted' }, 'Radios y curvaturas aplicados a tarjetas, botones y controles.'),
      ),
    ];
  }

  if (tabId === 'backgrounds') {
    let currentBg = prefs.get('bg', null);
    if (currentBg === null) {
      const bStr = prefs.get('background', 'deep-blue');
      currentBg = bStr === 'violet' ? 4 : (bStr === 'pure-black' ? 0 : 0);
    }

    const bgButtons = BGS.map((name, i) =>
      h('button', {
        type: 'button',
        class: 'app-cp-choice',
        'aria-pressed': String(currentBg === i),
        dataset: { bg: String(i) },
        on: {
          click: () => {
            prefs.set('bg', i);
            applyTheme(prefs);
            renderPanel();
          },
        },
      },
        h('span', { class: `app-cp-preview app-cp-bg-preview--${i}` }),
        h('span', {}, name),
      ));

    return [
      h('div', { class: 'app-cp-section' },
        h('strong', {}, 'Fondos dinámicos (12 fondos)'),
        h('div', { class: 'app-cp-grid' }, ...bgButtons),
        h('small', { class: 'app-muted' }, 'Fondos atmosféricos con refracción y texturas espaciales.'),
      ),
    ];
  }

  if (tabId === 'animations') {
    const currentAnim = prefs.get('anim', 2);
    const animButtons = ANIMS.map((name, i) =>
      h('button', {
        type: 'button',
        class: 'app-cp-choice',
        'aria-pressed': String(currentAnim === i + 1),
        dataset: { anim: String(i + 1) },
        on: {
          click: () => {
            prefs.set('anim', i + 1);
            applyTheme(prefs);
            renderPanel();
          },
        },
      },
        svgIcon('sparkles'),
        h('span', {}, name),
      ));

    return [
      h('div', { class: 'app-cp-section' },
        h('strong', {}, 'Animaciones de entrada (12 tipos)'),
        h('div', { class: 'app-cp-grid' }, ...animButtons),
        h('small', { class: 'app-muted' }, 'Transiciones y curvas de movimiento fluido.'),
      ),
    ];
  }

  if (tabId === 'colors') {
    return [
      h('div', { class: 'app-cp-section' },
        h('strong', {}, 'Paleta de acento'),
        h('p', { class: 'app-small app-muted' }, 'Acentos luminosos cian, lavanda y azul de alta pureza visual.'),
        h('div', { class: 'app-row app-row--mt' },
          h('button', {
            type: 'button',
            class: 'app-btn app-btn--sm app-btn--primary',
            on: {
              click: () => {
                prefs.set('theme', 0);
                prefs.set('mode', 'dark');
                applyTheme(prefs);
                renderPanel();
                toast.info('Tema Firma aplicado.');
              },
            },
          }, 'Firma Liquid Glass'),
        ),
      ),
    ];
  }

  if (tabId === 'languages') {
    const currentLang = prefs.get('language', 'es-CO');
    const langBtnEs = h('button', {
      type: 'button',
      class: 'app-cp-choice',
      'aria-pressed': String(currentLang === 'es-CO'),
      on: {
        click: () => {
          prefs.set('language', 'es-CO');
          applyTheme(prefs);
          renderPanel();
        },
      },
    },
      h('span', { class: 'app-cp-swatch app-cp-swatch--es' }),
      h('span', {}, 'Español'),
    );

    const langBtnEn = h('button', {
      type: 'button',
      class: 'app-cp-choice',
      'aria-pressed': String(currentLang === 'en-US'),
      on: {
        click: () => {
          prefs.set('language', 'en-US');
          applyTheme(prefs);
          renderPanel();
        },
      },
    },
      h('span', { class: 'app-cp-swatch app-cp-swatch--en' }),
      h('span', {}, 'English'),
    );

    return [
      h('div', { class: 'app-cp-section' },
        h('strong', {}, 'Idioma de la interfaz'),
        h('div', { class: 'app-cp-grid' }, langBtnEs, langBtnEn),
        h('small', { class: 'app-muted' }, 'Formato monetario COP ($) y convenciones locales.'),
      ),
    ];
  }

  if (tabId === 'accessibility') {
    const reduceMotion = Boolean(prefs.get('reducedMotion', false) || prefs.get('a11y.reduceMotion', false));
    const underline = Boolean(prefs.get('a11y.underline', false));
    const focusRing = Boolean(prefs.get('a11y.focusRing', false));
    const colorBlind = prefs.get('a11y.colorBlind', 'none');
    const fontScale = prefs.get('a11y.fontScale', 100);

    const motionSwitch = h('label', { class: 'app-check app-check--switch' },
      h('span', { class: 'app-check__label' }, 'Reducir movimiento'),
      h('input', {
        type: 'checkbox',
        checked: reduceMotion,
        'aria-label': 'Reducir movimiento',
        on: {
          change: (e) => {
            prefs.set('reducedMotion', e.target.checked);
            prefs.set('a11y.reduceMotion', e.target.checked);
            applyTheme(prefs);
          },
        },
      }),
    );

    const underlineSwitch = h('label', { class: 'app-check app-check--switch' },
      h('span', { class: 'app-check__label' }, 'Subrayar enlaces'),
      h('input', {
        type: 'checkbox',
        checked: underline,
        'aria-label': 'Subrayar enlaces',
        on: {
          change: (e) => {
            prefs.set('a11y.underline', e.target.checked);
            applyTheme(prefs);
          },
        },
      }),
    );

    const focusSwitch = h('label', { class: 'app-check app-check--switch' },
      h('span', { class: 'app-check__label' }, 'Anillo de foco ampliado'),
      h('input', {
        type: 'checkbox',
        checked: focusRing,
        'aria-label': 'Anillo de foco ampliado',
        on: {
          change: (e) => {
            prefs.set('a11y.focusRing', e.target.checked);
            applyTheme(prefs);
          },
        },
      }),
    );

    const cbModes = [
      { id: 'none', label: 'Ninguno' },
      { id: 'protanopia', label: 'Protanopia' },
      { id: 'deuteranopia', label: 'Deuteranopia' },
      { id: 'tritanopia', label: 'Tritanopia' },
    ];
    const cbChips = h('div', { class: 'app-cp-chips-grid', role: 'radiogroup', 'aria-label': 'Filtro de daltonismo' },
      ...cbModes.map((m) => {
        const isSelected = colorBlind === m.id;
        return h('button', {
          type: 'button',
          class: `app-btn app-btn--sm ${isSelected ? 'app-btn--chip-active' : ''}`,
          role: 'radio',
          'aria-checked': String(isSelected),
          dataset: { cbMode: m.id },
          on: {
            click: () => {
              prefs.set('a11y.colorBlind', m.id);
              applyTheme(prefs);
              renderPanel();
            },
          },
        }, m.label);
      }),
    );

    const scaleOut = h('span', { id: 'cp-scale-out', class: 'app-cp-scale-badge' }, `${fontScale}%`);
    const scaleInput = h('input', {
      class: 'app-range',
      id: 'cp-scale',
      type: 'range',
      min: '90',
      max: '140',
      step: '5',
      'aria-label': 'Escala del texto',
      value: String(fontScale),
      on: {
        input: (e) => {
          const val = Number(e.target.value);
          scaleOut.textContent = `${val}%`;
          prefs.set('a11y.fontScale', val);
          applyTheme(prefs);
        },
      },
    });

    const resetA11yBtn = h('button', {
      type: 'button',
      class: 'app-btn app-btn--sm',
      on: {
        click: () => {
          ['reducedMotion', 'a11y.reduceMotion', 'a11y.underline', 'a11y.focusRing', 'a11y.colorBlind', 'a11y.fontScale'].forEach((k) => prefs.remove(k));
          applyTheme(prefs);
          renderPanel();
          toast.info('Accesibilidad restablecida.');
        },
      },
    }, 'Restablecer accesibilidad');

    return [
      h('div', { class: 'app-cp-section' },
        h('strong', {}, 'Accesibilidad WCAG AA / AAA'),
        motionSwitch,
        underlineSwitch,
        focusSwitch,
      ),
      h('div', { class: 'app-cp-section' },
        h('strong', {}, 'Filtro de daltonismo'),
        cbChips,
      ),
      h('div', { class: 'app-cp-section' },
        h('div', { class: 'app-row app-row--between' },
          h('strong', {}, 'Escala del texto'),
          scaleOut,
        ),
        scaleInput,
      ),
      h('div', { class: 'app-row app-row--mt' }, resetA11yBtn),
    ];
  }

  return [];
}

function renderPanel() {
  const tabsContainer = $('#cp-tabs');
  const panelsContainer = $('#cp-panels');
  if (!tabsContainer || !panelsContainer) return;

  const tabButtons = PANEL_TABS.map((t) =>
    h('button', {
      type: 'button',
      class: 'app-cp-tab',
      role: 'tab',
      id: `cp-tab-${t.id}`,
      'aria-selected': String(activeTab === t.id),
      'aria-controls': `cp-panel-${t.id}`,
      dataset: { cpTab: t.id },
      on: {
        click: () => {
          activeTab = t.id;
          renderPanel();
        },
      },
    },
      svgIcon(t.icon),
      h('span', {}, t.label),
    ));
  tabsContainer.replaceChildren(...tabButtons);

  const panelSections = PANEL_TABS.map((t) =>
    h('section', {
      class: 'app-cp-tabpanel',
      role: 'tabpanel',
      id: `cp-panel-${t.id}`,
      'aria-labelledby': `cp-tab-${t.id}`,
      hidden: activeTab !== t.id,
    },
      ...renderTabContent(t.id),
    ));
  panelsContainer.replaceChildren(...panelSections);
}

export function initControlPanel(prefsInstance) {
  currentPrefs = prefsInstance;

  const panelToggle = $('#panel-toggle');
  const panelBackdrop = $('#panel-backdrop');
  const cpClose = $('#cp-close');
  const cpClose2 = $('#cp-close2');
  const cpReset = $('#cp-reset');

  if (panelToggle) {
    panelToggle.onclick = () => openControlPanel();
  }

  if (panelBackdrop) {
    panelBackdrop.onclick = () => closeControlPanel();
  }

  if (cpClose) {
    cpClose.onclick = () => closeControlPanel();
  }

  if (cpClose2) {
    cpClose2.onclick = () => closeControlPanel();
  }

  if (cpReset) {
    cpReset.onclick = () => openResetModal();
  }

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const modalOpen = document.body.classList.contains('modal-open');
      const panelOpen = document.body.classList.contains('panel-open');
      if (!modalOpen && panelOpen) {
        closeControlPanel();
      }
    }
  });
}
