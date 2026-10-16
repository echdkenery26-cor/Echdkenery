import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { CourseCard, PageHero, Section } from '@/components/site/blocks';
import { Link } from '@/components/ui/button';
import { isLocale, trFor } from '@/lib/locale';
import { getSettings, publicGet } from '@/lib/server-api';
import { cn } from '@/lib/utils';

export const metadata: Metadata = { title: 'Cours · الدروس' };

export default async function CoursesPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ audience?: string }> }) {
  const { locale } = await params;
  const { audience } = await searchParams;
  if (!isLocale(locale)) notFound();
  const t = trFor(locale);
  const [s, courses] = await Promise.all([getSettings(), publicGet<any[]>('/courses')]);
  const filter = audience === 'CHILD' || audience === 'ADULT' ? audience : '';
  const list = (courses || []).filter((c) => !filter || c.audience === filter);
  const tabs = [
    { v: '', label: t('Tous', 'الكل') },
    { v: 'CHILD', label: t('Enfants', 'الأطفال') },
    { v: 'ADULT', label: t('Adultes', 'الكبار') },
  ];
  return (
    <>
      <PageHero
        title={t('Nos cours', 'دروسنا')}
        text={t('Arabe et Coran, pour les enfants dès 6 ans et pour les adultes, du niveau 0 au niveau confirmé.', 'العربية والقرآن، للأطفال من سن 6 سنوات وللكبار، من المستوى صفر إلى المتقدم.')}
      />
      <Section>
        <div className="mb-8 flex gap-2" role="tablist">
          {tabs.map((x) => (
            <Link
              key={x.v}
              href={x.v ? `/courses?audience=${x.v}` : '/courses'}
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
        {list.length ? (
          <div className="grid gap-5 md:grid-cols-2">
            {list.map((c) => (
              <CourseCard key={c.id} c={c} locale={locale} arabicIndic={!!s['display.arabicIndicDigits']} categories={s['course.categories']} />
            ))}
          </div>
        ) : (
          <p className="rounded-2xl bg-white p-6 text-brand-500 shadow-card">{t('Aucun cours à afficher pour le moment.', 'لا توجد دروس للعرض حالياً.')}</p>
        )}
      </Section>
    </>
  );
}
