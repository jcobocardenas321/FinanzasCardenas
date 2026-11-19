// [D.15] Rutas de datos de usuario. NUNCA se escribe junto al .exe portable.
import { app } from 'electron';
import fs from 'node:fs';
import path from 'node:path';

export function getDataDir() {
  const dir = path.join(app.getPath('userData'), 'data');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function getDbPath() {
  return path.join(getDataDir(), 'finanzas.db');
}
