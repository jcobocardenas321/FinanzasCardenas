// [D.12] Contraseñas temporales (reset por Admin) que cumplen siempre la política fuerte.
import { randomInt } from 'node:crypto';

const SETS = ['abcdefghijkmnpqrstuvwxyz', 'ABCDEFGHJKLMNPQRSTUVWXYZ', '23456789', '!@#$%*+-=?'];

export function generateTemporaryPassword(length = 16) {
  const chars = SETS.map((s) => s[randomInt(s.length)]);
  const all = SETS.join('');
  while (chars.length < length) chars.push(all[randomInt(all.length)]);
  for (let i = chars.length - 1; i > 0; i -= 1) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}
