// [B.6] Composition root: único lugar donde se instancian implementaciones concretas y se cablean los módulos.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openDatabase } from './infrastructure/db/connection.js';
import { runMigrations } from './infrastructure/db/migrator.js';
import { withTransaction } from './infrastructure/db/tx.js';
import { generateTemporaryPassword } from './infrastructure/security/password-generator.js';
import { createRecoveryKeyFileStore } from './infrastructure/security/recovery-key-file-store.js';
import { generateRecoveryKey, hashRecoveryKey, recoveryKeyMatches } from './infrastructure/security/recovery-key.js';
import { createScryptHasher } from './infrastructure/security/scrypt-hasher.js';
import { createTokenService } from './infrastructure/security/token.js';
import { createAuthService } from './modules/auth/application/auth-service.js';
import { MAX_FAILED_ATTEMPTS } from './modules/auth/domain/session-policy.js';
import { createSqliteKvRepository } from './modules/auth/infrastructure/sqlite-kv-repository.js';
import { createSqliteSessionRepository } from './modules/auth/infrastructure/sqlite-session-repository.js';
import { createAnalyticsService } from './modules/analytics/application/analytics-service.js';
import { createSqliteAnalyticsRepository } from './modules/analytics/infrastructure/sqlite-analytics-repository.js';
import { createBudgetService } from './modules/budgets/application/budget-service.js';
import { createSqliteBudgetRepository } from './modules/budgets/infrastructure/sqlite-budget-repository.js';
import { createGoalService } from './modules/goals/application/goal-service.js';
import { createSqliteGoalRepository } from './modules/goals/infrastructure/sqlite-goal-repository.js';
import { createMetricsService } from './modules/metrics/application/metrics-service.js';
import { createSqliteMetricsRepository } from './modules/metrics/infrastructure/sqlite-metrics-repository.js';
import { createReportsService } from './modules/reports/application/reports-service.js';
import { createSettingsService } from './modules/settings/application/settings-service.js';
import { createSqliteSettingsRepository, SETTING_KEYS } from './modules/settings/infrastructure/sqlite-settings-repository.js';
import { createCategoryService } from './modules/categories/application/category-service.js';
import { createSqliteCategoryRepository } from './modules/categories/infrastructure/sqlite-category-repository.js';
import { createTransactionService } from './modules/transactions/application/transaction-service.js';
import { createSqliteTransactionRepository } from './modules/transactions/infrastructure/sqlite-transaction-repository.js';
import { createUserAccounts } from './modules/users/application/user-accounts.js';
import { createUserAdminService } from './modules/users/application/user-admin-service.js';
import { createSqliteUserRepository } from './modules/users/infrastructure/sqlite-user-repository.js';
import { systemClock } from './shared/clock.js';

export const MIGRATIONS_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'infrastructure/db/migrations');

/** @param {{ dbPath: string, recoveryDir: string, clock?: object, hasherOptions?: object, authOptions?: object, logger?: object }} options */
export function createContainer({ dbPath, recoveryDir, clock = systemClock, hasherOptions, authOptions, logger = console }) {
  const db = openDatabase(dbPath);
  try {
    runMigrations(db, { dir: MIGRATIONS_DIR, logger });
  } catch (error) {
    db.close();
    throw error;
  }
  const unitOfWork = { run: (fn) => withTransaction(db, fn) };
  const hasher = createScryptHasher(hasherOptions);

  const userRepo = createSqliteUserRepository(db);
  const auth = createAuthService({
    accounts: createUserAccounts({ users: userRepo, clock, maxFailedAttempts: MAX_FAILED_ATTEMPTS }),
    sessions: createSqliteSessionRepository(db),
    kv: createSqliteKvRepository(db),
    hasher,
    tokens: createTokenService(),
    recoveryKeys: { generate: generateRecoveryKey, hash: hashRecoveryKey, matches: recoveryKeyMatches },
    recoveryFile: createRecoveryKeyFileStore({ dir: recoveryDir }),
    clock,
    unitOfWork,
    logger,
    options: authOptions,
  });
  const users = createUserAdminService({
    users: userRepo,
    hasher,
    generatePassword: generateTemporaryPassword,
    sessionRevoker: { revokeAllForUser: auth.revokeUserSessions },
    unitOfWork,
    clock,
  });
  const categoryRepo = createSqliteCategoryRepository(db);
  const transactionRepo = createSqliteTransactionRepository(db);
  const categories = createCategoryService({ categories: categoryRepo, usage: { transactionCount: transactionRepo.readModel.countByCategory }, clock });
  const transactions = createTransactionService({ transactions: transactionRepo, categories: { findById: categoryRepo.findById }, unitOfWork, clock });

  // --- Fase 2b: los módulos se comunican por PUERTOS, nunca leyendo tablas ajenas ---
  const settings = createSettingsService({ repo: createSqliteSettingsRepository(db), keys: SETTING_KEYS, clock });
  const analytics = createAnalyticsService({ repo: createSqliteAnalyticsRepository(db), source: transactionRepo.readModel, clock });
  const budgets = createBudgetService({
    repo: createSqliteBudgetRepository(db),
    spending: { getSpentByCategory: analytics.getSpentByCategory }, // gasto por categoría (desde la tabla agregada)
    categories: { findById: categoryRepo.findById },
    settings: { getBudgetWarningPct: settings.getBudgetWarningPct },
    clock,
  });
  const goals = createGoalService({ repo: createSqliteGoalRepository(db), unitOfWork, clock });
  const reports = createReportsService({ source: transactionRepo.readModel, clock });
  const metrics = createMetricsService({ repo: createSqliteMetricsRepository(db), clock, logger });

  auth.purgeSessions();
  metrics.purgeOld();
  return { db, repos: { transactions: transactionRepo }, services: { auth, users, categories, transactions, settings, analytics, budgets, goals, reports, metrics }, close: () => db.close() };
}
