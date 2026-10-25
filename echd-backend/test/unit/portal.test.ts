//echd-backend/test/unit/portal.test.ts
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ForbiddenException } from '@nestjs/common';
import { SigningService } from '../../src/common/signing.service';
import { PortalService } from '../../src/modules/portal/portal.service';

const STUDENT = '3f2b8f9e-1c2d-4e5f-8a9b-0c1d2e3f4a5b';

function make(cfg: Record<string, any> = {}) {
  process.env.JWT_SECRET = 'x'.repeat(40);
  const values = { 'portal.enabled': true, 'portal.linkDays': 90, 'portal.epoch': 1, ...cfg };
  const settings: any = { getMany: async (keys: string[]) => Object.fromEntries(keys.map((k) => [k, (values as any)[k]])) };
  const prisma: any = { student: { findUnique: async () => ({ id: STUDENT }) } };
  const svc = new PortalService(prisma, settings, new SigningService(), {} as any, {} as any, {} as any);
  const token = async (days?: number) => (await svc.createLink(STUDENT, { days })).url.split('/suivi/')[1];
  return { svc, token, values, check: (t: string) => (svc as any).studentIdFrom(t) };
}

describe('espace parents : jeton du lien', () => {
  it('un lien valide donne accès à son élève', async () => {
    const { token, check } = make();
    assert.equal((await check(await token())).studentId, STUDENT);
  });
  it('une signature modifiée est refusée', async () => {
    const { token, check } = make();
    const t = await token();
    await assert.rejects(() => check(t.slice(0, -2) + (t.endsWith('AA') ? 'BB' : 'AA')), ForbiddenException);
  });
  it('un lien ne peut pas être transposé sur un autre élève', async () => {
    const { token, check } = make();
    const parts = (await token()).split('.');
    parts[0] = '11111111-2222-4333-8444-555555555555';
    await assert.rejects(() => check(parts.join('.')), ForbiddenException);
  });
  it('un lien expiré est refusé', async () => {
    const { check } = make();
    const signing = new SigningService();
    const exp = Math.floor(Date.now() / 1000) - 10;
    const sig = signing.sign(`portal|${STUDENT}|1`, exp);
    await assert.rejects(() => check(`${STUDENT}.${exp}.1.${sig}`), ForbiddenException);
  });
  it('« Révoquer tous les liens » invalide les anciens liens', async () => {
    const { token, check, values } = make();
    const t = await token();
    values['portal.epoch'] = 2;
    await assert.rejects(() => check(t), ForbiddenException);
  });
  it('espace parents désactivé : plus aucun accès, et plus de création de lien', async () => {
    const { token, check, values, svc } = make();
    const t = await token();
    values['portal.enabled'] = false;
    await assert.rejects(() => check(t), ForbiddenException);
    await assert.rejects(() => svc.createLink(STUDENT), /désactivé/);
  });
  it('des jetons mal formés sont refusés sans erreur serveur', async () => {
    const { check } = make();
    for (const bad of ['', 'abc', 'a.b.c.d', `${STUDENT}.x.1.sig`, '....']) await assert.rejects(() => check(bad), ForbiddenException);
  });
});
