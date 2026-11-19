// [A.1] Progreso de una meta de ahorro (seguimiento visual). Funciones puras.
export const progressOf = (targetAmountCop, savedCop) => ({
  savedCop,
  remainingCop: Math.max(0, targetAmountCop - savedCop),
  percent: Math.round((savedCop / targetAmountCop) * 1000) / 10, // puede superar 100; la UI lo limita
});

/** Estado automático: completada al alcanzar la meta, activa si baja; `archived` nunca cambia sola. */
export const syncedStatus = (goal, savedCop) => (goal.status === 'archived' ? 'archived' : savedCop >= goal.targetAmountCop ? 'completed' : 'active');
