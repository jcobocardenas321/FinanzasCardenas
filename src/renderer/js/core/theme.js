// [Fase 7.3] Gestión del estado visual y temas Liquid Glass (Apple).
// Soporta 12 temas, 4 modos, 12 geometrías, 12 fondos dinámicos, 12 animaciones y accesibilidad.
import { createPrefs } from './prefs.js';
import { select } from './store.js';

export const THEME_NAMES = [
  'Firma', 'Solar', 'Cítrico', 'Bosque', 'Menta', 'Cielo',
  'Océano', 'Índigo', 'Violeta', 'Magenta', 'Rubí', 'Cobre'
];

export const MODES = ['light', 'dark', 'contrast', 'auto'];
export const MODE_LABEL = { light: 'Claro', dark: 'Oscuro', contrast: 'Alto Contraste', auto: 'Auto' };
export const MODE_ICON = { light: 'sun', dark: 'moon', contrast: 'contrast', auto: 'monitor' };

export const GEO = [
  { name: 'Recto', r: '0px', c: '0px', b: '0px' },
  { name: 'Sutil', r: '4px', c: '5px', b: '4px' },
  { name: 'Suave', r: '8px', c: '10px', b: '8px' },
  { name: 'Redondo', r: '14px', c: '16px', b: '12px' },
  { name: 'Curvo', r: '20px', c: '24px', b: '16px' },
  { name: 'Burbuja', r: '28px', c: '32px', b: '24px' },
  { name: 'Cápsula', r: '999px', c: '28px', b: '999px' },
  { name: 'Orgánico', r: '28px 10px 28px 10px', c: '32px 12px 32px 12px', b: '24px 8px 24px 8px' },
  { name: 'Cortado', r: '18px 0 18px 0', c: '22px 0 22px 0', b: '14px 0 14px 0' },
  { name: 'Papel', r: '2px', c: '3px', b: '2px' },
  { name: 'Bloque', r: '12px 12px 2px 2px', c: '16px 16px 2px 2px', b: '10px 10px 2px 2px' },
  { name: 'Asimétrico', r: '6px 30px 6px 30px', c: '8px 34px 8px 34px', b: '5px 22px 5px 22px' }
];

export const BGS = [
  'Firma', 'Rejilla', 'Puntos', 'Malla', 'Aurora', 'Ondas',
  'Rayas', 'Grano', 'Blobs', 'Circuito', 'Papel', 'Vitral'
];

export const ANIMS = [
  'Fade', 'Subida', 'Lateral', 'Escala', 'Desenfoque', 'Rotación',
  'Flip', 'Muelle', 'Escalonada', 'Pulso', 'Flotación', 'Glitch'
];

export const PANEL_TABS = [
  { id: 'themes', icon: 'palette', label: 'Temas' },
  { id: 'geometry', icon: 'layers', label: 'Geometría' },
  { id: 'backgrounds', icon: 'image', label: 'Fondos' },
  { id: 'animations', icon: 'play', label: 'Animaciones' },
  { id: 'colors', icon: 'palette', label: 'Colores' },
  { id: 'languages', icon: 'globe', label: 'Idiomas' },
  { id: 'accessibility', icon: 'accessibility', label: 'Accesibilidad' },
];

// Compatibilidad retroactiva con Fase 7.2b
export const THEMES = [
  { id: 'dark', label: 'Oscuro', desc: 'Fondo espacial con acentos cian y lavanda (predeterminado)', icon: 'moon' },
  { id: 'light', label: 'Claro', desc: 'Superficie clara cristalina con contraste optimizado', icon: 'sun' },
  { id: 'contrast', label: 'Alto Contraste', desc: 'Negro puro con máxima legibilidad (WCAG AAA)', icon: 'circle-half-stroke' },
];

export const GEOMETRIES = [
  { id: 'rounded', label: 'Redondeado (Cápsulas)', desc: 'Bordes orgánicos y curvatura Liquid Glass', icon: 'shapes' },
  { id: 'sharp', label: 'Recto (Bordes sutiles)', desc: 'Esquinas compactas y formato angular moderno', icon: 'square' },
];

export const BACKGROUNDS = [
  { id: 'deep-blue', label: 'Azul Profundo', desc: 'Destellos orbitales cian y azul cobalto', preview: 'linear-gradient(135deg, #141a3a, #1a224a)' },
  { id: 'violet', label: 'Violeta Cósmico', desc: 'Gradiente espacial lavanda y amatista', preview: 'linear-gradient(135deg, #160d26, #2a1040)' },
  { id: 'pure-black', label: 'Negro Puro', desc: 'Fondo estelar oscuro minimalista', preview: 'linear-gradient(135deg, #070913, #020305)' },
];

export const ACCENTS = [
  { id: 'cyan', label: 'Cian', hex: '#7ce0ff', hover: '#a0e8ff', desc: 'Color firma Liquid Glass' },
  { id: 'lavender', label: 'Lavanda', hex: '#c7a6ff', hover: '#dcbcff', desc: 'Tonalidad pastel suave' },
  { id: 'emerald', label: 'Esmeralda', hex: '#34d399', hover: '#6ee7b7', desc: 'Verde vibrante equilibrado' },
  { id: 'rose', label: 'Rosa', hex: '#f472b6', hover: '#f9a8d4', desc: 'Acento cálido moderno' },
];

export const LANGUAGES = [
  { id: 'es-CO', label: 'Español (Colombia)', desc: 'Formato de moneda COP ($) y fechas locales', active: true },
  { id: 'en-US', label: 'English (US)', desc: 'Próximamente disponible', active: false },
];

export function getPrefs(prefsInstance) {
  if (prefsInstance) return prefsInstance;
  const user = select('session.user');
  return createPrefs(user?.id ?? 'anon');
}

// ===== Algoritmos de Color y Hue Shift Liquid Glass =====
export function normHex(v) {
  const m = String(v || '').match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!m) return null;
  const h = m[1];
  return '#' + (h.length === 3 ? h.split('').map((c) => c + c).join('') : h).toLowerCase();
}

export function hexRgb(hex) {
  const n = parseInt(String(hex).replace('#', ''), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

export function rgbHex(r, g, b) {
  return '#' + [r, g, b].map((c) => Math.round(Math.max(0, Math.min(255, c))).toString(16).padStart(2, '0')).join('');
}

export function lum(hex) {
  const { r, g, b } = hexRgb(hex);
  const f = (c) => { const s = c / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

export function contrast(a, b) {
  if (!normHex(a) || !normHex(b)) return 1;
  const l1 = lum(a), l2 = lum(b);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

export function rgbHsl(hex) {
  const { r, g, b } = hexRgb(hex);
  const rn = r / 255, gn = g / 255, bn = b / 255;
  const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h;
  if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0));
  else if (max === gn) h = (bn - rn) / d + 2;
  else h = (rn - gn) / d + 4;
  return { h: h * 60, s, l };
}

export function hslHex(h, s, l) {
  h = ((h % 360) + 360) % 360;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;
  if (h < 60) { r = c; g = x; }
  else if (h < 120) { r = x; g = c; }
  else if (h < 180) { g = c; b = x; }
  else if (h < 240) { g = x; b = c; }
  else if (h < 300) { r = x; b = c; }
  else { r = c; b = x; }
  return rgbHex((r + m) * 255, (g + m) * 255, (b + m) * 255);
}

export function shiftHue(hex, deg) {
  const c = normHex(hex);
  if (!c) return hex;
  const h = rgbHsl(c);
  return hslHex(h.h + deg, h.s, h.l);
}

export function mix(a, b, t) {
  const A = hexRgb(a), B = hexRgb(b);
  return rgbHex(A.r + (B.r - A.r) * t, A.g + (B.g - A.g) * t, A.b + (B.b - A.b) * t);
}

export function derive(accent, accent2, mode) {
  if (mode === 'dark') {
    return {
      bg: mix('#0b0d12', accent, 0.06),
      surface: mix('#141821', accent, 0.09),
      surface2: mix('#1c2130', accent, 0.12),
      fg: '#f5f6fa',
      muted: '#b8bec9',
      border: mix('#303747', accent, 0.2),
      accent,
      accent2
    };
  }
  return {
    bg: mix('#faf9f6', accent, 0.05),
    surface: '#ffffff',
    surface2: mix('#eff1f5', accent, 0.07),
    fg: '#14161b',
    muted: '#59606c',
    border: mix('#d8dce4', accent, 0.16),
    accent,
    accent2
  };
}

export function themeSet(index, mode) {
  if (mode === 'contrast') {
    return {
      bg: '#000000', surface: '#0a0a0a', surface2: '#141414',
      fg: '#ffffff', muted: '#ffff80', border: '#ffffff',
      accent: '#00ffff', accent2: '#7cf7ff'
    };
  }
  const baseAccent = '#7ce0ff';
  const baseAccent2 = '#c7a6ff';
  if (index === 0) {
    if (mode === 'light') {
      return {
        bg: '#eef2ff', surface: '#ffffff', surface2: '#f1f5f9',
        fg: '#0f172a', muted: '#475569', border: '#94a3b8',
        accent: '#0284c7', accent2: '#7c3aed'
      };
    }
    // dark
    return {
      bg: '#141a3a', surface: 'rgba(255, 255, 255, 0.14)', surface2: 'rgba(255, 255, 255, 0.2)',
      fg: '#ffffff', muted: '#c5d1ff', border: 'rgba(255, 255, 255, 0.45)',
      accent: baseAccent, accent2: baseAccent2
    };
  }
  const shift = index * 30;
  return derive(shiftHue(baseAccent, shift), shiftHue(baseAccent2, shift), mode);
}

/**
 * Aplica en tiempo real las preferencias visuales sobre document.documentElement y document.body.
 */
export function applyTheme(prefsInstance) {
  const prefs = getPrefs(prefsInstance);
  const root = document.documentElement;
  const body = document.body;

  // 1. Modo & Tema
  const rawTheme = prefs.get('theme', 0);
  let themeIndex = 0;
  if (typeof rawTheme === 'number') {
    themeIndex = Math.max(0, Math.min(11, rawTheme));
  }

  let mode = prefs.get('mode', null);
  if (!mode) {
    if (rawTheme === 'light') mode = 'light';
    else if (rawTheme === 'contrast' || prefs.get('highContrast', false)) mode = 'contrast';
    else mode = 'dark';
  }

  const resolved = mode === 'auto'
    ? (window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    : mode;

  root.dataset.theme = resolved;
  root.dataset.appMode = resolved;
  if (body) {
    body.dataset.appMode = resolved;
    body.dataset.appTheme = String(themeIndex);
  }

  const set = themeSet(themeIndex, resolved);
  root.style.setProperty('--bg', set.bg);
  root.style.setProperty('--surface', set.surface);
  root.style.setProperty('--surface-2', set.surface2);
  root.style.setProperty('--fg', set.fg);
  root.style.setProperty('--muted', set.muted);
  root.style.setProperty('--accent', set.accent);
  root.style.setProperty('--accent-2', set.accent2);
  root.style.setProperty('--border', set.border);

  if (resolved === 'contrast') {
    root.style.colorScheme = 'dark';
    root.style.setProperty('--fc-bg', '#000000');
    root.style.setProperty('--fc-surface', '#0a0a0a');
    root.style.setProperty('--fc-surface-glass', '#141414');
    root.style.setProperty('--fc-surface-glass-subtle', '#0d0d0d');
    root.style.setProperty('--fc-surface-glass-hover', '#222222');
    root.style.setProperty('--fc-text', '#ffffff');
    root.style.setProperty('--fc-text-muted', '#ffff80');
    root.style.setProperty('--fc-border', '#ffffff');
    root.style.setProperty('--fc-border-glass', '#ffffff');
    root.style.setProperty('--fc-border-glass-strong', '#ffffff');
    root.style.setProperty('--fc-border-soft', '#ffffff');
    root.style.setProperty('--fc-nav-bg', '#000000');
    root.style.setProperty('--fc-nav-glass', '#000000');
    root.style.setProperty('--fc-nav-text', '#ffffff');
    root.style.setProperty('--fc-primary', '#00ffff');
    root.style.setProperty('--fc-primary-hover', '#54ffff');
    root.style.setProperty('--fc-focus', '#ffff00');
    root.style.setProperty('--fc-shadow', 'none');
    root.style.setProperty('--fc-glass-bg-base', '#000000');
    body?.style.setProperty('background-image', 'none');
  } else if (resolved === 'light') {
    root.style.colorScheme = 'light';
    root.style.setProperty('--fc-bg', '#eef2ff');
    root.style.setProperty('--fc-surface', '#ffffff');
    root.style.setProperty('--fc-surface-glass', 'rgba(255, 255, 255, 0.78)');
    root.style.setProperty('--fc-surface-glass-subtle', 'rgba(255, 255, 255, 0.55)');
    root.style.setProperty('--fc-surface-glass-hover', 'rgba(255, 255, 255, 0.95)');
    root.style.setProperty('--fc-text', '#0f172a');
    root.style.setProperty('--fc-text-muted', '#475569');
    root.style.setProperty('--fc-border', '#94a3b8');
    root.style.setProperty('--fc-border-glass', 'rgba(15, 23, 42, 0.16)');
    root.style.setProperty('--fc-border-glass-strong', 'rgba(15, 23, 42, 0.35)');
    root.style.setProperty('--fc-border-soft', '#cbd5e1');
    root.style.setProperty('--fc-nav-bg', '#f1f5f9');
    root.style.setProperty('--fc-nav-glass', 'rgba(241, 245, 249, 0.92)');
    root.style.setProperty('--fc-nav-text', '#334155');
    root.style.setProperty('--fc-primary', set.accent);
    root.style.setProperty('--fc-primary-hover', set.accent2);
    root.style.setProperty('--fc-focus', set.accent);
    root.style.setProperty('--fc-shadow', '0 20px 40px -20px rgba(0, 0, 0, 0.15)');
    root.style.setProperty('--fc-glass-bg-base', '#eef2ff');
    body?.style.setProperty('background-image', 'radial-gradient(circle at 80% 12%, rgba(199, 166, 255, 0.18), transparent 48%), radial-gradient(circle at 12% 88%, rgba(124, 224, 255, 0.14), transparent 48%), linear-gradient(140deg, #eef2ff 0%, #e0e7ff 100%)');
  } else {
    // dark
    root.style.colorScheme = 'dark';
    root.style.removeProperty('--fc-bg');
    root.style.removeProperty('--fc-surface');
    root.style.removeProperty('--fc-surface-glass');
    root.style.removeProperty('--fc-surface-glass-subtle');
    root.style.removeProperty('--fc-surface-glass-hover');
    root.style.removeProperty('--fc-text');
    root.style.removeProperty('--fc-text-muted');
    root.style.removeProperty('--fc-border');
    root.style.removeProperty('--fc-border-glass');
    root.style.removeProperty('--fc-border-glass-strong');
    root.style.removeProperty('--fc-border-soft');
    root.style.removeProperty('--fc-nav-bg');
    root.style.removeProperty('--fc-nav-glass');
    root.style.removeProperty('--fc-nav-text');
    root.style.removeProperty('--fc-shadow');
    root.style.removeProperty('--fc-glass-bg-base');
    root.style.setProperty('--fc-primary', set.accent);
    root.style.setProperty('--fc-primary-hover', set.accent2);
    root.style.setProperty('--fc-focus', set.accent);
    body?.style.removeProperty('background-image');
  }

  // 2. Geometría
  let rawGeo = prefs.get('geo', null);
  if (rawGeo === null) {
    const gStr = prefs.get('geometry', 'rounded');
    rawGeo = gStr === 'sharp' ? 0 : 3;
  }
  const geoIndex = typeof rawGeo === 'number' ? Math.max(0, Math.min(11, rawGeo)) : 3;
  const g = GEO[geoIndex] || GEO[3];
  root.style.setProperty('--ui-radius', g.r);
  root.style.setProperty('--ui-card', g.c);
  root.style.setProperty('--ui-btn', g.b);
  root.style.setProperty('--fc-radius', g.r);
  root.style.setProperty('--fc-card-radius', g.c);
  root.dataset.geometry = g.name.toLowerCase();
  if (body) body.dataset.appGeo = String(geoIndex);

  // 3. Fondos (0..11)
  let rawBg = prefs.get('bg', null);
  if (rawBg === null) {
    const bStr = prefs.get('background', 'deep-blue');
    rawBg = bStr === 'violet' ? 4 : (bStr === 'pure-black' ? 0 : 0);
  }
  const bgIndex = typeof rawBg === 'number' ? Math.max(0, Math.min(11, rawBg)) : 0;
  if (body) body.dataset.appBg = String(bgIndex);

  // 4. Animaciones (1..12)
  const animIndex = prefs.get('anim', 2);
  if (body) body.dataset.appAnim = String(animIndex);

  // 5. Accesibilidad
  const reduceMotion = Boolean(prefs.get('reducedMotion', false) || prefs.get('a11y.reduceMotion', false));
  root.dataset.reducedMotion = String(reduceMotion);
  if (body) body.classList.toggle('a11y-reduce-motion', reduceMotion);

  const underline = Boolean(prefs.get('a11y.underline', false));
  if (body) body.classList.toggle('a11y-underline', underline);

  const focusRing = Boolean(prefs.get('a11y.focusRing', false));
  if (body) body.classList.toggle('a11y-focus', focusRing);

  const colorBlind = prefs.get('a11y.colorBlind', 'none');
  if (body) {
    body.classList.remove('a11y-cb-protanopia', 'a11y-cb-deuteranopia', 'a11y-cb-tritanopia');
    if (colorBlind && colorBlind !== 'none') {
      body.classList.add(`a11y-cb-${colorBlind}`);
    }
  }

  const fontScale = prefs.get('a11y.fontScale', 100);
  root.style.fontSize = (16 * fontScale / 100) + 'px';

  const lineHeight = prefs.get('a11y.lineHeight', 1.6);
  root.style.setProperty('--ui-line', String(lineHeight));

  const letterSpacing = prefs.get('a11y.letterSpacing', 0);
  root.style.setProperty('--ui-letter', `${letterSpacing}em`);
}
