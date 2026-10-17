//echd-frontend/src/components/app/collections-card.tsx
'use client';

import { Wallet } from 'lucide-react';
import { useState } from 'react';
import { Link } from '@/components/ui/button';
import { Badge, Card, CardTitle, ProgressBar } from '@/components/ui/display';
import { useApi } from '@/lib/hooks';
import { useLocale } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { methodLabel } from './labels';

type Period = 'month' | 'quarter' | 'year';

interface Collections {
  period: Period;
  ref: string;
  from: string;
  to: string;
  collectedCents: number;
  paymentsCount: number;
  byMethod: Array<{ method: string; cents: number }>;
  byMonth: Array<{ month: string; cents: number }>;
  expectedCents: number;
  expectedPaidCents: number;
}

/** « Encaissements » du tableau de bord : total réellement encaissé sur le mois, le trimestre ou l'année. */
export function CollectionsCard() {
  const { t, loc, money, num } = useLocale();
  const [period, setPeriod] = useState<Period>('month');
  const { data, error, validating, reload } = useApi<Collections>('/finance/collections', { period });

  const options: Array<{ value: Period; label: string }> = [
    { value: 'month', label: t('Mois', 'الشهر') },
    { value: 'quarter', label: t('Trimestre', 'الربع') },
    { value: 'year', label: t('Année', 'السنة') },
  ];

  const title = {
    month: t('Encaissements du mois', 'تحصيلات الشهر'),
    quarter: t('Encaissements du trimestre', 'تحصيلات الربع'),
    year: t('Encaissements de l’année', 'تحصيلات السنة'),
  }[period];

  // Les dates de l'API sont des jours « purs » : on les formate en UTC pour éviter tout décalage.
  const fmt = (iso: string, opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(loc, { ...opts, timeZone: 'UTC' }).format(new Date(`${iso}T00:00:00Z`));

  function periodLabel(d: Collections) {
    if (d.period === 'year') return fmt(d.from, { year: 'numeric' });
    if (d.period === 'quarter') {
      const q = Math.floor((Number(d.from.slice(5, 7)) - 1) / 3) + 1;
      const range = `${fmt(d.from, { month: 'short' })} – ${fmt(d.to, { month: 'short' })}`;
      return t(`T${q} ${d.from.slice(0, 4)} · ${range}`, `الربع ${num(q)} ${num(Number(d.from.slice(0, 4)))} · ${range}`);
    }
    return fmt(d.from, { month: 'long', year: 'numeric' });
  }

  const pct = data && data.expectedCents > 0 ? Math.round((data.collectedCents / data.expectedCents) * 100) : 0;
  const maxMonth = data ? Math.max(...data.byMonth.map((m) => m.cents), 0) : 0;

  return (
    <Card>
      <CardTitle icon={<Wallet className="size-4" />}>{title}</CardTitle>

      <div role="tablist" aria-label={t('Période', 'الفترة')} className="mb-4 grid grid-cols-3 gap-1 rounded-2xl bg-sand-200/70 p-1">
        {options.map((o) => {
          const on = o.value === period;
          return (
            <button
              key={o.value}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => setPeriod(o.value)}
              className={cn(
                'tap rounded-xl px-2 py-1.5 text-sm font-semibold transition',
                on ? 'bg-white text-brand-700 shadow-card' : 'text-brand-500 hover:text-brand-700',
              )}
            >
              {o.label}
            </button>
          );
        })}
      </div>

      {error && !data ? (
        <div className="rounded-xl bg-bad-soft p-3 text-sm text-bad">
          {t('Impossible de charger les encaissements.', 'تعذّر تحميل التحصيلات.')}{' '}
          <button type="button" className="font-semibold underline" onClick={reload}>
            {t('Réessayer', 'إعادة المحاولة')}
          </button>
        </div>
      ) : !data ? (
        <div className="space-y-3" aria-busy="true">
          <div className="h-9 w-40 animate-pulse rounded-xl bg-sand-200" />
          <div className="h-4 w-56 animate-pulse rounded-lg bg-sand-200" />
          <div className="h-2.5 w-full animate-pulse rounded-full bg-sand-200" />
        </div>
      ) : (
        <div className={cn('transition-opacity', validating && 'opacity-60')}>
          <p className="text-sm font-semibold text-brand-500">{periodLabel(data)}</p>
          <p className="num font-serif text-3xl font-bold text-brand-800">{money(data.collectedCents)}</p>
          <p className="mb-3 text-sm text-brand-500">
            {t(`sur ${money(data.expectedCents)} attendus`, `من أصل ${money(data.expectedCents)} متوقعة`)} ·{' '}
            {t(`${num(data.paymentsCount)} paiement(s)`, `${num(data.paymentsCount)} دفعة`)}
          </p>
          <ProgressBar value={pct} tone="ok" label={t('Encaissé', 'المحصَّل')} />

          {data.period !== 'month' && (
            <div className={cn('mt-4 grid gap-2', data.period === 'year' ? 'grid-cols-3 sm:grid-cols-4' : 'grid-cols-3')}>
              {data.byMonth.map((m) => (
                <div key={m.month} className="rounded-xl bg-brand-50 p-2.5">
                  <p className="text-xs font-semibold capitalize text-brand-500">{fmt(`${m.month}-01`, { month: 'short' })}</p>
                  <p className="num mt-0.5 truncate text-sm font-bold text-brand-800">{money(m.cents)}</p>
                  <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white">
                    <div className="h-full rounded-full bg-mint" style={{ width: `${maxMonth > 0 ? Math.round((m.cents / maxMonth) * 100) : 0}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}

          {data.byMethod.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {data.byMethod.map((m) => (
                <Badge key={m.method} tone="neutral">
                  {methodLabel(m.method, t)} · {money(m.cents)}
                </Badge>
              ))}
            </div>
          )}
        </div>
      )}

      <Link href="/admin/finance" className="tap mt-3 inline-flex items-center text-sm font-semibold text-brand-600 hover:underline">
        {t('Voir les cotisations', 'عرض الاشتراكات')}
      </Link>
    </Card>
  );
}
