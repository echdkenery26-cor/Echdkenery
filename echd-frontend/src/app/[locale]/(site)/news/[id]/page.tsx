import { ArrowLeft, ArrowRight } from 'lucide-react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Section } from '@/components/site/blocks';
import { Link } from '@/components/ui/button';
import { Badge } from '@/components/ui/display';
import { formatDate, intlLocale, isLocale, pickFor, trFor } from '@/lib/locale';
import { getSettings, publicGet } from '@/lib/server-api';

export async function generateMetadata({ params }: { params: Promise<{ locale: string; id: string }> }): Promise<Metadata> {
  const { locale, id } = await params;
  const a = await publicGet<any>(`/announcements/${id}`);
  return a && isLocale(locale) ? { title: pickFor(locale)(a.titleFr, a.titleAr) } : {};
}

export default async function AnnouncementPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  if (!isLocale(locale)) notFound();
  const t = trFor(locale);
  const pick = pickFor(locale);
  const [s, a] = await Promise.all([getSettings(), publicGet<any>(`/announcements/${id}`)]);
  if (!a) notFound();
  const loc = intlLocale(locale, !!s['display.arabicIndicDigits']);
  const cat = s['announcement.categories'].find((c) => c.code === a.category);
  const when = a.publishedAt || a.createdAt;
  const hijri = a.showHijri && when ? new Intl.DateTimeFormat(`${locale === 'ar' ? 'ar' : 'fr'}-u-ca-islamic-umalqura`, { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(when)) : null;
  const Back = locale === 'ar' ? ArrowRight : ArrowLeft;
  return (
    <Section>
      <article className="mx-auto max-w-3xl">
        <Link href="/news" className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-brand-600 hover:underline">
          <Back className="size-4" /> {t('Toutes les actualités', 'كل الأخبار')}
        </Link>
        <div className="mb-3 flex flex-wrap items-center gap-2 text-sm text-brand-400">
          {cat && <Badge tone={a.category === s['announcement.urgentCategory'] ? 'bad' : 'gold'}>{pick(cat.fr, cat.ar)}</Badge>}
          <time dateTime={when}>{formatDate(when, loc, 'long')}</time>
          {hijri && <span>· {hijri}</span>}
        </div>
        <h1 className="font-serif text-3xl font-bold leading-tight text-brand-800 sm:text-4xl">{pick(a.titleFr, a.titleAr)}</h1>
        {a.imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={a.imageUrl} alt="" className="mt-6 w-full rounded-[1.25rem] shadow-card" />
        )}
        <div className="mt-6 whitespace-pre-line text-lg leading-relaxed text-brand-700">{pick(a.bodyFr, a.bodyAr)}</div>
      </article>
    </Section>
  );
}
