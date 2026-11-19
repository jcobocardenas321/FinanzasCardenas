// [B.6][A.4] Reglas que hacen cumplir la arquitectura y el contrato de UI.
import js from '@eslint/js';
import globals from 'globals';

export default [
  { ignores: ['dist/**', 'node_modules/**', 'src/renderer/vendor/**'] },
  js.configs.recommended,
  {
    files: ['**/*.js', '**/*.mjs'],
    languageOptions: { ecmaVersion: 'latest', sourceType: 'module', globals: globals.node },
    rules: {
      // [A.4] Sin alertas nativas: usar ui/dialogs.js y ui/toasts.js
      'no-alert': 'error',
      'no-restricted-globals': ['error', 'alert', 'confirm', 'prompt'],
      eqeqeq: ['error', 'always'],
      'no-var': 'error',
      'prefer-const': 'error',
    },
  },
  {
    files: ['**/*.cjs'],
    languageOptions: { sourceType: 'commonjs', globals: globals.node },
  },
  {
    // Renderer: navegador. [B.5] LocalStorage solo para preferencias de UI, y solo vía core/prefs.js
    files: ['src/renderer/**/*.js', 'spikes/csp-modals/public/**/*.js'],
    languageOptions: { globals: globals.browser },
    rules: {
      'no-restricted-globals': [
        'error',
        'alert', 'confirm', 'prompt',
        { name: 'localStorage', message: 'Usa core/prefs.js (solo preferencias de UI).' },
        { name: 'sessionStorage', message: 'No se usa sessionStorage; el token vive solo en memoria.' },
      ],
      // Anti-XSS: el DOM se construye con core/dom.js (nodos de texto), nunca con HTML en cadena.
      'no-restricted-syntax': [
        'error',
        { selector: "AssignmentExpression[left.property.name=/^(innerHTML|outerHTML)$/]", message: 'No uses innerHTML/outerHTML: usa h() de core/dom.js.' },
        { selector: "CallExpression[callee.property.name='insertAdjacentHTML']", message: 'No uses insertAdjacentHTML: usa h() de core/dom.js.' },
        { selector: "CallExpression[callee.object.name='document'][callee.property.name='write']", message: 'No uses document.write.' },
      ],
    },
  },
  {
    files: ['src/renderer/js/core/prefs.js'],
    rules: { 'no-restricted-globals': ['error', 'alert', 'confirm', 'prompt'] },
  },
  {
    // [B.6] Clean Architecture: el dominio es puro (sin Express, Electron, SQLite ni módulos de Node).
    files: ['src/server/modules/*/domain/**/*.js'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['express', 'electron', 'better-sqlite3', 'node:*', 'fs', 'path', 'crypto', '**/infrastructure/**', '**/interface/**', '**/application/**'],
              message: 'domain/ no puede depender de infraestructura, interfaz, aplicación ni de librerías externas.',
            },
          ],
        },
      ],
    },
  },
  {
    // [B.6] application/ no conoce la infraestructura concreta.
    files: ['src/server/modules/*/application/**/*.js'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['express', 'electron', 'better-sqlite3', '**/infrastructure/**', '**/interface/**'],
              message: 'application/ depende solo de domain/ y de puertos; la infraestructura se inyecta en container.js.',
            },
          ],
        },
      ],
    },
  },
];
