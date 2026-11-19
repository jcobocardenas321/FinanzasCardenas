// Servidor REAL efímero + cliente fetch para pruebas E2E.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startServer } from '../../src/server/server.js';
import { tempDir } from './db.js';
import { createFakeClock, FAST, STRONG } from './fixtures.js';

export const KEY = 'test-launch-key-0123456789';
const RENDERER = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../src/renderer');

export async function startTestServer() {
  const dir = tempDir('fc-e2e-');
  const clock = createFakeClock();
  const srv = await startServer({ dbPath: `${dir}/e2e.db`, recoveryDir: `${dir}/rec`, rendererDir: RENDERER, launchKey: KEY, clock, ...FAST });
  async function call(method, url, { body, token, key = KEY, headers = {}, raw } = {}) {
    const h = { ...headers };
    if (key) h['X-Launch-Key'] = key;
    if (token) h.Authorization = `Bearer ${token}`;
    if (body !== undefined || raw !== undefined) h['Content-Type'] = 'application/json';
    const res = await fetch(`${srv.baseUrl}/api/v1${url}`, { method, headers: h, body: raw ?? (body === undefined ? undefined : JSON.stringify(body)) });
    const bytes = Buffer.from(await res.arrayBuffer());
    const text = bytes.toString('utf8'); // conserva el BOM (fetch().text() lo descarta)
    const isJson = (res.headers.get('content-type') ?? '').includes('json');
    return { status: res.status, headers: res.headers, bytes, text, body: isJson && text ? JSON.parse(text) : null };
  }
  /** Crea el Admin por HTTP y un Editor (ya sin cambio obligatorio). Devuelve sus tokens. */
  async function bootstrapUsers() {
    await call('POST', '/auth/setup', { body: { username: 'admin', displayName: 'Admin', password: STRONG } });
    const admin = (await call('POST', '/auth/login', { body: { username: 'admin', password: STRONG } })).body.data;
    const created = await call('POST', '/users', { token: admin.token, body: { username: 'ana', displayName: 'Ana', role: 'editor', password: STRONG } });
    srv.container.db.prepare('UPDATE users SET must_change_password = 0 WHERE id = ?').run(created.body.data.id);
    const editor = (await call('POST', '/auth/login', { body: { username: 'ana', password: STRONG } })).body.data;
    return { adminToken: admin.token, editorToken: editor.token };
  }
  return { srv, call, clock, bootstrapUsers, async close() { await srv.close(); fs.rmSync(dir, { recursive: true, force: true }); } };
}
