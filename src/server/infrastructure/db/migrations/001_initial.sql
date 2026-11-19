-- [B.7] Esquema relacional V1 · [D.13] users/roles · [D.12] sessions
-- [A.1] categories/budgets/goals · [B.8][C.11] agg_monthly_category, metric_events

CREATE TABLE users (
  id                   INTEGER PRIMARY KEY AUTOINCREMENT,
  username             TEXT    NOT NULL UNIQUE COLLATE NOCASE
                               CHECK (length(username) BETWEEN 3 AND 32),
  display_name         TEXT    NOT NULL CHECK (length(trim(display_name)) BETWEEN 1 AND 80),
  password_hash        TEXT    NOT NULL,
  role                 TEXT    NOT NULL CHECK (role IN ('admin','editor')),
  is_active            INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0,1)),
  must_change_password INTEGER NOT NULL DEFAULT 0 CHECK (must_change_password IN (0,1)),
  failed_attempts      INTEGER NOT NULL DEFAULT 0 CHECK (failed_attempts >= 0),
  locked_at            TEXT,
  last_login_at        TEXT,
  created_at           TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at           TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_users_role_active ON users(role, is_active);

-- [D.12] Sesión deslizante 24 h + inactividad 30 min (validadas en backend)
CREATE TABLE sessions (
  id               TEXT    PRIMARY KEY,                -- SHA-256 hex del token; el token nunca se guarda
  user_id          INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at       TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  last_activity_at TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  expires_at       TEXT    NOT NULL,
  revoked_at       TEXT
);
CREATE INDEX idx_sessions_user    ON sessions(user_id);
CREATE INDEX idx_sessions_expires ON sessions(expires_at);

-- [A.1] Catálogo de categorías personalizadas
CREATE TABLE categories (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT    NOT NULL COLLATE NOCASE CHECK (length(trim(name)) BETWEEN 1 AND 40),
  kind        TEXT    NOT NULL CHECK (kind IN ('income','expense')),
  color       TEXT    NOT NULL DEFAULT '#4F46E5'
              CHECK (color GLOB '#[0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f]'),
  icon        TEXT    NOT NULL DEFAULT 'fa-tag',
  is_archived INTEGER NOT NULL DEFAULT 0 CHECK (is_archived IN (0,1)),
  created_by  INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE (kind, name)
);

-- [A.1] Ingresos y gastos (CRUD) · monto entero en COP
CREATE TABLE transactions (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  kind        TEXT    NOT NULL CHECK (kind IN ('income','expense')),
  amount_cop  INTEGER NOT NULL CHECK (amount_cop > 0),
  category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  occurred_on TEXT    NOT NULL
              CHECK (occurred_on GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  description TEXT    NOT NULL CHECK (length(trim(description)) BETWEEN 1 AND 160),
  notes       TEXT    CHECK (notes IS NULL OR length(notes) <= 1000),
  created_by  INTEGER REFERENCES users(id) ON DELETE SET NULL,
  updated_by  INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_tx_date          ON transactions(occurred_on);
CREATE INDEX idx_tx_kind_date     ON transactions(kind, occurred_on);
CREATE INDEX idx_tx_category_date ON transactions(category_id, occurred_on);
CREATE INDEX idx_tx_created_by    ON transactions(created_by);

CREATE TRIGGER trg_tx_kind_matches_category_ins
BEFORE INSERT ON transactions
WHEN (SELECT kind FROM categories WHERE id = NEW.category_id) <> NEW.kind
BEGIN SELECT RAISE(ABORT, 'transaction.kind must match category.kind'); END;

CREATE TRIGGER trg_tx_kind_matches_category_upd
BEFORE UPDATE OF kind, category_id ON transactions
WHEN (SELECT kind FROM categories WHERE id = NEW.category_id) <> NEW.kind
BEGIN SELECT RAISE(ABORT, 'transaction.kind must match category.kind'); END;

-- [A.1] Presupuestos mensuales por categoría (solo categorías de gasto: lo valida el caso de uso)
CREATE TABLE budgets (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  year_month  TEXT    NOT NULL CHECK (year_month GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]'),
  amount_cop  INTEGER NOT NULL CHECK (amount_cop > 0),
  created_by  INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE (category_id, year_month)
);
CREATE INDEX idx_budgets_month ON budgets(year_month);

-- [A.1] Metas de ahorro con seguimiento (progreso = SUM(aportes) / meta)
CREATE TABLE goals (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  name              TEXT    NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 80),
  target_amount_cop INTEGER NOT NULL CHECK (target_amount_cop > 0),
  target_date       TEXT    CHECK (target_date IS NULL OR
                                   target_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  status            TEXT    NOT NULL DEFAULT 'active' CHECK (status IN ('active','completed','archived')),
  created_by        INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_goals_status ON goals(status);

CREATE TABLE goal_contributions (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  goal_id        INTEGER NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
  amount_cop     INTEGER NOT NULL CHECK (amount_cop > 0),
  contributed_on TEXT    NOT NULL
                 CHECK (contributed_on GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  created_by     INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_goal_contrib_goal ON goal_contributions(goal_id, contributed_on);

-- [B.8][C.11] "Almacenamiento analítico: Tablas agregadas"
-- Se mantiene desde los casos de uso de transactions, dentro de la misma transacción SQL.
CREATE TABLE agg_monthly_category (
  year_month  TEXT    NOT NULL,
  kind        TEXT    NOT NULL CHECK (kind IN ('income','expense')),
  category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  total_cop   INTEGER NOT NULL DEFAULT 0,
  tx_count    INTEGER NOT NULL DEFAULT 0,
  updated_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY (year_month, kind, category_id)
) WITHOUT ROWID;

-- [C.11] Métricas: "Errores, Uso por módulo, Métrica personalizada" (solo local)
CREATE TABLE metric_events (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  kind       TEXT NOT NULL CHECK (kind IN ('error','module_use','custom')),
  module     TEXT NOT NULL,
  name       TEXT NOT NULL,
  detail     TEXT CHECK (detail IS NULL OR length(detail) <= 2000),
  user_id    INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_metrics_kind_date   ON metric_events(kind, created_at);
CREATE INDEX idx_metrics_module_date ON metric_events(module, created_at);

CREATE TABLE app_settings (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
