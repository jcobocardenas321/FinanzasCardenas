// [D.15][D.12] Cliente de la API. Configuración {baseUrl, launchKey} desde el preload (IPC).
// El token de sesión vive SOLO en memoria (nunca en LocalStorage).
export class ApiError extends Error {
  constructor({ status, code, message, fields, details, requestId }) {
    super(message);
    this.name = 'ApiError';
    Object.assign(this, { status, code, fields, details, requestId });
  }
}

let config = null;
let token = null;

export async function initApi() {
  if (!window.fc?.getApiConfig) throw new Error('El preload no expone getApiConfig()');
  config = await window.fc.getApiConfig();
  return config;
}

export const setToken = (value) => { token = value ?? null; };
export const hasToken = () => token !== null;

const SESSION_CODES = new Set(['UNAUTHENTICATED', 'SESSION_EXPIRED', 'SESSION_IDLE']);

function build(path, query, auth, hasBody) {
  if (!config) throw new Error('Llama a initApi() antes de usar la API');
  const url = new URL(`${config.baseUrl}/api/v1${path}`);
  for (const [k, v] of Object.entries(query ?? {})) if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v));
  const headers = { 'X-Launch-Key': config.launchKey };
  if (hasBody) headers['Content-Type'] = 'application/json';
  if (auth && token) headers.Authorization = `Bearer ${token}`;
  return { url, headers };
}

async function toError(response, auth) {
  const payload = await response.json().catch(() => null);
  const e = payload?.error ?? {};
  const error = new ApiError({ status: response.status, code: e.code ?? 'UNKNOWN', message: e.message ?? 'Error de red', fields: e.fields, details: e.details, requestId: e.requestId });
  if (auth && response.status === 401 && SESSION_CODES.has(error.code)) {
    token = null;
    window.dispatchEvent(new CustomEvent('fc:auth:expired', { detail: { reason: error.code } }));
  }
  return error;
}

async function request(method, path, { body, query, auth = true } = {}) {
  const { url, headers } = build(path, query, auth, body !== undefined);
  const response = await fetch(url, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  if (response.status === 204) return null;
  if (!response.ok) throw await toError(response, auth);
  return response.json();
}

/** Descarga un archivo (p. ej. CSV) con la sesión actual. @returns {Promise<{ blob: Blob, filename: string }>} */
async function download(path, { query } = {}) {
  const { url, headers } = build(path, query, true, false);
  const response = await fetch(url, { headers });
  if (!response.ok) throw await toError(response, true);
  const filename = /filename="([^"]+)"/.exec(response.headers.get('content-disposition') ?? '')?.[1] ?? 'descarga';
  return { blob: await response.blob(), filename };
}

export const api = {
  get: (path, options) => request('GET', path, options),
  post: (path, body, options) => request('POST', path, { ...options, body: body ?? {} }),
  put: (path, body, options) => request('PUT', path, { ...options, body: body ?? {} }),
  patch: (path, body, options) => request('PATCH', path, { ...options, body }),
  delete: (path, options) => request('DELETE', path, options),
  download,
};
