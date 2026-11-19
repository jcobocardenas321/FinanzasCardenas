// [D.15] Arranque del servidor: Express en 127.0.0.1 con puerto efímero (0) y clave de arranque.
import http from 'node:http';
import { createApp } from './app.js';
import { createContainer } from './container.js';

/**
 * @param {{ dbPath: string, recoveryDir: string, launchKey: string, rendererDir?: string, host?: string, port?: number,
 *           version?: string, clock?: object, hasherOptions?: object, authOptions?: object, logger?: object }} options
 */
export async function startServer({ launchKey, rendererDir, host = '127.0.0.1', port = 0, version, logger = console, ...containerOptions }) {
  if (!launchKey || launchKey.length < 16) throw new Error('launchKey inválida (mínimo 16 caracteres)');
  const container = createContainer({ ...containerOptions, logger });
  const allowedHosts = new Set();
  const app = createApp({ services: container.services, launchKey, rendererDir, allowedHosts, version, logger, onInternalError: container.services.metrics.recordInternalError });
  const server = http.createServer(app);
  try {
    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(port, host, resolve);
    });
  } catch (error) {
    container.close();
    throw error;
  }
  const actualPort = server.address().port;
  allowedHosts.add(`${host}:${actualPort}`);
  return {
    port: actualPort,
    baseUrl: `http://${host}:${actualPort}`,
    container,
    async close() {
      server.closeAllConnections();
      await new Promise((resolve) => server.close(resolve));
      container.close();
    },
  };
}
