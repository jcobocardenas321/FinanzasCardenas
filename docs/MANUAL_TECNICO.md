# Manual Técnico · FinanzasCardenas

> **Versión:** 0.1.0 (Fase 7 · Rediseño Liquid Glass)  
> **Plataforma:** Aplicación de escritorio multiplataforma (Windows Portable `.exe`, Linux AppImage)  
> **Arquitectura:** Clean Architecture · Monolito Modular · Electron + Node.js + Express + SQLite  

---

## 1. Visión General y Objetivos de Ingeniería

**FinanzasCardenas** es una solución de escritorio orientada a la gestión integral de la economía doméstica y familiar. Ha sido diseñada siguiendo directrices estrictas de calidad de software, principios **SOLID**, **DRY** y **Clean Architecture**, con una separación inequívoca entre el proceso principal de Electron, el servidor de API REST local embebido y el renderer en Vanilla JavaScript modular de alto rendimiento.

### Principios Fundamentales de Diseño
1. **Autonomía y Privacidad Total:** Persistencia relacional local mediante SQLite embebido (`better-sqlite3`). No requiere servidores externos ni conexión a internet.
2. **Seguridad en Profundidad:** Proceso principal aislado (`contextIsolation: true`, `sandbox: true`, sin `nodeIntegration`), comunicación IPC segura con validación de origen, servidor HTTP local con enlace exclusivo a `127.0.0.1` en puerto efímero, `X-Launch-Key` contra ataques de DNS rebinding y estricta cabecera Content Security Policy (CSP).
3. **Accesibilidad Universal (WCAG AA):** Cumplimiento verificado mediante pruebas automatizadas con `axe-core` y contraste de tokens ≥ 4.5:1 para texto y ≥ 3:1 para componentes de interfaz.
4. **Diseño Visual Liquid Glass (Apple WWDC 2025):** Interfaz futurista con translucidez adaptativa, refracción especular, bordes fluidos con radios generosos (`border-radius: 999px` en controles), paleta nocturna azul noche (`#141A3A`) con acentos cian líquido (`#7CE0FF`) y lavanda (`#C7A6FF`).

---

## 2. Arquitectura del Sistema

El sistema implementa un monolito modular desacoplado. La composición y cableado de dependencias se centraliza en `src/server/container.js`.

```mermaid
flowchart TD
    subgraph Electron ["Electron Host"]
        Main["Main Process (src/main/main.js)"]
        Preload["Preload Script (src/preload/preload.js)"]
    end

    subgraph Backend ["Backend HTTP (Node.js + Express)"]
        HttpServer["Express HTTP Server (127.0.0.1:ephemeral)"]
        Middlewares["Security Middlewares (CSP, HostGuard, LaunchKey, Auth)"]
        
        subgraph Modules ["Módulos de Negocio (Clean Architecture)"]
            Auth["Auth & Session Module"]
            Transactions["Transactions CRUD"]
            Budgets["Budgets & Warnings"]
            Goals["Savings Goals"]
            Analytics["Analytics & Aggregates"]
            Reports["Reports & CSV Export"]
            Users["Users & RBAC"]
            Settings["Household Settings"]
            Metrics["Local Usage Metrics"]
        end

        DB[(SQLite Local: better-sqlite3)]
    end

    subgraph Frontend ["Renderer (Vanilla JS + Liquid Glass)"]
        HTML["index.html (Semantic HTML5)"]
        CSS["Liquid Glass CSS (Tokens, Layout, Components)"]
        Router["Hash Router (#/modulo/pestaña)"]
        Store["Reactive Store & EventBus"]
        Views["Vistas Modulares (Dashboard, CRUDs, etc.)"]
    end

    Main -->|Inicia en puerto libre| HttpServer
    Main -->|IPC seguro| Preload
    Preload -->|API Config (baseUrl, launchKey)| Frontend
    Frontend -->|Fetch REST con X-Launch-Key & Bearer| HttpServer
    HttpServer --> Middlewares
    Middlewares --> Modules
    Modules --> DB
```

### Capas por Módulo (`src/server/modules/<contexto>/`)
- **`interface/`:** Rutas Express y controladores HTTP. Validan parámetros de entrada y serializan respuestas en formato `{ data }` o `{ data, meta }`.
- **`application/`:** Casos de uso y orquestación de servicios de negocio.
- **`domain/`:** Entidades, reglas de negocio puras, validaciones y puertos (interfaces sin dependencias de frameworks ni librerías externas).
- **`infrastructure/`:** Repositorios de persistencia con `better-sqlite3`, adaptadores de hashing (`scrypt`), reloj del sistema y adaptadores de archivos.

---

## 3. Modelo de Datos Relacional (SQLite)

La persistencia utiliza SQLite embebido gestionado mediante migraciones versionadas en `src/server/infrastructure/db/migrations/`:

| Tabla | Propósito | Llaves e Índices Clave |
| :--- | :--- | :--- |
| `users` | Cuentas multiusuario del hogar (Admin y Editor) | `id` (PK), `username` (UNIQUE), `role`, `must_change_password`, `locked_at` |
| `sessions` | Sesiones activas en memoria/disco con control de inactividad | `id` (PK, SHA-256 de token), `user_id` (FK `users`), `expires_at`, `last_activity_at` |
| `categories` | Catálogo de categorías para ingresos y gastos | `id` (PK), `name` (UNIQUE por tipo), `kind` ('income'/'expense'), `is_archived` |
| `transactions` | Movimientos financieros (ingresos y gastos) | `id` (PK), `category_id` (FK `categories`), `amount_cop`, `transacted_on` (DATE), `kind` |
| `budgets` | Presupuestos mensuales por categoría | `id` (PK), `month` (YYYY-MM), `category_id` (FK), `amount_cop`, UNIQUE(`month`, `category_id`) |
| `goals` | Metas de ahorro doméstico | `id` (PK), `name`, `target_amount_cop`, `saved_cop`, `target_date`, `status` |
| `goal_contributions`| Aportes individuales a metas de ahorro | `id` (PK), `goal_id` (FK `goals`), `amount_cop`, `contributed_on` |
| `settings` | Configuración global del hogar | `household_name`, `budget_warning_threshold_pct`, `currency` (COP fija) |
| `agg_monthly_category` | Tabla agregada para analítica en tiempo real | `month`, `category_id`, `kind`, `total_cop`, `count` |
| `metric_events` | Registro local de errores y uso por módulo (retención 90d) | `id` (PK), `occurred_at`, `module`, `name`, `kind` |

---

## 4. Seguridad y Endurecimiento

1. **Aislamiento de Electron:**
   - `webPreferences: { contextIsolation: true, sandbox: true, webSecurity: true, nodeIntegration: false, allowRunningInsecureContent: false }`.
   - Menú contextual y atajos bloqueados contra herramientas de depuración en producción.
   - Navegación web y ventanas externas bloqueadas; enlaces `https` externos se abren exclusivamente con el navegador predeterminado del sistema operativo.
2. **DNS Rebinding Guard & Puerto Efímero:**
   - El servidor Express se enlaza únicamente a `127.0.0.1` en un puerto asignado aleatoriamente por el sistema operativo (`port: 0`).
   - Se genera una clave criptográfica `X-Launch-Key` (UUIDv4) por cada sesión de la aplicación que se entrega al renderer solo a través del canal IPC `getApiConfig()`.
   - El middleware `hostGuard` verifica que la cabecera `Host` corresponda estrictamente a `127.0.0.1:<puerto_asignado>`.
3. **Criptografía de Credenciales y Sesión:**
   - Hashing de contraseñas mediante **`scrypt`** con sal criptográfica aleatoria de 16 bytes y parámetros de derivación robustos (`N=16384, r=8, p=1`).
   - Política de contraseñas fuertes: mínimo 10 caracteres, mayúsculas, minúsculas, números y símbolos especiales, sin contener el nombre de usuario.
   - Bloqueo preventivo de cuenta tras 5 intentos fallidos consecutivos de login.
   - Duración de sesión: 24 horas con renovación deslizante y cierre por inactividad estricto a los 30 minutos.
   - Clave de recuperación del Administrador de 160 bits (alfabeto sin caracteres ambiguos), rotativa y de un solo uso.

---

## 5. Lenguaje Visual Liquid Glass (Fase 7)

El sistema visual fue integrado a partir de la especificación Apple Liquid Glass:

- **Tokens CSS (`src/renderer/css/tokens.css`):**
  - `--fc-bg`: `#141A3A` (Fondo noche profundo con gradientes radiales de luz líquida).
  - `--fc-surface-glass`: `rgba(255, 255, 255, 0.12)` con `backdrop-filter: blur(20px) saturate(150%)`.
  - `--fc-primary`: `#7CE0FF` (Acento cian líquido) y `--fc-accent-2`: `#C7A6FF` (Lavanda).
  - `--fc-border-glass`: `rgba(255, 255, 255, 0.38)` y borde especular `inset 0 1px 0 rgba(255, 255, 255, 0.5)`.
  - Radios: cápsulas completas `999px` en botones, pestañas, selectores e inputs; tarjetas y modales con radios de `24px` a `32px`.
- **Tipografía Nativa Embebida:**
  - `Inter` (pesos 400 y 700) para lectura fluida de datos e interfaz.
  - `Outfit` (pesos 400, 600 y 800) para encabezados display.
  - `JetBrains Mono` (pesos 400, 500 y 700) para valores tabulares, claves y números.

---

## 6. Procedimientos de Testing y QA

Dentro del directorio `finanzas-cardenas/`:

```bash
# 1. Pruebas unitarias y de integración (Node.js test runner nativo)
npm test

# 2. Análisis estático de código y reglas de arquitectura
npm run lint

# 3. Pruebas End-to-End de interfaz con Electron real y auditoría axe-core (WCAG A/AA)
npm run smoke:ui
```
