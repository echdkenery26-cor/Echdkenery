/** Libellés bilingues des états et énumérations (utilisés dans tout le back-office). */
type T = (fr: string, ar: string) => string;
export type Tone = 'neutral' | 'ok' | 'warn' | 'bad' | 'info' | 'gold' | 'dark';

export const studentStatus = (s: string, t: T): { label: string; tone: Tone } => {
  switch (s) {
    case 'ENROLLED':
      return { label: t('Inscrit', 'مسجّل'), tone: 'ok' };
    case 'PREREGISTERED':
      return { label: t('Préinscrit', 'تسجيل مسبق'), tone: 'gold' };
    case 'WAITLIST':
      return { label: t('Liste d’attente', 'قائمة الانتظار'), tone: 'info' };
    case 'SUSPENDED':
      return { label: t('Suspendu', 'موقوف'), tone: 'warn' };
    case 'LEFT':
      return { label: t('Parti', 'غادر'), tone: 'neutral' };
    default:
      return { label: s, tone: 'neutral' };
  }
};

export const audienceLabel = (a: string, t: T) => (a === 'CHILD' ? t('Enfant', 'طفل') : t('Adulte', 'بالغ'));
export const audiencePlural = (a: string, t: T) => (a === 'CHILD' ? t('Enfants', 'الأطفال') : t('Adultes', 'الكبار'));
export const genderLabel = (g: string | null | undefined, t: T) => (g === 'MALE' ? t('Garçon / homme', 'ذكر') : g === 'FEMALE' ? t('Fille / femme', 'أنثى') : '—');

export const dueStatus = (s: string, t: T): { label: string; tone: Tone } => {
  switch (s) {
    case 'PAID':
      return { label: t('Payé', 'مدفوع'), tone: 'ok' };
    case 'PARTIAL':
      return { label: t('Partiel', 'جزئي'), tone: 'info' };
    case 'UPCOMING':
      return { label: t('À venir', 'قادم'), tone: 'neutral' };
    case 'LATE':
      return { label: t('En retard', 'متأخر'), tone: 'warn' };
    case 'CRITICAL':
      return { label: t('Retard critique', 'تأخر حرج'), tone: 'bad' };
    case 'EXEMPT':
      return { label: t('Exonéré', 'معفى'), tone: 'gold' };
    default:
      return { label: s, tone: 'neutral' };
  }
};

export const methodLabel = (m: string, t: T) =>
  ({ CASH: t('Espèces', 'نقداً'), CHEQUE: t('Chèque', 'شيك'), TRANSFER: t('Virement', 'تحويل'), CARD: t('Carte', 'بطاقة') }[m] || m);

export const attendanceStatus = (s: string, t: T): { label: string; tone: Tone } => {
  switch (s) {
    case 'PRESENT':
      return { label: t('Présent', 'حاضر'), tone: 'ok' };
    case 'ABSENT':
      return { label: t('Absent', 'غائب'), tone: 'bad' };
    case 'LATE':
      return { label: t('En retard', 'متأخر'), tone: 'warn' };
    case 'EXCUSED':
      return { label: t('Excusé', 'بعذر'), tone: 'info' };
    default:
      return { label: s, tone: 'neutral' };
  }
};

export const enrollmentStatus = (s: string, t: T): { label: string; tone: Tone } =>
  s === 'ACTIVE' ? { label: t('Inscrit', 'مسجّل'), tone: 'ok' } : s === 'WAITLIST' ? { label: t('En attente', 'في الانتظار'), tone: 'info' } : { label: t('Terminée', 'منتهية'), tone: 'neutral' };
