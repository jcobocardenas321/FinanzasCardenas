# Changelog

Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) y [SemVer](https://semver.org/lang/es/).

## [Sin publicar]

### Añadido
- Fase 4: menú nativo con atajos, guardado nativo del CSV, impresión a PDF (A4) por IPC, endurecimiento del proceso principal (navegación, permisos, IPC con origen validado, webPreferences verificadas) y recuperación ante caída del renderer. Smoke de Electron de 31 pasos.
- Fase 3b: módulos de datos del frontend (Transacciones con tabla, filtros y modal; Panel con gráficos SVG; Categorías; Presupuestos; Metas; Reportes con exportación CSV; Usuarios; Configuración) y componentes compartidos (data-table, form-dialog, charts, progress). Smoke de UI ampliado a 50 pasos con auditoría axe-core.
- Fase 3a: shell del renderer (layout con sidebar colapsable/anclable y cajón móvil, header con menú de usuario, router por hash con guardias, store reactivo, toasts, tabs, formularios con validación inline, skeletons, estados vacíos), vistas de setup/login/recuperación/cambio de contraseña y panel con KPI. Pruebas de contraste, guardias y smoke de UI con axe-core.
- Fase 2b: módulos budgets, goals, analytics (KPI, series, pastel, media/mediana, EDA), reports (resumen, detalle, CSV), metrics y settings; puertos entre módulos y prueba de arquitectura.
- Fase 2 (parcial): migrador con checksum; módulos auth (scrypt, sesión deslizante 24 h + inactividad 30 min, bloqueo a 5 intentos, clave de recuperación), users, categories y transactions (con `agg_monthly_category` en la misma transacción); servidor Express en 127.0.0.1 con puerto efímero y `X-Launch-Key`; cliente `core/api.js`.
- Fase 1: andamiaje (estructura Clean Architecture, ESLint, EditorConfig, Git), conexión `better-sqlite3` y esquema V1.
- Spikes técnicos: Electron + `better-sqlite3` y CSP estricta con el adaptador de diálogos.
