'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { useLocale } from '@/lib/i18n';
import { stripLocale } from '@/lib/locale';
import { cn } from '@/lib/utils';

/** Bascule FR / العربية en gardant la page courante */
export function LangSwitch({ tone = 'light', className }: { tone?: 'light' | 'dark'; className?: string }) {
  const { locale } = useLocale();
  const path = stripLocale(usePathname() || '/');
  const item = (l: 'fr' | 'ar', label: string) => (
    <Link
      key={l}
      href={`/${l}${path === '/' ? '' : path}`}
      hrefLang={l}
      lang={l}
      aria-current={locale === l ? 'true' : undefined}
      className={cn(
        'tap grid place-items-center rounded-full px-3 text-sm font-semibold transition',
        locale === l
          ? tone === 'dark'
            ? 'bg-white text-brand-700'
            : 'bg-brand-600 text-white'
          : tone === 'dark'
            ? 'text-white/80 hover:bg-white/10'
            : 'text-brand-600 hover:bg-brand-50',
      )}
    >
      {label}
    </Link>
  );
  return (
    <div className={cn('inline-flex items-center gap-0.5 rounded-full p-0.5', tone === 'dark' ? 'bg-white/10' : 'bg-sand-200/80', className)}>
      {item('fr', 'FR')}
      {item('ar', 'عربي')}
    </div>
  );
}
