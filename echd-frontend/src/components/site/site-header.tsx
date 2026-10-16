'use client';

import { Menu, X } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Logo } from '@/components/brand';
import { Link, LinkButton } from '@/components/ui/button';
import { useLocale } from '@/lib/i18n';
import { stripLocale } from '@/lib/locale';
import { cn } from '@/lib/utils';
import { LangSwitch } from './lang-switch';

export function SiteHeader({ name, logoUrl, registrationOpen }: { name: string; logoUrl?: string | null; registrationOpen: boolean }) {
  const { t } = useLocale();
  const path = stripLocale(usePathname() || '/');
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => setOpen(false), [path]);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 8);
    on();
    window.addEventListener('scroll', on, { passive: true });
    return () => window.removeEventListener('scroll', on);
  }, []);

  const links = [
    { href: '/courses', label: t('Cours', 'الدروس') },
    { href: '/schedule', label: t('Horaires', 'المواعيد') },
    { href: '/team', label: t('Équipe', 'الفريق') },
    { href: '/news', label: t('Actualités', 'الأخبار') },
    { href: '/contact', label: t('Contact', 'اتصل بنا') },
  ];

  return (
    <header className={cn('sticky top-0 z-40 transition-shadow', scrolled || open ? 'bg-paper/95 shadow-card backdrop-blur' : 'bg-paper')}>
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4 sm:px-6">
        <Link href="/" className="flex min-w-0 items-center gap-3" aria-label={name}>
          <Logo src={logoUrl} size={40} />
          <span className="line-clamp-2 font-serif text-[0.9rem] font-bold leading-tight text-brand-800 sm:text-base">{name}</span>
        </Link>

        <nav className="ms-auto hidden items-center gap-1 lg:flex" aria-label={t('Navigation principale', 'التنقل الرئيسي')}>
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              aria-current={path.startsWith(l.href) ? 'page' : undefined}
              className={cn(
                'rounded-full px-3.5 py-2 text-sm font-semibold transition',
                path.startsWith(l.href) ? 'bg-brand-600 text-white' : 'text-brand-600 hover:bg-brand-50',
              )}
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="ms-auto flex items-center gap-2 lg:ms-3">
          <div className="hidden sm:block">
            <LangSwitch />
          </div>
          {registrationOpen && (
            <div className="hidden sm:block">
              <LinkButton href="/register" variant="primary" size="sm">
                {t('Pré-inscription', 'التسجيل المسبق')}
              </LinkButton>
            </div>
          )}
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-label={open ? t('Fermer le menu', 'إغلاق القائمة') : t('Ouvrir le menu', 'فتح القائمة')}
            className="tap grid size-11 place-items-center rounded-xl text-brand-700 hover:bg-brand-50 lg:hidden"
          >
            {open ? <X className="size-6" /> : <Menu className="size-6" />}
          </button>
        </div>
      </div>

      {open && (
        <div className="anim-fade border-t border-sand-200 bg-paper px-4 pb-5 pt-3 lg:hidden">
          <nav className="mx-auto flex max-w-6xl flex-col gap-1" aria-label={t('Menu', 'القائمة')}>
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={cn(
                  'tap flex items-center rounded-xl px-4 py-3 text-base font-semibold',
                  path.startsWith(l.href) ? 'bg-brand-600 text-white' : 'text-brand-700 hover:bg-brand-50',
                )}
              >
                {l.label}
              </Link>
            ))}
            <div className="mt-3 flex items-center justify-between gap-3 sm:hidden">
              <LangSwitch />
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
