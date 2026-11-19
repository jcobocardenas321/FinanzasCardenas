// [D.12] Reloj inyectable (permite probar expiración e inactividad sin esperar).
export const systemClock = { now: () => new Date(), sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)) };
