import { ArrowLeft, ArrowRight, Check, Clock, MapPin, Users } from 'lucide-react';
import { CourseIcon } from '@/components/course-icon';
import { Badge } from '@/components/ui/display';
import { Link } from '@/components/ui/button';
import { Locale, formatDate, formatTime, intlLocale, pickFor, trFor, weekdayName } from '@/lib/locale';
import { SlotGroup } from '@/lib/schedule';
import { cn } from '@/lib/utils';

export function Arrow({ locale, className }: { locale: Locale; className?: string }) {
  const A = locale === 'ar' ? ArrowLeft : ArrowRight;
  return <A className={cn('size-4', className)} aria-hidden />;
}

export function Section({ children, className, tone = 'paper', id }: { children: React.ReactNode; className?: string; tone?: 'paper' | 'sand' | 'white'; id?: string }) {
  return (
    <section id={id} className={cn(tone === 'sand' ? 'bg-sand-200/60' : tone === 'white' ? 'bg-white' : 'bg-paper', 'py-14 sm:py-20', className)}>
      <div className="mx-auto max-w-6xl px-4 sm:px-6">{children}</div>
    </section>
  );
}

export function SectionHead({ title, text, action }: { title: string; text?: string; action?: React.ReactNode }) {
  return (
    <div className="mb-8 flex flex-col gap-3 sm:mb-10 sm:flex-row sm:items-end sm:justify-between">
      <div className="max-w-2xl">
        <h2 className="font-serif text-2xl font-bold leading-tight text-brand-800 sm:text-3xl">{title}</h2>
        {text && <p className="mt-2 text-brand-500">{text}</p>}
      </div>
      {action}
    </div>
  );
}

export function PageHero({ title, text }: { title: string; text?: string }) {
  return (
    <div className="pattern-star relative overflow-hidden bg-brand-800 text-white">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
        <h1 className="max-w-3xl font-serif text-3xl font-bold leading-tight sm:text-4xl">{title}</h1>
        {text && <p className="mt-3 max-w-2xl text-lg leading-relaxed text-white/75">{text}</p>}
      </div>
    </div>
  );
}

export const audienceLabel = (locale: Locale, a: 'CHILD' | 'ADULT') =>
  a === 'CHILD' ? trFor(locale)('Enfants', 'الأطفال') : trFor(locale)('Adultes', 'الكبار');

/** Résumé « Samedi 10:00–12:30 » des créneaux d'un cours */
export function slotSummary(locale: Locale, slots: Array<{ weekday: number; startTime: string; endTime: string }>, arabicIndic = false) {
  const loc = intlLocale(locale, arabicIndic);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const s of slots) {
    const k = `${s.weekday}|${s.startTime}|${s.endTime}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(`${weekdayName(s.weekday, loc)} \u2066${formatTime(s.startTime, loc)}–${formatTime(s.endTime, loc)}\u2069`);
  }
  return out;
}

export function CourseCard({ c, locale, arabicIndic, categories }: { c: any; locale: Locale; arabicIndic?: boolean; categories?: Array<{ code: string; fr: string; ar: string }> }) {
  const t = trFor(locale);
  const pick = pickFor(locale);
  const points: string[] = (locale === 'ar' && c.keyPointsAr?.length ? c.keyPointsAr : c.keyPointsFr) || [];
  const slots = slotSummary(locale, c.slots || [], arabicIndic);
  const cat = categories?.find((x) => x.code === c.category);
  return (
    <article className="flex flex-col overflow-hidden rounded-[1.25rem] bg-white shadow-card">
      <div className="h-1.5" style={{ background: c.color || 'var(--color-brand-600)' }} />
      <div className="flex flex-1 flex-col gap-4 p-5 sm:p-6">
        <div className="flex items-start gap-4">
          <span className="grid size-12 shrink-0 place-items-center rounded-2xl text-white" style={{ background: c.color || 'var(--color-brand-600)' }}>
            <CourseIcon name={c.icon} className="size-6" />
          </span>
          <div className="min-w-0">
            <h3 className="font-serif text-lg font-bold leading-snug text-brand-800">{pick(c.titleFr, c.titleAr)}</h3>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              <Badge tone="info">
                <Users className="size-3" /> {audienceLabel(locale, c.audience)}
                {c.minAge ? ` · ${t('dès', 'من')} ${c.minAge} ${t('ans', 'سنوات')}` : ''}
              </Badge>
              {c.level && <Badge tone="gold">{pick(c.level.labelFr, c.level.labelAr)}</Badge>}
              {cat && <Badge>{pick(cat.fr, cat.ar)}</Badge>}
            </div>
          </div>
        </div>
        <p className="text-[0.95rem] leading-relaxed text-brand-600">{pick(c.descriptionFr, c.descriptionAr)}</p>
        {points.length > 0 && (
          <ul className="grid gap-1.5 text-sm text-brand-700 sm:grid-cols-2">
            {points.map((p) => (
              <li key={p} className="flex items-start gap-2">
                <Check className="mt-0.5 size-4 shrink-0 text-ok" /> {p}
              </li>
            ))}
          </ul>
        )}
        {slots.length > 0 && (
          <div className="mt-auto flex flex-wrap gap-2 border-t border-sand-200 pt-4">
            {slots.map((x) => (
              <span key={x} className="inline-flex items-center gap-1.5 rounded-full bg-sand-200/70 px-3 py-1 text-sm font-medium text-brand-700">
                <Clock className="size-3.5 text-gold-700" /> {x}
              </span>
            ))}
          </div>
        )}
      </div>
    </article>
  );
}

export function AnnouncementCard({ a, locale, categories, arabicIndic }: { a: any; locale: Locale; categories: Array<{ code: string; fr: string; ar: string }>; arabicIndic?: boolean }) {
  const pick = pickFor(locale);
  const cat = categories.find((c) => c.code === a.category);
  const body: string = pick(a.bodyFr, a.bodyAr);
  return (
    <Link
      href={`/news/${a.id}`}
      className="group flex flex-col overflow-hidden rounded-[1.25rem] bg-white shadow-card transition hover:-translate-y-0.5 hover:shadow-lift"
    >
      {a.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={a.imageUrl} alt="" className="aspect-[16/9] w-full object-cover" loading="lazy" />
      )}
      <div className="flex flex-1 flex-col gap-2 p-5">
        <div className="flex flex-wrap items-center gap-2 text-xs text-brand-400">
          {cat && <Badge tone={a.category === 'urgent' ? 'bad' : 'gold'}>{pick(cat.fr, cat.ar)}</Badge>}
          <time dateTime={a.publishedAt}>{formatDate(a.publishedAt, intlLocale(locale, arabicIndic))}</time>
        </div>
        <h3 className="font-serif text-lg font-bold leading-snug text-brand-800 group-hover:text-brand-600">{pick(a.titleFr, a.titleAr)}</h3>
        <p className="line-clamp-3 text-sm leading-relaxed text-brand-500">{body}</p>
      </div>
    </Link>
  );
}

export function InfoRow({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-600">{icon}</span>
      <div className="min-w-0 pt-1 text-brand-700">{children}</div>
    </div>
  );
}

export { MapPin };
export type { SlotGroup };
