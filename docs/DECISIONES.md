# Registro de decisiones (ADR)

## ADR-001 · Persistencia con `better-sqlite3` en lugar de `sqlite3` [B.5][B.7]
- **Decisión:** usar `better-sqlite3` (API síncrona). Reemplaza a `sqlite3` por su historial de problemas con bindings nativos y ABI en Electron.
- **Consecuencias:** los repositorios y puertos de persistencia son **síncronos**; las transacciones usan `db.transaction()` (ver `tx.js`) y su función debe ser síncrona. Las operaciones asíncronas (p. ej. `crypto.scrypt`) se resuelven antes de abrir la transacción. Los controladores Express pueden seguir siendo `async`.

## ADR-002 · SweetAlert2 bajo CSP estricta [A.4][B.5]
- **Decisión:** mantener SweetAlert2 detrás del adaptador `ui/dialogs.js`, usando la build ESM **sin estilos incrustados** (`sweetalert2.esm.js` + `sweetalert2.min.css` enlazado). La build `*.all` inyecta `<style>` y viola `style-src 'self'`.
- **Evidencia:** `npm run spike:csp` (Electron real, CSP completa de la Fase 0): 0 violaciones, confirm/cancel/notice correctos, FontAwesome cargado.
- **Plan B:** `ui/dialogs.native.js` (`<dialog>`), con la misma interfaz y probado en el mismo spike.

## ADR-003 · Sin recompilación nativa [D.15]
- **Hecho:** `better-sqlite3` 13.x publica binarios N-API precompilados dentro del paquete npm. El mismo binario se carga en Node y en Electron.
- **Decisión:** no usar `electron-rebuild` y configurar `npmRebuild: false`. Se desempaqueta `prebuilds/**` del asar.
- **Verificación:** `npm run spike:sqlite` y `npm test` usan el mismo `node_modules`, sin pasos intermedios.

## ADR-004 · Express sirve el renderer; rutas de `vendor/` absolutas [D.15][B.5]
- **Decisión:** el renderer se carga desde `http://127.0.0.1:<puerto>/` (Express, estáticos) y la CSP viaja por cabecera. Los imports y `<link>` usan rutas **absolutas desde la raíz** (`/vendor/...`, `/js/...`), estables ante cualquier profundidad de módulo y de router.
- **Seguridad:** `/api/*` exige `X-Launch-Key` (UUID por arranque, entregado solo por IPC al origen del servidor), guardia de `Host` (anti DNS rebinding) y Bearer de sesión. Los estáticos no llevan clave (la página debe poder cargarse).

## ADR-005 · Clave de recuperación del Admin [D.12]
- Se genera en el `setup` (160 bits), se muestra una vez y se escribe `recovery-key.txt` (flag `wx`, modo 0600) en `userData`. En BD solo se guarda su SHA-256.
- **Un solo uso:** al recuperar, la clave se **rota** (se devuelve la nueva y se sobrescribe el archivo). Supuesto a confirmar: el archivo en claro vive en el equipo; el manual indicará guardarlo fuera y borrarlo.

## ADR-006 · Contrato de la API [B.6]
- Respuestas `{ data }` (recurso) o `{ data, meta }` (listas); errores `{ error: { code, message, fields?, details?, requestId } }`.
- Sesión: 24 h deslizante + 30 min de inactividad; la renovación se persiste como máximo cada 60 s (tolerancia de inactividad ≤ 60 s).

## ADR-007 · Propiedad de datos y puertos entre módulos [B.6][C.11]
- Cada tabla pertenece a un módulo y solo él la consulta; los demás reciben **puertos** inyectados desde `container.js`. Lo hace cumplir `tests/unit/architecture.test.js` (escanea el código fuente).
- `budgets` obtiene el gasto por categoría del puerto `getSpentByCategory` (analytics, sobre la tabla agregada). `categories` pregunta el uso al puerto `transactionCount` (transactions). `analytics` y `reports` reciben un `readModel` de **solo lectura** de transactions.
- **Analytics** (KPI, series, pastel, tendencias) lee `agg_monthly_category`. Media/mediana y EDA de nulos necesitan filas individuales y usan el `readModel`. **Reports** trabajan por rango de DÍAS exactos, que la tabla mensual no puede responder, y por eso también usan el `readModel`.

## ADR-008 · Alcance de la analítica y los reportes [C.11]
- Sin predicciones: tendencias = variación mensual descriptiva (umbral 5 % sobre el promedio previo). Por defecto se analizan 6 meses COMPLETOS (el mes en curso se marca con `includesIncompleteMonth`).
- Sin PDF ni gráficos en el backend: solo datos JSON y CSV (UTF-8 con BOM, CRLF, defensa contra CSV injection). La impresión usa `printToPDF` de Electron (Fase 5); los gráficos son SVG propios (Fase 3).
- Sin WebSockets ni SSE: la actualización "en tiempo real" es la reactividad del frontend (eventos `fc:data:mutated`).
- Los meses y fechas "de hoy" se calculan en **hora local** del equipo (UTC rompería el mes actual por las noches en Colombia).

## ADR-009 · Supuestos de la Fase 2b (objetables)
- Umbral de alerta de presupuestos configurable (por defecto 80 %); `over` solo si el gasto SUPERA el presupuesto.
- Metas: el estado `completed` es automático (según los aportes); solo se puede fijar `active` o `archived`. Los aportes no alteran el Balance Total (ambigüedad #8-A).
- Métricas locales con retención de 90 días; los errores 500 se registran en `metric_events` sin exponer detalles al cliente.
- Configuración mínima: nombre del hogar y umbral de alerta; la moneda es COP fija.

## ADR-010 · Shell del renderer: sidebar, router y sesión en el cliente [A.2][A.3][B.5]
- **Router por hash** (`#/modulo/pestaña`): funciona sin configuración especial en Express y con enlaces directos. Las guardias son funciones puras (`decide`): primer arranque fuerza `/setup`; sin sesión solo rutas públicas; `mustChangePassword` bloquea todo salvo `/change-password`; Usuarios es solo Admin. Cada navegación mueve el foco al `<h1>`, actualiza `document.title` y descarta renders obsoletos.
- **Pestañas**: el estado se refleja con `history.replaceState` (no dispara `hashchange`) para no perder el foco del teclado; la pestaña activa se guarda por usuario.
- **Sidebar "Colapsable" + "Pin"** (interpretación a confirmar): *colapsar* reduce a íconos; si NO está anclado, se expande al pasar el cursor o al enfocar con teclado; *anclar* impide esa expansión. Preferencias por usuario en LocalStorage (`sidebar.collapsed`, `sidebar.pinned`). En móvil (< 768 px) es un cajón con foco atrapado, Esc y fondo para cerrar.
- **Sesión**: el token vive solo en memoria (recargar la ventana pide iniciar sesión). Mientras hay interacción, el cliente avisa al servidor como máximo cada 5 min (`GET /auth/session`) para que leer o escribir un formulario largo no cuente como inactividad. Un 401 `SESSION_IDLE`/`SESSION_EXPIRED` muestra un modal y vuelve al login.
- **Anti-XSS**: el DOM se construye con `h()` (`core/dom.js`, nodos de texto); ESLint prohíbe `innerHTML`, `outerHTML`, `insertAdjacentHTML` y `document.write` en el renderer, y `localStorage` fuera de `core/prefs.js`.
- **Verificación de accesibilidad**: contraste de los tokens (tests unitarios) + `axe-core` (WCAG 2.0/2.1 A y AA) sobre las pantallas clave, ejecutado en Electron real (`npm run smoke:ui`). axe cubre solo una parte de WCAG: la revisión manual con lector de pantalla queda para la Fase 6.

## ADR-011 · Módulos de datos del frontend [A.1][A.4][C.11]
- **Una sola tabla** (`ui/data-table.js`) para todos los listados: orden por encabezado (`aria-sort`), paginación 10/20/50, región desplazable enfocable y esqueleto de carga. Transacciones usa la misma tabla en las pestañas Todos/Ingresos/Gastos, cambiando solo el filtro `kind` del store (`transactions-store.js`). El tamaño de página y el orden son preferencias de UI; **los datos viven solo en memoria**.
- **Formularios en modal** (`ui/form-dialog.js`, `<dialog>` nativo: foco atrapado y Esc) con `field`/`bindForm`: el error de cada campo aparece debajo de él y los errores del servidor se asignan al campo con el mismo nombre.
- **Gráficos SVG nativos** (`ui/charts.js`): `role="img"` con `aria-label` que resume los datos, tabla equivalente solo para lectores de pantalla, leyenda con texto, y navegación con ←/→/Inicio/Fin (tooltip + anuncio). No dependen del color: trama rayada en gastos, línea discontinua y marcadores distintos. Paleta de 8 tonos con contraste ≥ 3:1 sobre blanco (verificado por test).
- **Estados en texto + ícono** (En orden / Alerta / Superado, Activa / Archivada…), nunca solo color.
- **Exportación CSV**: `api.download` + enlace temporal; el nombre sale de `Content-Disposition`. La impresión a PDF (Electron `printToPDF`) llega en la Fase 5.
- **Pendiente conocido**: el pastel asigna color por posición (8 tonos); con más de 8 categorías los colores se repiten (la leyenda con porcentajes y la tabla de datos siguen distinguiéndolas).

## ADR-012 · Integración con Electron: menú, guardado nativo, PDF y endurecimiento [D.15][A.3]
- **Menú nativo** (`src/main/menu.js`): Archivo, Editar, Ver y Ayuda con Ctrl+N/E/P/R/B. El proceso principal solo envía el NOMBRE del comando por IPC; el preload lo filtra contra una lista blanca y el renderer decide qué hacer (`core/commands.js`). Si la vista destino no está abierta, se navega y el comando queda pendiente hasta que la vista lo registre.
- **Guardado nativo** (`src/main/files.js`): el renderer envía bytes y un nombre *sugerido*; la RUTA la elige el usuario en `showSaveDialog`. Tipos permitidos por lista cerrada (`csv`, `pdf`; consulta con `Object.hasOwn`), nombre saneado, máximo 50 MB y extensión forzada.
- **printToPDF**: el renderer pide imprimir; el proceso principal genera el PDF A4 (`@media print` oculta la interfaz) y abre el diálogo de guardado.
- **Endurecimiento**: `will-navigate`/`will-redirect` solo al origen exacto del servidor local; `window.open` nunca crea ventanas (solo https se delega al navegador); permisos denegados salvo escribir en el portapapeles; `webSecurity` activo y `assertSecureWebPreferences` falla el arranque si se pierde `contextIsolation`/`sandbox`; todos los canales IPC validan ventana y origen del remitente; `<webview>` prohibido; herramientas de desarrollo solo sin empaquetar; `render-process-gone` ofrece reiniciar la interfaz.
- **Recargar (Ctrl+R)** pide iniciar sesión de nuevo: el token vive solo en memoria (decisión de la Fase 3).
- **Pruebas**: los diálogos nativos y `shell.openExternal` se sustituyen por espías; los atajos se verifican por su `accelerator` y ejecutando el `click` del elemento (un teclado real no puede simularse en modo sin pantalla).
