//echd-frontend/src/components/app/balance-hero.tsx
'use client';

import { Eye, EyeOff, HandCoins, Plus, Wallet } from 'lucide-react';
import { useEffect, useState } from 'react';
import { AutoFit } from '@/components/ui/auto-fit';
import { Link } from '@/components/ui/button';
import { useAuth } from '@/lib/auth';
import { useApi } from '@/lib/hooks';
import { useLocale } from '@/lib/i18n';
import { cn } from '@/lib/utils';

const HIDE_KEY = 'echd.balance.hidden';

/**
 * Carte d'accueil du tableau de bord : salutation, solde disponible en grand (œil pour le masquer)
 * et les trois accès rapides. Le solde et les dépenses ne sont visibles que de l'administrateur.
 */
export function BalanceHero({ today }: { today: string }) {
  const { t, money } = useLocale();
  const { user, isAdmin } = useAuth();
  const bal = useApi<{ cash: { balanceCents: number } }>(isAdmin ? '/expenses/balance' : null, { period: 'month' });
  const [hidden, setHidden] = useState(false);

  // Le choix « solde masqué » est un confort propre à cet appareil
  useEffect(() => {
    try {
      setHidden(localStorage.getItem(HIDE_KEY) === '1');
    } catch {
      /* stockage indisponible : on garde l'affichage par défaut */
    }
  }, []);

  function toggle() {
    const next = !hidden;
    setHidden(next);
    try {
      localStorage.setItem(HIDE_KEY, next ? '1' : '0');
    } catch {
      /* ignoré */
    }
  }

  const cents = bal.data?.cash.balanceCents;
  const negative = cents != null && cents < 0;

  return (
    <section className="relative overflow-hidden rounded-[1.75rem] bg-white shadow-[0_28px_50px_-22px_rgb(18_43_35/0.5),0_2px_6px_rgb(18_43_35/0.06)] ring-1 ring-brand-100/70">
      <div className="h-1.5 bg-gradient-to-r from-gold-300 via-gold-500 to-gold-300" />
      <div className="pattern-star pointer-events-none absolute inset-y-0 end-0 w-3/4 [mask-image:linear-gradient(to_left,black,transparent)] rtl:[mask-image:linear-gradient(to_right,black,transparent)]" />

      <div className="relative px-5 pb-5 pt-4 sm:px-7 sm:pb-6 sm:pt-5 lg:flex lg:items-end lg:justify-between lg:gap-10">
        <div className="min-w-0 lg:max-w-xl lg:flex-1">
          <p className="text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-gold-700 rtl:tracking-normal">{today}</p>
          <h1 className="mt-1 font-serif text-xl font-bold leading-tight text-brand-800 sm:text-2xl">
            {t('Bonjour', 'مرحباً')} {user?.firstName}
          </h1>
          <p className="mt-1 text-sm text-brand-500">
            {isAdmin
              ? t('Suivez les encaissements et les dépenses de l’école.', 'تابع تحصيلات المدرسة ومصروفاتها.')
              : t('Suivez les cotisations de l’école.', 'تابع اشتراكات المدرسة.')}
          </p>

          {isAdmin && (
            <div className="mt-5">
              <div className="flex items-center gap-2 text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-brand-400 rtl:tracking-normal">
                <span>{t('Solde disponible', 'الرصيد المتاح')}</span>
                <button
                  type="button"
                  onClick={toggle}
                  aria-label={hidden ? t('Afficher le solde', 'إظهار الرصيد') : t('Masquer le solde', 'إخفاء الرصيد')}
                  className="grid size-7 place-items-center rounded-full text-brand-400 transition hover:bg-brand-50 hover:text-brand-700"
                >
                  {hidden ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
              <div className="mt-0.5">
                {cents == null && !bal.error ? (
                  <div className="h-10 w-44 animate-pulse rounded-xl bg-sand-200" aria-busy="true" />
                ) : (
                  <AutoFit maxSize={38} minSize={22} className={cn('num font-serif font-bold', negative && !hidden ? 'text-bad' : 'text-brand-700')}>
                    {hidden ? '•••• •••' : cents == null ? '—' : money(cents)}
                  </AutoFit>
                )}
              </div>
            </div>
          )}
        </div>

        <div className={cn('mt-5 grid gap-2.5 lg:mt-0 lg:shrink-0', isAdmin ? 'grid-cols-3 lg:w-[26rem]' : 'grid-cols-1 lg:w-56')}>
          <Shortcut href="/admin/finance" icon={<Wallet className="size-[1.15rem]" />} row={!isAdmin}>
            {t('Voir les cotisations', 'عرض الاشتراكات')}
          </Shortcut>
          {isAdmin && (
            <>
              <Shortcut href="/admin/expenses" icon={<HandCoins className="size-[1.15rem]" />}>
                {t('Voir les dépenses', 'عرض المصروفات')}
              </Shortcut>
              <Shortcut href="/admin/expenses?new=1" icon={<Plus className="size-[1.15rem]" />} primary>
                {t('Nouvelle dépense', 'مصروف جديد')}
              </Shortcut>
            </>
          )}
        </div>
      </div>
    </section>
  );
}

function Shortcut({ href, icon, children, primary, row }: { href: string; icon: React.ReactNode; children: React.ReactNode; primary?: boolean; row?: boolean }) {
  return (
    <Link
      href={href}
      className={cn(
        'flex min-w-0 rounded-2xl px-2 py-3 text-[0.8rem] font-semibold leading-tight transition active:scale-[0.98]',
        row ? 'flex-row items-center justify-center gap-3 text-sm' : 'flex-col items-center justify-start gap-1.5 text-center',
        primary
          ? 'bg-gold-500 text-brand-800 shadow-[0_10px_20px_-12px_rgb(176_143_58/0.95)] hover:bg-gold-400'
          : 'bg-sand-100 text-brand-700 ring-1 ring-sand-200 hover:bg-brand-50',
      )}
    >
      <span className={cn('grid size-9 shrink-0 place-items-center rounded-xl', primary ? 'bg-white/40 text-brand-800' : 'bg-white text-brand-600 shadow-card')}>{icon}</span>
      <span className="line-clamp-2">{children}</span>
    </Link>
  );
}
