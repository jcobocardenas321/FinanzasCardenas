// [B.5] LocalStorage SOLO para preferencias de UI. Lista blanca de claves: cualquier otra lanza error.
// Nunca guarda token, datos financieros ni credenciales (la sesión vive en memoria).
const KEY_RE = /^fc\.ui\.(\d+|anon)\.(sidebar\.(collapsed|pinned)|table\.[a-z0-9_-]+\.(pageSize|sort)|tab\.[a-z0-9_-]+|dashboard\.month|theme|mode|geometry|geo|fontSize|reducedMotion|background|bg|anim|accentColor|language|highContrast|a11y\.[a-zA-Z0-9_-]+)$/;

export function createPrefs(userId, storage = globalThis.localStorage) {
  const prefix = `fc.ui.${userId ?? 'anon'}.`;
  const full = (key) => {
    const k = prefix + key;
    if (!KEY_RE.test(k)) throw new Error(`Clave de preferencia no permitida: ${key}`);
    return k;
  };
  return {
    get(key, fallback = null) {
      const k = full(key);
      try {
        const raw = storage?.getItem(k);
        return raw === null || raw === undefined ? fallback : JSON.parse(raw);
      } catch {
        return fallback;
      }
    },
    set(key, value) {
      const k = full(key);
      if (!['boolean', 'number', 'string'].includes(typeof value) || String(value).length > 100) {
        throw new Error('Las preferencias solo admiten booleanos, números o textos cortos');
      }
      try { storage?.setItem(k, JSON.stringify(value)); } catch { /* almacenamiento no disponible: se ignora */ }
    },
    remove(key) {
      const k = full(key);
      try { storage?.removeItem(k); } catch { /* se ignora */ }
    },
  };
}
