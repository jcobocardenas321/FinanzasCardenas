# FinanzasCardenas

Aplicación de escritorio para la gestión profesional de la economía del hogar: ingresos, gastos, presupuestos, metas de ahorro y analítica. Funciona 100 % sin conexión.

**Stack:** Electron · Node.js + Express · SQLite (`better-sqlite3`) · HTML/CSS/JS vanilla (módulos ES6) · `node:test`.

## Requisitos
- Node.js 22 o superior
- Git

## Puesta en marcha
```bash
npm install        # instala dependencias y copia assets de terceros a src/renderer/vendor
npm test           # pruebas con node:test
npm run lint       # ESLint
npm start          # abre la aplicación en modo desarrollo
npm run smoke      # Electron: arranque, endurecimiento, menú, guardado nativo, PDF y caída del renderer
npm run smoke:ui   # recorrido E2E de la interfaz + auditoría de accesibilidad (axe-core)
```

## Spikes técnicos (Fase 1)
```bash
npm run spike:sqlite   # better-sqlite3 dentro de Electron
npm run spike:csp      # CSP estricta + adaptador de diálogos
```
En Linux sin pantalla: `xvfb-run -a npx electron --no-sandbox spikes/<spike>/main.js`.

## Documentación
- [Decisiones de arquitectura](docs/DECISIONES.md)
- [Arquitectura](docs/ARQUITECTURA.md)
- [Manual técnico](docs/MANUAL_TECNICO.md) · [Manual de usuario](docs/MANUAL_USUARIO.md) · [Despliegue](docs/DESPLIEGUE.md)
- [Cómo contribuir](CONTRIBUTING.md)

## Estado
Fase 1 (andamiaje) y Fases 2 (backend), 3a/3b (frontend) y 4 (integración con Electron) completadas. Ver [CHANGELOG](CHANGELOG.md).
