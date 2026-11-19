// [D.12] Hash de contraseñas con scrypt (node:crypto). Formato: scrypt$N$r$p$salt_b64$hash_b64
import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';

const derive = (password, salt, { N, r, p, keyLen }) =>
  new Promise((resolve, reject) => {
    scrypt(password.normalize('NFKC'), salt, keyLen, { N, r, p, maxmem: 256 * N * r }, (err, key) => (err ? reject(err) : resolve(key)));
  });

/** @param {{ N?: number, r?: number, p?: number, keyLen?: number }} [options]  N bajo solo en pruebas. */
export function createScryptHasher({ N = 2 ** 15, r = 8, p = 1, keyLen = 64 } = {}) {
  let dummy;
  const hash = async (password) => {
    const salt = randomBytes(16);
    const key = await derive(password, salt, { N, r, p, keyLen });
    return `scrypt$${N}$${r}$${p}$${salt.toString('base64')}$${key.toString('base64')}`;
  };
  const verify = async (password, stored) => {
    const parts = typeof stored === 'string' ? stored.split('$') : [];
    if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
    const [, n, rr, pp, saltB64, hashB64] = parts;
    const expected = Buffer.from(hashB64, 'base64');
    const params = { N: Number(n), r: Number(rr), p: Number(pp), keyLen: expected.length };
    if (![params.N, params.r, params.p].every(Number.isSafeInteger) || expected.length === 0) return false;
    try {
      const actual = await derive(password, Buffer.from(saltB64, 'base64'), params);
      return timingSafeEqual(actual, expected);
    } catch {
      return false;
    }
  };
  return {
    hash,
    verify,
    /** Gasta el mismo tiempo que una verificación real (usuario inexistente) para no filtrar su existencia. */
    async verifyDummy(password) {
      dummy ??= await hash(randomBytes(12).toString('hex'));
      await verify(password, dummy);
      return false;
    },
  };
}
