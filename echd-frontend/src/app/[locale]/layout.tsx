import type { Metadata, Viewport } from 'next';
import { notFound } from 'next/navigation';
import '../globals.css';
import { PwaRegister } from '@/components/pwa-register';
import { FeedbackProvider } from '@/components/ui/feedback';
import { LocaleProvider } from '@/lib/i18n';
import { LOCALES, dirOf, isLocale, pickFor } from '@/lib/locale';
import { getSettings } from '@/lib/server-api';

// Les pages lisent l'API au moment de la requête (contenu toujours à jour).
export const dynamic = 'force-dynamic';

export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const s = await getSettings();
  const pick = pickFor(locale);
  const name = pick(s['institute.name'].fr, s['institute.name'].ar);
  return {
    title: { default: name, template: `%s · ${s['institute.shortName'] || name}` },
    description: pick(s['institute.presentation'].fr, s['institute.presentation'].ar),
    applicationName: name,
    manifest: '/manifest.webmanifest',
    appleWebApp: { capable: true, title: s['institute.shortName'] || name, statusBarStyle: 'black-translucent' },
    icons: { icon: '/icons/icon-192.png', apple: '/icons/apple-touch-icon.png' },
    alternates: { languages: { fr: '/fr', ar: '/ar' } },
  };
}

export const viewport: Viewport = {
  themeColor: '#1F4A3A',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default async function RootLocaleLayout({ children, params }: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const s = await getSettings();
  return (
    <html lang={locale} dir={dirOf(locale)}>
      <body className="min-h-dvh antialiased">
        <LocaleProvider locale={locale} arabicIndic={!!s['display.arabicIndicDigits']} currency={s['institute.currency'] || 'EUR'}>
          <FeedbackProvider>{children}</FeedbackProvider>
        </LocaleProvider>
        <PwaRegister />
      </body>
    </html>
  );
}
