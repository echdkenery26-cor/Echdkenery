import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { AnnouncementCard, PageHero, Section } from '@/components/site/blocks';
import { Link } from '@/components/ui/button';
import { isLocale, pickFor, trFor } from '@/lib/locale';
import { getSettings, publicGet } from '@/lib/server-api';
import { cn } from '@/lib/utils';

export const metadata: Metadata = { title: 'Actualités · الأخبار' };
const PAGE = 9;

export default async function NewsPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ category?: string; page?: string }> }) {
  const { locale } = await params;
  const sp = await searchParams;
  if (!isLocale(locale)) notFound();
  const t = trFor(locale);
  const pick = pickFor(locale);
  const page = Math.max(1, Number(sp.page) || 1);
  const s = await getSettings();
  const cats = s['announcement.categories'];
  const category = cats.some((c) => c.code === sp.category) ? sp.category! : '';
  const qs = new URLSearchParams({ limit: String(PAGE), page: String(page), ...(category ? { category } : {}) });
  const data = await publicGet<{ items: any[]; total: number }>(`/announcements?${qs}`);
  const pages = Math.max(1, Math.ceil((data?.total || 0) / PAGE));
  const link = (p: number, c = category) => `/news?${new URLSearchParams({ ...(c ? { category: c } : {}), ...(p > 1 ? { page: String(p) } : {}) })}`.replace(/\?$/, '');

  return (
    <>
      <PageHero title={t('Actualités', 'الأخبار')} text={t('Rentrée, vacances, changements d’horaires : tout ce qu’il faut savoir.', 'الدخول المدرسي والعطل وتغيّر المواعيد: كل ما يهمّكم.')} />
      <Section>
        <div className="scroll-x -mx-4 mb-8 flex gap-2 px-4 sm:mx-0 sm:flex-wrap sm:px-0">
          {[{ code: '', fr: 'Tout', ar: 'الكل' }, ...cats].map((c) => (
            <Link
              key={c.code}
              href={link(1, c.code)}
              scroll={false}
              className={cn(
                'tap grid shrink-0 place-items-center rounded-full px-5 text-sm font-semibold transition',
                category === c.code ? 'bg-brand-600 text-white' : 'bg-white text-brand-600 shadow-card hover:bg-brand-50',
              )}
            >
              {pick(c.fr, c.ar)}
            </Link>
          ))}
        </div>
        {data && data.items.length > 0 ? (
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {data.items.map((a) => (
              <AnnouncementCard key={a.id} a={a} locale={locale} categories={cats} arabicIndic={!!s['display.arabicIndicDigits']} />
            ))}
          </div>
        ) : (
          <p className="rounded-2xl bg-white p-6 text-brand-500 shadow-card">{t('Aucune actualité pour le moment.', 'لا توجد أخبار حالياً.')}</p>
        )}
        {pages > 1 && (
          <nav className="mt-10 flex items-center justify-center gap-3">
            {page > 1 && (
              <Link href={link(page - 1)} className="tap rounded-xl bg-white px-4 py-2.5 text-sm font-semibold shadow-card">
                {t('Précédent', 'السابق')}
              </Link>
            )}
            <span className="num text-sm text-brand-500">
              {page} / {pages}
            </span>
            {page < pages && (
              <Link href={link(page + 1)} className="tap rounded-xl bg-white px-4 py-2.5 text-sm font-semibold shadow-card">
                {t('Suivant', 'التالي')}
              </Link>
            )}
          </nav>
        )}
      </Section>
    </>
  );
}
