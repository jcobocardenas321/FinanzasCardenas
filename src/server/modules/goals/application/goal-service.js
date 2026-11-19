// [A.1] Metas de ahorro con seguimiento. Los aportes son informativos: NO alteran el Balance Total
// (decisión de la ambigüedad #8, opción A). El estado "completed" se sincroniza solo.
import { conflict, notFound } from '../../../shared/errors.js';
import { daysBetween, localIsoDate } from '../../../shared/dates.js';
import { buildMeta, parsePaging } from '../../../shared/pagination.js';
import { validate } from '../../../shared/validation.js';
import { progressOf, syncedStatus } from '../domain/goal-progress.js';

const MAX = 9_999_999_999_999;
const SORTABLE = { name: 'g.name COLLATE NOCASE', target_date: 'g.target_date', target_amount_cop: 'g.target_amount_cop', created_at: 'g.created_at', status: 'g.status' };

export function createGoalService({ repo, unitOfWork, clock }) {
  const iso = () => clock.now().toISOString();
  const today = () => localIsoDate(clock.now());
  const mustFind = (id) => repo.findById(id) ?? (() => { throw notFound('Meta no encontrada'); })();

  function present(g) {
    const daysLeft = g.targetDate ? daysBetween(today(), g.targetDate) : null;
    return { ...g, ...progressOf(g.targetAmountCop, g.savedCop), daysLeft, isOverdue: g.status === 'active' && daysLeft !== null && daysLeft < 0 };
  }
  const sync = (id) => {
    const g = mustFind(id);
    const next = syncedStatus(g, g.savedCop);
    if (next !== g.status) repo.setStatus(id, next, iso());
  };

  return {
    list(query) {
      const paging = parsePaging(query, { sortable: SORTABLE, defaultSort: 'created_at:desc' });
      const f = validate(query, { status: { type: 'enum', values: ['active', 'completed', 'archived'] } }, { partial: true });
      const { rows, total } = repo.list({ status: f.status, ...paging });
      return { data: rows.map(present), meta: buildMeta(total, paging.page, paging.pageSize) };
    },
    get: (id) => ({ ...present(mustFind(id)), contributions: repo.contributions(id) }),

    create(actor, input) {
      const d = validate(input, { name: { type: 'string', max: 80 }, targetAmountCop: { type: 'int', min: 1, max: MAX }, targetDate: { type: 'date', nullable: true, required: false } });
      const id = repo.insert({ ...d, userId: actor.id, now: iso() });
      return present(repo.findById(id));
    },

    /** `status` solo admite active|archived: "completed" es automático según el progreso. */
    update(id, input) {
      mustFind(id);
      const d = validate(input, { name: { type: 'string', max: 80 }, targetAmountCop: { type: 'int', min: 1, max: MAX }, targetDate: { type: 'date', nullable: true }, status: { type: 'enum', values: ['active', 'archived'] } }, { partial: true });
      return unitOfWork.run(() => {
        repo.update(id, d, iso());
        sync(id);
        return present(repo.findById(id));
      });
    },

    remove(id) {
      mustFind(id);
      repo.delete(id); // los aportes se eliminan en cascada
    },

    addContribution(actor, goalId, input) {
      const goal = mustFind(goalId);
      if (goal.status === 'archived') throw conflict('La meta está archivada. Reactívala para registrar aportes.', 'GOAL_ARCHIVED');
      const d = validate(input, { amountCop: { type: 'int', min: 1, max: MAX }, contributedOn: { type: 'date' } });
      return unitOfWork.run(() => {
        const cid = repo.addContribution({ goalId, ...d, userId: actor.id, now: iso() });
        sync(goalId);
        return { goal: present(repo.findById(goalId)), contribution: repo.findContribution(cid) };
      });
    },

    removeContribution(goalId, contributionId) {
      mustFind(goalId);
      const c = repo.findContribution(contributionId);
      if (!c || c.goalId !== goalId) throw notFound('Aporte no encontrado');
      return unitOfWork.run(() => {
        repo.deleteContribution(contributionId);
        sync(goalId);
        return present(repo.findById(goalId));
      });
    },
  };
}
