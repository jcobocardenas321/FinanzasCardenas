# Changelog

Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) y [SemVer](https://semver.org/lang/es/).

## [Sin publicar]

### Añadido
- Fase 7.4 (Pulido visual y unificación de UX Liquid Glass):
  - Unificación del disparador del panel de control: tanto la opción "Panel de control" del menú de usuario como el botón flotante `#panel-toggle` abren directamente el cajón lateral Offcanvas sin cambiar de página ni recargar.
  - Eliminación de cajas grises y fondos opacos en la cabecera del drawer (`.app-cp-head`), reemplazados por un gradiente líquido translúcido con haz de luz cian/lavanda.
  - Sustitución de checkboxes nativos por switches de cristal (`.app-check--switch`) con desplazamiento fluido de perla blanca y foco cian accesible (`:focus-visible`).
  - Reemplazo del `<select>` nativo de daltonismo por botones tipo chips cápsula de cristal en rejilla 2x2 (*Ninguno, Protanopia, Deuteranopia, Tritanopia*).
  - Estilizado de alta fidelidad para el control deslizante de escala de texto (`.app-range`) con barra translúcida de cristal y pulgar circular brillante cian/lavanda.
  - Botones del pie ("Restablecer" y "Cerrar") perfeccionados con formato de cápsula de cristal (`border-radius: 999px; backdrop-filter: blur(12px)`) con brillo interior y hover interactivo.
  - Actualización de la suite E2E de UI a 53 pasos completos con Electron, validando apertura del drawer desde el menú de usuario, cambio en vivo de temas y cero violaciones WCAG AA.
- Fase 7.3 (Clonación total e integración completa Liquid Glass Apple WWDC 2025):
  - Integración del cajón lateral deslizante Offcanvas (`#control-panel` y `#panel-backdrop`) con trampa de foco WAI-ARIA, navegación por teclado y cierre con Esc.
  - Botón flotante `#panel-toggle` ("Panel") fijado en la esquina inferior derecha.
  - Sprite SVG completo en `index.html` con 64 símbolos de interfaz y 3 matrices de color SVG para filtros de daltonismo (`#cb-protanopia`, `#cb-deuteranopia`, `#cb-tritanopia`).
  - Catálogo de personalización completa: 12 temas generados por refracción matemática de matiz (30° HSL), 4 modos de iluminación (Claro, Oscuro, Alto Contraste WCAG AAA, Auto), 12 estilos de geometría, 12 fondos dinámicos y 12 animaciones de entrada.
  - Diálogo modal accesible de confirmación para restablecimiento a valores de fábrica en `#modal-root`.
  - Mantenimiento estricto de la CSP (`style-src 'self'`) mediante manipulación CSSOM tipada y clases atómicas dedicadas (cero inline styles).
- Fase 7.2b (Lógica y persistencia del panel de apariencia):
  - Creación del módulo `core/theme.js` para la gestión reactiva del estado visual y aplicación en vivo de variables CSSOM sobre `document.documentElement`.
  - Sincronización persistente con `localStorage` mediante whitelist estricta (`theme`, `mode`, `geometry`, `geo`, `background`, `bg`, `anim`, `a11y.*`).
  - Reactividad instantánea en controles sin recarga de pantalla.
- Fase 7.2a (Cascarón de apariencia y componentes visuales Liquid Glass):
  - Estilos de botones cápsula con gradiente cian/azul y luz interior en `components.css`.
  - Inputs semitransparentes con borde translúcido y foco cian resplandeciente.
  - Tablas traslúcidas de cristal con encabezados en mayúsculas y hover en filas.
  - Modales con fondo de vidrio esmerilado y sombras multicapa.
  - Estructura de navegación de dos columnas para la personalización de apariencia.
- Fase 7.1 (Rediseño visual Liquid Glass: superficies base y responsive):
  - Nuevos tokens en `tokens.css`: paleta nocturna `#141A3A`, acentos cian `#7CE0FF`, lavanda `#C7A6FF` y azul reactivo `#4A5BFF`.
  - Tipografías modernas embebidas: *Inter*, *Outfit* y *JetBrains Mono*, con contrastes WCAG AA verificados.
  - Barra lateral (Sidebar) con efecto de vidrio esmerilado (`backdrop-filter: blur(20px)`), estados expandido, colapsado (rail) y anclado (pin).
  - Comportamiento responsive optimizado: botón hamburguesa visible únicamente en pantallas pequeñas (< 768px) con cajón accesible y foco atrapado.
- Fase 4: menú nativo con atajos, guardado nativo del CSV, impresión a PDF (A4) por IPC, endurecimiento del proceso principal (navegación, permisos, IPC con origen validado, webPreferences verificadas) y recuperación ante caída del renderer. Smoke de Electron de 31 pasos.
- Fase 3b: módulos de datos del frontend (Transacciones con tabla, filtros y modal; Panel con gráficos SVG; Categorías; Presupuestos; Metas; Reportes con exportación CSV; Usuarios; Configuración) y componentes compartidos (data-table, form-dialog, charts, progress). Smoke de UI ampliado a 50 pasos con auditoría axe-core.
- Fase 3a: shell del renderer (layout con sidebar colapsable/anclable y cajón móvil, header con menú de usuario, router por hash con guardias, store reactivo, toasts, tabs, formularios con validación inline, skeletons, estados vacíos), vistas de setup/login/recuperación/cambio de contraseña y panel con KPI. Pruebas de contraste, guardias y smoke de UI con axe-core.
- Fase 2b: módulos budgets, goals, analytics (KPI, series, pastel, media/mediana, EDA), reports (resumen, detalle, CSV), metrics y settings; puertos entre módulos y prueba de arquitectura.
- Fase 2 (parcial): migrador con checksum; módulos auth (scrypt, sesión deslizante 24 h + inactividad 30 min, bloqueo a 5 intentos, clave de recuperación), users, categories y transactions (con `agg_monthly_category` en la misma transacción); servidor Express en 127.0.0.1 con puerto efímero y `X-Launch-Key`; cliente `core/api.js`.
- Fase 1: andamiaje (estructura Clean Architecture, ESLint, EditorConfig, Git), conexión `better-sqlite3` y esquema V1.
- Spikes técnicos: Electron + `better-sqlite3` y CSP estricta con el adaptador de diálogos.
