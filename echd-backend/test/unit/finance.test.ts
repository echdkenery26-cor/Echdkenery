//echd-backend/test/unit/finance.test.ts
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { FinanceService, periodRange } from '../../src/modules/finance/finance.service';

describe('periodRange', () => {
  it('mois', () => {
    const r = periodRange('month', '2026-02');
    assert.equal(r.from.toISOString(), '2026-02-01T00:00:00.000Z');
    assert.equal(r.to.toISOString(), '2026-03-01T00:00:00.000Z');
    assert.deepEqual(r.months, ['2026-02']);
  });
  it('trimestre : mai appartient à T2 (avril–juin)', () => {
    const r = periodRange('quarter', '2026-05');
    assert.deepEqual(r.months, ['2026-04', '2026-05', '2026-06']);
    assert.equal(r.to.toISOString(), '2026-07-01T00:00:00.000Z');
  });
  it('année : 12 mois, borne haute au 1er janvier suivant', () => {
    const r = periodRange('year', '2026-10');
    assert.equal(r.months.length, 12);
    assert.equal(r.from.toISOString(), '2026-01-01T00:00:00.000Z');
    assert.equal(r.to.toISOString(), '2027-01-01T00:00:00.000Z');
  });
});

/** Faux Prisma : suffit pour vérifier les règles d'argent sans base de données. */
function makeService(opts: { due: any; guardCount?: number; payment?: any; claimCount?: number }) {
  const calls: string[] = [];
  const tx = {
    due: {
      updateMany: async () => (calls.push('due.updateMany'), { count: opts.guardCount ?? 1 }),
      update: async () => (calls.push('due.update'), {}),
    },
    counter: { upsert: async () => (calls.push('counter.upsert'), { value: 7 }) },
    payment: {
      create: async ({ data }: any) => (calls.push('payment.create'), { id: 'p1', ...data }),
      updateMany: async () => (calls.push('payment.updateMany'), { count: opts.claimCount ?? 1 }),
      findUniqueOrThrow: async () => ({ id: 'p1', cancelledAt: new Date() }),
    },
  };
  const prisma: any = {
    due: { findUnique: async () => opts.due, findUniqueOrThrow: async () => opts.due, update: async () => ({}) },
    payment: {
      findUnique: async () => opts.payment ?? null,
      findUniqueOrThrow: async () => ({ id: 'p1' }),
    },
    $transaction: async (fn: any) => fn(tx),
  };
  const settings: any = { today: async () => new Date('2026-10-24T00:00:00Z'), get: async () => false };
  const audit: any = { log: async () => undefined };
  const mail: any = { send: async () => true };
  const signing: any = { documentUrl: () => ({ url: 'https://api.test/doc' }) };
  const svc: any = new FinanceService(prisma, settings, audit, mail, signing);
  svc.applyStatus = async () => undefined;
  return { svc: svc as FinanceService, calls };
}

const actor: any = { id: 'u1', firstName: 'Ad', lastName: 'Min' };
const due = (over: any = {}) => ({ id: 'd1', studentId: 's1', amountCents: 5000, paidCents: 0, status: 'UPCOMING', label: 'Octobre', ...over });

describe('createPayment', () => {
  it('refuse un montant supérieur au reste à payer', async () => {
    const { svc } = makeService({ due: due({ paidCents: 4000 }) });
    await assert.rejects(() => svc.createPayment({ dueId: 'd1', amountCents: 2000, method: 'CASH' } as any, actor), BadRequestException);
  });
  it('refuse une échéance exonérée ou soldée', async () => {
    await assert.rejects(() => makeService({ due: due({ status: 'EXEMPT' }) }).svc.createPayment({ dueId: 'd1', amountCents: 100, method: 'CASH' } as any, actor), BadRequestException);
    await assert.rejects(() => makeService({ due: due({ paidCents: 5000 }) }).svc.createPayment({ dueId: 'd1', amountCents: 100, method: 'CASH' } as any, actor), BadRequestException);
  });
  it('refuse une date de paiement dans le futur', async () => {
    const { svc } = makeService({ due: due() });
    await assert.rejects(() => svc.createPayment({ dueId: 'd1', amountCents: 100, method: 'CASH', paidAt: '2026-12-01' } as any, actor), BadRequestException);
  });
  it('encaisse et numérote le reçu dans la transaction', async () => {
    const { svc, calls } = makeService({ due: due() });
    await svc.createPayment({ dueId: 'd1', amountCents: 2000, method: 'CASH' } as any, actor);
    assert.deepEqual(calls, ['due.updateMany', 'counter.upsert', 'payment.create']);
  });
  it('paiement simultané : si la garde atomique échoue, aucun reçu ni paiement n’est créé', async () => {
    const { svc, calls } = makeService({ due: due(), guardCount: 0 });
    await assert.rejects(() => svc.createPayment({ dueId: 'd1', amountCents: 2000, method: 'CASH' } as any, actor), ConflictException);
    assert.deepEqual(calls, ['due.updateMany']);
  });
});

describe('cancelPayment', () => {
  const pay = { id: 'p1', dueId: 'd1', amountCents: 2000, cancelledAt: null };
  it('annule et rend le montant à l’échéance', async () => {
    const { svc, calls } = makeService({ due: due({ status: 'PARTIAL' }), payment: pay });
    await svc.cancelPayment('p1', { reason: 'Erreur de saisie' } as any, actor);
    assert.deepEqual(calls.slice(0, 2), ['payment.updateMany', 'due.update']);
  });
  it('refuse un paiement déjà annulé', async () => {
    const { svc } = makeService({ due: due(), payment: { ...pay, cancelledAt: new Date() } });
    await assert.rejects(() => svc.cancelPayment('p1', { reason: 'x' } as any, actor), BadRequestException);
  });
  it('double annulation simultanée : le second appel n’enlève pas le montant deux fois', async () => {
    const { svc, calls } = makeService({ due: due(), payment: pay, claimCount: 0 });
    await assert.rejects(() => svc.cancelPayment('p1', { reason: 'x' } as any, actor), BadRequestException);
    assert.ok(!calls.includes('due.update'));
  });
});

describe('destinataires des e-mails (reçus et relances)', () => {
  const { svc } = makeService({ due: due() });
  it('enfant : les responsables légaux d’abord', () => {
    assert.deepEqual(svc.recipientsOf({ audience: 'CHILD', email: 'kid@x.fr', guardians: [{ email: 'Papa@X.fr' }, { email: null }, { email: 'papa@x.fr' }] }), ['papa@x.fr']);
  });
  it('enfant sans e-mail de responsable : repli sur l’élève', () => {
    assert.deepEqual(svc.recipientsOf({ audience: 'CHILD', email: 'kid@x.fr', guardians: [] }), ['kid@x.fr']);
  });
  it('adulte : son propre e-mail d’abord', () => {
    assert.deepEqual(svc.recipientsOf({ audience: 'ADULT', email: 'me@x.fr', guardians: [{ email: 'autre@x.fr' }] }), ['me@x.fr']);
  });
  it('aucune adresse : liste vide', () => {
    assert.deepEqual(svc.recipientsOf({ audience: 'ADULT', email: null, guardians: [] }), []);
  });
});
