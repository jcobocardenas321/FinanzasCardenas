// [D.13] Reglas de campos compartidas entre módulos (auth y users).
export const usernameRule = {
  type: 'string',
  min: 3,
  max: 32,
  pattern: /^[A-Za-z0-9._-]+$/,
  patternMessage: 'Solo letras, números, punto, guion y guion bajo',
};
export const displayNameRule = { type: 'string', max: 80 };
export const passwordInputRule = { type: 'string', trim: false, max: 128 };
