// [B.6][C.11] Hace cumplir las restricciones de arquitectura de SKILLS.md y de la Fase 2b.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const SERVER = path.join(ROOT, 'src/server');
const MODULES = path.join(SERVER, 'modules');

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : e.name.endsWith('.js') ? [path.join(dir, e.name)] : []));
}
const files = walk(SERVER).map((f) => ({ file: f, rel: path.relative(SERVER, f).replaceAll('\\', '/'), src: fs.readFileSync(f, 'utf8') }));
const moduleOf = (rel) => (rel.startsWith('modules/') ? rel.split('/')[1] : null);

// tabla -> módulos autorizados a consultarla/modificarla
const OWNERS = {
  transactions: ['transactions'],
  budgets: ['budgets'],
  goals: ['goals'],
  goal_contributions: ['goals'],
  metric_events: ['metrics'],
  agg_monthly_category: ['transactions', 'analytics'], // escribe transactions, lee analytics
  sessions: ['auth'],
  users: ['users'],
  app_settings: ['auth', 'settings'],
};

test('cada tabla solo se toca desde el módulo dueño (budgets NO lee transactions)', () => {
  const violations = [];
  for (const [table, owners] of Object.entries(OWNERS)) {
    const re = new RegExp(`\\b(FROM|JOIN|INTO|UPDATE|DELETE\\s+FROM)\\s+${table}\\b`, 'i');
    for (const f of files) {
      if (re.test(f.src) && !owners.includes(moduleOf(f.rel))) violations.push(`${f.rel} accede a "${table}"`);
    }
  }
  assert.deepEqual(violations, []);
});

test('un módulo nunca importa archivos de otro módulo (solo shared y puertos inyectados)', () => {
  const violations = [];
  for (const f of files.filter((x) => moduleOf(x.rel))) {
    for (const m of f.src.matchAll(/from\s+'(\.[^']+)'/g)) {
      const target = path.resolve(path.dirname(f.file), m[1]);
      if (target.startsWith(MODULES + path.sep)) {
        const owner = path.relative(MODULES, target).split(path.sep)[0];
        if (owner !== moduleOf(f.rel)) violations.push(`${f.rel} importa ${path.relative(SERVER, target)}`);
      }
    }
  }
  assert.deepEqual(violations, []);
});

test('el backend y el proyecto no incluyen librerías de PDF, gráficos, WebSockets ni SSE', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  const deps = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies });
  const banned = ['pdfkit', 'pdfmake', 'jspdf', 'puppeteer', 'puppeteer-core', 'playwright', 'html-pdf', 'chart.js', 'chartjs-node-canvas', 'd3', 'plotly.js', 'chartist', 'highcharts', 'echarts', 'ws', 'socket.io', 'eventsource', 'sse', 'better-sse'];
  assert.deepEqual(deps.filter((d) => banned.includes(d)), []);
  const code = files.map((f) => f.src).join('\n');
  assert.equal(/text\/event-stream/.test(code), false, 'sin SSE');
  assert.equal(/new\s+WebSocket|from\s+'ws'|socket\.io/.test(code), false, 'sin WebSockets');
});

test('analytics solo lee la tabla agregada (no consulta transactions)', () => {
  const repo = files.find((f) => f.rel === 'modules/analytics/infrastructure/sqlite-analytics-repository.js');
  assert.ok(repo.src.includes('agg_monthly_category'));
  assert.equal(/\btransactions\b/.test(repo.src.replace(/\/\/.*$/gm, '')), false);
});
