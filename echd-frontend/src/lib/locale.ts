// Utilitaires de langue utilisables côté serveur ET côté navigateur.

export const LOCALES = ['fr', 'ar'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'fr';

export const isLocale = (v: string): v is Locale => (LOCALES as readonly string[]).includes(v);
export const dirOf = (l: Locale) => (l === 'ar' ? 'rtl' : 'ltr');

/** Code de langue pour Intl (chiffres latins par défaut, indo-arabes si demandé dans les paramètres). */
export function intlLocale(l: Locale, arabicIndic = false) {
  if (l === 'fr') return 'fr-FR';
  return arabicIndic ? 'ar-EG' : 'ar-u-nu-latn';
}

/** t('Bonjour', 'مرحبا') → texte dans la langue courante */
export const trFor = (l: Locale) => (fr: string, ar: string) => (l === 'ar' ? ar : fr);

/** Choisit le champ FR ou AR d'une donnée bilingue (repli sur le français si l'arabe est vide). */
export const pickFor = (l: Locale) => (fr?: string | null, ar?: string | null) =>
  l === 'ar' && ar && ar.trim() ? ar : fr || ar || '';

/** Préfixe un chemin avec la langue : /admin → /fr/admin */
export function withLocale(l: Locale, path: string) {
  if (!path.startsWith('/') || path.startsWith('//')) return path;
  if (/^\/(fr|ar)(\/|$)/.test(path)) return path;
  return `/${l}${path === '/' ? '' : path}`;
}

/** Retire le préfixe de langue d'un chemin. */
export const stripLocale = (path: string) => path.replace(/^\/(fr|ar)(?=\/|$)/, '') || '/';

/* ───── Formats ───── */

const toDate = (v: string | Date) => (v instanceof Date ? v : new Date(v));

/** Les dates venant de l'API sont des jours « purs » (UTC) : on les affiche en UTC pour éviter un décalage. */
export function formatDate(v: string | Date | null | undefined, loc: string, style: 'short' | 'medium' | 'long' = 'medium') {
  if (!v) return '—';
  const d = toDate(v);
  if (isNaN(d.getTime())) return '—';
  const opts: Intl.DateTimeFormatOptions =
    style === 'short'
      ? { day: '2-digit', month: '2-digit', year: 'numeric' }
      : style === 'long'
        ? { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }
        : { day: 'numeric', month: 'short', year: 'numeric' };
  return new Intl.DateTimeFormat(loc, { ...opts, timeZone: 'UTC' }).format(d);
}

/** Date + heure d'un événement (instant réel) dans le fuseau du navigateur. */
export function formatDateTime(v: string | Date | null | undefined, loc: string) {
  if (!v) return '—';
  const d = toDate(v);
  if (isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat(loc, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(d);
}

export function formatMoney(cents: number | null | undefined, loc: string, currency = 'EUR') {
  const n = (cents ?? 0) / 100;
  let cur = (currency || 'EUR').trim().toUpperCase();
  let digits = 2;
  try {
    digits = new Intl.NumberFormat(loc, { style: 'currency', currency: cur }).resolvedOptions().maximumFractionDigits ?? 2;
  } catch {
    cur = 'EUR'; // code de devise invalide dans les paramètres
  }
  return new Intl.NumberFormat(loc, {
    style: 'currency',
    currency: cur,
    minimumFractionDigits: n % 1 ? digits : 0,
    maximumFractionDigits: digits,
  }).format(n);
}

export function formatNumber(n: number | null | undefined, loc: string) {
  return new Intl.NumberFormat(loc).format(n ?? 0);
}

/** "08:30" → "08:30" (chiffres adaptés à la langue) */
export function formatTime(t: string | null | undefined, loc: string) {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  const d = new Date(Date.UTC(2000, 0, 1, h, m));
  return new Intl.DateTimeFormat(loc, { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'UTC' }).format(d);
}

/** Jour de la semaine ISO (1 = lundi … 7 = dimanche) */
export function weekdayName(iso: number, loc: string, style: 'long' | 'short' = 'long') {
  const d = new Date(Date.UTC(2024, 0, iso)); // 1er janvier 2024 = lundi
  const name = new Intl.DateTimeFormat(loc, { weekday: style, timeZone: 'UTC' }).format(d);
  return name.charAt(0).toUpperCase() + name.slice(1);
}

export const todayISO = () => new Date().toISOString().slice(0, 10);

export function initials(first?: string | null, last?: string | null) {
  const a = (first || '').trim()[0] || '';
  const b = (last || '').trim()[0] || '';
  return (a + b).toUpperCase() || '?';
}

export const fullName = (p?: { firstName?: string | null; lastName?: string | null } | null) =>
  p ? `${p.firstName ?? ''} ${p.lastName ?? ''}`.trim() : '';

export function ageFrom(birth?: string | null) {
  if (!birth) return null;
  const b = new Date(birth);
  const n = new Date();
  let a = n.getUTCFullYear() - b.getUTCFullYear();
  if (n.getUTCMonth() < b.getUTCMonth() || (n.getUTCMonth() === b.getUTCMonth() && n.getUTCDate() < b.getUTCDate())) a--;
  return a;
}

/** Ajoute (ou retire) des jours à une date ISO « AAAA-MM-JJ » (calcul en UTC, sans décalage horaire) */
export const addDaysISO = (iso: string, n: number) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
