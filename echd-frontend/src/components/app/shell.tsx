//echd-frontend/src/components/app/shell.tsx
'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { Bell, KeyRound, LogOut, MoreHorizontal, UserRound } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { Logo } from '@/components/brand';
import { LangSwitch } from '@/components/site/lang-switch';
import { Link } from '@/components/ui/button';
import { Avatar } from '@/components/ui/display';
import { Modal } from '@/components/ui/feedback';
import { Popover } from '@/components/ui/popover';
import { useAuth } from '@/lib/auth';
import { useApi } from '@/lib/hooks';
import { useLocale } from '@/lib/i18n';
import { stripLocale } from '@/lib/locale';
import { cn } from '@/lib/utils';
import { NavGroup, NavItem, STAFF_NAV, TEACHER_NAV, roleLabel } from './nav';

function isActive(path: string, href: string) {
  if (href === '/admin' || href === '/teacher') return path === href;
  return path === href || path.startsWith(href + '/');
}

/** Pages hors menu qui doivent quand même s'annoncer dans la barre du haut. */
const EXTRA_PAGES: Array<{ href: string; label: [string, string]; icon: React.ComponentType<{ className?: string }> }> = [
  { href: '/account', label: ['Mon compte', 'حسابي'], icon: UserRound },
  { href: '/notifications', label: ['Notifications', 'الإشعارات'], icon: Bell },
];

export function AppShell({ children, name, logoUrl }: { children: React.ReactNode; name: string; logoUrl?: string | null }) {
  const { t, href } = useLocale();
  const router = useRouter();
  const pathname = stripLocale(usePathname() || '/');
  const { status, user, isStaff, isTeacher, mustChangePassword, logout } = useAuth();
  const [moreOpen, setMoreOpen] = useState(false);

  // Garde d'accès : connexion obligatoire, changement du mot de passe temporaire, bon espace selon le rôle
  useEffect(() => {
    if (status === 'anon') router.replace(`${href('/login')}?next=${encodeURIComponent(href(pathname))}`);
    else if (status === 'authed') {
      if (mustChangePassword) router.replace(href('/change-password'));
      else if (isTeacher && pathname.startsWith('/admin')) router.replace(href('/teacher'));
      else if (isStaff && pathname.startsWith('/teacher')) router.replace(href('/admin'));
    }
  }, [status, mustChangePassword, isTeacher, isStaff, pathname, router, href]);

  useEffect(() => setMoreOpen(false), [pathname]);

  const groups: NavGroup[] = useMemo(
    () =>
      (isTeacher ? TEACHER_NAV : STAFF_NAV)
        .map((g) => ({ ...g, items: g.items.filter((i) => !i.roles || (user && i.roles.includes(user.role))) }))
        .filter((g) => g.items.length),
    [isTeacher, user],
  );
  const all = groups.flatMap((g) => g.items);
  const tabs = all.filter((i) => i.tab);
  const prereg = useApi<{ new: number }>(isStaff ? '/pre-registrations/count' : null);
  const unread = useApi<{ count: number }>(user ? '/notifications/unread-count' : null, undefined, { refreshInterval: 60_000 });

  if (status !== 'authed' || !user || mustChangePassword || (isTeacher && pathname.startsWith('/admin')) || (isStaff && pathname.startsWith('/teacher'))) {
    return (
      <div className="grid min-h-dvh place-items-center bg-paper">
        <div className="size-10 animate-spin rounded-full border-4 border-brand-100 border-t-brand-600" role="status" aria-label="Chargement" />
      </div>
    );
  }

  const badge = (i: NavItem) => (i.badge === 'prereg' ? prereg.data?.new || 0 : 0);
  const current = all.find((i) => isActive(pathname, i.href)) ?? EXTRA_PAGES.find((i) => isActive(pathname, i.href));
  const unreadCount = unread.data?.count || 0;
  const homeHref = isTeacher ? '/teacher' : '/admin';
  // Sur le tableau de bord, la carte du solde « monte » sur le bandeau
  const overlapHero = isStaff && pathname === '/admin';

  const UserMenu = (
    <Popover
      trigger={({ toggle }) => (
        <button type="button" onClick={toggle} aria-label={t('Mon compte', 'حسابي')} className="tap grid place-items-center rounded-full">
          <Avatar first={user.firstName} last={user.lastName} size={40} />
        </button>
      )}
    >
      {(close) => (
        <div>
          <div className="px-3 pb-2 pt-1.5">
            <p className="font-semibold text-brand-800">{`${user.firstName} ${user.lastName}`.trim() || user.username}</p>
            <p className="text-xs text-brand-400">{roleLabel(user.role, t)}</p>
          </div>
          <div className="border-t border-sand-200 pt-1">
            <MenuLink href="/account" icon={<UserRound className="size-4" />} onClick={close}>
              {t('Mon compte', 'حسابي')}
            </MenuLink>
            <MenuLink href="/change-password" icon={<KeyRound className="size-4" />} onClick={close}>
              {t('Changer de mot de passe', 'تغيير كلمة المرور')}
            </MenuLink>
            <button
              type="button"
              onClick={() => logout().then(() => router.replace(href('/login')))}
              className="tap flex w-full items-center gap-3 rounded-xl px-3 text-sm font-semibold text-bad hover:bg-bad-soft"
            >
              <LogOut className="size-4" /> {t('Se déconnecter', 'تسجيل الخروج')}
            </button>
          </div>
        </div>
      )}
    </Popover>
  );

  const bell = (onDark: boolean) => (
    <Link
      href="/notifications"
      aria-label={t('Notifications', 'الإشعارات')}
      className={cn('tap relative grid place-items-center rounded-full transition', onDark ? 'bg-white/10 text-white hover:bg-white/20' : 'text-brand-600 hover:bg-brand-50')}
    >
      <Bell className="size-5" />
      {unreadCount > 0 && (
        <span className={cn('num absolute end-0.5 top-0.5 grid min-w-5 place-items-center rounded-full bg-gold-500 px-1 text-[0.68rem] font-bold leading-5 text-brand-800', onDark && 'ring-2 ring-brand-800')}>
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      )}
    </Link>
  );

  return (
    <div className="min-h-dvh bg-paper lg:flex">
      {/* Barre latérale (ordinateur) */}
      <aside className="no-print hidden w-64 shrink-0 lg:block">
        <div className="fixed inset-y-0 start-0 flex w-64 flex-col bg-brand-800 text-white">
          <Link href={homeHref} className="flex items-center gap-3 px-5 py-5">
            <Logo src={logoUrl} size={40} tone="light" />
            <span className="line-clamp-2 font-serif text-sm font-bold leading-snug">{name}</span>
          </Link>
          <nav className="flex-1 overflow-y-auto px-3 pb-4" aria-label={t('Navigation', 'التنقل')}>
            {groups.map((g) => (
              <div key={g.title[0]} className="mb-4">
                <p className="mb-1 px-3 text-xs font-semibold text-white/45">{t(...g.title)}</p>
                {g.items.map((i) => {
                  const on = isActive(pathname, i.href);
                  const n = badge(i);
                  return (
                    <Link
                      key={i.href}
                      href={i.href}
                      aria-current={on ? 'page' : undefined}
                      className={cn(
                        'flex min-h-11 items-center gap-3 rounded-xl px-3 text-[0.93rem] font-medium transition',
                        on ? 'bg-white/12 text-white shadow-[inset_3px_0_0_var(--color-gold-500)] rtl:shadow-[inset_-3px_0_0_var(--color-gold-500)]' : 'text-white/75 hover:bg-white/8 hover:text-white',
                      )}
                    >
                      <i.icon className={cn('size-[1.15rem]', on && 'text-gold-400')} />
                      <span className="flex-1">{t(...i.label)}</span>
                      {n > 0 && <span className="num rounded-full bg-gold-500 px-2 text-xs font-bold text-brand-800">{n}</span>}
                    </Link>
                  );
                })}
              </div>
            ))}
          </nav>
          <div className="border-t border-white/10 p-3">
            <LangSwitch tone="dark" className="w-full justify-center" />
          </div>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        {/* Barre du haut — téléphone : la barre reste collée en haut, le bandeau défile avec la page */}
        <header className="no-print sticky top-0 z-30 bg-brand-800 pt-[env(safe-area-inset-top)] lg:hidden">
          <div className="flex items-center gap-3 px-4 py-3">
            <Link href={homeHref} className="flex min-w-0 flex-1 items-center gap-3">
              <span className="grid size-[3.25rem] shrink-0 place-items-center rounded-2xl bg-white shadow-[0_8px_20px_-8px_rgb(0_0_0/0.6)] ring-2 ring-gold-400/70">
                <Logo src={logoUrl} size={42} />
              </span>
              <span className="min-w-0">
                <span className="line-clamp-2 block font-serif text-[0.95rem] font-bold leading-snug text-white">{name}</span>
                <span className="block truncate text-xs font-semibold text-gold-300">{roleLabel(user.role, t)}</span>
              </span>
            </Link>
            <div className="flex shrink-0 items-center gap-1.5">
              {bell(true)}
              {UserMenu}
            </div>
          </div>
        </header>
        <div className={cn('no-print relative overflow-hidden rounded-b-[1.75rem] bg-gradient-to-b from-brand-800 to-brand-700 px-4 pt-1 shadow-card lg:hidden', overlapHero ? 'pb-14' : 'pb-5')}>
          <div className="pattern-star pointer-events-none absolute inset-0 [mask-image:linear-gradient(to_bottom,transparent,black)]" />
          <div className="relative flex items-center justify-between gap-3">
            {current ? (
              <span className="flex min-w-0 items-center gap-2 rounded-full bg-white/10 py-1.5 ps-1.5 pe-4 text-white ring-1 ring-white/15">
                <span className="grid size-8 shrink-0 place-items-center rounded-full bg-gold-500 text-brand-800">
                  <current.icon className="size-4" />
                </span>
                <span className="truncate text-[0.95rem] font-semibold">{t(...current.label)}</span>
              </span>
            ) : (
              <span />
            )}
            <LangSwitch tone="dark" className="shrink-0" />
          </div>
        </div>

        {/* Barre du haut — ordinateur */}
        <header className="no-print sticky top-0 z-30 hidden h-16 items-center gap-2 bg-paper/90 px-8 backdrop-blur lg:flex">
          <div className="ms-auto flex items-center gap-1">
            {bell(false)}
            {UserMenu}
          </div>
        </header>

        <main className={cn('mx-auto w-full max-w-6xl px-4 pb-28 lg:px-8 lg:pb-12', overlapHero ? 'relative z-10 -mt-9 pt-0 lg:mt-0 lg:pt-2' : 'pt-5 lg:pt-2')}>
          <Suspense fallback={null}>{children}</Suspense>
        </main>
      </div>

      {/* Barre du bas (téléphone) */}
      <nav className="no-print safe-bottom fixed inset-x-0 bottom-0 z-40 bg-white shadow-float lg:hidden" aria-label={t('Navigation', 'التنقل')}>
        <ul className="mx-auto flex max-w-xl items-stretch justify-around px-1 pt-1">
          {tabs.map((i) => {
            const on = isActive(pathname, i.href);
            return (
              <li key={i.href} className="flex-1">
                <Link href={i.href} aria-current={on ? 'page' : undefined} className={cn('flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-xl text-[0.7rem] font-semibold', on ? 'text-brand-600' : 'text-brand-400')}>
                  <span className={cn('grid h-7 w-12 place-items-center rounded-full transition', on && 'bg-brand-100')}>
                    <i.icon className="size-5" />
                  </span>
                  {t(...(i.short || i.label))}
                </Link>
              </li>
            );
          })}
          {all.length > tabs.length && (
            <li className="flex-1">
              <button type="button" onClick={() => setMoreOpen(true)} className="flex min-h-14 w-full flex-col items-center justify-center gap-0.5 rounded-xl text-[0.7rem] font-semibold text-brand-400">
                <span className="relative grid h-7 w-12 place-items-center">
                  <MoreHorizontal className="size-5" />
                  {(prereg.data?.new || 0) > 0 && <span className="absolute end-2.5 top-0 size-2.5 rounded-full bg-gold-500" />}
                </span>
                {t('Plus', 'المزيد')}
              </button>
            </li>
          )}
        </ul>
      </nav>

      <Modal open={moreOpen} onClose={() => setMoreOpen(false)} title={t('Menu', 'القائمة')}>
        <div className="space-y-5 pb-2">
          {groups.map((g) => (
            <div key={g.title[0]}>
              <p className="mb-2 text-sm font-semibold text-brand-400">{t(...g.title)}</p>
              <div className="grid grid-cols-2 gap-2.5">
                {g.items.map((i) => {
                  const n = badge(i);
                  return (
                    <Link key={i.href} href={i.href} className={cn('relative flex min-h-16 items-center gap-3 rounded-2xl bg-white p-3 shadow-card', isActive(pathname, i.href) && 'ring-2 ring-brand-500')}>
                      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-600">
                        <i.icon className="size-5" />
                      </span>
                      <span className="text-sm font-semibold leading-tight text-brand-800">{t(...i.label)}</span>
                      {n > 0 && <span className="num absolute end-2 top-2 rounded-full bg-gold-500 px-1.5 text-xs font-bold text-brand-800">{n}</span>}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </Modal>
    </div>
  );
}

function MenuLink({ href, icon, children, onClick }: { href: string; icon: React.ReactNode; children: React.ReactNode; onClick: () => void }) {
  return (
    <Link href={href} onClick={onClick} className="tap flex items-center gap-3 rounded-xl px-3 text-sm font-semibold text-brand-700 hover:bg-brand-50">
      {icon} {children}
    </Link>
  );
}
