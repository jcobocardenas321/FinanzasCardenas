// [D.15] Reglas de seguridad del proceso principal. Funciones puras (sin importar electron) para poder probarlas con node:test.

/** ¿La URL pertenece EXACTAMENTE al origen del servidor local? (compara origen, no prefijo de texto) */
export function isTrustedUrl(url, baseUrl) {
  try { return new URL(url).origin === new URL(baseUrl).origin; } catch { return false; }
}

/** Un mensaje IPC solo es válido si viene de la ventana principal y de una página del servidor local. */
export const isTrustedSender = (event, baseUrl, mainWebContents) =>
  Boolean(mainWebContents) && event.sender === mainWebContents && isTrustedUrl(event.senderFrame?.url ?? '', baseUrl);

/** Falla si la ventana no conserva el aislamiento exigido (contextIsolation, sin nodeIntegration, sandbox, webSecurity). */
export function assertSecureWebPreferences(p) {
  const problems = [];
  if (p.contextIsolation !== true) problems.push('contextIsolation debe ser true');
  if (p.nodeIntegration === true) problems.push('nodeIntegration debe ser false');
  if (p.sandbox !== true) problems.push('sandbox debe ser true');
  if (p.webSecurity === false) problems.push('webSecurity no puede desactivarse');
  if (p.webviewTag === true) problems.push('webviewTag debe ser false');
  if (p.allowRunningInsecureContent === true) problems.push('allowRunningInsecureContent debe ser false');
  if (problems.length) throw new Error(`Configuración de seguridad inválida: ${problems.join('; ')}`);
}

/** Único permiso concedido: copiar texto al portapapeles (clave de recuperación, contraseña temporal). */
export const isPermissionAllowed = (permission) => permission === 'clipboard-sanitized-write';
