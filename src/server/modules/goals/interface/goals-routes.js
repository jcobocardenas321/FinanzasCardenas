// [A.1] Rutas /goals (Admin y Editor).
import { Router } from 'express';
import { parseId } from '../../../shared/validation.js';

export function createGoalRoutes(goals) {
  const r = Router();
  r.get('/', (req, res) => res.json(goals.list(req.query)));
  r.post('/', (req, res) => res.status(201).json({ data: goals.create(req.auth.user, req.body) }));
  r.get('/:id', (req, res) => res.json({ data: goals.get(parseId(req.params.id)) }));
  r.patch('/:id', (req, res) => res.json({ data: goals.update(parseId(req.params.id), req.body) }));
  r.delete('/:id', (req, res) => (goals.remove(parseId(req.params.id)), res.status(204).end()));
  r.post('/:id/contributions', (req, res) => res.status(201).json({ data: goals.addContribution(req.auth.user, parseId(req.params.id), req.body) }));
  r.delete('/:id/contributions/:cid', (req, res) => res.json({ data: goals.removeContribution(parseId(req.params.id), parseId(req.params.cid)) }));
  return r;
}
