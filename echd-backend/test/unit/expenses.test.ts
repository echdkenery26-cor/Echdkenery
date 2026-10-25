//echd-backend/test/unit/expenses.test.ts
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { BadRequestException } from '@nestjs/common';
import { buildBalance, ExpensesService } from '../../src/modules/expenses/expenses.service';

const d = (s: string) => new Date(`${s}T00:00:00.000Z`);

describe('buildBalance', () => {
  const r = buildBalance({
    months: ['2026-10', '2026-11'],
    payments: [
      { amountCents: 10000, paidAt: d('2026-10-05') },
      { amountCents: 5000, paidAt: d('2026-11-02') },
    ],
    expenses: [
      { amountCents: 4000, spentAt: d('2026-10-30'), category: 'SALARY' },
      { amountCents: 1500, spentAt: d('2026-11-03'), category: 'SUPPLIES' },
      { amountCents: 500, spentAt: d('2026-11-04'), category: 'SUPPLIES' },
    ],
  });
  it('solde = encaissé − dépensé', () => {
    assert.equal(r.collectedCents, 15000);
    assert.equal(r.spentCents, 6000);
    assert.equal(r.balanceCents, 9000);
    assert.equal(r.expensesCount, 3);
  });
  it('détail par catégorie (les 4 catégories sont toujours présentes)', () => {
    assert.deepEqual(r.byCategory.map((c) => c.category), ['SALARY', 'EQUIPMENT', 'SUPPLIES', 'OTHER']);
    assert.deepEqual(r.byCategory.find((c) => c.category === 'SUPPLIES'), { category: 'SUPPLIES', cents: 2000, count: 2 });
    assert.equal(r.byCategory.find((c) => c.category === 'EQUIPMENT')!.cents, 0);
  });
  it('détail par mois, solde négatif possible', () => {
    assert.deepEqual(r.byMonth[0], { month: '2026-10', collectedCents: 10000, spentCents: 4000, balanceCents: 6000 });
    assert.deepEqual(r.byMonth[1], { month: '2026-11', collectedCents: 5000, spentCents: 2000, balanceCents: 3000 });
    const neg = buildBalance({ months: ['2026-10'], payments: [], expenses: [{ amountCents: 700, spentAt: d('2026-10-01'), category: 'OTHER' }] });
    assert.equal(neg.balanceCents, -700);
  });
});

function makeService(opts: { before?: any; claimCount?: number; opening?: number } = {}) {
  const calls: string[] = [];
  const created: any[] = [];
  const prisma: any = {
    $transaction: async (fn: any) => fn({ counter: { upsert: async () => ({ value: 7 }) }, expense: { create: async ({ data }: any) => (created.push(data), { id: 'e1', ...data }) } }),
    expense: {
      findUnique: async () => opts.before ?? null,
      updateMany: async () => (calls.push('updateMany'), { count: opts.claimCount ?? 1 }),
      findUniqueOrThrow: async () => ({ ...(opts.before ?? {}), id: 'e1' }),
      findMany: async () => [{ amountCents: 300, spentAt: d('2026-10-10'), category: 'OTHER' }],
      aggregate: async () => ({ _sum: { amountCents: 2000 } }),
    },
    payment: {
      findMany: async () => [{ amountCents: 1000, paidAt: d('2026-10-09') }],
      aggregate: async () => ({ _sum: { amountCents: 9000 } }),
    },
  };
  const settings: any = {
    today: async () => d('2026-10-24'),
    get: async () => opts.opening ?? 0,
  };
  const audit: any = { log: async (_a: any, action: string) => calls.push(action) };
  return { svc: new ExpensesService(prisma, settings, audit), calls, created };
}
const actor: any = { id: 'u1', firstName: 'A', lastName: 'B', username: 'ab' };
const base = { category: 'SUPPLIES' as const, label: 'Cahiers', amountCents: 1200, method: 'CASH' as const };

describe('ExpensesService', () => {
  it('crée une dépense numérotée D-AAAA-NNNNN et la journalise', async () => {
    const { svc, calls, created } = makeService();
    const e: any = await svc.create({ ...base, spentAt: '2026-10-20' }, actor);
    assert.equal(e.number, 'D-2026-00007');
    assert.equal(created[0].createdByLabel, 'A B');
    assert.deepEqual(calls, ['CREATE']);
  });
  it('refuse une date future et un objet vide', async () => {
    const { svc } = makeService();
    await assert.rejects(svc.create({ ...base, spentAt: '2026-10-25' }, actor), BadRequestException);
    await assert.rejects(svc.create({ ...base, label: '   ' }, actor), BadRequestException);
  });
  it('refuse de modifier ou d’annuler une dépense déjà annulée', async () => {
    const { svc } = makeService({ before: { id: 'e1', cancelledAt: new Date() } });
    await assert.rejects(svc.update('e1', { label: 'x y' }, actor), BadRequestException);
    await assert.rejects(svc.cancel('e1', { reason: 'erreur' }, actor), BadRequestException);
  });
  it('annulation concurrente : un seul gagnant', async () => {
    const { svc } = makeService({ before: { id: 'e1', cancelledAt: null }, claimCount: 0 });
    await assert.rejects(svc.cancel('e1', { reason: 'erreur' }, actor), BadRequestException);
  });
  it('annule avec motif et journalise CANCEL_EXPENSE', async () => {
    const { svc, calls } = makeService({ before: { id: 'e1', cancelledAt: null } });
    await svc.cancel('e1', { reason: ' doublon ' }, actor);
    assert.deepEqual(calls, ['updateMany', 'CANCEL_EXPENSE']);
  });
  it('solde disponible = solde de départ + encaissements − dépenses', async () => {
    const { svc } = makeService({ opening: 5000 });
    const b = await svc.balance('month', '2026-10');
    assert.equal(b.balanceCents, 700);
    assert.deepEqual(b.cash, { openingCents: 5000, collectedCents: 9000, spentCents: 2000, balanceCents: 12000 });
  });
});
