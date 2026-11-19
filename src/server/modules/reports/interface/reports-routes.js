// [Alcance: reportes] Rutas /reports (Admin y Editor).
import { Router } from 'express';

export function createReportsRoutes(reports) {
  const r = Router();
  r.get('/summary', (req, res) => res.json({ data: reports.summary(req.query) }));
  r.get('/detail', (req, res) => res.json({ data: reports.detail(req.query) }));
  r.get('/transactions.csv', (req, res) => {
    const { filename, content } = reports.csv(req.query);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(content);
  });
  return r;
}
