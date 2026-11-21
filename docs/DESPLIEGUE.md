# Guía de Despliegue y Empaquetado · FinanzasCardenas

> **Versión del producto:** 0.1.0  
> **Formato de distribución:** Ejecutable portable autónomo para Windows (`.exe`)  
> **Empaquetador:** Electron Builder  

---

## 1. Requisitos Previos de Construcción

Para generar el binario portable de **FinanzasCardenas** se requiere una estación de trabajo con el siguiente entorno:

- **Sistema Operativo:** macOS, Windows 10/11 o Linux de 64 bits.
- **Node.js:** Versión `>= 22.0.0` (LTS recomendada).
- **npm:** Versión `>= 10.0.0`.
- **Memoria RAM:** Mínimo 4 GB (8 GB recomendados durante la compilación).
- **Espacio en disco:** Al menos 1 GB libre para dependencias y empaquetado.

---

## 2. Preparación del Entorno de Compilación

Todos los comandos deben ejecutarse dentro de la carpeta `finanzas-cardenas/`:

```bash
# 1. Acceder al directorio del proyecto
cd finanzas-cardenas

# 2. Instalar dependencias de producción y desarrollo
npm install

# 3. Copiar recursos de librerías locales (fuentes, iconos, SweetAlert)
npm run vendor

# 4. Ejecutar la batería de pruebas y validación estática
npm test
npm run lint
```

---

## 3. Generación del Ejecutable Portable para Windows

El proyecto utiliza **Electron Builder** configurado a través de `electron-builder.yml`:

```bash
npm run dist:win
```

### Qué sucede durante el empaquetado:
1. Electron Builder empaqueta el backend en Node.js, el servidor Express, el motor relacional `better-sqlite3` con sus binarios nativos N-API precompilados y los recursos del frontend (`src/renderer`).
2. Se genera un archivo ejecutable portable en la carpeta `finanzas-cardenas/dist/`:
   ```
   dist/
   └── FinanzasCardenas 0.1.0.exe
   ```
3. **Características del Binario Portable:**
   - **Autónomo (Zero-Config):** No requiere que el usuario final tenga Node.js, Python ni bases de datos instaladas en su equipo Windows.
   - **Sin Instalador:** Puede ejecutarse directamente desde el disco duro o desde una memoria USB.

---

## 4. Persistencia Local y Ubicación de Datos

Al ejecutarse en el equipo del usuario final, la aplicación almacena de forma segura la base de datos relacional y los archivos de configuración en el directorio estándar `userData` del sistema operativo:

- **Windows:** `%APPDATA%\finanzas-cardenas\` (típicamente `C:\Users\<Usuario>\AppData\Roaming\finanzas-cardenas\`)
- **macOS:** `~/Library/Application Support/finanzas-cardenas/`
- **Linux:** `~/.config/finanzas-cardenas/`

### Archivos Almacenados en `userData`:
1. `data/finanzas.db`: Base de datos relacional SQLite con todas las tablas, movimientos, usuarios y presupuestos del hogar.
2. `rec/recovery-key.txt`: Archivo temporal generado en el primer arranque con la clave de recuperación del Administrador (permisos restrictivos `0600`).

---

## 5. Estrategia de Copia de Seguridad (Backup) y Restauración

Para respaldar toda la información financiera del hogar:

1. **Crear una copia de seguridad:**
   - Asegúrate de cerrar la aplicación FinanzasCardenas.
   - Copia el archivo `finanzas.db` ubicado en `%APPDATA%\finanzas-cardenas\data\` hacia un medio externo seguro (disco externo o almacenamiento en la nube cifrado).
2. **Restaurar información:**
   - Cierra la aplicación.
   - Pega el archivo `finanzas.db` respaldado en `%APPDATA%\finanzas-cardenas\data\finanzas.db`, reemplazando el archivo existente.
   - Al abrir de nuevo la aplicación, todos los datos históricos estarán completamente disponibles.

---

## 6. Verificación de Integridad y Distribución Académica

Para garantizar la autenticidad del archivo portable distribuido a evaluadores o usuarios:

```powershell
# En Windows PowerShell para verificar el hash SHA-256
Get-FileHash -Path "dist\FinanzasCardenas 0.1.0.exe" -Algorithm SHA256
```

---

## 7. Solución de Problemas (Troubleshooting)

A continuación se detallan los escenarios más comunes de soporte y sus soluciones operativas:

### 7.1. Base de Datos Bloqueada (`SQLITE_BUSY` o `database is locked`)
- **Causa:** Ocurre si una instancia previa de la aplicación no se cerró completamente o si un software de respaldo en segundo plano (ej. OneDrive, Google Drive o Dropbox) mantiene bloqueado el archivo `finanzas.db`.
- **Solución:**
  1. Cierra todos los procesos de `FinanzasCardenas` desde el Administrador de Tareas (Windows) o mediante terminal:
     ```bash
     pkill -f "FinanzasCardenas" || killall electron
     ```
  2. Verifica que el archivo `finanzas.db` en la carpeta `userData` no esté marcado como "Sólo lectura".
  3. Si la carpeta está sincronizada en la nube, desactiva la sincronización en tiempo real sobre la ruta `userData/data/` para evitar conflictos con el modo WAL (Write-Ahead Logging) de SQLite.

### 7.2. Puerto Local o Enlace de Red Bloqueado
- **Causa:** El backend interno de Express se enlaza exclusivamente al adaptador local `127.0.0.1` en un puerto dinámico efímero. Si una directiva de seguridad del sistema o firewall bloquea el enlace loopback, la ventana del renderer no podrá comunicarse con la API.
- **Solución:**
  1. Comprueba que el firewall local permita conexiones salientes y entrantes en la interfaz de loopback (`localhost` / `127.0.0.1`).
  2. La aplicación nunca expone puertos a redes externas (`0.0.0.0`), garantizando aislamiento total.

### 7.3. Errores de Certificados y CSP (Content Security Policy)
- **Causa:** Mensajes en la consola de depuración como `Refused to load the script/style because it violates the following Content Security Policy directive`.
- **Solución:**
  1. FinanzasCardenas utiliza una política de seguridad estricta: `default-src 'self'` sin `'unsafe-inline'`. Todos los scripts y estilos deben residir en el paquete empaquetado.
  2. Si se compila desde el código fuente y faltan iconos o fuentes, asegúrate de haber ejecutado previamente `npm run vendor` para volcar todas las tipografías locales (`Inter`, `Outfit`, `JetBrains Mono`) y librerías (`SweetAlert2`, `FontAwesome`).
  3. No se requiere conexión a internet para cargar tipografías ni recursos CDN.

### 7.4. Olvido de Contraseña y Recuperación de la Cuenta Administrador
- **Causa:** El usuario Administrador olvidó sus credenciales de acceso.
- **Solución:**
  1. En la pantalla de inicio de sesión, haz clic en **"¿Olvidaste tu contraseña?"**.
  2. Ingresa el nombre de usuario del Administrador y la **Clave de Recuperación** única obtenida en el primer inicio (guardada en `userData/rec/recovery-key.txt` o anotada de forma segura).
  3. Define una nueva contraseña maestra que cumpla las políticas de complejidad (mínimo 10 caracteres, mayúscula, minúscula, número y símbolo).
  4. La clave de recuperación utilizada quedará invalidada inmediatamente y el sistema generará una nueva clave única e irrepetible que deberás almacenar.

