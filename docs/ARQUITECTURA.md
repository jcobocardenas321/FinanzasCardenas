# Arquitectura

Monolito modular con Clean Architecture [B.6]. Capas por módulo (`src/server/modules/<contexto>/`):

```
interface        rutas Express + controladores
   ↓
application      casos de uso / servicios
   ↓
domain           entidades, value objects y puertos (puro)
   ↑
infrastructure   repositorios SQLite (better-sqlite3), hasher, reloj
```

Reglas aplicadas por ESLint (`eslint.config.js`): `domain/` no importa Express, Electron, SQLite ni módulos de Node; `application/` no importa infraestructura concreta. La composición vive en `src/server/container.js`.

Contexto completo y contratos: ver la entrega de Fase 0. Decisiones técnicas: [DECISIONES.md](DECISIONES.md).
