// [D.13] Rutas /users (solo Admin; el montaje aplica requireRole('admin')).
import { Router } from 'express';
import { parseId } from '../../../shared/validation.js';

export function createUsersRoutes(users) {
  const r = Router();
  r.get('/', (req, res) => res.json(users.list(req.query)));
  r.post('/', async (req, res) => res.status(201).json({ data: await users.create(req.body) }));
  r.get('/:id', (req, res) => res.json({ data: users.get(parseId(req.params.id)) }));
  r.patch('/:id', (req, res) => res.json({ data: users.update(parseId(req.params.id), req.body) }));
  r.post('/:id/reset-password', async (req, res) => res.json({ data: await users.resetPassword(parseId(req.params.id)) }));
  r.post('/:id/unlock', (req, res) => res.json({ data: users.unlock(parseId(req.params.id)) }));
  return r;
}
