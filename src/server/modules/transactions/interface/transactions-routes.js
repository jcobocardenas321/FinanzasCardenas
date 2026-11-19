// [A.1] Rutas /transactions (Admin y Editor): listado con filtros, orden y paginación.
import { Router } from 'express';
import { parseId } from '../../../shared/validation.js';

export function createTransactionRoutes(transactions) {
  const r = Router();
  r.get('/', (req, res) => res.json(transactions.list(req.query)));
  r.post('/', (req, res) => res.status(201).json({ data: transactions.create(req.auth.user, req.body) }));
  r.get('/:id', (req, res) => res.json({ data: transactions.get(parseId(req.params.id)) }));
  r.patch('/:id', (req, res) => res.json({ data: transactions.update(req.auth.user, parseId(req.params.id), req.body) }));
  r.delete('/:id', (req, res) => (transactions.remove(parseId(req.params.id)), res.status(204).end()));
  return r;
}
