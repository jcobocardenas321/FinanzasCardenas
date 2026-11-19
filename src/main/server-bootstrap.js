// [D.15] Levanta Express dentro del proceso principal: 127.0.0.1, puerto efímero y launchKey única por arranque.
import { app } from 'electron';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startServer } from '../server/server.js';
import { getDataDir, getDbPath } from './paths.js';

const here = path.dirname(fileURLToPath(import.meta.url));

/** @returns {Promise<{ baseUrl: string, launchKey: string, close: () => Promise<void> }>} */
export async function bootstrapServer() {
  const launchKey = randomUUID();
  const server = await startServer({
    dbPath: getDbPath(),
    recoveryDir: getDataDir(),
    rendererDir: path.join(here, '../renderer'),
    launchKey,
    version: app.getVersion(),
    host: '127.0.0.1',
    port: 0,
  });
  return { baseUrl: server.baseUrl, launchKey, close: server.close };
}
