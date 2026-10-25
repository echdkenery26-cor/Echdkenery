//echd-backend/src/common/utils.ts
import { randomInt } from 'crypto';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

/* ───────────── Dates (date seule = minuit UTC) ───────────── */

export function dateOnly(v: string | Date): Date {
  if (typeof v === 'string') return new Date(v.slice(0, 10) + 'T00:00:00.000Z');
  return new Date(Date.UTC(v.getUTCFullYear(), v.getUTCMonth(), v.getUTCDate()));
}

export const ymd = (d: Date) => d.toISOString().slice(0, 10);

export function addDays(d: Date, n: number): Date {
  const r = new Date(d.getTime());
  r.setUTCDate(r.getUTCDate() + n);
  return r;
}

export function addMonths(d: Date, n: number): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, 1));
}

export function diffDays(a: Date, b: Date): number {
  return Math.round((a.getTime() - b.getTime()) / 86400000);
}

/** Date du jour dans un fuseau donné, ramenée à minuit UTC. */
export function todayIn(tz: string): Date {
  const s = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
  return dateOnly(s);
}

/** Jour ISO : 1 = lundi … 6 = samedi, 7 = dimanche. */
export function isoWeekday(d: Date): number {
  const w = d.getUTCDay();
  return w === 0 ? 7 : w;
}

export function timeToMin(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

export const overlaps = (aS: string, aE: string, bS: string, bE: string) =>
  timeToMin(aS) < timeToMin(bE) && timeToMin(aE) > timeToMin(bS);

export function ageOn(birth: Date | null | undefined, ref: Date): number | null {
  if (!birth) return null;
  let age = ref.getUTCFullYear() - birth.getUTCFullYear();
  const m = ref.getUTCMonth() - birth.getUTCMonth();
  if (m < 0 || (m === 0 && ref.getUTCDate() < birth.getUTCDate())) age--;
  return age;
}

/* ───────────── Pagination ───────────── */

export class PageQuery {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  pageSize?: number = 25;
}

export const pageArgs = (q: PageQuery) => {
  const page = q.page ?? 1;
  const pageSize = q.pageSize ?? 25;
  return { skip: (page - 1) * pageSize, take: pageSize };
};

export const pageResult = <T>(items: T[], total: number, q: PageQuery) => ({
  items,
  total,
  page: q.page ?? 1,
  pageSize: q.pageSize ?? 25,
});

/* ───────────── Texte ───────────── */

export const fullName = (p: { firstName: string; lastName?: string | null }) =>
  `${p.firstName} ${p.lastName ?? ''}`.trim();

/** Numéro au format international sans « + » (pour wa.me). */
export function normalizePhone(raw: string | null | undefined, countryCode = '33'): string | null {
  if (!raw) return null;
  let d = raw.replace(/[^\d+]/g, '');
  if (!d) return null;
  if (d.startsWith('+')) return d.slice(1);
  if (d.startsWith('00')) return d.slice(2);
  if (d.startsWith('0')) return countryCode + d.slice(1);
  return d;
}

export function slugify(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/^\.+|\.+$/g, '');
}

/** Mot de passe provisoire lisible (sans 0/O/1/l/I), avec lettres, chiffres. */
export function generatePassword(len = 10): string {
  const letters = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ';
  const digits = '23456789';
  const all = letters + digits;
  const chars = [letters[randomInt(letters.length)], digits[randomInt(digits.length)]];
  while (chars.length < len) chars.push(all[randomInt(all.length)]);
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}

/**
 * Une cellule qui commence par = + - @ (ou tabulation / retour chariot) est interprétée comme une formule
 * par Excel : un nom saisi par un visiteur (ex. « =HYPERLINK(...) ») pourrait s'exécuter à l'ouverture.
 * On neutralise uniquement les textes (jamais les nombres) en préfixant une apostrophe.
 */
export const neutralizeFormula = (s: string): string => (/^[=+\-@\t\r]/.test(s) ? `'${s}` : s);

export const csvEscape = (v: unknown): string => {
  if (v === null || v === undefined) return '';
  let s = v instanceof Date ? v.toISOString().slice(0, 10) : String(v);
  if (typeof v === 'string') s = neutralizeFormula(s);
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export const money = (cents: number, currency = 'EUR', locale = 'fr-FR') =>
  new Intl.NumberFormat(locale, { style: 'currency', currency }).format(cents / 100);

/** Retire les champs sensibles avant écriture dans le journal. */
export function sanitizeForAudit(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  return JSON.parse(
    JSON.stringify(obj, (k, v) => (['passwordHash', 'tokenHash', 'password'].includes(k) ? undefined : v)),
  );
}
