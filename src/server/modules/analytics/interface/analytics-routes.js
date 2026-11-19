// [C.11] Rutas /analytics (Admin y Editor). El uso por módulo (/analytics/usage, solo Admin) vive en el módulo metrics.
import { Router } from 'express';

export function createAnalyticsRoutes(analytics) {
  const r = Router();
  r.get('/kpis', (req, res) => res.json({ data: analytics.kpis(req.query) }));
  r.get('/series', (req, res) => res.json({ data: analytics.series(req.query) }));
  r.get('/breakdown', (req, res) => res.json({ data: analytics.breakdown(req.query) }));
  r.get('/stats', (req, res) => res.json({ data: analytics.stats(req.query) }));
  r.get('/eda', (req, res) => res.json({ data: analytics.eda(req.query) }));
  return r;
}
