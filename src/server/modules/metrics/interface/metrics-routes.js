// [C.11] POST /metrics/events (Admin y Editor) y GET /analytics/usage (solo Admin).
import { Router } from 'express';

export function createMetricsRoutes(metrics) {
  const r = Router();
  r.post('/events', (req, res) => res.status(201).json({ data: metrics.record(req.auth.user, req.body) }));
  return r;
}

export function createUsageRoutes(metrics) {
  const r = Router();
  r.get('/', (req, res) => res.json({ data: metrics.usage(req.query) }));
  return r;
}
