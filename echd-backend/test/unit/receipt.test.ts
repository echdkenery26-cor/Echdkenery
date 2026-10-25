//echd-backend/test/unit/receipt.test.ts
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ReceiptView, renderReceiptHtml } from '../../src/modules/documents/receipt-template';

const t: any = new Proxy({}, { get: (_o, k) => `T_${String(k)}` });
const base: ReceiptView = {
  lang: 'fr',
  ar: false,
  t,
  org: { name: 'École <b>Test</b>', shortName: 'ECHD', address: 'Kenery', phone: '', email: '', logo: 'https://x.test/logo.png' },
  number: 'R-2026-00001',
  amount: '40,00 €',
  date: '24 octobre 2026',
  student: 'Élève "Test"',
  label: 'Cotisation',
  method: 'Espèces',
  due: { total: '40,00 €', before: '0,00 €', remaining: '0,00 €', beforePct: 0, thisPct: 100, settled: true },
  cancelled: false,
  issuedOn: '24 octobre 2026',
};

describe('renderReceiptHtml', () => {
  it('affiche numéro, montant, logo et tampon « payé »', () => {
    const h = renderReceiptHtml(base);
    assert.match(h, /R-2026-00001/);
    assert.match(h, /40,00 €/);
    assert.match(h, /src="https:\/\/x\.test\/logo\.png"/);
    assert.match(h, /T_stampPaid/);
    assert.match(h, /T_settled/);
  });
  it('échappe le HTML des données saisies', () => {
    const h = renderReceiptHtml(base);
    assert.ok(!h.includes('<b>Test</b>'));
    assert.match(h, /École &lt;b&gt;Test&lt;\/b&gt;/);
    assert.match(h, /Élève &quot;Test&quot;/);
  });
  it('reçu annulé : filigrane, motif et tampon rouge, pas de « soldé »', () => {
    const h = renderReceiptHtml({ ...base, cancelled: true, cancelReason: 'Erreur' });
    assert.match(h, /void-mark/);
    assert.match(h, /Erreur/);
    assert.match(h, /#b4413a/);
    assert.ok(!h.includes('T_settled'));
  });
  it('paiement partiel et sans logo : étoile de la plateforme', () => {
    const h = renderReceiptHtml({ ...base, org: { ...base.org, logo: null }, due: { ...base.due, settled: false, remaining: '10,00 €' } });
    assert.match(h, /T_partial/);
    assert.ok(!h.includes('<img'));
    assert.match(h, /M36 4l8 13\.6/);
  });
  it('arabe : page en RTL', () => {
    assert.match(renderReceiptHtml({ ...base, lang: 'ar', ar: true }), /dir="rtl"/);
  });
});
