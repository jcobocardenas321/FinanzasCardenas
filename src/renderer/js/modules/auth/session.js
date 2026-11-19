// [D.12] Acciones de sesión del frontend. El token vive solo en memoria (core/api.js), jamás en almacenamiento.
import { api, setToken } from '../../core/api.js';
import { EVENTS, emit } from '../../core/events.js';
import { resetSession, setState } from '../../core/store.js';

export async function loadSetupStatus() {
  const { data } = await api.get('/auth/setup-status', { auth: false });
  setState('session.needsSetup', data.needsSetup);
  return data.needsSetup;
}

async function loadHousehold() {
  try { setState('cache.household', (await api.get('/settings')).data.householdName); } catch { /* el encabezado funciona sin el nombre */ }
}

export async function login(username, password) {
  const { data } = await api.post('/auth/login', { username, password }, { auth: false });
  setToken(data.token);
  setState('session', { status: 'authenticated', user: data.user, expiresAt: data.expiresAt, needsSetup: false });
  emit(EVENTS.LOGIN, { user: data.user });
  loadHousehold();
  return data.user;
}

export async function logout() {
  try { await api.post('/auth/logout'); } catch { /* si la sesión ya no vale, igual se cierra localmente */ }
  setToken(null);
  resetSession();
  setState('cache.household', null);
  emit(EVENTS.LOGOUT, {});
}

export async function refreshUser() {
  const { data } = await api.get('/auth/session');
  setState('session.user', data.user);
  setState('session.expiresAt', data.expiresAt);
}
