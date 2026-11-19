// [D.12] Tokens de sesión opacos: el cliente recibe el token; la BD solo guarda su SHA-256.
import { createHash, randomBytes } from 'node:crypto';

export const hashToken = (token) => createHash('sha256').update(token).digest('hex');

export function createTokenService() {
  return {
    generate() {
      const token = randomBytes(32).toString('base64url');
      return { token, id: hashToken(token) };
    },
    idOf: hashToken,
  };
}
