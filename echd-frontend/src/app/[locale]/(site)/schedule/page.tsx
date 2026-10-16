import { Clock, DoorOpen, UserRound } from 'lucide-react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { CourseIcon } from '@/components/course-icon';
import { PageHero, Section, audienceLabel } from '@/components/site/blocks';
import { Link } from '@/components/ui/button';
import { Badge } from '@/components/ui/display';
import { formatTime, intlLocale, isLocale, pickFor, trFor, weekdayName } from '@/lib/locale';
import { PubSlot, byWeekday, groupSlots } from '@/lib/schedule';
import { getSettings, publicGet } from '@/lib/server-api';
import { cn } from '@/lib/utils';

export const metadata: Metadata = { title: 'Horaires · المواعيد' };

export default async function SchedulePage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ audience?: string }> }) {
  const { locale } = await params;
  const { audience } = await searchParams;
  if (!isLocale(locale)) notFound();
  const t = trFor(locale);
  const pick = pickFor(locale);
  const [s, data] = await Promise.all([getSettings(), publicGet<{ slots: PubSlot[] }>('/schedule')]);
  const loc = intlLocale(locale, !!s['display.arabicIndicDigits']);
  const filter = audience === 'CHILD' || audience === 'ADULT' ? audience : '';
  const days = byWeekday(groupSlots((data?.slots || []).filter((x) => !filter || x.course.audience === filter)));
  const tabs = [
    { v: '', label: t('Tous', 'الكل') },
    { v: 'CHILD', label: t('Enfants', 'الأطفال') },
    { v: 'ADULT', label: t('Adultes', 'الكبار') },
  ];
  return (
    <>
      <PageHero title={t('Horaires de la semaine', 'مواعيد الأسبوع')} text={pick(s['institute.hours'].fr, s['institute.hours'].ar)} />
      <Section>
        <div className="mb-8 flex gap-2">
          {tabs.map((x) => (
            <Link
              key={x.v}
              href={x.v ? `/schedule?audience=${x.v}` : '/schedule'}
              scroll={false}
              className={cn(
                'tap grid place-items-center rounded-full px-5 text-sm font-semibold transition',
                filter === x.v ? 'bg-brand-600 text-white' : 'bg-white text-brand-600 shadow-card hover:bg-brand-50',
              )}
            >
              {x.label}
            </Link>
          ))}
        </div>
        {days.length === 0 && <p className="rounded-2xl bg-white p-6 text-brand-500 shadow-card">{t('Aucun horaire publié pour le moment.', 'لا توجد مواعيد منشورة حالياً.')}</p>}
        <div className="space-y-8">
          {days.map(([wd, groups]) => (
            <div key={wd}>
              <h2 className="mb-4 font-serif text-xl font-bold text-brand-800">{weekdayName(wd, loc)}</h2>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {groups.map((g) => (
                  <article key={g.key} className="flex gap-4 rounded-[1.25rem] bg-white p-4 shadow-card sm:p-5">
                    <span className="grid size-11 shrink-0 place-items-center rounded-2xl text-white" style={{ background: g.course.color }}>
                      <CourseIcon name={g.course.icon} className="size-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p dir="ltr" className="num inline-flex items-center gap-1.5 font-serif text-lg font-bold text-brand-700">
                        <Clock className="size-4 text-gold-600" />
                        {formatTime(g.startTime, loc)}–{formatTime(g.endTime, loc)}
                      </p>
                      <h3 className="mt-0.5 font-semibold leading-snug text-brand-800">{pick(g.course.titleFr, g.course.titleAr)}</h3>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        <Badge tone="info">{audienceLabel(locale, g.course.audience)}</Badge>
                        {g.course.level && <Badge tone="gold">{pick(g.course.level.labelFr, g.course.level.labelAr)}</Badge>}
                      </div>
                      {(g.teachers.length > 0 || g.rooms.length > 0) && (
                        <ul className="mt-3 space-y-1 text-sm text-brand-500">
                          {g.teachers.length > 0 && (
                            <li className="flex items-center gap-2">
                              <UserRound className="size-3.5" /> {g.teachers.join(', ')}
                            </li>
                          )}
                          {g.rooms.length > 0 && (
                            <li className="flex items-center gap-2">
                              <DoorOpen className="size-3.5" /> {g.rooms.join(', ')}
                            </li>
                          )}
                        </ul>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Section>
    </>
  );
}
