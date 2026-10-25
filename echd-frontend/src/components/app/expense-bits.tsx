//echd-frontend/src/components/app/expense-bits.tsx
'use client';

import { Ban, Banknote, NotebookPen, Pencil, Save, Shapes, Wrench } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge, Card } from '@/components/ui/display';
import { Modal, Notice, useToast } from '@/components/ui/feedback';
import { Chips, Field, TextField, TextareaField } from '@/components/ui/form';
import { api } from '@/lib/api';
import { invalidate, messageOf } from '@/lib/hooks';
import { useLocale } from '@/lib/i18n';
import { todayISO } from '@/lib/locale';
import { centsToEuro, cn, euroToCents } from '@/lib/utils';
import { ReasonModal } from './finance-bits';
import { methodLabel } from './labels';

export type ExpenseCategory = 'SALARY' | 'EQUIPMENT' | 'SUPPLIES' | 'OTHER';
export const EXPENSE_CATEGORIES: ExpenseCategory[] = ['SALARY', 'EQUIPMENT', 'SUPPLIES', 'OTHER'];

export const refreshExpenses = () => invalidate('/expenses', '/dashboard');

type T = (fr: string, ar: string) => string;

/** Libellé, icône et couleur de chaque catégorie de dépense. */
export function categoryMeta(c: string, t: T) {
  switch (c) {
    case 'SALARY':
      return { label: t('Salaires', 'الرواتب'), icon: Banknote, bubble: 'bg-brand-50 text-brand-600', bar: 'bg-brand-500' };
    case 'EQUIPMENT':
      return { label: t('Équipements', 'المعدات'), icon: Wrench, bubble: 'bg-gold-200 text-gold-700', bar: 'bg-gold-500' };
    case 'SUPPLIES':
      return { label: t('Fournitures scolaires', 'اللوازم المدرسية'), icon: NotebookPen, bubble: 'bg-ok-soft text-ok', bar: 'bg-mint' };
    default:
      return { label: t('Autres', 'أخرى'), icon: Shapes, bubble: 'bg-sand-200 text-brand-600', bar: 'bg-brand-300' };
  }
}

/** Premier et dernier jour (AAAA-MM-JJ) du mois, du trimestre ou de l'année qui contient `ref` (AAAA-MM). */
export function periodBounds(period: 'month' | 'quarter' | 'year', ref: string) {
  const [y, m] = ref.split('-').map(Number);
  const start = period === 'year' ? 0 : period === 'quarter' ? Math.floor((m - 1) / 3) * 3 : m - 1;
  const len = period === 'year' ? 12 : period === 'quarter' ? 3 : 1;
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return { from: iso(new Date(Date.UTC(y, start, 1))), to: iso(new Date(Date.UTC(y, start + len, 1) - 86400000)) };
}

/* ─────────── Carte d'une dépense (historique) ─────────── */

export function ExpenseCard({ e, onEdit, onCancel }: { e: any; onEdit: (e: any) => void; onCancel: (e: any) => void }) {
  const { t, date, money } = useLocale();
  const cancelled = !!e.cancelledAt;
  const meta = categoryMeta(e.category, t);
  const Icon = meta.icon;
  return (
    <Card className={cn(cancelled && 'opacity-70')}>
      <div className="flex items-start gap-3">
        <span className={cn('grid size-11 shrink-0 place-items-center rounded-2xl', meta.bubble)}>
          <Icon className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className={cn('truncate font-serif font-bold text-brand-800', cancelled && 'line-through')}>{e.label}</p>
          <p className="truncate text-sm text-brand-600">{e.beneficiary || meta.label}</p>
          <p className="text-xs text-brand-400">
            {date(e.spentAt)} · {methodLabel(e.method, t)}
            {e.reference ? ` · ${e.reference}` : ''}
          </p>
        </div>
        <div className="text-end">
          <p className={cn('num font-serif text-lg font-bold', cancelled ? 'text-brand-400 line-through' : 'text-bad')}>−{money(e.amountCents)}</p>
          <Badge tone={cancelled ? 'bad' : 'neutral'}>{cancelled ? t('Annulée', 'ملغاة') : meta.label}</Badge>
        </div>
      </div>
      {e.comment && !cancelled && <p className="mt-2 text-xs text-brand-500">{e.comment}</p>}
      {cancelled && e.cancelReason && <p className="mt-2 rounded-xl bg-bad-soft px-3 py-2 text-xs text-bad">{e.cancelReason}</p>}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <p className="num text-xs text-brand-400">
          {e.number}
          {e.createdByLabel ? ` · ${e.createdByLabel}` : ''}
        </p>
        {!cancelled && (
          <div className="flex gap-1.5">
            <Button size="sm" variant="soft" icon={<Pencil className="size-4" />} onClick={() => onEdit(e)}>
              {t('Modifier', 'تعديل')}
            </Button>
            <Button size="sm" variant="ghost" className="text-bad" icon={<Ban className="size-4" />} onClick={() => onCancel(e)}>
              {t('Annuler', 'إلغاء')}
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
}

/* ─────────── Saisie / modification ─────────── */

export function ExpenseModal({ open, expense, onClose, onDone }: { open: boolean; expense: any | null; onClose: () => void; onDone?: () => void }) {
  const { t, loc, currency } = useLocale();
  const toast = useToast();
  const editing = !!expense;
  const [category, setCategory] = useState<ExpenseCategory>('SUPPLIES');
  const [label, setLabel] = useState('');
  const [beneficiary, setBeneficiary] = useState('');
  const [amount, setAmount] = useState('');
  const [spentAt, setSpentAt] = useState(todayISO());
  const [method, setMethod] = useState('CASH');
  const [reference, setReference] = useState('');
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setErr(null);
    if (expense) {
      setCategory(expense.category);
      setLabel(expense.label || '');
      setBeneficiary(expense.beneficiary || '');
      setAmount(centsToEuro(expense.amountCents));
      setSpentAt(String(expense.spentAt).slice(0, 10));
      setMethod(expense.method);
      setReference(expense.reference || '');
      setComment(expense.comment || '');
    } else {
      setCategory('SUPPLIES');
      setLabel('');
      setBeneficiary('');
      setAmount('');
      setSpentAt(todayISO());
      setMethod('CASH');
      setReference('');
      setComment('');
    }
  }, [open, expense]);

  const monthName = (iso: string) => new Intl.DateTimeFormat(loc, { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${iso.slice(0, 7)}-01T00:00:00Z`));

  // Choisir « Salaires » propose un objet type ; l'utilisateur peut le modifier librement.
  function pickCategory(c: ExpenseCategory) {
    setCategory(c);
    if (c === 'SALARY' && !label.trim() && !editing) setLabel(`${t('Salaire', 'راتب')} — ${monthName(spentAt)}`);
  }

  const labelHint = {
    SALARY: t('Ex. Salaire de septembre', 'مثال: راتب شهر سبتمبر'),
    EQUIPMENT: t('Ex. Tableau blanc, ventilateurs, tapis…', 'مثال: سبورة، مراوح، سجاد…'),
    SUPPLIES: t('Ex. Cahiers, stylos, craies…', 'مثال: دفاتر، أقلام، طباشير…'),
    OTHER: t('Précisez la nature de la dépense (loyer, électricité, entretien…)', 'حدّد طبيعة المصروف (إيجار، كهرباء، صيانة…)'),
  }[category];
  const whoLabel = category === 'SALARY' ? t('Bénéficiaire (enseignant, employé)', 'المستفيد (معلّم، موظف)') : t('Fournisseur / bénéficiaire', 'المورّد / المستفيد');

  async function submit(ev: React.FormEvent) {
    ev.preventDefault();
    setErr(null);
    const cents = euroToCents(amount);
    if (!Number.isFinite(cents) || cents <= 0) return setErr(t('Indiquez un montant valide.', 'أدخل مبلغاً صحيحاً.'));
    if (label.trim().length < 2) return setErr(category === 'OTHER' ? t('Précisez la nature de la dépense.', 'حدّد طبيعة المصروف.') : t('Indiquez l’objet de la dépense.', 'أدخل موضوع المصروف.'));
    const body = {
      category,
      label: label.trim(),
      beneficiary: beneficiary.trim(),
      amountCents: cents,
      spentAt,
      method,
      reference: reference.trim(),
      comment: comment.trim(),
    };
    setBusy(true);
    try {
      if (editing) await api(`/expenses/${expense.id}`, { method: 'PATCH', body });
      else await api('/expenses', { method: 'POST', body: { ...body, beneficiary: body.beneficiary || undefined, reference: body.reference || undefined, comment: body.comment || undefined } });
      await refreshExpenses();
      onDone?.();
      toast.ok(editing ? t('Dépense modifiée', 'تم تعديل المصروف') : t('Dépense enregistrée — le solde est mis à jour', 'تم تسجيل المصروف — تم تحديث الرصيد'));
      onClose();
    } catch (e) {
      setErr(messageOf(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={editing ? t('Modifier la dépense', 'تعديل المصروف') : t('Nouvelle dépense', 'مصروف جديد')}>
      <form onSubmit={submit} className="space-y-4">
        <Field label={t('Catégorie', 'الفئة')}>
          <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label={t('Catégorie', 'الفئة')}>
            {EXPENSE_CATEGORIES.map((c) => {
              const m = categoryMeta(c, t);
              const Icon = m.icon;
              const on = c === category;
              return (
                <button
                  key={c}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => pickCategory(c)}
                  className={cn(
                    'tap flex items-center gap-2.5 rounded-2xl p-2.5 text-start text-sm font-semibold transition',
                    on ? 'bg-brand-600 text-white shadow-card' : 'bg-sand-100 text-brand-700 hover:bg-sand-200',
                  )}
                >
                  <span className={cn('grid size-8 shrink-0 place-items-center rounded-xl', on ? 'bg-white/20 text-white' : m.bubble)}>
                    <Icon className="size-4" />
                  </span>
                  <span className="min-w-0 leading-tight">{m.label}</span>
                </button>
              );
            })}
          </div>
        </Field>
        <TextField label={category === 'OTHER' ? t('Nature de la dépense', 'طبيعة المصروف') : t('Objet', 'الموضوع')} required placeholder={labelHint} value={label} onChange={(e) => setLabel(e.target.value)} maxLength={200} />
        <TextField label={whoLabel} hint={t('Facultatif', 'اختياري')} value={beneficiary} onChange={(e) => setBeneficiary(e.target.value)} maxLength={150} />
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label={`${t('Montant', 'المبلغ')} (${currency})`} required inputMode="decimal" dir="ltr" value={amount} onChange={(e) => setAmount(e.target.value)} className="[&_input]:text-start" />
          <TextField label={t('Date', 'التاريخ')} type="date" required dir="ltr" max={todayISO()} value={spentAt} onChange={(e) => setSpentAt(e.target.value)} className="[&_input]:text-start" />
        </div>
        <Field label={t('Moyen de paiement', 'طريقة الدفع')}>
          <Chips value={method} onChange={setMethod} options={['CASH', 'CHEQUE', 'TRANSFER', 'CARD'].map((m) => ({ value: m, label: methodLabel(m, t) }))} />
        </Field>
        <TextField label={t('Référence', 'المرجع')} hint={t('N° de facture, de chèque, de virement… (facultatif)', 'رقم فاتورة أو شيك أو تحويل… (اختياري)')} value={reference} onChange={(e) => setReference(e.target.value)} maxLength={120} />
        <TextareaField label={t('Commentaire', 'تعليق')} rows={2} value={comment} onChange={(e) => setComment(e.target.value)} maxLength={500} />
        {err && <Notice tone="bad">{err}</Notice>}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>{t('Retour', 'رجوع')}</Button>
          <Button type="submit" variant="primary" loading={busy} icon={<Save className="size-4" />}>
            {editing ? t('Enregistrer', 'حفظ') : t('Enregistrer la dépense', 'تسجيل المصروف')}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

/* ─────────── Annulation (motif obligatoire) ─────────── */

export function CancelExpenseModal({ expense, onClose }: { expense: any | null; onClose: () => void }) {
  const { t, money } = useLocale();
  const toast = useToast();
  return (
    <ReasonModal
      open={!!expense}
      onClose={onClose}
      danger
      title={t('Annuler cette dépense', 'إلغاء هذا المصروف')}
      text={expense ? `${expense.label} · ${money(expense.amountCents)} — ${t('elle reste dans l’historique, marquée « annulée », et le montant est rendu au solde.', 'تبقى في السجل كـ«ملغاة» ويعود المبلغ إلى الرصيد.')}` : undefined}
      confirmLabel={t('Annuler la dépense', 'إلغاء المصروف')}
      onConfirm={async (reason) => {
        await api(`/expenses/${expense.id}/cancel`, { method: 'POST', body: { reason } });
        await refreshExpenses();
        toast.ok(t('Dépense annulée — le solde est mis à jour', 'تم إلغاء المصروف — تم تحديث الرصيد'));
      }}
    />
  );
}
