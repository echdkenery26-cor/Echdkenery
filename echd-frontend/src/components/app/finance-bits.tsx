'use client';

import { Ban, Bell, CheckCircle2, FileText, Mail, MessageCircle, Plus, Printer, Receipt, Send, Share2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button, IconButton } from '@/components/ui/button';
import { Badge, Card, ProgressBar } from '@/components/ui/display';
import { Modal, Notice, Spinner, useToast } from '@/components/ui/feedback';
import { Chips, Field, Input, TextField, TextareaField } from '@/components/ui/form';
import { api, openDocument, shareDocument } from '@/lib/api';
import { invalidate, messageOf } from '@/lib/hooks';
import { useLocale } from '@/lib/i18n';
import { todayISO } from '@/lib/locale';
import { centsToEuro, cn, euroToCents, waLink } from '@/lib/utils';
import { dueStatus, methodLabel } from './labels';

const refresh = () => invalidate('/dues', '/students', '/payments', '/finance', '/dashboard', '/reminders');

/* ─────────── Échéance ─────────── */

export function DueCard({
  d,
  student,
  onPay,
  onRemind,
  onExempt,
  onUnexempt,
  compact,
}: {
  d: any;
  student?: boolean;
  onPay?: (d: any) => void;
  onRemind?: (d: any) => void;
  onExempt?: (d: any) => void;
  onUnexempt?: (d: any) => void;
  compact?: boolean;
}) {
  const { t, date, money } = useLocale();
  const st = dueStatus(d.status, t);
  const open = d.status !== 'PAID' && d.status !== 'EXEMPT';
  const late = d.status === 'LATE' || d.status === 'CRITICAL';
  return (
    <Card className={cn(late && 'ring-1 ring-bad/25')}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {student && d.student && (
            <p className="truncate text-sm font-semibold text-brand-500">
              {d.student.firstName} {d.student.lastName}
            </p>
          )}
          <p className="font-serif font-bold text-brand-800">{d.label}</p>
          <p className="text-xs text-brand-400">
            {t('Échéance', 'الاستحقاق')} {date(d.dueDate)}
          </p>
        </div>
        <Badge tone={st.tone}>{st.label}</Badge>
      </div>
      <div className="mt-3 flex items-end justify-between gap-3">
        <div>
          <p className="num font-serif text-xl font-bold text-brand-800">{money(d.amountCents)}</p>
          {d.status === 'EXEMPT' ? (
            d.exemptReason && <p className="text-xs text-brand-400">{d.exemptReason}</p>
          ) : (
            open && d.paidCents > 0 && <p className="text-xs text-brand-500">{t('Reste', 'المتبقي')} {money(d.remainingCents)}</p>
          )}
        </div>
        {!compact && (
          <div className="flex flex-wrap justify-end gap-1.5">
            {open && onPay && (
              <Button size="sm" variant="dark" onClick={() => onPay(d)} icon={<Plus className="size-4" />}>
                {t('Encaisser', 'تحصيل')}
              </Button>
            )}
            {late && onRemind && (
              <IconButton label={t('Relancer', 'تذكير')} variant="soft" onClick={() => onRemind(d)} className="!size-9">
                <Bell className="size-4" />
              </IconButton>
            )}
            {open && onExempt && (
              <Button size="sm" variant="ghost" onClick={() => onExempt(d)}>
                {t('Exonérer', 'إعفاء')}
              </Button>
            )}
            {d.status === 'EXEMPT' && onUnexempt && (
              <Button size="sm" variant="ghost" onClick={() => onUnexempt(d)}>
                {t('Annuler l’exonération', 'إلغاء الإعفاء')}
              </Button>
            )}
          </div>
        )}
      </div>
      {d.paidCents > 0 && d.status !== 'EXEMPT' && d.status !== 'PAID' && (
        <div className="mt-3">
          <ProgressBar value={d.paidCents} max={d.amountCents} tone="gold" />
        </div>
      )}
    </Card>
  );
}

/* ─────────── Paiement reçu ─────────── */

export function PaymentCard({ p, onCancel }: { p: any; onCancel?: (p: any) => void }) {
  const { t, isAr, date, money } = useLocale();
  const toast = useToast();
  const cancelled = !!p.cancelledAt;
  const [busy, setBusy] = useState(false);

  async function share() {
    setBusy(true);
    try {
      const r = await shareDocument('receipt', p.id, isAr ? 'ar' : 'fr');
      const text = t(`Votre reçu ${p.receiptNumber} : ${r.url}`, `إيصالكم ${p.receiptNumber}: ${r.url}`);
      window.open(waLink('', text).replace('wa.me/', 'wa.me/'), '_blank');
    } catch (e) {
      toast.error(messageOf(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className={cn(cancelled && 'opacity-70')}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className={cn('num font-serif text-lg font-bold text-brand-800', cancelled && 'line-through')}>{money(p.amountCents)}</p>
          <p className="truncate text-sm text-brand-600">{p.due?.label}</p>
          <p className="text-xs text-brand-400">
            {date(p.paidAt)} · {methodLabel(p.method, t)}
          </p>
        </div>
        <div className="text-end">
          <Badge tone={cancelled ? 'bad' : 'ok'}>{cancelled ? t('Annulé', 'ملغى') : p.receiptNumber}</Badge>
          {cancelled && <p className="num mt-1 text-xs text-brand-400">{p.receiptNumber}</p>}
        </div>
      </div>
      {cancelled && p.cancelReason && <p className="mt-2 rounded-xl bg-bad-soft px-3 py-2 text-xs text-bad">{p.cancelReason}</p>}
      {!cancelled && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          <Button size="sm" variant="soft" icon={<Printer className="size-4" />} onClick={() => openDocument('receipt', p.id, isAr ? 'ar' : 'fr').catch((e) => toast.error(messageOf(e)))}>
            {t('Reçu', 'الإيصال')}
          </Button>
          <Button size="sm" variant="ghost" loading={busy} icon={<Share2 className="size-4" />} onClick={share}>
            {t('Envoyer', 'إرسال')}
          </Button>
          {onCancel && (
            <Button size="sm" variant="ghost" className="text-bad" icon={<Ban className="size-4" />} onClick={() => onCancel(p)}>
              {t('Annuler', 'إلغاء')}
            </Button>
          )}
        </div>
      )}
    </Card>
  );
}

/* ─────────── Encaisser ─────────── */

export function PaymentModal({ due, onClose, onDone }: { due: any | null; onClose: () => void; onDone?: () => void }) {
  const { t, isAr, money, currency } = useLocale();
  const toast = useToast();
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('CASH');
  const [paidAt, setPaidAt] = useState(todayISO());
  const [reference, setReference] = useState('');
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState<any | null>(null);

  useEffect(() => {
    if (due) {
      setAmount(centsToEuro(due.remainingCents ?? due.amountCents - due.paidCents));
      setMethod('CASH');
      setPaidAt(todayISO());
      setReference('');
      setComment('');
      setErr(null);
      setDone(null);
    }
  }, [due]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    const cents = euroToCents(amount);
    if (!cents || cents <= 0) return setErr(t('Indiquez un montant valide.', 'أدخل مبلغاً صحيحاً.'));
    setBusy(true);
    try {
      const p = await api('/payments', { method: 'POST', body: { dueId: due.id, amountCents: cents, method, paidAt, reference: reference.trim() || undefined, comment: comment.trim() || undefined } });
      refresh();
      onDone?.();
      setDone(p);
    } catch (e) {
      setErr(messageOf(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={!!due} onClose={onClose} title={done ? t('Paiement enregistré', 'تم تسجيل الدفعة') : t('Encaisser un paiement', 'تحصيل دفعة')}>
      {done ? (
        <div className="space-y-4 text-center">
          <CheckCircle2 className="mx-auto size-12 text-ok" />
          <p className="font-serif text-lg font-bold text-brand-800">{money(done.amountCents)}</p>
          <p className="num text-sm text-brand-500">{t('Reçu', 'إيصال')} {done.receiptNumber}</p>
          <div className="flex flex-wrap justify-center gap-2">
            <Button variant="primary" icon={<Printer className="size-4" />} onClick={() => openDocument('receipt', done.id, isAr ? 'ar' : 'fr').catch((e) => toast.error(messageOf(e)))}>
              {t('Imprimer le reçu', 'طباعة الإيصال')}
            </Button>
            <Button variant="outline" onClick={onClose}>{t('Fermer', 'إغلاق')}</Button>
          </div>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          {due && (
            <div className="rounded-2xl bg-sand-100 p-3 text-sm">
              <p className="font-semibold text-brand-800">{due.label}</p>
              <p className="text-brand-500">
                {t('Reste à payer', 'المتبقي')} : <span className="num font-semibold">{money(due.remainingCents ?? due.amountCents - due.paidCents)}</span>
              </p>
            </div>
          )}
          <TextField label={`${t('Montant', 'المبلغ')} (${currency})`} required inputMode="decimal" dir="ltr" value={amount} onChange={(e) => setAmount(e.target.value)} className="[&_input]:text-start" />
          <Field label={t('Moyen de paiement', 'طريقة الدفع')}>
            <Chips value={method} onChange={setMethod} options={['CASH', 'CHEQUE', 'TRANSFER', 'CARD'].map((m) => ({ value: m, label: methodLabel(m, t) }))} />
          </Field>
          <TextField label={t('Date', 'التاريخ')} type="date" dir="ltr" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} className="[&_input]:text-start" />
          <TextField label={t('Référence', 'المرجع')} hint={t('N° de chèque, de virement… (facultatif)', 'رقم الشيك أو التحويل… (اختياري)')} value={reference} onChange={(e) => setReference(e.target.value)} />
          <TextareaField label={t('Commentaire', 'تعليق')} rows={2} value={comment} onChange={(e) => setComment(e.target.value)} />
          {err && <Notice tone="bad">{err}</Notice>}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={onClose}>{t('Annuler', 'إلغاء')}</Button>
            <Button type="submit" variant="primary" loading={busy} icon={<Receipt className="size-4" />}>{t('Enregistrer', 'تسجيل')}</Button>
          </div>
        </form>
      )}
    </Modal>
  );
}

/* ─────────── Saisie d'un motif (annulation, exonération…) ─────────── */

export function ReasonModal({
  open,
  title,
  text,
  confirmLabel,
  danger,
  onClose,
  onConfirm,
}: {
  open: boolean;
  title: string;
  text?: string;
  confirmLabel: string;
  danger?: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => Promise<void>;
}) {
  const { t } = useLocale();
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    if (open) {
      setReason('');
      setErr(null);
    }
  }, [open]);
  async function go(e: React.FormEvent) {
    e.preventDefault();
    if (!reason.trim()) return setErr(t('Le motif est obligatoire.', 'السبب إلزامي.'));
    setBusy(true);
    try {
      await onConfirm(reason.trim());
      onClose();
    } catch (e) {
      setErr(messageOf(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal open={open} onClose={onClose} title={title}>
      <form onSubmit={go} className="space-y-4">
        {text && <p className="text-sm text-brand-500">{text}</p>}
        <TextareaField label={t('Motif', 'السبب')} required rows={3} value={reason} onChange={(e) => setReason(e.target.value)} autoFocus />
        {err && <Notice tone="bad">{err}</Notice>}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>{t('Retour', 'رجوع')}</Button>
          <Button type="submit" variant={danger ? 'danger' : 'dark'} loading={busy}>{confirmLabel}</Button>
        </div>
      </form>
    </Modal>
  );
}

/** Annulation d'un paiement (avec motif) — rouvre l'échéance */
export function CancelPaymentModal({ payment, onClose }: { payment: any | null; onClose: () => void }) {
  const { t } = useLocale();
  const toast = useToast();
  return (
    <ReasonModal
      open={!!payment}
      onClose={onClose}
      danger
      title={t('Annuler ce paiement', 'إلغاء هذه الدفعة')}
      text={t('Le paiement reste visible dans l’historique, marqué « annulé ». L’échéance est rouverte.', 'تبقى الدفعة ظاهرة في السجل كـ«ملغاة» وتُعاد فتح الاستحقاق.')}
      confirmLabel={t('Annuler le paiement', 'إلغاء الدفعة')}
      onConfirm={async (reason) => {
        await api(`/payments/${payment.id}/cancel`, { method: 'POST', body: { reason } });
        refresh();
        toast.ok(t('Paiement annulé', 'تم إلغاء الدفعة'));
      }}
    />
  );
}

export function ExemptModal({ due, onClose }: { due: any | null; onClose: () => void }) {
  const { t } = useLocale();
  const toast = useToast();
  return (
    <ReasonModal
      open={!!due}
      onClose={onClose}
      title={t('Exonérer cette échéance', 'إعفاء هذا الاستحقاق')}
      text={due?.label}
      confirmLabel={t('Exonérer', 'إعفاء')}
      onConfirm={async (reason) => {
        await api(`/dues/${due.id}/exempt`, { method: 'POST', body: { reason } });
        refresh();
        toast.ok(t('Échéance exonérée', 'تم الإعفاء'));
      }}
    />
  );
}

/* ─────────── Relance WhatsApp / e-mail ─────────── */

export function ReminderModal({ target, onClose }: { target: { studentId?: string; dueId?: string } | null; onClose: () => void }) {
  const { t, isAr } = useLocale();
  const toast = useToast();
  const [lang, setLang] = useState<'fr' | 'ar'>(isAr ? 'ar' : 'fr');
  const [prep, setPrep] = useState<any | null>(null);
  const [message, setMessage] = useState('');
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!target) return;
    setPrep(null);
    setErr(null);
    api('/reminders/prepare', { method: 'POST', body: { ...target, lang } })
      .then((r) => {
        setPrep(r);
        setMessage(r.message);
      })
      .catch((e) => setErr(messageOf(e)));
  }, [target, lang]);

  async function send(channel: 'WHATSAPP' | 'EMAIL') {
    const url = channel === 'WHATSAPP' ? waUrl() : mailUrl();
    if (!url) return;
    window.open(url, '_blank');
    try {
      await api('/reminders', { method: 'POST', body: { studentId: prep.studentId, dueId: prep.dueId || undefined, channel, message } });
      invalidate('/reminders', '/students');
      toast.ok(t('Relance enregistrée dans l’historique', 'سُجّل التذكير في السجل'));
    } catch (e) {
      toast.error(messageOf(e));
    }
    onClose();
  }
  const waUrl = () => (prep?.whatsappUrl ? prep.whatsappUrl.split('?text=')[0] + '?text=' + encodeURIComponent(message) : null);
  const mailUrl = () => (prep?.mailtoUrl ? prep.mailtoUrl.split('&body=')[0] + '&body=' + encodeURIComponent(message) : null);

  return (
    <Modal open={!!target} onClose={onClose} title={t('Relance de paiement', 'تذكير بالسداد')}>
      {err ? (
        <Notice tone="bad">{err}</Notice>
      ) : !prep ? (
        <div className="grid place-items-center py-10"><Spinner /></div>
      ) : (
        <div className="space-y-4">
          <Chips value={lang} onChange={setLang} options={[{ value: 'fr', label: 'Français' }, { value: 'ar', label: 'العربية' }]} />
          <TextareaField label={t('Message', 'الرسالة')} rows={6} dir={lang === 'ar' ? 'rtl' : 'ltr'} value={message} onChange={(e) => setMessage(e.target.value)} />
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" disabled={!prep.whatsappUrl} onClick={() => send('WHATSAPP')} icon={<MessageCircle className="size-4" />}>WhatsApp</Button>
            <Button variant="outline" disabled={!prep.mailtoUrl} onClick={() => send('EMAIL')} icon={<Mail className="size-4" />}>{t('E-mail', 'بريد')}</Button>
          </div>
          {!prep.whatsappUrl && !prep.mailtoUrl && <Notice tone="warn">{t('Aucun téléphone ni e-mail enregistré pour cet élève.', 'لا يوجد هاتف ولا بريد مسجّل لهذا الطالب.')}</Notice>}
        </div>
      )}
    </Modal>
  );
}

/* ─────────── Échéance manuelle ─────────── */

export function NewDueModal({ studentId, open, onClose }: { studentId: string; open: boolean; onClose: () => void }) {
  const { t, currency } = useLocale();
  const toast = useToast();
  const [label, setLabel] = useState('');
  const [amount, setAmount] = useState('');
  const [dueDate, setDueDate] = useState(todayISO());
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    if (open) {
      setLabel('');
      setAmount('');
      setDueDate(todayISO());
      setErr(null);
    }
  }, [open]);
  async function go(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await api('/dues', { method: 'POST', body: { studentId, label: label.trim(), amountCents: euroToCents(amount), dueDate } });
      refresh();
      toast.ok(t('Échéance ajoutée', 'تمت إضافة الاستحقاق'));
      onClose();
    } catch (e) {
      setErr(messageOf(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal open={open} onClose={onClose} title={t('Ajouter une échéance', 'إضافة استحقاق')}>
      <form onSubmit={go} className="space-y-4">
        <TextField label={t('Libellé', 'البيان')} required value={label} onChange={(e) => setLabel(e.target.value)} />
        <TextField label={`${t('Montant', 'المبلغ')} (${currency})`} required inputMode="decimal" dir="ltr" value={amount} onChange={(e) => setAmount(e.target.value)} className="[&_input]:text-start" />
        <TextField label={t('Date d’échéance', 'تاريخ الاستحقاق')} type="date" required dir="ltr" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="[&_input]:text-start" />
        {err && <Notice tone="bad">{err}</Notice>}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>{t('Annuler', 'إلغاء')}</Button>
          <Button type="submit" variant="primary" loading={busy}>{t('Ajouter', 'إضافة')}</Button>
        </div>
      </form>
    </Modal>
  );
}
