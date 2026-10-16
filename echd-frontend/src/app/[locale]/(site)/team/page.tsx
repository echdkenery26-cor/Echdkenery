import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { PageHero, Section, SectionHead, audienceLabel } from '@/components/site/blocks';
import { Avatar } from '@/components/ui/display';
import { isLocale, pickFor, trFor } from '@/lib/locale';
import { publicGet } from '@/lib/server-api';

export const metadata: Metadata = { title: 'Équipe · الفريق' };

export default async function TeamPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = trFor(locale);
  const pick = pickFor(locale);
  const team = await publicGet<{ administration: any[]; teachers: any[] }>('/team');
  const admin = team?.administration || [];
  const teachers = team?.teachers || [];
  return (
    <>
      <PageHero title={t('Notre équipe', 'فريقنا')} text={t('Celles et ceux qui font vivre l’école, chaque samedi.', 'الذين يُحيون المدرسة كل أسبوع.')} />
      <Section>
        {admin.length > 0 && (
          <>
            <SectionHead title={t('Direction et administration', 'الإدارة')} />
            <div className="mb-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {admin.map((m) => (
                <article key={m.id} className="flex items-center gap-4 rounded-[1.25rem] bg-white p-5 shadow-card">
                  <Avatar src={m.photoUrl} first={m.name.split(' ')[0]} last={m.name.split(' ')[1]} size={64} />
                  <div className="min-w-0">
                    <h3 className="font-serif font-bold leading-snug text-brand-800">{m.name}</h3>
                    <p className="text-sm text-brand-500">{pick(m.roleFr, m.roleAr)}</p>
                  </div>
                </article>
              ))}
            </div>
          </>
        )}
        {teachers.length > 0 && (
          <>
            <SectionHead title={t('Enseignants', 'المعلمون')} />
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {teachers.map((m) => (
                <article key={m.id} className="flex flex-col items-center rounded-[1.25rem] bg-white p-6 text-center shadow-card">
                  <Avatar src={m.photoUrl} first={m.firstName} last={m.lastName} size={84} />
                  <h3 className="mt-3 font-serif font-bold text-brand-800">{`${m.firstName} ${m.lastName}`.trim()}</h3>
                  {m.specialty && <p className="text-sm text-brand-500">{m.specialty}</p>}
                  <p className="mt-1.5 text-xs text-brand-400">{(m.audiences || []).map((a: 'CHILD' | 'ADULT') => audienceLabel(locale, a)).join(' · ')}</p>
                </article>
              ))}
            </div>
          </>
        )}
        {admin.length === 0 && teachers.length === 0 && (
          <p className="rounded-2xl bg-white p-6 text-brand-500 shadow-card">{t('L’équipe sera bientôt présentée.', 'سيتم تقديم الفريق قريباً.')}</p>
        )}
      </Section>
    </>
  );
}
