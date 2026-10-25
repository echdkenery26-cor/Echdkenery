//echd-frontend/src/app/[locale]/(app)/admin/expenses/page.tsx
'use client';

import { Download, HandCoins, Landmark, Plus, TrendingDown, TrendingUp, Wallet } from 'lucide-react';
import { useEffect, useState } from 'react';
import { CancelExpenseModal, EXPENSE_CATEGORIES, ExpenseCard, ExpenseModal, categoryMeta, periodBounds } from '@/components/app/expense-bits';
import { Button } from '@/components/ui/button';
import { Badge, Card, CardTitle, PageHeader, Pagination, ProgressBar, StatCard } from '@/components/ui/display';
import { EmptyState, ErrorState, SkeletonCards, useToast } from '@/components/ui/feedback';
import { Chips, SearchBox, Switch } from '@/components/ui/form';
import { Popover } from '@/components/ui/popover';
import { download } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { messageOf, useApi } from '@/lib/hooks';
import { useLocale } from '@/lib/i18n';
import { todayISO } from '@/lib/locale';
import { useUrlState } from '@/lib/url-state';
import { cn } from '@/lib/utils';

const PAGE = 20;
type Period = 'month' | 'quarter' | 'year' | 'all';

export default function ExpensesPage() {
  const { t, num, money, loc } = useLocale();
  const { isAdmin } = useAuth();
  const toast = useToast();
  const [f, set] = useUrlState({ period: 'month', month: '', category: '', q: '', cancelled: '', page: '1', new: '' });
  const period = f.period as Period;
  const month = f.month || todayISO().slice(0, 7);
  const [editing, setEditing] = useState<any | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [cancelling, setCancelling] = useState<any | null>(null);

  // Lien « + Dépense » du tableau de bord : ouvre directement le formulaire
  useEffect(() => {
    if (f.new) {
      setEditing(null);
      setFormOpen(true);
      set({ new: '' }, false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [f.new]);

  const bounds = period === 'all' ? null : periodBounds(period, month);
  const balance = useApi<any>(isAdmin ? '/expenses/balance' : null, { period: period === 'all' ? 'year' : period, ref: month });
  const list = useApi<any>(isAdmin ? '/expenses' : null, {
    category: f.category || undefined,
    q: f.q || undefined,
    from: bounds?.from,
    to: bounds?.to,
    includeCancelled: f.cancelled ? 'true' : undefined,
    page: Number(f.page),
    pageSize: PAGE,
  });

  if (!isAdmin) {
    return <EmptyState icon={<HandCoins className="size-6" />} title={t('Accès réservé à l’administrateur', 'متاح للمدير فقط')} text={t('Les dépenses et le solde sont visibles par l’administrateur uniquement.', 'المصروفات والرصيد يراها المدير فقط.')} />;
  }

  const b = balance.data;
  const cash = b?.cash;
  const maxCat = b ? Math.max(...b.byCategory.map((c: any) => c.cents), 1) : 1;
  const monthLabel = (m: string) => new Intl.DateTimeFormat(loc, { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${m}-01T00:00:00Z`));
  const shortMonth = (m: string) => new Intl.DateTimeFormat(loc, { month: 'short', timeZone: 'UTC' }).format(new Date(`${m}-01T00:00:00Z`));

  async function exportFile() {
    try {
      await download('/exports/expenses', { format: 'xlsx', category: f.category || undefined, q: f.q || undefined, from: bounds?.from, to: bounds?.to, includeCancelled: f.cancelled ? 'true' : undefined }, 'depenses.xlsx');
    } catch (e) {
      toast.error(messageOf(e));
    }
  }

  const periodTitle = !b
    ? ''
    : period === 'all'
      ? t('Depuis le début', 'منذ البداية')
      : period === 'year'
        ? monthLabel(month).split(' ').pop()!
        : period === 'quarter'
          ? `${shortMonth(b.byMonth[0].month)} – ${shortMonth(b.byMonth[b.byMonth.length - 1].month)} ${b.from.slice(0, 4)}`
          : monthLabel(month);

  // Regroupement visuel par mois (la page courante de l'historique)
  const groups: Array<{ month: string; items: any[] }> = [];
  for (const it of list.data?.items ?? []) {
    const m = String(it.spentAt).slice(0, 7);
    const last = groups[groups.length - 1];
    if (last && last.month === m) last.items.push(it);
    else groups.push({ month: m, items: [it] });
  }

  return (
    <div>
      <PageHeader
        title={t('Dépenses', 'المصروفات')}
        subtitle={t('Salaires, équipements, fournitures… chaque dépense est déduite automatiquement du solde.', 'الرواتب والمعدات واللوازم… كل مصروف يُخصم تلقائياً من الرصيد.')}
        actions={
          <>
            <Popover
              trigger={(p) => (
                <Button variant="outline" icon={<Download className="size-4" />} onClick={p.toggle} aria-expanded={p.open}>
                  {t('Exporter', 'تصدير')}
                </Button>
              )}
            >
              {(close) => (
                <div className="flex w-60 flex-col p-1.5">
                  <button type="button" className="tap rounded-xl px-3 text-start text-sm font-semibold text-brand-700 hover:bg-sand-100" onClick={() => { close(); exportFile(); }}>
                    {t('Historique affiché (Excel)', 'السجل المعروض (Excel)')}
                  </button>
                </div>
              )}
            </Popover>
            <Button variant="primary" icon={<Plus className="size-4" />} onClick={() => { setEditing(null); setFormOpen(true); }}>
              {t('Nouvelle dépense', 'مصروف جديد')}
            </Button>
          </>
        }
      />

      {/* Solde disponible */}
      <Card className="mb-4 bg-brand-700 text-white">
        <div className="flex items-start gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-white/15"><Landmark className="size-5" /></span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-white/75">{t('Solde disponible', 'الرصيد المتاح')}</p>
            <p className={cn('num font-serif text-3xl font-bold', cash && cash.balanceCents < 0 && 'text-red-200')}>{cash ? money(cash.balanceCents) : '…'}</p>
            {cash && (
              <p className="mt-1 text-xs text-white/70">
                {t('Solde de départ', 'الرصيد الابتدائي')} {money(cash.openingCents)} + {t('encaissé', 'المحصّل')} {money(cash.collectedCents)} − {t('dépensé', 'المصروف')} {money(cash.spentCents)}
              </p>
            )}
          </div>
        </div>
      </Card>

      {/* Période */}
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <div role="tablist" aria-label={t('Période', 'الفترة')} className="grid grid-cols-4 gap-1 rounded-2xl bg-sand-200/70 p-1">
          {([['month', t('Mois', 'الشهر')], ['quarter', t('Trimestre', 'الربع')], ['year', t('Année', 'السنة')], ['all', t('Tout', 'الكل')]] as Array<[Period, string]>).map(([v, label]) => (
            <button
              key={v}
              type="button"
              role="tab"
              aria-selected={period === v}
              onClick={() => set({ period: v })}
              className={cn('tap rounded-xl px-3 py-1.5 text-sm font-semibold transition', period === v ? 'bg-white text-brand-700 shadow-card' : 'text-brand-500 hover:text-brand-700')}
            >
              {label}
            </button>
          ))}
        </div>
        {period !== 'all' && (
          <input
            type="month"
            dir="ltr"
            aria-label={t('Mois de référence', 'الشهر المرجعي')}
            value={month}
            onChange={(e) => e.target.value && set({ month: e.target.value })}
            className="tap rounded-xl bg-white px-3 text-sm font-semibold text-brand-700 shadow-card outline-none focus-visible:ring-2 focus-visible:ring-gold-500"
          />
        )}
        {period !== 'all' && <span className="text-sm font-semibold text-brand-500">{periodTitle}</span>}
      </div>

      {balance.error && !b ? (
        <ErrorState message={balance.error.message} onRetry={balance.reload} />
      ) : (
        <>
          <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <StatCard icon={<TrendingUp className="size-5 sm:size-6" />} tone="ok" value={b ? money(period === 'all' ? cash.collectedCents : b.collectedCents) : '…'} label={t('Encaissé', 'المحصّل')} />
            <StatCard icon={<TrendingDown className="size-5 sm:size-6" />} tone="warn" value={b ? money(period === 'all' ? cash.spentCents : b.spentCents) : '…'} label={t('Dépensé', 'المصروف')} hint={b && period !== 'all' ? t(`${num(b.expensesCount)} dépense(s)`, `${num(b.expensesCount)} مصروف`) : undefined} />
            <StatCard
              icon={<Wallet className="size-5 sm:size-6" />}
              tone={b && (period === 'all' ? cash.collectedCents - cash.spentCents : b.balanceCents) < 0 ? 'bad' : 'gold'}
              value={b ? money(period === 'all' ? cash.collectedCents - cash.spentCents : b.balanceCents) : '…'}
              label={t('Solde de la période', 'رصيد الفترة')}
              hint={t('encaissé − dépensé', 'المحصّل − المصروف')}
            />
          </div>

          {b && period !== 'all' && (
            <>
              <div className="mb-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
                {EXPENSE_CATEGORIES.map((c) => {
                  const row = b.byCategory.find((x: any) => x.category === c) ?? { cents: 0, count: 0 };
                  const m = categoryMeta(c, t);
                  const Icon = m.icon;
                  const on = f.category === c;
                  return (
                    <button key={c} type="button" onClick={() => set({ category: on ? '' : c })} aria-pressed={on} className={cn('rounded-3xl bg-white p-3.5 text-start shadow-card transition hover:shadow-float', on && 'ring-2 ring-gold-500')}>
                      <span className={cn('mb-2 grid size-9 place-items-center rounded-xl', m.bubble)}><Icon className="size-4" /></span>
                      <p className="truncate text-xs font-semibold text-brand-500">{m.label}</p>
                      <p className="num truncate font-serif text-lg font-bold text-brand-800">{money(row.cents)}</p>
                      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-sand-200">
                        <div className={cn('h-full rounded-full', m.bar)} style={{ width: `${Math.round((row.cents / maxCat) * 100)}%` }} />
                      </div>
                    </button>
                  );
                })}
              </div>

              {period !== 'month' && (
                <Card className="mb-3">
                  <CardTitle>{t('Mois par mois', 'شهراً بشهر')}</CardTitle>
                  <div className={cn('grid gap-2', period === 'year' ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4' : 'grid-cols-3')}>
                    {b.byMonth.map((m: any) => (
                      <div key={m.month} className="rounded-2xl bg-brand-50 p-2.5">
                        <p className="text-xs font-semibold capitalize text-brand-500">{shortMonth(m.month)}</p>
                        <p className={cn('num truncate text-sm font-bold', m.balanceCents < 0 ? 'text-bad' : 'text-brand-800')}>{money(m.balanceCents)}</p>
                        <p className="num truncate text-[11px] text-brand-400">+{money(m.collectedCents)} · −{money(m.spentCents)}</p>
                      </div>
                    ))}
                  </div>
                </Card>
              )}
            </>
          )}
        </>
      )}

      {/* Historique */}
      <div className="mb-3 mt-6 flex items-center justify-between gap-3">
        <h2 className="font-serif text-lg font-bold text-brand-800">{t('Historique des dépenses', 'سجل المصروفات')}</h2>
        {list.data && (
          <Badge tone="neutral">
            {t(`${num(list.data.total)} · ${money(list.data.summary.spentCents)}`, `${num(list.data.total)} · ${money(list.data.summary.spentCents)}`)}
          </Badge>
        )}
      </div>
      <div className="mb-4 space-y-3">
        <SearchBox value={f.q} onChange={(v) => set({ q: v })} placeholder={t('Rechercher (objet, bénéficiaire, n°)…', 'بحث (الموضوع، المستفيد، الرقم)…')} />
        <Chips
          value={f.category}
          onChange={(v) => set({ category: v })}
          options={[{ value: '', label: t('Toutes', 'الكل') }, ...EXPENSE_CATEGORIES.map((c) => ({ value: c as string, label: categoryMeta(c, t).label }))]}
        />
        <Switch checked={!!f.cancelled} onChange={(v) => set({ cancelled: v ? '1' : '' })} label={t('Afficher aussi les dépenses annulées', 'عرض المصروفات الملغاة أيضاً')} />
      </div>

      {list.error && !list.data ? (
        <ErrorState message={list.error.message} onRetry={list.reload} />
      ) : list.loading || !list.data ? (
        <SkeletonCards n={4} />
      ) : list.data.items.length === 0 ? (
        <EmptyState
          icon={<HandCoins className="size-6" />}
          title={f.q || f.category ? t('Aucune dépense ne correspond', 'لا يوجد مصروف مطابق') : t('Aucune dépense enregistrée', 'لا توجد مصروفات مسجّلة')}
          text={t('Enregistrez les salaires, achats et charges : le solde se met à jour tout seul.', 'سجّل الرواتب والمشتريات والأعباء: يتحدّث الرصيد تلقائياً.')}
          action={<Button variant="primary" icon={<Plus className="size-4" />} onClick={() => { setEditing(null); setFormOpen(true); }}>{t('Nouvelle dépense', 'مصروف جديد')}</Button>}
        />
      ) : (
        <>
          <div className="space-y-5">
            {groups.map((g) => (
              <section key={g.month}>
                <h3 className="mb-2 text-sm font-bold capitalize text-brand-500">{monthLabel(g.month)}</h3>
                <div className="grid gap-3 md:grid-cols-2">
                  {g.items.map((e) => (
                    <ExpenseCard key={e.id} e={e} onEdit={(x) => { setEditing(x); setFormOpen(true); }} onCancel={setCancelling} />
                  ))}
                </div>
              </section>
            ))}
          </div>
          <Pagination page={Number(f.page)} pageSize={PAGE} total={list.data.total} onChange={(p) => set({ page: String(p) }, false)} />
        </>
      )}

      <ExpenseModal open={formOpen} expense={editing} onClose={() => setFormOpen(false)} />
      <CancelExpenseModal expense={cancelling} onClose={() => setCancelling(null)} />
    </div>
  );
}
