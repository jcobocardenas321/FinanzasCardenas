// [D.12] Política de contraseñas "Fuerte" (supuesto aprobado en Fase 0): >= 12 caracteres, mayúscula,
// minúscula, dígito y símbolo; no puede contener el nombre de usuario. Función pura.
export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_MAX_LENGTH = 128;

/** @returns {string[]} violaciones (vacío = válida) */
export function checkPassword(password, { username } = {}) {
  const problems = [];
  if (typeof password !== 'string') return ['Debe ser texto'];
  if (password.length < PASSWORD_MIN_LENGTH) problems.push(`Mínimo ${PASSWORD_MIN_LENGTH} caracteres`);
  if (password.length > PASSWORD_MAX_LENGTH) problems.push(`Máximo ${PASSWORD_MAX_LENGTH} caracteres`);
  if (!/\p{Ll}/u.test(password)) problems.push('Falta una letra minúscula');
  if (!/\p{Lu}/u.test(password)) problems.push('Falta una letra mayúscula');
  if (!/\p{N}/u.test(password)) problems.push('Falta un dígito');
  if (!/[^\p{L}\p{N}]/u.test(password)) problems.push('Falta un símbolo');
  if (username && username.length >= 3 && password.toLowerCase().includes(username.toLowerCase())) {
    problems.push('No debe contener el nombre de usuario');
  }
  return problems;
}
