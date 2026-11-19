// [A.1] Rutas /budgets (Admin y Editor).
import { Router } from 'express';
import { parseId } from '../../../shared/validation.js';

export function createBudgetRoutes(budgets) {
  const r = Router();
  r.get('/', (req, res) => res.json({ data: budgets.list(req.query) }));
  r.put('/:categoryId/:month', (req, res) => res.json({ data: budgets.upsert(req.auth.user, parseId(req.params.categoryId), req.params.month, req.body) }));
  r.delete('/:categoryId/:month', (req, res) => (budgets.remove(parseId(req.params.categoryId), req.params.month), res.status(204).end()));
  return r;
}
