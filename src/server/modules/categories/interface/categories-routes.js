// [A.1] Rutas /categories (Admin y Editor).
import { Router } from 'express';
import { parseId } from '../../../shared/validation.js';

export function createCategoryRoutes(categories) {
  const r = Router();
  r.get('/', (req, res) => res.json(categories.list(req.query)));
  r.post('/', (req, res) => res.status(201).json({ data: categories.create(req.auth.user, req.body) }));
  r.get('/:id', (req, res) => res.json({ data: categories.get(parseId(req.params.id)) }));
  r.patch('/:id', (req, res) => res.json({ data: categories.update(parseId(req.params.id), req.body) }));
  r.delete('/:id', (req, res) => (categories.remove(parseId(req.params.id)), res.status(204).end()));
  return r;
}
