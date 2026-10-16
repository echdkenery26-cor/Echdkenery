import { Megaphone } from 'lucide-react';
import { notFound } from 'next/navigation';
import { MobileCta } from '@/components/site/mobile-cta';
import { SiteFooter } from '@/components/site/site-footer';
import { SiteHeader } from '@/components/site/site-header';
import { Link } from '@/components/ui/button';
import { isLocale, pickFor } from '@/lib/locale';
import { getSettings, publicGet } from '@/lib/server-api';

export default async function SiteLayout({ children, params }: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const pick = pickFor(locale);
  const [s, banner] = await Promise.all([getSettings(), publicGet<any[]>('/announcements/banner', 30)]);
  const urgent = banner?.[0];
  return (
    <>
      <a href="#contenu" className="sr-only focus:not-sr-only focus:fixed focus:start-3 focus:top-3 focus:z-[70] focus:rounded-xl focus:bg-gold-500 focus:px-4 focus:py-2 focus:font-semibold">
        {locale === 'ar' ? 'تخطَّ إلى المحتوى' : 'Aller au contenu'}
      </a>
      {urgent && (
        <Link href={`/news/${urgent.id}`} className="block bg-gold-500 px-4 py-2.5 text-center text-sm font-semibold text-brand-800 hover:bg-gold-400">
          <Megaphone className="me-2 inline size-4 align-text-bottom" />
          {pick(urgent.titleFr, urgent.titleAr)}
        </Link>
      )}
      <SiteHeader
        name={pick(s['institute.name'].fr, s['institute.name'].ar)}
        logoUrl={s['institute.logoUrl']}
        registrationOpen={!!s['site.registrationOpen']}
      />
      <main id="contenu">{children}</main>
      <SiteFooter locale={locale} s={s} />
      {s['site.registrationOpen'] && <MobileCta />}
    </>
  );
}
