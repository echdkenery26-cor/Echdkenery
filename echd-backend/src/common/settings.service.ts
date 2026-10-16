import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { todayIn } from './utils';

type Bi = { fr: string; ar: string };

/**
 * Registre des paramètres : valeurs par défaut + clés autorisées.
 * Tout est modifiable depuis l'espace admin (PUT /api/settings) — rien n'est codé en dur.
 */
export const SETTINGS_DEFAULTS: Record<string, any> = {
  // Identité de l'institut
  'institute.name': { fr: 'École coranique Hamidou DIALLO (ECHD)', ar: 'مدرسة حميدو ديالو القرآنية' } as Bi,
  'institute.shortName': 'ECHD',
  'institute.address': { fr: '', ar: '' } as Bi,
  'institute.phone': '',
  'institute.whatsapp': '',
  'institute.email': '',
  'institute.hours': { fr: 'Le samedi', ar: 'يوم السبت' } as Bi,
  'institute.presentation': {
    fr: "Cours d'arabe et de Coran pour enfants dès 6 ans et pour adultes, du niveau débutant au niveau confirmé.",
    ar: 'دروس في اللغة العربية والقرآن الكريم للأطفال من سن 6 سنوات وللكبار، من المبتدئ إلى المتقدم.',
  } as Bi,
  'institute.logo': null,
  'institute.timezone': 'Europe/Paris',
  'institute.defaultCountryCode': '33',
  'institute.currency': 'EUR',

  // Site public
  'site.heroTitle': {
    fr: 'Lire le Coran et apprendre l\'arabe, à votre rythme',
    ar: 'اقرأ القرآن الكريم وتعلّم العربية بوتيرتك',
  } as Bi,
  'site.registrationOpen': true,
  'site.registrationSteps': {
    fr: [
      'Remplissez le formulaire de préinscription',
      "Nous vous contactons pour confirmer la place",
      "Réglez les frais d'inscription et commencez les cours",
    ],
    ar: ['املأ استمارة التسجيل المسبق', 'نتصل بكم لتأكيد المقعد', 'سدّدوا رسوم التسجيل وابدؤوا الدروس'],
  } as { fr: string[]; ar: string[] },
  'site.registrationInfo': {
    fr: 'Le règlement des cours est proposé après confirmation de la place.',
    ar: 'يُقترح سداد رسوم الدروس بعد تأكيد المقعد.',
  } as Bi,
  'site.privacyPolicy': { fr: '', ar: '' } as Bi,
  'site.defaultLanguage': 'fr',
  'display.arabicIndicDigits': false,

  // Listes de catégories (éditables)
  'announcement.categories': [
    { code: 'back_to_school', fr: 'Rentrée', ar: 'الدخول المدرسي' },
    { code: 'holidays', fr: 'Vacances', ar: 'العطلة' },
    { code: 'schedule', fr: 'Horaires', ar: 'المواعيد' },
    { code: 'event', fr: 'Événement', ar: 'حدث' },
    { code: 'urgent', fr: 'Urgent', ar: 'عاجل' },
    { code: 'misc', fr: 'Divers', ar: 'متفرقات' },
  ],
  'announcement.urgentCategory': 'urgent',
  'course.categories': [
    { code: 'arabic', fr: 'Arabe', ar: 'اللغة العربية' },
    { code: 'quran', fr: 'Coran', ar: 'القرآن الكريم' },
    { code: 'tajwid', fr: 'Tajwid', ar: 'التجويد' },
  ],

  // Sécurité
  'security.inactivityMinutes': 30,

  // Alertes
  'alerts.absenceThreshold': 2,
  'alerts.dueGraceDays': 7,
  'alerts.dueCriticalDays': 30,
  'alerts.preRegPendingDays': 3,
  'alerts.digest': 'weekly', // none | daily | weekly

  // Cotisations
  'fees.siblingDiscountPercent': 0,

  // RGPD
  'retention.years': 3,

  // Bulletins : trimestres optionnels [{ start:'YYYY-MM-DD', end:'YYYY-MM-DD' }] (sinon année découpée en 3)
  'terms.dates': null,

  // Modèles de messages (placeholders : {student} {amount} {period} {school} {receipt})
  'templates.reminder': {
    fr: "Bonjour, sauf erreur de notre part, la cotisation de {student} ({period}), d'un montant de {amount}, reste à régler. Merci de votre compréhension. {school}",
    ar: 'السلام عليكم، إن لم نكن مخطئين فإن اشتراك {student} ({period}) بمبلغ {amount} لم يُسدَّد بعد. شكراً لتفهّمكم. {school}',
  } as Bi,
  'templates.preregAck': {
    fr: "Bonjour, nous avons bien reçu votre demande de préinscription ({reference}) à {school}. Nous vous contacterons très prochainement.",
    ar: 'السلام عليكم، استلمنا طلب التسجيل المسبق ({reference}) في {school}. سنتصل بكم قريباً.',
  } as Bi,
  'templates.slotChange': {
    fr: "Bonjour, information de {school} : {message}",
    ar: 'السلام عليكم، إعلام من {school}: {message}',
  } as Bi,
};

/** Clés exposées sur le site public (aucune donnée sensible). */
export const PUBLIC_SETTING_KEYS = [
  'institute.name',
  'institute.shortName',
  'institute.address',
  'institute.phone',
  'institute.whatsapp',
  'institute.email',
  'institute.hours',
  'institute.presentation',
  'institute.logo',
  'institute.currency',
  'site.heroTitle',
  'site.registrationOpen',
  'site.registrationSteps',
  'site.registrationInfo',
  'site.privacyPolicy',
  'site.defaultLanguage',
  'display.arabicIndicDigits',
  'announcement.categories',
  'announcement.urgentCategory',
  'course.categories',
];

/** Clés lisibles par tous les utilisateurs connectés (listes déroulantes, seuils d'affichage). */
export const LOOKUP_SETTING_KEYS = [
  ...PUBLIC_SETTING_KEYS,
  'institute.timezone',
  'security.inactivityMinutes',
  'alerts.absenceThreshold',
];

@Injectable()
export class SettingsService {
  private cache: Map<string, any> | null = null;
  private loadedAt = 0;

  constructor(private prisma: PrismaService) {}

  private async load() {
    if (this.cache && Date.now() - this.loadedAt < 30_000) return this.cache;
    const rows = await this.prisma.setting.findMany();
    this.cache = new Map(rows.map((r) => [r.key, r.value]));
    this.loadedAt = Date.now();
    return this.cache;
  }

  async get<T = any>(key: string): Promise<T> {
    const c = await this.load();
    return (c.has(key) ? c.get(key) : SETTINGS_DEFAULTS[key]) as T;
  }

  async getMany(keys: string[]): Promise<Record<string, any>> {
    const c = await this.load();
    const out: Record<string, any> = {};
    for (const k of keys) out[k] = c.has(k) ? c.get(k) : SETTINGS_DEFAULTS[k];
    return out;
  }

  async all(): Promise<Record<string, any>> {
    return this.getMany(Object.keys(SETTINGS_DEFAULTS));
  }

  async set(values: Record<string, any>): Promise<void> {
    const keys = Object.keys(values);
    const unknown = keys.filter((k) => !(k in SETTINGS_DEFAULTS));
    if (unknown.length) throw new BadRequestException(`Paramètres inconnus : ${unknown.join(', ')}`);
    this.validate(values);
    await this.prisma.$transaction(
      keys.map((key) =>
        this.prisma.setting.upsert({
          where: { key },
          update: { value: values[key] ?? null },
          create: { key, value: values[key] ?? null },
        }),
      ),
    );
    this.cache = null;
  }

  private validate(v: Record<string, any>) {
    const intIn = (k: string, min: number, max: number) => {
      if (k in v && (!Number.isInteger(v[k]) || v[k] < min || v[k] > max))
        throw new BadRequestException(`${k} doit être un entier entre ${min} et ${max}.`);
    };
    intIn('security.inactivityMinutes', 5, 480);
    intIn('alerts.absenceThreshold', 1, 20);
    intIn('alerts.dueGraceDays', 0, 90);
    intIn('alerts.dueCriticalDays', 1, 365);
    intIn('alerts.preRegPendingDays', 1, 60);
    intIn('fees.siblingDiscountPercent', 0, 100);
    intIn('retention.years', 1, 20);
    if ('alerts.digest' in v && !['none', 'daily', 'weekly'].includes(v['alerts.digest']))
      throw new BadRequestException('alerts.digest doit valoir none, daily ou weekly.');
    if ('institute.timezone' in v) {
      try {
        new Intl.DateTimeFormat('en', { timeZone: v['institute.timezone'] });
      } catch {
        throw new BadRequestException('Fuseau horaire invalide.');
      }
    }
    for (const k of ['announcement.categories', 'course.categories']) {
      if (k in v) {
        const ok =
          Array.isArray(v[k]) && v[k].every((c: any) => c && typeof c.code === 'string' && typeof c.fr === 'string');
        if (!ok) throw new BadRequestException(`${k} doit être une liste de { code, fr, ar }.`);
      }
    }
  }

  async tz(): Promise<string> {
    return this.get<string>('institute.timezone');
  }

  async today(): Promise<Date> {
    return todayIn(await this.tz());
  }
}
