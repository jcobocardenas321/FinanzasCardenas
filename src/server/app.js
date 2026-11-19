// [B.5][B.6][D.15] Aplicación Express: cabeceras seguras, guardia de Host, estáticos del renderer y API /api/v1.
import express from 'express';
import { notFound } from './shared/errors.js';
import { createAuthMiddleware } from './infrastructure/http/middlewares/authenticate.js';
import { errorHandler, notFoundHandler } from './infrastructure/http/middlewares/error-handler.js';
import { hostGuard } from './infrastructure/http/middlewares/host-guard.js';
import { launchKeyGuard } from './infrastructure/http/middlewares/launch-key.js';
import { requestId } from './infrastructure/http/middlewares/request-id.js';
import { securityHeaders } from './infrastructure/http/middlewares/security-headers.js';
import { createAuthRoutes } from './modules/auth/interface/auth-routes.js';
import { createAnalyticsRoutes } from './modules/analytics/interface/analytics-routes.js';
import { createBudgetRoutes } from './modules/budgets/interface/budgets-routes.js';
import { createGoalRoutes } from './modules/goals/interface/goals-routes.js';
import { createMetricsRoutes, createUsageRoutes } from './modules/metrics/interface/metrics-routes.js';
import { createReportsRoutes } from './modules/reports/interface/reports-routes.js';
import { createSettingsRoutes } from './modules/settings/interface/settings-routes.js';
import { createCategoryRoutes } from './modules/categories/interface/categories-routes.js';
import { createTransactionRoutes } from './modules/transactions/interface/transactions-routes.js';
import { createUsersRoutes } from './modules/users/interface/users-routes.js';

export function createApp({ services, launchKey, rendererDir, allowedHosts, version = '0.0.0', logger, onInternalError }) {
  const app = express();
  app.disable('x-powered-by');
  app.set('etag', false);
  app.use(requestId, securityHeaders, hostGuard(allowedHosts));
  if (rendererDir) app.use(express.static(rendererDir, { dotfiles: 'deny', index: 'index.html' }));

  const mw = createAuthMiddleware(services.auth);
  const api = express.Router();
  api.use((req, res, next) => (res.setHeader('Cache-Control', 'no-store'), next()));
  api.use(launchKeyGuard(launchKey));
  api.use(express.json({ limit: '100kb' }));
  api.get('/health', (req, res) => res.json({ data: { status: 'ok', version, time: new Date().toISOString() } }));
  api.use('/auth', createAuthRoutes({ auth: services.auth, mw }));
  api.use('/users', mw.authenticate(), mw.requireRole('admin'), createUsersRoutes(services.users));
  api.use('/categories', mw.authenticate(), createCategoryRoutes(services.categories));
  api.use('/transactions', mw.authenticate(), createTransactionRoutes(services.transactions));
  api.use('/budgets', mw.authenticate(), createBudgetRoutes(services.budgets));
  api.use('/goals', mw.authenticate(), createGoalRoutes(services.goals));
  api.use('/analytics/usage', mw.authenticate(), mw.requireRole('admin'), createUsageRoutes(services.metrics));
  api.use('/analytics', mw.authenticate(), createAnalyticsRoutes(services.analytics));
  api.use('/reports', mw.authenticate(), createReportsRoutes(services.reports));
  api.use('/metrics', mw.authenticate(), createMetricsRoutes(services.metrics));
  api.use('/settings', mw.authenticate(), createSettingsRoutes({ settings: services.settings, mw }));
  api.use((req, res, next) => next(notFound('Ruta no encontrada')));

  app.use('/api/v1', api);
  app.use(notFoundHandler);
  app.use(errorHandler(logger, onInternalError));
  return app;
}
