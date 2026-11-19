# Manual de Usuario · FinanzasCardenas

Bienvenido a **FinanzasCardenas**, la aplicación de escritorio moderna y segura diseñada para ayudarte a tomar el control absoluto de la economía de tu hogar.

---

## 1. Primeros Pasos y Configuración Inicial (Setup)

Al ejecutar la aplicación por primera vez, el sistema detecta que no existen usuarios registrados e inicia automáticamente el asistente de **Configuración Inicial**:

1. **Creación de la Cuenta de Administrador:**
   - **Nombre de usuario:** Identificador único (por ejemplo, `admin` o tu nombre).
   - **Nombre para mostrar:** Tu nombre completo o cómo deseas que la aplicación te salude en la barra superior.
   - **Contraseña maestra:** Debe ser una contraseña segura de al menos 10 caracteres que combine mayúsculas, minúsculas, números y símbolos.
   - **Confirmación:** Vuelve a escribir la contraseña para verificar que coincide.
2. **Generación de la Clave de Recuperación del Administrador:**
   - El sistema genera una clave especial de 32 caracteres (dividida en 8 bloques de 4 caracteres, por ejemplo: `A3K9-W7R2-M8P4-T6Y1-...`).
   - **IMPORTANTE:** Esta clave se muestra **una sola vez**. Cópiala y guárdala en un lugar seguro (por ejemplo, en un gestor de contraseñas o en una libreta física).
   - Te permitirá recuperar el acceso al sistema en caso de que olvides tu contraseña maestra.

---

## 2. Acceso y Seguridad de Sesión

### Inicio de Sesión (Login)
- Ingresa tu nombre de usuario y tu contraseña.
- **Protección contra ataques de fuerza bruta:** Si introduces una contraseña incorrecta 5 veces consecutivas, la cuenta quedará temporalmente bloqueada por seguridad. En tal caso, un administrador del hogar deberá desbloquearla desde el módulo de Usuarios.

### Cierre Automático por Inactividad
- Por motivos de privacidad y seguridad bancaria doméstica, si dejas la aplicación sin interactuar durante **30 minutos**, tu sesión se cerrará de forma automática y se te solicitará volver a ingresar tu contraseña para continuar.

### Recuperación de Acceso
- Si eres el Administrador y no recuerdas tu contraseña, pulsa en el enlace **"Olvidé mi contraseña (Administrador)"** en la pantalla de inicio de sesión.
- Ingresa tu usuario, tu clave de recuperación guardada y una nueva contraseña fuerte.
- El sistema restablecerá tu acceso y te entregará una nueva clave de recuperación de un solo uso.

---

## 3. Navegación e Interfaz (Diseño Liquid Glass)

FinanzasCardenas cuenta con la elegante interfaz **Liquid Glass**, caracterizada por paneles translúcidos con efecto de vidrio esmerilado, iluminación especular suave y acentos de color cian y lavanda:

- **Barra Superior (Header):**
  - Muestra el nombre de la aplicación, el nombre personalizado de tu hogar (por ejemplo, *"Casa Cárdenas"*) y el botón de usuario en cápsula de cristal.
  - Al pulsar en tu nombre, se despliega el menú de usuario para **Cambiar contraseña** o **Cerrar sesión**.
- **Barra Lateral de Navegación (Sidebar):**
  - Permite acceder a los diferentes módulos de la aplicación.
  - **Modo Expandido:** Muestra el ícono y el nombre de cada sección.
  - **Modo Contraído (Rail):** Se reduce a una columna delgada con íconos. Al pasar el cursor por encima, el menú se despliega automáticamente.
  - **Botón Anclar (Pin):** Si deseas mantener el menú contraído sin que se expanda al pasar el cursor, pulsa el botón *"Anclar menú"*.
  - **Dispositivos móviles o ventanas reducidas:** La barra lateral se oculta y se transforma en un menú hamburguesa desplegable accesible.

---

## 4. Guía Detallada por Módulo

### 4.1. Panel de Control (Dashboard)
El centro de mando de tu economía doméstica:
- **Tarjetas de KPI en Tiempo Real:**
  - **Balance Total:** La diferencia acumulada entre todos tus ingresos históricos y todos tus gastos registrados.
  - **Ahorro Mensual:** El resultado neto (ingresos menos gastos) correspondiente al mes calendario en curso.
- **Gráficos Interactivos Nativos SVG:**
  - **Comparativa de Ingresos vs. Gastos (Últimos 6 meses):** Gráfico de barras que compara lo que ingresó frente a lo que gastaste mes a mes.
  - **Evolución del Ahorro (Últimos 12 meses):** Gráfico de líneas que muestra la trayectoria y salud de tu ahorro mensual a lo largo del último año.
  - **Distribución de Gastos por Categoría:** Gráfico circular (pastel) con el desglose porcentual de en qué se fue tu dinero durante el mes actual.
  - *Navegación con teclado:* Puedes enfocar cualquier gráfico con la tecla `Tab` y desplazarte por cada barra o sector usando las flechas `←` y `→` para ver los valores exactos en pantalla.

### 4.2. Transacciones (Ingresos y Gastos)
Registra y gestiona el flujo de caja diario:
- **Pestañas:** Explora rápidamente entre *"Todos"*, *"Ingresos"* o *"Gastos"*.
- **Registro de un nuevo movimiento:** Pulsa en **"Nuevo movimiento"** para abrir el formulario modal. Indica la fecha, el tipo (Ingreso o Gasto), la categoría correspondiente, el monto en pesos colombianos (COP) y una descripción opcional.
- **Búsqueda y Filtros Avanzados:** Filtra por categoría, por texto de descripción o por rango de fechas (desde / hasta).
- **Ordenamiento y Paginación:** Haz clic en los encabezados de la tabla (Fecha, Monto, Descripción) para ordenar de forma ascendente o descendente.

### 4.3. Presupuestos Mensuales
Mantén los gastos de cada área de tu hogar bajo control:
- Asigna un límite máximo de gasto en pesos para cada categoría (por ejemplo: *Alimentación: $ 1.200.000*, *Servicios Públicos: $ 450.000*).
- **Indicadores de Estado Visual:**
  - **En orden (Verde):** El gasto actual se encuentra por debajo del umbral de alerta.
  - **Alerta (Amarillo):** El gasto ha alcanzado o superado el umbral configurado (por ejemplo, el 80 % del presupuesto).
  - **Superado (Rojo):** Se ha gastado más dinero del asignado en el presupuesto de esa categoría.

### 4.4. Metas de Ahorro
Planifica y alcanza tus sueños familiares (un viaje, el fondo de emergencia, la cuota inicial de vivienda):
- Crea una meta indicando el nombre, el monto objetivo a reunir y una fecha límite opcional.
- Cada meta se presenta en una tarjeta de cristal con un **anillo de progreso circular** que refleja el porcentaje ahorrado.
- Pulsa en **"Aportar"** para registrar un nuevo ahorro con su fecha y monto.
- Al completar el 100 % del objetivo, la meta cambia automáticamente a estado *"Completada"*.
- Puedes archivar o reactivar metas cuando lo consideres oportuno.

### 4.5. Reportes Financieros y Exportación CSV
Genera balances consolidados para el período que elijas:
- Consulta el resumen de ingresos, gastos y ahorro neto de cualquier mes.
- Revisa el desglose cronológico detallado de todos los movimientos.
- **Exportar CSV:** Pulsa el botón *"Exportar CSV"* para descargar un archivo estructurado compatible con Microsoft Excel, Google Sheets o LibreOffice Calc. El sistema utiliza el diálogo de guardado nativo de Windows y previene riesgos de inyección de fórmulas.

### 4.6. Categorías
Personaliza las etiquetas de clasificación de tus finanzas:
- Crea nuevas categorías para ingresos (por ejemplo: *Salario, Rendimientos, Arriendos*) o gastos (por ejemplo: *Mascotas, Educación, Salud*).
- Las categorías con movimientos registrados no pueden eliminarse por accidente, pero puedes archivarlas para que dejen de aparecer en nuevos formularios.

### 4.7. Usuarios y Roles (Exclusivo Administrador)
Permite a otros miembros del hogar registrar sus ingresos y gastos:
- **Roles disponibles:**
  - **Administrador:** Acceso total, gestión de usuarios, catálogos y configuración.
  - **Editor:** Puede consultar el panel, registrar y editar transacciones, presupuestos y metas, pero no puede crear otros usuarios ni modificar la configuración del hogar.
- **Creación de usuario:** El Administrador asigna una contraseña inicial; el nuevo usuario estará obligado a cambiarla en su primer inicio de sesión.
- **Restablecimiento de contraseña:** Si un miembro del hogar olvida su clave, el Administrador puede generar una contraseña temporal de un solo uso.

### 4.8. Configuración
- Personaliza el **Nombre del hogar** (se mostrará en la barra superior).
- Modifica el **Umbral de alerta de presupuestos** (un valor entre 50 % y 100 %).

---

## 5. Atajos de Teclado y Accesibilidad

| Atajo | Acción |
| :--- | :--- |
| `Ctrl + N` | Crear nuevo movimiento financiero (Ingreso o Gasto) |
| `Ctrl + E` | Abrir la vista de Transacciones |
| `Ctrl + P` | Abrir la vista de Presupuestos |
| `Ctrl + R` | Abrir la vista de Reportes |
| `Ctrl + B` | Imprimir / Guardar reporte en formato PDF |
| `Tab` / `Shift + Tab` | Navegar ordenadamente entre controles interactivos |
| `Esc` | Cerrar cualquier ventana modal o menú abierto |
