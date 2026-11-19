// [A.1] Caché en memoria del catálogo de categorías (no es persistente: son datos del hogar, no preferencias de UI).
import { EVENTS, on } from './events.js';

let cache = null;
let offMutations = null;

export async function getCategories(api, { force = false } = {}) {
  if (!offMutations) offMutations = on(EVENTS.MUTATED, (d) => { if (d?.entity === 'category') cache = null; });
  if (!cache || force) cache = (await api.get('/categories', { query: { pageSize: 100 } })).data;
  return cache;
}

/** Categorías utilizables para un tipo. `keepId` conserva una categoría archivada ya asignada (al editar). */
export const categoriesFor = (list, kind, keepId = null) => list.filter((c) => (!kind || c.kind === kind) && (!c.isArchived || c.id === keepId));
