// [A.4] Paginación, orden y filtros estándar de los listados. El orden usa lista blanca (sin SQL del cliente).
import { validate } from './validation.js';
import { validationError } from './errors.js';

/**
 * @param {object} query  req.query
 * @param {{ sortable: Record<string,string>, defaultSort: string, defaultPageSize?: number, maxPageSize?: number }} opts
 *   sortable: campo_público -> expresión SQL segura (p. ej. { occurred_on: 't.occurred_on' })
 */
export function parsePaging(query, { sortable, defaultSort, defaultPageSize = 20, maxPageSize = 100 }) {
  const p = validate(
    query,
    {
      page: { type: 'int', coerce: true, min: 1, max: 1_000_000 },
      pageSize: { type: 'int', coerce: true, min: 1, max: maxPageSize },
      sort: { type: 'string', max: 60 },
    },
    { partial: true },
  );
  const page = p.page ?? 1;
  const pageSize = p.pageSize ?? defaultPageSize;
  const [field, dirRaw = 'asc'] = (p.sort ?? defaultSort).split(':');
  const dir = dirRaw.toLowerCase();
  if (!Object.hasOwn(sortable, field) || !['asc', 'desc'].includes(dir)) {
    throw validationError({ sort: `Orden inválido. Campos permitidos: ${Object.keys(sortable).join(', ')}` });
  }
  return { page, pageSize, limit: pageSize, offset: (page - 1) * pageSize, orderBy: `${sortable[field]} ${dir.toUpperCase()}`, sort: `${field}:${dir}` };
}

export const buildMeta = (total, page, pageSize) => ({ page, pageSize, total, totalPages: Math.ceil(total / pageSize) });

/** Escapa % y _ para usar el texto del usuario en LIKE ... ESCAPE '\'. */
export const likePattern = (text) => `%${text.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
