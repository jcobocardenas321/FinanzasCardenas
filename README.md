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

## Rediseño Visual Liquid Glass (Apple WWDC 2025 · Fase 7)

La interfaz de usuario ha sido completamente rediseñada bajo la especificación **Liquid Glass (Apple)**:
- **Superficies de Cristal:** Paneles y tarjetas translúcidas con refracción óptica, desenfoque gaussiano de alta fidelidad (`backdrop-filter: blur(20px) saturate(150%)`), bordes esmerilados y luz especular interior (`box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.45)`).
- **Paleta Nocturna Profunda:** Fondo base espacial `#141A3A` con acentos de color cian líquido (`#7CE0FF`), lavanda (`#C7A6FF`) y azul reactivo (`#4A5BFF`).
- **Controles en Cápsula:** Botones, inputs, badges y pestañas con silueta de píldora completa (`border-radius: 999px`) y estados hover con resplandor luminoso.
- **Centro de Personalización en Vivo (Drawer Lateral):**
  - **12 Temas Espectrales:** Generados mediante rotación armónica de matiz HSL a intervalos de 30° (*Firma, Solar, Cítrico, Bosque, Menta, Cielo, Océano, Índigo, Violeta, Magenta, Rubí, Cobre*).
  - **4 Modos de Luz:** Claro, Oscuro (predeterminado), Alto Contraste (WCAG 2.1 AAA) y Automático.
  - **12 Estilos de Geometría:** Radios adaptables desde Recto (0px) hasta Cápsula (999px) y Asimétrico.
  - **12 Fondos Atmosféricos y 12 Animaciones de Entrada:** Refracciones generativas y curvas de aceleración fluida.
  - **Accesibilidad Universal:** Filtros SVG de daltonismo (*Protanopia, Deuteranopia, Tritanopia*), switches de cristal y slider de escala de texto (90 % - 140 %).
- **Seguridad y Cero Estilos Inline:** Cumplimiento total con la cabecera CSP estricta (`style-src 'self'`) mediante manipulación CSSOM tipada y clases atómicas seguras.

## Documentación
- [Decisiones de arquitectura](docs/DECISIONES.md)
- [Arquitectura](docs/ARQUITECTURA.md)
- [Manual técnico](docs/MANUAL_TECNICO.md) · [Manual de usuario](docs/MANUAL_USUARIO.md) · [Despliegue](docs/DESPLIEGUE.md)
- [Cómo contribuir](CONTRIBUTING.md)

## Estado
- **Fase 1 (Andamiaje & Spikes):** Completada.
- **Fase 2 (Backend HTTP, SQLite & Seguridad):** Completada.
- **Fase 3a/3b (Frontend Modular & Componentes de Negocio):** Completada.
- **Fase 4 (Integración Nativa Electron & IPC):** Completada.
- **Fase 5 (Manuales & Documentación Técnica):** Completada.
- **Fase 7 (Rediseño Visual Integral Liquid Glass Apple WWDC 2025):** Completada al 100 %.
- **Control de Calidad:** 255 pruebas automatizadas (`npm test`), 0 errores de ESLint (`npm run lint`) y 53 pasos E2E con Electron y auditoría `axe-core` sin violaciones de accesibilidad (`npm run smoke:ui`). Ver [CHANGELOG](CHANGELOG.md).
