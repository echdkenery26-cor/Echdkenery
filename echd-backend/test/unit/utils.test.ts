//echd-backend/test/unit/utils.test.ts
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ageOn, csvEscape, dateOnly, diffDays, generatePassword, neutralizeFormula, normalizePhone, overlaps, slugify } from '../../src/common/utils';

describe('csvEscape', () => {
  it('neutralise les formules Excel dans les textes', () => {
    assert.equal(csvEscape('=HYPERLINK("http://x")'), `"'=HYPERLINK(""http://x"")"`);
    assert.equal(csvEscape('+33612345678'), "'+33612345678");
    assert.equal(csvEscape('-cmd'), "'-cmd");
    assert.equal(csvEscape('@SUM(A1)'), "'@SUM(A1)");
  });
  it('ne touche pas aux nombres (montants négatifs inclus)', () => {
    assert.equal(csvEscape(-12.5), '-12.5');
    assert.equal(csvEscape(42), '42');
  });
  it('protège séparateurs, guillemets et retours à la ligne', () => {
    assert.equal(csvEscape('a;b'), '"a;b"');
    assert.equal(csvEscape('dit "oui"'), '"dit ""oui"""');
    assert.equal(csvEscape('l1\nl2'), '"l1\nl2"');
  });
  it('gère null, undefined et les dates', () => {
    assert.equal(csvEscape(null), '');
    assert.equal(csvEscape(undefined), '');
    assert.equal(csvEscape(new Date('2026-03-05T00:00:00Z')), '2026-03-05');
  });
  it('neutralizeFormula laisse un texte normal intact', () => {
    assert.equal(neutralizeFormula('Amadou DIALLO'), 'Amadou DIALLO');
  });
});

describe('dates', () => {
  it('dateOnly ramène à minuit UTC', () => {
    assert.equal(dateOnly('2026-10-24T23:59:59+02:00').toISOString(), '2026-10-24T00:00:00.000Z');
  });
  it('diffDays', () => {
    assert.equal(diffDays(dateOnly('2026-03-10'), dateOnly('2026-03-01')), 9);
  });
  it('ageOn tient compte de l’anniversaire', () => {
    const birth = dateOnly('2015-06-15');
    assert.equal(ageOn(birth, dateOnly('2026-06-14')), 10);
    assert.equal(ageOn(birth, dateOnly('2026-06-15')), 11);
    assert.equal(ageOn(null, dateOnly('2026-06-15')), null);
  });
  it('overlaps : créneaux qui se touchent ne se chevauchent pas', () => {
    assert.equal(overlaps('09:00', '10:00', '10:00', '11:00'), false);
    assert.equal(overlaps('09:00', '10:30', '10:00', '11:00'), true);
  });
});

describe('texte', () => {
  it('normalizePhone', () => {
    assert.equal(normalizePhone('06 12 34 56 78'), '33612345678');
    assert.equal(normalizePhone('+224 622 00 00 00'), '224622000000');
    assert.equal(normalizePhone('00224622000000'), '224622000000');
    assert.equal(normalizePhone(''), null);
  });
  it('slugify retire accents et espaces', () => {
    assert.equal(slugify('Élève Hamidou DIALLO'), 'eleve.hamidou.diallo');
  });
  it('generatePassword respecte la longueur et mélange lettres/chiffres', () => {
    for (let i = 0; i < 50; i++) {
      const p = generatePassword(10);
      assert.equal(p.length, 10);
      assert.match(p, /[A-Za-z]/);
      assert.match(p, /\d/);
      assert.doesNotMatch(p, /[0OIl1]/);
    }
  });
});
