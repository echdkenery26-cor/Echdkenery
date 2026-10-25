//echd-frontend/src/lib/server-api.ts
import 'server-only';

// Appels à l'API depuis le serveur Next (pages publiques). En cas d'échec on renvoie null :
// le site reste affiché avec un message plutôt que de planter.

const API_URL = (process.env.API_URL || 'http://localhost:4000').replace(/\/$/, '');

export async function publicGet<T = any>(path: string, revalidate = 30): Promise<T | null> {
  try {
    const res = await fetch(`${API_URL}/api/public${path}`, { next: { revalidate } });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

/** Espace parents : jamais mis en cache (données personnelles, lien secret dans l'adresse). */
export async function portalGet<T = any>(token: string): Promise<{ status: number; data: T | null }> {
  try {
    const res = await fetch(`${API_URL}/api/portal/${encodeURIComponent(token)}`, { cache: 'no-store' });
    if (!res.ok) return { status: res.status, data: null };
    return { status: 200, data: (await res.json()) as T };
  } catch {
    return { status: 0, data: null };
  }
}

export interface Bi {
  fr: string;
  ar: string;
}

export interface SiteSettings {
  'institute.name': Bi;
  'institute.shortName': string;
  'institute.address': Bi;
  'institute.phone': string;
  'institute.whatsapp': string;
  'institute.email': string;
  'institute.hours': Bi;
  'institute.presentation': Bi;
  'institute.logoUrl'?: string | null;
  'site.heroTitle': Bi;
  'site.registrationOpen': boolean;
  'site.registrationSteps': { fr: string[]; ar: string[] };
  'site.registrationInfo': Bi;
  'site.privacyPolicy': Bi;
  'display.arabicIndicDigits': boolean;
  'announcement.categories': Array<{ code: string; fr: string; ar: string }>;
  'announcement.urgentCategory': string;
  'course.categories': Array<{ code: string; fr: string; ar: string }>;
  [k: string]: any;
}

const FALLBACK: SiteSettings = {
  'institute.name': { fr: 'École coranique ECHD', ar: 'مدرسة ECHD القرآنية' },
  'institute.shortName': 'ECHD',
  'institute.address': { fr: '', ar: '' },
  'institute.phone': '',
  'institute.whatsapp': '',
  'institute.email': '',
  'institute.hours': { fr: '', ar: '' },
  'institute.presentation': { fr: '', ar: '' },
  'site.heroTitle': { fr: 'Lire le Coran et apprendre l\'arabe', ar: 'اقرأ القرآن وتعلّم العربية' },
  'site.registrationOpen': true,
  'site.registrationSteps': { fr: [], ar: [] },
  'site.registrationInfo': { fr: '', ar: '' },
  'site.privacyPolicy': { fr: '', ar: '' },
  'display.arabicIndicDigits': false,
  'announcement.categories': [],
  'announcement.urgentCategory': 'urgent',
  'course.categories': [],
};

export async function getSettings(): Promise<SiteSettings> {
  const s = await publicGet<SiteSettings>('/settings', 60);
  return { ...FALLBACK, ...(s || {}) };
}
