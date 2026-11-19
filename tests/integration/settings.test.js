// [A.1] Configuración del hogar. Nunca debe exponer datos sensibles de app_settings.
import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, test } from 'node:test';
import { createSqliteSettingsRepository } from '../../src/server/modules/settings/infrastructure/sqlite-settings-repository.js';
import { createTestContainer, rejects, setupAdmin } from '../helpers/fixtures.js';

describe('settings', () => {
  let c, s;
  beforeEach(async () => { c = createTestContainer(); s = c.services.settings; await setupAdmin(c); });
  afterEach(() => c.cleanup());

  test('valores por defecto: hogar "Mi hogar", moneda COP fija y umbral 80 %', () => {
    assert.deepEqual(s.get(), { householdName: 'Mi hogar', currency: 'COP', budgetWarningThresholdPct: 80 });
  });

  test('actualiza parcialmente y persiste', () => {
    assert.equal(s.update({ householdName: '  Casa Cárdenas ' }).householdName, 'Casa Cárdenas');
    assert.equal(s.update({ budgetWarningThresholdPct: 90 }).budgetWarningThresholdPct, 90);
    assert.deepEqual(s.get(), { householdName: 'Casa Cárdenas', currency: 'COP', budgetWarningThresholdPct: 90 });
  });

  test('valida límites; la moneda no es modificable', async () => {
    await rejects(async () => s.update({ budgetWarningThresholdPct: 49 }), { fields: 'budgetWarningThresholdPct' });
    await rejects(async () => s.update({ budgetWarningThresholdPct: 101 }), { fields: 'budgetWarningThresholdPct' });
    await rejects(async () => s.update({ householdName: '' }), { fields: 'householdName' });
    assert.equal(s.update({ currency: 'USD' }).currency, 'COP');
  });

  test('NO filtra el hash de la clave de recuperación y el repositorio solo admite claves de la lista blanca', () => {
    assert.ok(c.db.prepare("SELECT 1 FROM app_settings WHERE key = 'recovery_key_hash'").get(), 'existe en la tabla');
    assert.equal(/recovery|hash/i.test(JSON.stringify(s.get())), false);
    const repo = createSqliteSettingsRepository(c.db);
    assert.throws(() => repo.get('recovery_key_hash'), /no permitida/);
    assert.throws(() => repo.set('recovery_key_hash', 'x', 'now'), /no permitida/);
  });
});
