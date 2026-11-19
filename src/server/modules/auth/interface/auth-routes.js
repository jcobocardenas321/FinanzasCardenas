// [D.12] Rutas /auth. Envoltorio de respuesta: { data }.
import { Router } from 'express';

export function createAuthRoutes({ auth, mw }) {
  const r = Router();
  const pending = mw.authenticate({ allowPasswordChangePending: true });
  r.get('/setup-status', (req, res) => res.json({ data: auth.setupStatus() }));
  r.post('/setup', async (req, res) => res.status(201).json({ data: await auth.setup(req.body) }));
  r.post('/login', async (req, res) => res.json({ data: await auth.login(req.body) }));
  r.post('/recover', async (req, res) => res.json({ data: await auth.recover(req.body) }));
  r.post('/logout', pending, (req, res) => (auth.logout(req.auth.sessionId), res.status(204).end()));
  r.get('/session', pending, (req, res) => {
    const { user, expiresAt, idleTimeoutMs } = req.auth;
    res.json({ data: { user, expiresAt, idleTimeoutMs } });
  });
  r.post('/change-password', pending, async (req, res) => {
    const result = await auth.changePassword({ userId: req.auth.user.id, sessionId: req.auth.sessionId, ...req.body });
    res.json({ data: result });
  });
  return r;
}
