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
