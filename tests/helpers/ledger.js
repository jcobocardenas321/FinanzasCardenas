// Libro contable de ejemplo para pruebas de la Fase 2b (reloj fijo: 2026-11-12; mes actual = 2026-11).
// Ingresos: salario 3.000.000 en jun, jul, sep, oct y nov (agosto SIN movimientos).
// Gastos: jun/jul/sep/oct = 600.000 vivienda + 400.000 alimentación (1.000.000); nov = 300.000 vivienda.
// Totales: ingresos 15.000.000 · gastos 4.300.000 · balance 10.700.000 · ahorro de nov 2.700.000.
import { createTestContainer, setupAdmin } from './fixtures.js';

export async function seedLedger(options = {}) {
  const c = createTestContainer(options);
  const { admin } = await setupAdmin(c);
  const cat = (name) => c.services.categories.list({ q: name }).data[0].id;
  const ids = { salario: cat('Salario'), otrosIng: cat('Otros ingresos'), vivienda: cat('Vivienda'), comida: cat('Alimentación'), transporte: cat('Transporte') };
  const add = (kind, categoryId, amountCop, occurredOn, description, notes) =>
    c.services.transactions.create(admin, { kind, categoryId, amountCop, occurredOn, description, ...(notes ? { notes } : {}) });
  for (const m of ['2026-06', '2026-07', '2026-09', '2026-10']) {
    add('income', ids.salario, 3_000_000, `${m}-01`, `Nómina ${m}`, m === '2026-06' ? 'primera' : undefined);
    add('expense', ids.vivienda, 600_000, `${m}-05`, `Arriendo ${m}`, m === '2026-10' ? 'octubre' : undefined);
    add('expense', ids.comida, 400_000, `${m}-10`, `Mercado ${m}`);
  }
  add('income', ids.salario, 3_000_000, '2026-11-01', 'Nómina 2026-11');
  add('expense', ids.vivienda, 300_000, '2026-11-05', 'Arriendo 2026-11');
  return { c, admin, ids, add };
}
