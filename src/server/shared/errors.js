// [B.6] Errores de aplicación con código estable y estado HTTP (contrato de errores de la API).
export class AppError extends Error {
  constructor(code, message, { status = 500, fields, details, cause } = {}) {
    super(message, { cause });
    this.name = 'AppError';
    this.code = code;
    this.status = status;
    this.fields = fields;
    this.details = details;
  }
}

export const validationError = (fields, message = 'Hay campos inválidos') =>
  new AppError('VALIDATION_ERROR', message, { status: 400, fields });
export const unauthenticated = (message = 'Debes iniciar sesión', code = 'UNAUTHENTICATED') =>
  new AppError(code, message, { status: 401 });
export const forbidden = (message = 'No tienes permiso para esta acción', code = 'FORBIDDEN') =>
  new AppError(code, message, { status: 403 });
export const notFound = (message = 'No encontrado') => new AppError('NOT_FOUND', message, { status: 404 });
export const conflict = (message, code = 'CONFLICT', fields) => new AppError(code, message, { status: 409, fields });
export const accountLocked = (message = 'Cuenta bloqueada. Solicita el desbloqueo a un administrador.') =>
  new AppError('ACCOUNT_LOCKED', message, { status: 423 });
