import { Clock, MapPin, MessageCircle, Phone } from 'lucide-react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { AnnouncementCard, Arrow, CourseCard, InfoRow, Section, SectionHead } from '@/components/site/blocks';
import { Lauh } from '@/components/site/lauh';
import { LinkButton } from '@/components/ui/button';
import { isLocale, pickFor, trFor } from '@/lib/locale';
import { getSettings, publicGet } from '@/lib/server-api';
import { telLink, waLink } from '@/lib/utils';

export const metadata: Metadata = { title: { absolute: 'ECHD' } };

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = trFor(locale);
  const pick = pickFor(locale);
  const [s, courses, schedule, news] = await Promise.all([
    getSettings(),
    publicGet<any[]>('/courses'),
    publicGet<{ slots: any[] }>('/schedule'),
    publicGet<{ items: any[] }>('/announcements?limit=3'),
  ]);
  const open = !!s['site.registrationOpen'];
  const indic = !!s['display.arabicIndicDigits'];
  const steps: string[] = (locale === 'ar' ? s['site.registrationSteps'].ar : s['site.registrationSteps'].fr) || [];
  const address = pick(s['institute.address'].fr, s['institute.address'].ar);
  const hours = pick(s['institute.hours'].fr, s['institute.hours'].ar);

  return (
    <>
      {/* Accueil */}
      <div className="pattern-star relative overflow-hidden bg-brand-800 text-white">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 pb-16 pt-12 sm:px-6 sm:pb-24 sm:pt-16 md:grid-cols-[1.1fr_0.9fr]">
          <div>
            <h1 className="font-serif text-[2.1rem] font-bold leading-[1.15] sm:text-5xl sm:leading-[1.12]">
              {pick(s['site.heroTitle'].fr, s['site.heroTitle'].ar)}
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-white/75">{pick(s['institute.presentation'].fr, s['institute.presentation'].ar)}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              {open ? (
                <LinkButton href="/register" variant="primary" size="lg" icon={undefined}>
                  {t('Pré-inscription', 'التسجيل المسبق')}
                  <Arrow locale={locale} />
                </LinkButton>
              ) : (
                <p className="rounded-xl bg-white/10 px-4 py-3 text-sm text-white/85">{t('Les pré-inscriptions sont fermées pour le moment.', 'التسجيل المسبق مغلق حالياً.')}</p>
              )}
              <LinkButton href="/courses" variant="ghost" size="lg" className="text-white ring-1 ring-inset ring-white/30 hover:bg-white/10">
                {t('Voir les cours', 'عرض الدروس')}
              </LinkButton>
            </div>
          </div>
          <Lauh slots={schedule?.slots || []} locale={locale} arabicIndic={indic} />
        </div>
      </div>

      {/* Cours */}
      <Section>
        <SectionHead
          title={t('Nos cours', 'دروسنا')}
          text={t('Des parcours pour les enfants et pour les adultes, du niveau 0 au niveau confirmé.', 'مسارات للأطفال والكبار، من المستوى صفر إلى المتقدم.')}
          action={
            <LinkButton href="/courses" variant="outline" size="sm">
              {t('Tous les cours', 'كل الدروس')} <Arrow locale={locale} />
            </LinkButton>
          }
        />
        {courses && courses.length > 0 ? (
          <div className="grid gap-5 md:grid-cols-2">
            {courses.slice(0, 4).map((c) => (
              <CourseCard key={c.id} c={c} locale={locale} arabicIndic={indic} categories={s['course.categories']} />
            ))}
          </div>
        ) : (
          <p className="rounded-2xl bg-white p-6 text-brand-500 shadow-card">{t('Les cours seront bientôt publiés.', 'سيتم نشر الدروس قريباً.')}</p>
        )}
      </Section>

      {/* Comment s'inscrire */}
      {steps.length > 0 && (
        <Section tone="sand">
          <div className="grid gap-10 md:grid-cols-[0.9fr_1.1fr] md:items-center">
            <div>
              <h2 className="font-serif text-2xl font-bold leading-tight text-brand-800 sm:text-3xl">{t('Comment s’inscrire', 'كيف تسجّل')}</h2>
              <p className="mt-3 text-brand-500">{pick(s['site.registrationInfo'].fr, s['site.registrationInfo'].ar)}</p>
              {open && (
                <LinkButton href="/register" variant="primary" size="lg" className="mt-6">
                  {t('Commencer la pré-inscription', 'ابدأ التسجيل المسبق')} <Arrow locale={locale} />
                </LinkButton>
              )}
            </div>
            <ol className="space-y-3">
              {steps.map((st, i) => (
                <li key={i} className="flex items-center gap-4 rounded-[1.25rem] bg-white p-4 shadow-card sm:p-5">
                  <span className="num grid size-11 shrink-0 place-items-center rounded-full bg-brand-600 font-serif text-lg font-bold text-gold-400">
                    {new Intl.NumberFormat(indic && locale === 'ar' ? 'ar-EG' : locale === 'ar' ? 'ar-u-nu-latn' : 'fr-FR').format(i + 1)}
                  </span>
                  <p className="font-medium text-brand-700">{st}</p>
                </li>
              ))}
            </ol>
          </div>
        </Section>
      )}

      {/* Actualités */}
      {news && news.items.length > 0 && (
        <Section>
          <SectionHead
            title={t('Actualités', 'الأخبار')}
            action={
              <LinkButton href="/news" variant="outline" size="sm">
                {t('Toutes les actualités', 'كل الأخبار')} <Arrow locale={locale} />
              </LinkButton>
            }
          />
          <div className="grid gap-5 md:grid-cols-3">
            {news.items.map((a) => (
              <AnnouncementCard key={a.id} a={a} locale={locale} categories={s['announcement.categories']} arabicIndic={indic} />
            ))}
          </div>
        </Section>
      )}

      {/* Infos pratiques */}
      <Section tone="white">
        <SectionHead title={t('Venir nous voir', 'زورونا')} />
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {address && (
            <InfoRow icon={<MapPin className="size-4" />}>
              <p className="font-semibold">{t('Adresse', 'العنوان')}</p>
              <p className="text-sm text-brand-500">{address}</p>
            </InfoRow>
          )}
          {hours && (
            <InfoRow icon={<Clock className="size-4" />}>
              <p className="font-semibold">{t('Jours de cours', 'أيام الدراسة')}</p>
              <p className="text-sm text-brand-500">{hours}</p>
            </InfoRow>
          )}
          {s['institute.phone'] && (
            <InfoRow icon={<Phone className="size-4" />}>
              <p className="font-semibold">{t('Téléphone', 'الهاتف')}</p>
              <a href={telLink(s['institute.phone'])} dir="ltr" className="text-sm text-brand-500 underline-offset-2 hover:underline" style={{ unicodeBidi: 'plaintext' }}>
                {s['institute.phone']}
              </a>
            </InfoRow>
          )}
          {s['institute.whatsapp'] && (
            <InfoRow icon={<MessageCircle className="size-4" />}>
              <p className="font-semibold">WhatsApp</p>
              <a href={waLink(s['institute.whatsapp'])} target="_blank" rel="noreferrer" className="text-sm text-brand-500 underline-offset-2 hover:underline">
                {t('Écrire un message', 'إرسال رسالة')}
              </a>
            </InfoRow>
          )}
        </div>
        {!address && !hours && !s['institute.phone'] && !s['institute.whatsapp'] && (
          <p className="text-brand-500">{t('Les coordonnées seront bientôt publiées.', 'سيتم نشر بيانات الاتصال قريباً.')}</p>
        )}
      </Section>
    </>
  );
}
