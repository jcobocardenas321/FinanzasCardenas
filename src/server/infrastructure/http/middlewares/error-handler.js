// [B.6] Contrato de errores: { error: { code, message, fields?, details?, requestId } } + mapeo de errores de SQLite.
import { AppError, conflict, notFound, validationError } from '../../../shared/errors.js';

function fromSqlite(err) {
  switch (err.code) {
    case 'SQLITE_CONSTRAINT_UNIQUE':
    case 'SQLITE_CONSTRAINT_PRIMARYKEY':
      return conflict('Ya existe un registro con esos datos');
    case 'SQLITE_CONSTRAINT_FOREIGNKEY':
      return conflict('El registro está en uso o referencia datos inexistentes', 'IN_USE');
    case 'SQLITE_CONSTRAINT_CHECK':
    case 'SQLITE_CONSTRAINT_TRIGGER':
      return validationError(undefined, 'Los datos no cumplen las reglas de integridad');
    default:
      return null;
  }
}

export const notFoundHandler = (req, res, next) => next(notFound('Ruta no encontrada'));

// Express reconoce un manejador de errores por tener 4 parámetros.
// eslint-disable-next-line no-unused-vars
export const errorHandler = (logger, onInternalError) => (err, req, res, _next) => {
  let appError = err instanceof AppError ? err : null;
  if (!appError && err?.type === 'entity.parse.failed') appError = validationError(undefined, 'El cuerpo no es JSON válido');
  if (!appError && err?.type === 'entity.too.large') appError = new AppError('VALIDATION_ERROR', 'El cuerpo es demasiado grande', { status: 413 });
  if (!appError && typeof err?.code === 'string' && err.code.startsWith('SQLITE_CONSTRAINT')) appError = fromSqlite(err);
  if (!appError) {
    logger?.error?.(`[${req.id}] ${req.method} ${req.originalUrl}`, err);
    onInternalError?.({ method: req.method, path: req.originalUrl.split('?')[0], message: String(err?.message ?? err), requestId: req.id, userId: req.auth?.user?.id ?? null });
    appError = new AppError('INTERNAL', 'Error interno del servidor', { status: 500 });
  }
  res.status(appError.status).json({
    error: { code: appError.code, message: appError.message, fields: appError.fields, details: appError.details, requestId: req.id },
  });
};
