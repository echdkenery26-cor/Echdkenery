//echd-frontend/src/app/[locale]/(app)/admin/finance/page.tsx
'use client';

import { AlertTriangle, Bell, CalendarClock, CheckCircle2, Download, Pencil, Plus, Receipt, RefreshCw, Trash2, TrendingUp, Users, Wallet } from 'lucide-react';
import { useEffect, useState } from 'react';
import {
  CancelPaymentModal,
  DueCard,
  ExemptModal,
  PaymentCard,
  PaymentModal,
  ReminderModal,
} from '@/components/app/finance-bits';
import { methodLabel } from '@/components/app/labels';
import { Button, IconButton, Link } from '@/components/ui/button';
import { Avatar, Badge, Card, PageHeader, Pagination, ProgressBar, StatCard, Tabs } from '@/components/ui/display';
import { EmptyState, ErrorState, Modal, Notice, SkeletonCards, useConfirm, useToast } from '@/components/ui/feedback';
import { Chips, SearchBox, SelectField, Switch, TextField } from '@/components/ui/form';
import { Popover } from '@/components/ui/popover';
import { api, del, download, post } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { invalidate, messageOf, useApi } from '@/lib/hooks';
import { useLocale } from '@/lib/i18n';
import { todayISO } from '@/lib/locale';
import { useLookups } from '@/lib/lookups';
import { useUrlState } from '@/lib/url-state';
import { centsToEuro, euroToCents } from '@/lib/utils';

type TabId = 'students' | 'dues' | 'payments' | 'fees';
const PAGE = 20;
const refreshAll = () => invalidate('/dues', '/payments', '/finance', '/students', '/dashboard', '/fees', '/expenses');

export default function FinancePage() {
  const { t, num, money } = useLocale();
  const { isAdmin } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const [f, set] = useUrlState({ tab: 'students', state: '', month: '', q: '', status: '', method: '', page: '1' });
  const tab = f.tab as TabId;
  const summary = useApi<any>('/finance/summary', { month: f.month || undefined });
  const [busy, setBusy] = useState(false);

  const month = f.month || summary.data?.month || todayISO().slice(0, 7);

  async function generate() {
    if (!(await confirm({ title: t('Générer les échéances manquantes ?', 'توليد الاستحقاقات الناقصة؟'), message: t('Crée les cotisations selon les barèmes pour tous les élèves inscrits. Aucun doublon n’est créé.', 'ينشئ الاشتراكات حسب الجداول لكل الطلاب المسجّلين دون تكرار.'), confirmLabel: t('Générer', 'توليد') }))) return;
    setBusy(true);
    try {
      const r = await post('/fees/generate', {});
      await refreshAll();
      toast.ok(t(`${num(r.created)} échéance(s) créée(s)`, `تم إنشاء ${num(r.created)} استحقاق`));
    } catch (e) {
      toast.error(messageOf(e));
    } finally {
      setBusy(false);
    }
  }

  async function exportFile(kind: 'dues' | 'payments' | 'accounting') {
    try {
      if (kind === 'accounting') await download('/exports/accounting', { month: f.month || undefined }, 'comptabilite.xlsx');
      else await download(`/exports/${kind}`, { format: 'xlsx', month: kind === 'dues' ? f.month || undefined : undefined }, `${kind}.xlsx`);
    } catch (e) {
      toast.error(messageOf(e));
    }
  }

  const s = summary.data;
  const rate = s && s.expectedCents > 0 ? Math.round((s.expectedPaidCents / s.expectedCents) * 100) : 0;

  return (
    <div>
      <PageHeader
        title={t('Cotisations', 'الاشتراكات')}
        subtitle={t('Échéances, paiements et reçus.', 'الاستحقاقات والدفعات والإيصالات.')}
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
                <div className="flex w-56 flex-col p-1.5">
                  <button type="button" className="tap rounded-xl px-3 text-start text-sm font-semibold text-brand-700 hover:bg-sand-100" onClick={() => { close(); exportFile('dues'); }}>
                    {t('Échéances (Excel)', 'الاستحقاقات (Excel)')}
                  </button>
                  <button type="button" className="tap rounded-xl px-3 text-start text-sm font-semibold text-brand-700 hover:bg-sand-100" onClick={() => { close(); exportFile('payments'); }}>
                    {t('Paiements (Excel)', 'الدفعات (Excel)')}
                  </button>
                  <button type="button" className="tap rounded-xl px-3 text-start text-sm font-semibold text-brand-700 hover:bg-sand-100" onClick={() => { close(); exportFile('accounting'); }}>
                    {t('Comptabilité du mois (Excel)', 'محاسبة الشهر (Excel)')}
                  </button>
                </div>
              )}
            </Popover>
            <Button variant="dark" loading={busy} icon={<RefreshCw className="size-4" />} onClick={generate}>
              {t('Générer les échéances', 'توليد الاستحقاقات')}
            </Button>
          </>
        }
      />

      <div className="mb-4 flex items-center gap-3">
        <label className="flex items-center gap-2 text-sm font-semibold text-brand-600">
          <CalendarClock className="size-4" />
          <span className="sr-only sm:not-sr-only">{t('Mois', 'الشهر')}</span>
          <input
            type="month"
            dir="ltr"
            value={month}
            onChange={(e) => set({ month: e.target.value }, false)}
            className="tap rounded-xl bg-white px-3 text-sm font-semibold text-brand-700 shadow-card outline-none focus-visible:ring-2 focus-visible:ring-gold-500"
          />
        </label>
        {f.month && (
          <button type="button" className="text-sm font-semibold text-brand-500 underline-offset-2 hover:underline" onClick={() => set({ month: '' }, false)}>
            {t('Mois en cours', 'الشهر الحالي')}
          </button>
        )}
      </div>

      <div className="mb-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard icon={<Wallet className="size-5 sm:size-6" />} tone="ok" value={s ? money(s.collectedCents) : '…'} label={t('Encaissé ce mois', 'المحصّل هذا الشهر')} hint={s ? t(`${num(s.paymentsCount)} paiement(s)`, `${num(s.paymentsCount)} دفعة`) : undefined} />
        <StatCard icon={<TrendingUp className="size-5 sm:size-6" />} tone="gold" value={s ? `${num(rate)} %` : '…'} label={t('Échéances du mois réglées', 'المسدّد من استحقاقات الشهر')} hint={s ? `${money(s.expectedPaidCents)} / ${money(s.expectedCents)}` : undefined} />
        <StatCard icon={<Receipt className="size-5 sm:size-6" />} tone="neutral" value={s ? money(Math.max(s.expectedCents - s.expectedPaidCents, 0)) : '…'} label={t('Reste à encaisser', 'المتبقي للتحصيل')} />
        <LateStat />
      </div>
      {s && s.byMethod.length > 0 && (
        <div className="mb-5 flex flex-wrap gap-2">
          {s.byMethod.map((m: any) => (
            <Badge key={m.method} tone="neutral">{methodLabel(m.method, t)} · {money(m.cents)}</Badge>
          ))}
        </div>
      )}

      <Tabs
        value={tab}
        onChange={(v) => set({ tab: v, page: '', status: '', method: '' })}
        tabs={[
          { value: 'students', label: t('Par élève', 'حسب الطالب') },
          { value: 'dues', label: t('Échéances', 'الاستحقاقات') },
          { value: 'payments', label: t('Paiements', 'الدفعات') },
          { value: 'fees', label: t('Barèmes', 'الجداول') },
        ]}
      />

      {tab === 'students' && <ByStudent f={f} set={set} />}
      {tab === 'dues' && <Dues f={f} set={set} />}
      {tab === 'payments' && <Payments f={f} set={set} />}
      {tab === 'fees' && <Fees isAdmin={isAdmin} />}
    </div>
  );
}

function LateStat() {
  const { t, num } = useLocale();
  const d = useApi<any>('/dues/by-student', { state: 'late', pageSize: 1 });
  const n = d.data?.summary?.lateStudents ?? 0;
  return <StatCard icon={<AlertTriangle className="size-5 sm:size-6" />} tone={n ? 'bad' : 'ok'} value={d.data ? num(n) : '…'} label={t('Élèves en retard', 'طلاب متأخرون')} href="/admin/finance?state=late" />;
}

type FilterProps = { f: Record<string, string>; set: (p: Record<string, string>, reset?: boolean) => void };

/* ─────────── Par élève ─────────── */

function ByStudent({ f, set }: FilterProps) {
  const { t, num, money } = useLocale();
  const { data, error, loading, reload } = useApi<any>('/dues/by-student', { state: f.state || undefined, q: f.q || undefined, month: f.month || undefined, page: Number(f.page), pageSize: PAGE });
  const [remind, setRemind] = useState<any>(null);

  return (
    <div>
      <div className="mb-4 space-y-3">
        <SearchBox value={f.q} onChange={(v) => set({ q: v })} placeholder={t('Rechercher un élève…', 'ابحث عن طالب…')} />
        <Chips
          value={f.state}
          onChange={(v) => set({ state: v })}
          options={[
            { value: '', label: t('Reste à payer', 'عليه متبقٍّ') },
            { value: 'late', label: t('En retard', 'متأخر') },
          ]}
        />
      </div>
      {error ? (
        <ErrorState message={error.message} onRetry={reload} />
      ) : loading || !data ? (
        <SkeletonCards n={4} />
      ) : data.items.length === 0 ? (
        <EmptyState icon={<CheckCircle2 className="size-6" />} title={f.state === 'late' ? t('Aucun retard de paiement', 'لا يوجد تأخر في السداد') : t('Rien à encaisser', 'لا شيء للتحصيل')} text={t('Tout est à jour pour cette sélection.', 'كل شيء مسدَّد في هذا الاختيار.')} />
      ) : (
        <>
          <p className="mb-3 text-sm text-brand-500">
            {t(`${num(data.total)} élève(s) · reste ${money(data.summary.remainingCents)}`, `${num(data.total)} طالب · المتبقي ${money(data.summary.remainingCents)}`)}
          </p>
          <div className="grid gap-3 md:grid-cols-2">
            {data.items.map((it: any) => (
              <Card key={it.student.id}>
                <div className="flex items-start gap-3">
                  <Avatar first={it.student.firstName} last={it.student.lastName} size={44} />
                  <div className="min-w-0 flex-1">
                    <Link href={`/admin/students/${it.student.id}?tab=finance`} className="block truncate font-serif font-bold text-brand-800 hover:underline">
                      {it.student.firstName} {it.student.lastName}
                    </Link>
                    <p dir="ltr" className="num text-start text-xs text-brand-400">{it.student.phone || '—'}</p>
                  </div>
                  {it.lateCount > 0 ? (
                    <Badge tone={it.daysLate > 30 ? 'bad' : 'warn'}>{t(`${num(it.daysLate)} j de retard`, `${num(it.daysLate)} يوماً تأخر`)}</Badge>
                  ) : (
                    <Badge tone="info">{t('En cours', 'جارٍ')}</Badge>
                  )}
                </div>
                <div className="mt-3 flex items-end justify-between">
                  <div>
                    <p className="text-xs text-brand-400">{t('Reste à payer', 'المتبقي')}</p>
                    <p className="num font-serif text-xl font-bold text-brand-800">{money(it.remainingCents)}</p>
                  </div>
                  <p className="num text-xs text-brand-400">{money(it.paidCents)} / {money(it.totalCents)}</p>
                </div>
                <div className="mt-2"><ProgressBar value={it.paidCents} max={it.totalCents} tone={it.lateCount ? 'bad' : 'gold'} /></div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  <Link href={`/admin/students/${it.student.id}?tab=finance`} className="tap inline-flex items-center rounded-xl bg-brand-600 px-3.5 text-sm font-semibold text-white hover:bg-brand-700">
                    {t('Encaisser', 'تحصيل')}
                  </Link>
                  <Button size="sm" variant="soft" icon={<Bell className="size-4" />} onClick={() => setRemind({ studentId: it.student.id })}>
                    {t('Relancer', 'تذكير')}
                  </Button>
                </div>
              </Card>
            ))}
          </div>
          <Pagination page={Number(f.page)} pageSize={PAGE} total={data.total} onChange={(p) => set({ page: String(p) }, false)} />
        </>
      )}
      <ReminderModal target={remind} onClose={() => setRemind(null)} />
    </div>
  );
}

/* ─────────── Échéances ─────────── */

function Dues({ f, set }: FilterProps) {
  const { t, num, money } = useLocale();
  const toast = useToast();
  const { data, error, loading, reload } = useApi<any>('/dues', { state: f.state || undefined, status: f.status || undefined, q: f.q || undefined, month: f.month || undefined, page: Number(f.page), pageSize: PAGE });
  const [pay, setPay] = useState<any>(null);
  const [remind, setRemind] = useState<any>(null);
  const [exempt, setExempt] = useState<any>(null);

  async function unexempt(d: any) {
    try {
      await post(`/dues/${d.id}/unexempt`);
      await refreshAll();
    } catch (e) {
      toast.error(messageOf(e));
    }
  }

  return (
    <div>
      <div className="mb-4 space-y-3">
        <SearchBox value={f.q} onChange={(v) => set({ q: v })} placeholder={t('Rechercher un élève…', 'ابحث عن طالب…')} />
        <Chips
          value={f.status || f.state}
          onChange={(v) => (v === 'late' || v === 'open' ? set({ state: v, status: '' }) : set({ state: '', status: v }))}
          options={[
            { value: '', label: t('Toutes', 'الكل') },
            { value: 'open', label: t('À régler', 'غير مسدّدة') },
            { value: 'late', label: t('En retard', 'متأخرة') },
            { value: 'PARTIAL', label: t('Partielles', 'جزئية') },
            { value: 'PAID', label: t('Payées', 'مدفوعة') },
            { value: 'EXEMPT', label: t('Exonérées', 'معفاة') },
          ]}
        />
      </div>
      {error ? (
        <ErrorState message={error.message} onRetry={reload} />
      ) : loading || !data ? (
        <SkeletonCards n={4} />
      ) : data.items.length === 0 ? (
        <EmptyState icon={<Wallet className="size-6" />} title={t('Aucune échéance', 'لا توجد استحقاقات')} text={t('Utilisez « Générer les échéances » pour créer les cotisations des élèves inscrits.', 'استعمل «توليد الاستحقاقات» لإنشاء اشتراكات الطلاب المسجّلين.')} />
      ) : (
        <>
          <p className="mb-3 text-sm text-brand-500">
            {t(`${num(data.total)} échéance(s) · ${money(data.summary.collectedCents)} encaissé sur ${money(data.summary.expectedCents)}`, `${num(data.total)} استحقاق · محصّل ${money(data.summary.collectedCents)} من ${money(data.summary.expectedCents)}`)}
          </p>
          <div className="grid gap-3 md:grid-cols-2">
            {data.items.map((d: any) => (
              <DueCard key={d.id} d={d} student onPay={setPay} onRemind={(x) => setRemind({ dueId: x.id })} onExempt={setExempt} onUnexempt={unexempt} />
            ))}
          </div>
          <Pagination page={Number(f.page)} pageSize={PAGE} total={data.total} onChange={(p) => set({ page: String(p) }, false)} />
        </>
      )}
      <PaymentModal due={pay} onClose={() => setPay(null)} />
      <ReminderModal target={remind} onClose={() => setRemind(null)} />
      <ExemptModal due={exempt} onClose={() => setExempt(null)} />
    </div>
  );
}

/* ─────────── Paiements ─────────── */

function Payments({ f, set }: FilterProps) {
  const { t, num, money } = useLocale();
  const [cancelled, setCancelled] = useState(false);
  const { data, error, loading, reload } = useApi<any>('/payments', { method: f.method || undefined, includeCancelled: cancelled ? 'true' : undefined, page: Number(f.page), pageSize: PAGE });
  const [cancel, setCancel] = useState<any>(null);

  return (
    <div>
      <div className="mb-4 space-y-3">
        <Chips
          value={f.method}
          onChange={(v) => set({ method: v })}
          options={[{ value: '', label: t('Tous', 'الكل') }, ...['CASH', 'CHEQUE', 'TRANSFER', 'CARD'].map((m) => ({ value: m, label: methodLabel(m, t) }))]}
        />
        <Switch checked={cancelled} onChange={setCancelled} label={t('Afficher les paiements annulés', 'إظهار الدفعات الملغاة')} />
      </div>
      {error ? (
        <ErrorState message={error.message} onRetry={reload} />
      ) : loading || !data ? (
        <SkeletonCards n={4} />
      ) : data.items.length === 0 ? (
        <EmptyState icon={<Receipt className="size-6" />} title={t('Aucun paiement', 'لا توجد دفعات')} />
      ) : (
        <>
          <p className="mb-3 text-sm text-brand-500">{t(`${num(data.total)} paiement(s) · ${money(data.summary.collectedCents)}`, `${num(data.total)} دفعة · ${money(data.summary.collectedCents)}`)}</p>
          <div className="grid gap-3 md:grid-cols-2">
            {data.items.map((p: any) => (
              <div key={p.id}>
                {p.student && (
                  <Link href={`/admin/students/${p.student.id}?tab=finance`} className="mb-1 ms-1 inline-block text-sm font-semibold text-brand-500 hover:underline">
                    {p.student.firstName} {p.student.lastName}
                  </Link>
                )}
                <PaymentCard p={p} onCancel={setCancel} />
              </div>
            ))}
          </div>
          <Pagination page={Number(f.page)} pageSize={PAGE} total={data.total} onChange={(p) => set({ page: String(p) }, false)} />
        </>
      )}
      <CancelPaymentModal payment={cancel} onClose={() => setCancel(null)} />
    </div>
  );
}

/* ─────────── Barèmes ─────────── */

const periodLabel = (p: string, t: (a: string, b: string) => string) =>
  ({ ONCE: t('Une fois', 'مرة واحدة'), MONTHLY: t('Par mois', 'شهرياً'), QUARTERLY: t('Par trimestre', 'كل ثلاثة أشهر'), YEARLY: t('Par an', 'سنوياً') }[p] || p);

function Fees({ isAdmin }: { isAdmin: boolean }) {
  const { t, pick, money } = useLocale();
  const toast = useToast();
  const confirm = useConfirm();
  const { data, error, loading, reload } = useApi<any[]>('/fees');
  const [form, setForm] = useState<{ open: boolean; fee: any | null }>({ open: false, fee: null });

  async function remove(x: any) {
    if (!(await confirm({ title: t('Supprimer ce barème ?', 'حذف هذا الجدول؟'), message: t('Les échéances déjà créées sont conservées.', 'تبقى الاستحقاقات المنشأة سابقاً.'), danger: true, confirmLabel: t('Supprimer', 'حذف') }))) return;
    try {
      await del(`/fees/${x.id}`);
      await invalidate('/fees');
    } catch (e) {
      toast.error(messageOf(e));
    }
  }

  return (
    <div>
      <Notice className="mb-4">{t('Les barèmes décrivent les tarifs. Les échéances de chaque élève en sont déduites (remise fratrie comprise).', 'تصف الجداول التعريفات، ومنها تُشتقّ استحقاقات كل طالب (مع خصم الإخوة).')}</Notice>
      {isAdmin && (
        <div className="mb-4 flex justify-end">
          <Button variant="primary" icon={<Plus className="size-4" />} onClick={() => setForm({ open: true, fee: null })}>{t('Nouveau barème', 'جدول جديد')}</Button>
        </div>
      )}
      {error ? (
        <ErrorState message={error.message} onRetry={reload} />
      ) : loading || !data ? (
        <SkeletonCards n={3} />
      ) : data.length === 0 ? (
        <EmptyState icon={<Wallet className="size-6" />} title={t('Aucun barème', 'لا توجد جداول')} />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {data.map((x) => (
            <Card key={x.id} className={x.active ? '' : 'opacity-60'}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-serif font-bold text-brand-800">{pick(x.titleFr, x.titleAr || x.titleFr)}</p>
                  <p className="text-xs text-brand-400">{x.course ? pick(x.course.titleFr, x.course.titleAr) : t('Tous les cours', 'كل الدروس')}</p>
                </div>
                {isAdmin && (
                  <div className="flex gap-1">
                    <IconButton label={t('Modifier', 'تعديل')} className="!size-9" onClick={() => setForm({ open: true, fee: x })}><Pencil className="size-4" /></IconButton>
                    <IconButton label={t('Supprimer', 'حذف')} className="!size-9" onClick={() => remove(x)}><Trash2 className="size-4" /></IconButton>
                  </div>
                )}
              </div>
              <div className="mt-3 flex items-end justify-between">
                <p className="num font-serif text-2xl font-bold text-brand-800">{money(x.amountCents)}</p>
                <div className="flex gap-1.5">
                  <Badge tone={x.kind === 'REGISTRATION' ? 'gold' : 'info'}>{x.kind === 'REGISTRATION' ? t('Inscription', 'تسجيل') : t('Scolarité', 'دراسة')}</Badge>
                  <Badge>{periodLabel(x.period, t)}</Badge>
                  {!x.active && <Badge tone="warn">{t('Inactif', 'غير نشط')}</Badge>}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
      <FeeForm open={form.open} fee={form.fee} onClose={() => setForm({ open: false, fee: null })} />
    </div>
  );
}

function FeeForm({ open, fee, onClose }: { open: boolean; fee: any | null; onClose: () => void }) {
  const { t, pick, currency } = useLocale();
  const toast = useToast();
  const { lk } = useLookups();
  const [f, setF] = useState<any>({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    if (!open) return;
    setErr(null);
    setF({ titleFr: fee?.titleFr || '', titleAr: fee?.titleAr || '', kind: fee?.kind || 'TUITION', amount: fee ? centsToEuro(fee.amountCents) : '', period: fee?.period || 'MONTHLY', courseId: fee?.courseId || '', active: fee?.active ?? true });
  }, [open, fee]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const amountCents = euroToCents(f.amount);
      if (!Number.isFinite(amountCents) || amountCents < 0) throw new Error(t('Montant invalide.', 'مبلغ غير صالح.'));
      const base = { titleFr: f.titleFr.trim(), titleAr: f.titleAr.trim() || undefined, amountCents, active: f.active };
      if (fee) await api(`/fees/${fee.id}`, { method: 'PATCH', body: { ...base, period: f.kind === 'REGISTRATION' ? 'ONCE' : f.period, courseId: f.courseId || null } });
      else await api('/fees', { method: 'POST', body: { ...base, kind: f.kind, period: f.period, courseId: f.courseId || undefined } });
      await invalidate('/fees');
      toast.ok(t('Barème enregistré', 'تم حفظ الجدول'));
      onClose();
    } catch (e) {
      setErr(messageOf(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={fee ? t('Modifier le barème', 'تعديل الجدول') : t('Nouveau barème', 'جدول جديد')}>
      <form onSubmit={save} className="space-y-4">
        <TextField label={t('Intitulé (français)', 'العنوان (فرنسي)')} required value={f.titleFr || ''} onChange={(e) => setF({ ...f, titleFr: e.target.value })} />
        <TextField label={t('Intitulé (arabe)', 'العنوان (عربي)')} dir="rtl" value={f.titleAr || ''} onChange={(e) => setF({ ...f, titleAr: e.target.value })} />
        {!fee && (
          <SelectField label={t('Type', 'النوع')} value={f.kind || 'TUITION'} onChange={(e) => setF({ ...f, kind: e.target.value })}>
            <option value="TUITION">{t('Scolarité (cotisation)', 'دراسة (اشتراك)')}</option>
            <option value="REGISTRATION">{t('Frais d’inscription', 'رسوم التسجيل')}</option>
          </SelectField>
        )}
        <TextField label={`${t('Montant', 'المبلغ')} (${currency})`} required inputMode="decimal" dir="ltr" value={f.amount || ''} onChange={(e) => setF({ ...f, amount: e.target.value })} className="[&_input]:text-start" />
        {f.kind !== 'REGISTRATION' && (
          <SelectField label={t('Périodicité', 'الدورية')} value={f.period || 'MONTHLY'} onChange={(e) => setF({ ...f, period: e.target.value })}>
            {['MONTHLY', 'QUARTERLY', 'YEARLY', 'ONCE'].map((p) => <option key={p} value={p}>{periodLabel(p, t)}</option>)}
          </SelectField>
        )}
        <SelectField label={t('Cours concerné', 'الدرس المعني')} hint={t('Laissez vide pour appliquer à tous les cours.', 'اتركه فارغاً للتطبيق على كل الدروس.')} value={f.courseId || ''} onChange={(e) => setF({ ...f, courseId: e.target.value })}>
          <option value="">{t('Tous les cours', 'كل الدروس')}</option>
          {lk?.courses.map((c) => <option key={c.id} value={c.id}>{pick(c.titleFr, c.titleAr)}</option>)}
        </SelectField>
        <Switch checked={!!f.active} onChange={(v) => setF({ ...f, active: v })} label={t('Barème actif', 'جدول نشط')} />
        {err && <Notice tone="bad">{err}</Notice>}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>{t('Annuler', 'إلغاء')}</Button>
          <Button type="submit" variant="primary" loading={busy}>{t('Enregistrer', 'حفظ')}</Button>
        </div>
      </form>
    </Modal>
  );
}
