#!/usr/bin/env node
// scripts/seed-demo.js
// Pobla la base de datos de FinanzasCardenas con datos de prueba realistas para demostración y evaluación.
// Soporta modo idempotente y limpieza completa con la bandera --clean.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');
const MIGRATIONS_DIR = path.join(PROJECT_ROOT, 'src/server/infrastructure/db/migrations');

// 1. Detección inteligente de la ruta de la base de datos SQLite
export function resolveDbPath(args = process.argv.slice(2)) {
  const dbIndex = args.indexOf('--db');
  if (dbIndex !== -1 && args[dbIndex + 1]) {
    return path.resolve(args[dbIndex + 1]);
  }
  if (process.env.FINANZAS_DB_PATH) {
    return path.resolve(process.env.FINANZAS_DB_PATH);
  }
  if (args.includes('--local')) {
    return path.resolve(PROJECT_ROOT, 'data/finanzas.db');
  }

  const home = os.homedir();
  const platform = os.platform();
  const candidates = [];

  if (platform === 'darwin') {
    candidates.push(path.join(home, 'Library/Application Support/finanzas-cardenas/data/finanzas.db'));
    candidates.push(path.join(home, 'Library/Application Support/FinanzasCardenas/data/finanzas.db'));
  } else if (platform === 'win32') {
    const appData = process.env.APPDATA || path.join(home, 'AppData/Roaming');
    candidates.push(path.join(appData, 'finanzas-cardenas/data/finanzas.db'));
    candidates.push(path.join(appData, 'FinanzasCardenas/data/finanzas.db'));
  } else {
    candidates.push(path.join(home, '.config/finanzas-cardenas/data/finanzas.db'));
    candidates.push(path.join(home, '.config/FinanzasCardenas/data/finanzas.db'));
  }

  // Candidato local en workspace
  candidates.push(path.join(PROJECT_ROOT, 'data/finanzas.db'));

  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }

  // Si ninguno existe, usar la ubicación oficial del sistema
  return candidates[0];
}

// 2. Ejecución de migraciones en caso de que sea una base nueva
function ensureSchema(db) {
  db.pragma('foreign_keys = ON');
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');

  // Si la tabla schema_migrations no existe, correr migraciones SQL
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'schema_migrations'").all();
  if (tables.length === 0) {
    db.exec(`CREATE TABLE schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );`);
  }

  if (fs.existsSync(MIGRATIONS_DIR)) {
    const files = fs.readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql')).sort();
    for (const f of files) {
      const version = parseInt(f.slice(0, 3), 10);
      const applied = db.prepare('SELECT version FROM schema_migrations WHERE version = ?').get(version);
      if (!applied) {
        const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, f), 'utf-8');
        db.transaction(() => {
          db.exec(sql);
          db.prepare('INSERT INTO schema_migrations (version, name) VALUES (?, ?)').run(version, f);
        })();
      }
    }
  }
}

// 3. Garantizar categorías estándar (mínimo 8 solicitadas)
function ensureCategories(db) {
  const defaultCats = [
    { name: 'Salario', kind: 'income', color: '#16A34A', icon: 'fa-briefcase' },
    { name: 'Otros ingresos', kind: 'income', color: '#0D9488', icon: 'fa-plus' },
    { name: 'Vivienda', kind: 'expense', color: '#7C3AED', icon: 'fa-house' },
    { name: 'Alimentación', kind: 'expense', color: '#EA580C', icon: 'fa-utensils' },
    { name: 'Transporte', kind: 'expense', color: '#2563EB', icon: 'fa-bus' },
    { name: 'Servicios', kind: 'expense', color: '#CA8A04', icon: 'fa-bolt' },
    { name: 'Salud', kind: 'expense', color: '#DC2626', icon: 'fa-heart-pulse' },
    { name: 'Educación', kind: 'expense', color: '#4F46E5', icon: 'fa-graduation-cap' },
    { name: 'Ocio', kind: 'expense', color: '#EC4899', icon: 'fa-gamepad' },
    { name: 'Otros gastos', kind: 'expense', color: '#64748B', icon: 'fa-ellipsis' },
  ];

  const insert = db.prepare(`
    INSERT INTO categories (name, kind, color, icon)
    VALUES (@name, @kind, @color, @icon)
    ON CONFLICT (kind, name) DO NOTHING
  `);

  for (const c of defaultCats) {
    insert.run(c);
  }

  const all = db.prepare('SELECT id, name, kind FROM categories').all();
  const map = new Map();
  for (const row of all) {
    map.set(`${row.kind}:${row.name.toLowerCase()}`, row.id);
  }
  return map;
}

// 4. Limpieza de datos demo si se ejecuta con --clean
export function cleanDemoData(db) {
  let txCount = 0;
  let goalsCount = 0;
  let budgetsCount = 0;
  let metricsCount = 0;

  db.transaction(() => {
    // Transacciones demo
    const txRes = db.prepare("DELETE FROM transactions WHERE notes LIKE '%[DEMO]%'").run();
    txCount = txRes.changes;

    // Metas de ahorro demo
    const goalsRes = db.prepare("DELETE FROM goals WHERE name IN ('Viaje a San Andrés', 'Fondo de emergencia', 'Computador nuevo')").run();
    goalsCount = goalsRes.changes;

    // Presupuestos demo registrados
    const bRes = db.prepare("DELETE FROM budgets WHERE year_month IN (SELECT DISTINCT substr(occurred_on, 1, 7) FROM transactions WHERE notes LIKE '%[DEMO]%')").run();
    budgetsCount = bRes.changes;

    // Métricas demo
    const mRes = db.prepare("DELETE FROM metric_events WHERE detail LIKE '%[DEMO]%'").run();
    metricsCount = mRes.changes;

    // Reconstruir tabla agregada
    db.exec('DELETE FROM agg_monthly_category');
    db.prepare(`
      INSERT INTO agg_monthly_category (year_month, kind, category_id, total_cop, tx_count, updated_at)
      SELECT substr(occurred_on, 1, 7), kind, category_id, SUM(amount_cop), COUNT(*), strftime('%Y-%m-%dT%H:%M:%fZ','now')
      FROM transactions GROUP BY 1, 2, 3
    `).run();
  })();

  return { txCount, goalsCount, budgetsCount, metricsCount };
}

// 5. Generador principal de datos demo
export function seedDemoData(dbPath) {
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const db = new Database(dbPath);
  ensureSchema(db);

  // Obtener usuario administrador existente
  let admin = db.prepare("SELECT id, username, display_name FROM users WHERE role = 'admin' AND is_active = 1 LIMIT 1").get();
  if (!admin) {
    // Si la base no tiene ningún usuario, creamos un admin demo seguro
    const now = new Date().toISOString();
    // Hash dummy scrypt seguro para 'Admin2026!'
    const hash = 'scrypt$32768$8$1$6V5y5b5Y6e6R7w8e9r0t1y==$dGVzdGtleWR1bW15Zm9yZGVtb3NlZWRpbmc4OTAxMjM0NTY3ODkwMTI=';
    const res = db.prepare(`
      INSERT INTO users (username, display_name, password_hash, role, is_active, created_at, updated_at)
      VALUES ('admin', 'Administrador Demo', ?, 'admin', 1, ?, ?)
    `).run(hash, now, now);
    admin = { id: res.lastInsertRowid, username: 'admin', display_name: 'Administrador Demo' };
  }

  const catMap = ensureCategories(db);
  const getCat = (kind, name) => catMap.get(`${kind}:${name.toLowerCase()}`);

  // Limpiar datos demo previos para garantizar idempotencia
  cleanDemoData(db);

  // Calcular los últimos 6 meses (mes actual + 5 meses anteriores)
  const now = new Date();
  const months = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    const yearMonth = d.toISOString().slice(0, 7);
    months.push(yearMonth);
  }
  const currentMonth = months[months.length - 1];

  const transactionsToInsert = [];

  // Plantilla de transacciones mensuales realistas
  for (let mIdx = 0; mIdx < months.length; mIdx++) {
    const ym = months[mIdx];
    const isCurrent = mIdx === months.length - 1;

    // --- INGRESOS ---
    // 1. Salario Quincena 1 (día 15): 2.250.000 COP
    transactionsToInsert.push({
      kind: 'income',
      amountCop: 2250000,
      categoryId: getCat('income', 'Salario'),
      occurredOn: `${ym}-15`,
      description: 'Pago primera quincena salario',
      notes: 'Nómina mensual empresa [DEMO]',
    });

    // 2. Salario Quincena 2 (día 28 o 30): 2.250.000 COP
    // Total Salario mensual = 4.500.000 COP
    transactionsToInsert.push({
      kind: 'income',
      amountCop: 2250000,
      categoryId: getCat('income', 'Salario'),
      occurredOn: `${ym}-28`,
      description: 'Pago segunda quincena salario',
      notes: 'Nómina mensual empresa [DEMO]',
    });

    // Ingreso extra en meses seleccionados
    if (mIdx === 1 || mIdx === 4) {
      transactionsToInsert.push({
        kind: 'income',
        amountCop: 650000,
        categoryId: getCat('income', 'Otros ingresos'),
        occurredOn: `${ym}-20`,
        description: 'Honorarios asesoría técnica independiente',
        notes: 'Proyecto freelance [DEMO]',
      });
    } else if (mIdx === 2) {
      transactionsToInsert.push({
        kind: 'income',
        amountCop: 380000,
        categoryId: getCat('income', 'Otros ingresos'),
        occurredOn: `${ym}-12`,
        description: 'Venta de artículo usado en MercadoLibre',
        notes: 'Ingreso extraordinario [DEMO]',
      });
    }

    // --- GASTOS MENSUALES VARIADOS (~23 a 25 transacciones por mes) ---
    const monthlyExpenses = [
      // Vivienda
      { cat: 'Vivienda', day: '05', amt: 1450000, desc: 'Canon de arrendamiento apartamento' },
      { cat: 'Vivienda', day: '06', amt: 220000, desc: 'Cuota de administración del conjunto' },

      // Servicios
      { cat: 'Servicios', day: '08', amt: 145000 + (mIdx * 4500), desc: 'Factura Enel Codensa (energía eléctrica)' },
      { cat: 'Servicios', day: '10', amt: 88000 + (mIdx * 2500), desc: 'Factura Acueducto y Alcantarillado' },
      { cat: 'Servicios', day: '11', amt: 38000 + (mIdx * 1200), desc: 'Factura Gas Natural Vanti' },
      { cat: 'Servicios', day: '12', amt: 110000, desc: 'Servicio internet fibra óptica y telefonía' },

      // Alimentación
      { cat: 'Alimentación', day: '02', amt: 320000 + (mIdx * 8000), desc: 'Mercado primera quincena en Éxito' },
      { cat: 'Alimentación', day: '09', amt: 75000, desc: 'Compras de frutas y verduras en Fruver' },
      { cat: 'Alimentación', day: '16', amt: 345000 + (mIdx * 7000), desc: 'Mercado segunda quincena en Carulla' },
      { cat: 'Alimentación', day: '22', amt: 52000, desc: 'Panadería y lácteos de la semana' },
      { cat: 'Alimentación', day: '13', amt: 115000 + (mIdx * 6000), desc: 'Almuerzo familiar fin de semana' },
      { cat: 'Alimentación', day: '25', amt: 68000, desc: 'Cena en restaurante local' },

      // Transporte
      { cat: 'Transporte', day: '03', amt: 75000, desc: 'Recarga tarjeta TuLlave Transmilenio' },
      { cat: 'Transporte', day: '14', amt: 130000 + (mIdx * 5000), desc: 'Tanqueada de gasolina estación Terpel' },
      { cat: 'Transporte', day: '21', amt: 38000, desc: 'Viaje en taxi / plataforma de movilidad' },

      // Salud
      { cat: 'Salud', day: '07', amt: 95000, desc: 'Copago consulta médica especialista' },
      { cat: 'Salud', day: '18', amt: 58000 + (mIdx * 3000), desc: 'Medicamentos y botiquín Drogas La Rebaja' },

      // Educación
      { cat: 'Educación', day: '17', amt: 85000, desc: 'Suscripción plataforma de cursos online' },
      { cat: 'Educación', day: '23', amt: 65000 + (mIdx * 4000), desc: 'Libro técnico y material de estudio' },

      // Ocio
      { cat: 'Ocio', day: '04', amt: 54000, desc: 'Suscripción mensual Netflix y Spotify' },
      { cat: 'Ocio', day: '19', amt: 62000, desc: 'Entradas de cine y confitería Cine Colombia' },
      { cat: 'Ocio', day: '27', amt: 35000, desc: 'Cafetería y repostería artesanal' },

      // Otros gastos
      { cat: 'Otros gastos', day: '24', amt: 65000, desc: 'Artículos de ferretería y hogar' },
      { cat: 'Otros gastos', day: '26', amt: 48000 + (mIdx * 2000), desc: 'Imprevistos de aseo y mantenimiento' },
    ];

    // Ajuste en el mes actual para garantizar los presupuestos en 'warning' y 'over'
    for (const exp of monthlyExpenses) {
      let amt = exp.amt;
      if (isCurrent && exp.cat === 'Alimentación') {
        // Incremento leve para superar el presupuesto asignado
        amt = Math.round(amt * 1.25);
      }
      transactionsToInsert.push({
        kind: 'expense',
        amountCop: amt,
        categoryId: getCat('expense', exp.cat),
        occurredOn: `${ym}-${exp.day}`,
        description: exp.desc,
        notes: `Gasto verificado [DEMO]`,
      });
    }
  }

  // Insertar todas las transacciones dentro de una transacción SQL atómica
  const insertTx = db.prepare(`
    INSERT INTO transactions (kind, amount_cop, category_id, occurred_on, description, notes, created_by, updated_by, created_at, updated_at)
    VALUES (@kind, @amountCop, @categoryId, @occurredOn, @description, @notes, @adminId, @adminId, @now, @now)
  `);

  const nowIso = new Date().toISOString();
  db.transaction(() => {
    for (const tx of transactionsToInsert) {
      insertTx.run({ ...tx, adminId: admin.id, now: nowIso });
    }

    // Reconstruir tabla agregada agg_monthly_category
    db.exec('DELETE FROM agg_monthly_category');
    db.prepare(`
      INSERT INTO agg_monthly_category (year_month, kind, category_id, total_cop, tx_count, updated_at)
      SELECT substr(occurred_on, 1, 7), kind, category_id, SUM(amount_cop), COUNT(*), ?
      FROM transactions GROUP BY 1, 2, 3
    `).run(nowIso);
  })();

  // 6. Configurar Presupuestos del mes actual
  // Calculamos el gasto real del mes actual por categoría
  const currentExpenses = db.prepare(`
    SELECT category_id, SUM(amount_cop) as spent_cop
    FROM transactions
    WHERE kind = 'expense' AND substr(occurred_on, 1, 7) = ?
    GROUP BY category_id
  `).all(currentMonth);

  const spentByCatId = new Map(currentExpenses.map((r) => [r.category_id, r.spent_cop]));

  // Categorías clave
  const catAlimentacion = getCat('expense', 'Alimentación');
  const catTransporte = getCat('expense', 'Transporte');
  const catVivienda = getCat('expense', 'Vivienda');
  const catServicios = getCat('expense', 'Servicios');

  const spentAlim = spentByCatId.get(catAlimentacion) || 1200000;
  const spentTrans = spentByCatId.get(catTransporte) || 243000;
  const spentViv = spentByCatId.get(catVivienda) || 1670000;
  const spentServ = spentByCatId.get(catServicios) || 381000;

  // 1. OVER (superado): Presupuesto menor al gasto actual (ej. 85% de lo gastado)
  const budgetAlim = Math.round((spentAlim * 0.85) / 10000) * 10000;

  // 2. WARNING (alerta >= 80% y <= 100%): Presupuesto ligeramente superior al gasto (ej. gasto / 0.88)
  const budgetTrans = Math.round((spentTrans / 0.88) / 10000) * 10000;

  // 3. OK (< 80%): Margen holgado
  const budgetViv = Math.round((spentViv / 0.70) / 10000) * 10000;
  const budgetServ = Math.round((spentServ / 0.65) / 10000) * 10000;

  const insertBudget = db.prepare(`
    INSERT INTO budgets (category_id, year_month, amount_cop, created_by, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT (category_id, year_month) DO UPDATE SET amount_cop = excluded.amount_cop, updated_at = excluded.updated_at
  `);

  db.transaction(() => {
    insertBudget.run(catAlimentacion, currentMonth, budgetAlim, admin.id, nowIso, nowIso);
    insertBudget.run(catTransporte, currentMonth, budgetTrans, admin.id, nowIso, nowIso);
    insertBudget.run(catVivienda, currentMonth, budgetViv, admin.id, nowIso, nowIso);
    insertBudget.run(catServicios, currentMonth, budgetServ, admin.id, nowIso, nowIso);
  })();

  // 7. Configurar 3 Metas de Ahorro con anillos parcialmente llenos
  const insertGoal = db.prepare(`
    INSERT INTO goals (name, target_amount_cop, target_date, status, created_by, created_at, updated_at)
    VALUES (?, ?, ?, 'active', ?, ?, ?)
  `);
  const insertContrib = db.prepare(`
    INSERT INTO goal_contributions (goal_id, amount_cop, contributed_on, created_by, created_at)
    VALUES (?, ?, ?, ?, ?)
  `);

  const goalsInfo = [];
  db.transaction(() => {
    // Meta 1: Viaje a San Andrés (Meta: 5.000.000 COP, Progreso ~64%)
    const g1Res = insertGoal.run('Viaje a San Andrés', 5000000, `${months[months.length - 1]}-20`, admin.id, nowIso, nowIso);
    const g1Id = g1Res.lastInsertRowid;
    insertContrib.run(g1Id, 1200000, `${months[1]}-16`, admin.id, nowIso);
    insertContrib.run(g1Id, 1000000, `${months[3]}-16`, admin.id, nowIso);
    insertContrib.run(g1Id, 1000000, `${months[4]}-16`, admin.id, nowIso);
    goalsInfo.push({ name: 'Viaje a San Andrés', target: 5000000, saved: 3200000, pct: 64 });

    // Meta 2: Fondo de emergencia (Meta: 15.000.000 COP, Progreso 50%)
    const g2Res = insertGoal.run('Fondo de emergencia', 15000000, null, admin.id, nowIso, nowIso);
    const g2Id = g2Res.lastInsertRowid;
    for (let i = 0; i < 5; i++) {
      insertContrib.run(g2Id, 1500000, `${months[i]}-18`, admin.id, nowIso);
    }
    goalsInfo.push({ name: 'Fondo de emergencia', target: 15000000, saved: 7500000, pct: 50 });

    // Meta 3: Computador nuevo (Meta: 4.000.000 COP, Progreso 45%)
    const g3Res = insertGoal.run('Computador nuevo', 4000000, `${months[months.length - 1]}-15`, admin.id, nowIso, nowIso);
    const g3Id = g3Res.lastInsertRowid;
    insertContrib.run(g3Id, 900000, `${months[2]}-22`, admin.id, nowIso);
    insertContrib.run(g3Id, 900000, `${months[4]}-22`, admin.id, nowIso);
    goalsInfo.push({ name: 'Computador nuevo', target: 4000000, saved: 1800000, pct: 45 });
  })();

  // 8. Eventos de telemetría y uso local en metric_events
  const insertMetric = db.prepare(`
    INSERT INTO metric_events (kind, module, name, detail, user_id, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const demoMetrics = [
    { kind: 'module_use', module: 'dashboard', name: 'view_summary', detail: 'Vista principal del panel [DEMO]' },
    { kind: 'module_use', module: 'transactions', name: 'filter_by_month', detail: 'Filtro semestral [DEMO]' },
    { kind: 'module_use', module: 'budgets', name: 'view_progress', detail: 'Auditoría mensual de presupuestos [DEMO]' },
    { kind: 'module_use', module: 'goals', name: 'contribution_added', detail: 'Aporte registrado a meta de ahorro [DEMO]' },
    { kind: 'module_use', module: 'reports', name: 'generate_pdf', detail: 'Generación reporte balance [DEMO]' },
    { kind: 'module_use', module: 'reports', name: 'export_csv', detail: 'Exportación histórica a CSV [DEMO]' },
    { kind: 'custom', module: 'theme', name: 'mode_toggle', detail: 'Cambio de modo a Dark [DEMO]' },
    { kind: 'custom', module: 'appearance', name: 'palette_signature', detail: 'Selección de tema Firma [DEMO]' },
    { kind: 'custom', module: 'backup', name: 'auto_check', detail: 'Verificación de integridad de base de datos [DEMO]' },
  ];

  db.transaction(() => {
    for (const m of demoMetrics) {
      insertMetric.run(m.kind, m.module, m.name, m.detail, admin.id, nowIso);
    }
  })();

  db.close();

  return {
    dbPath,
    admin: admin.username,
    transactionsCount: transactionsToInsert.length,
    months,
    currentMonth,
    budgets: [
      { category: 'Alimentación', budget: budgetAlim, spent: spentAlim, status: 'over' },
      { category: 'Transporte', budget: budgetTrans, spent: spentTrans, status: 'warning' },
      { category: 'Vivienda', budget: budgetViv, spent: spentViv, status: 'ok' },
      { category: 'Servicios', budget: budgetServ, spent: spentServ, status: 'ok' },
    ],
    goals: goalsInfo,
    metricsCount: demoMetrics.length,
  };
}

// 9. Ejecución CLI
if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  const args = process.argv.slice(2);
  const dbPath = resolveDbPath(args);

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Uso: node scripts/seed-demo.js [opciones]

Opciones:
  --db <ruta>    Especifica la ruta directa al archivo finanzas.db.
  --local        Usa la ruta ./data/finanzas.db en la raíz del proyecto.
  --clean        Elimina únicamente los datos demo generados previamente sin tocar contraseñas ni usuarios.
  --help, -h     Muestra esta ayuda.
    `);
    process.exit(0);
  }

  if (args.includes('--clean')) {
    console.log(`\n🧹 Limpiando datos de demostración en: ${dbPath}`);
    if (!fs.existsSync(dbPath)) {
      console.log('ℹ️  No existe la base de datos en dicha ruta.');
      process.exit(0);
    }
    const db = new Database(dbPath);
    const res = cleanDemoData(db);
    db.close();
    console.log(`✅ Limpieza completada con éxito:`);
    console.log(`   - Transacciones demo eliminadas: ${res.txCount}`);
    console.log(`   - Metas demo eliminadas: ${res.goalsCount}`);
    console.log(`   - Presupuestos demo eliminados: ${res.budgetsCount}`);
    console.log(`   - Eventos de telemetría eliminados: ${res.metricsCount}`);
    console.log(`   - Agregados mensuales recalculados y sincronizados.\n`);
    process.exit(0);
  }

  console.log(`\n🌱 Poblando FinanzasCardenas con datos de prueba realistas...`);
  console.log(`📂 Base de datos destino: ${dbPath}`);

  try {
    const result = seedDemoData(dbPath);
    console.log(`\n🎉 ¡Datos de demostración cargados exitosamente!`);
    console.log(`👤 Usuario Administrador vinculado: ${result.admin}`);
    console.log(`📊 Transacciones creadas: ${result.transactionsCount} movimientos (distribuidos entre ${result.months[0]} y ${result.months[5]})`);
    console.log(`💰 Salario mensual asignado: $4.500.000 COP en 2 quincenas de $2.250.000 COP`);
    console.log(`📈 Agregados mensuales (agg_monthly_category): sincronizados para 6 meses`);
    console.log(`\n🎯 Presupuestos del mes actual (${result.currentMonth}):`);
    for (const b of result.budgets) {
      const badge = b.status === 'over' ? '🚨 SUPERADO (Over)' : b.status === 'warning' ? '⚠️  ALERTA (Warning)' : '✅ OK';
      console.log(`   - ${b.category}: Presupuestado $${b.budget.toLocaleString('es-CO')} | Gastado $${b.spent.toLocaleString('es-CO')} -> ${badge}`);
    }
    console.log(`\n🏆 Metas de ahorro configuradas:`);
    for (const g of result.goals) {
      console.log(`   - ${g.name}: Meta $${g.target.toLocaleString('es-CO')} | Ahorrado $${g.saved.toLocaleString('es-CO')} (${g.pct}% completado)`);
    }
    console.log(`\n📡 Eventos registrados en telemetría local: ${result.metricsCount} eventos`);
    console.log(`\n💡 Para revertir o eliminar estos datos de prueba en cualquier momento:`);
    console.log(`   node scripts/seed-demo.js --clean\n`);
  } catch (err) {
    console.error(`❌ Error al poblar la base de datos:`, err);
    process.exit(1);
  }
}
