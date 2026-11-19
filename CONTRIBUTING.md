# Contribuir a FinanzasCardenas

Flujo **trunk-based** [D.16]: `main` siempre está verde y se integra con ramas cortas.

1. Crea una rama corta desde `main`: `feat/<tema>` o `fix/<tema>`.
2. Haz commits pequeños con [Conventional Commits](https://www.conventionalcommits.org/es/v1.0.0/) (`feat:`, `fix:`, `docs:`, `test:`, `chore:`, `refactor:`).
3. Antes de abrir el PR: `npm test` y `npm run lint` deben pasar.
4. Completa el checklist de aceptación de la plantilla de PR.
5. Integra rápido (idealmente en el mismo día) y borra la rama.

## Reglas del proyecto
- Respeta las capas `domain → application → infrastructure → interface` (lo hace cumplir ESLint).
- Nada de `alert()`, `confirm()` ni `prompt()`: usa `ui/dialogs.js` y `ui/toasts.js`.
- SQL solo con sentencias preparadas (`db.prepare(...)`), nunca concatenando texto.
- Nunca subas bases de datos, claves de recuperación ni secretos.
- Cada archivo nuevo lleva en su cabecera el ID de `SKILLS.md` que implementa (p. ej. `// [D.12] ...`).
