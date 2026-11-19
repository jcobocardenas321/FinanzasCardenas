// [A.1] GET /settings (Admin y Editor) · PUT /settings (solo Admin).
import { Router } from 'express';

export function createSettingsRoutes({ settings, mw }) {
  const r = Router();
  r.get('/', (req, res) => res.json({ data: settings.get() }));
  r.put('/', mw.requireRole('admin'), (req, res) => res.json({ data: settings.update(req.body) }));
  return r;
}
