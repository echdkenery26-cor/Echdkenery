//echd-frontend/src/components/app/parent-link.tsx
'use client';

import { Copy, ExternalLink, Link2, Mail, MessageCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Modal, Notice, Spinner, useToast } from '@/components/ui/feedback';
import { Chips, Field } from '@/components/ui/form';
import { post } from '@/lib/api';
import { messageOf } from '@/lib/hooks';
import { useLocale } from '@/lib/i18n';
import { waLink } from '@/lib/utils';

/** Lien de suivi sécurisé à envoyer aux parents (présences, progression, cotisations, reçus). Aucun compte à créer. */
export function ParentLinkModal({ open, onClose, student }: { open: boolean; onClose: () => void; student: { id: string; firstName: string; guardians?: Array<{ email?: string | null }>; email?: string | null } }) {
  const { t, date } = useLocale();
  const toast = useToast();
  const [lang, setLang] = useState<'fr' | 'ar'>('fr');
  const [link, setLink] = useState<{ url: string; expiresAt: string } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    setBusy(true);
    setErr(null);
    setLink(null);
    post<{ url: string; expiresAt: string }>(`/students/${student.id}/portal-link`, { lang })
      .then((r) => alive && setLink(r))
      .catch((e) => alive && setErr(messageOf(e)))
      .finally(() => alive && setBusy(false));
    return () => {
      alive = false;
    };
  }, [open, lang, student.id]);

  const message = link
    ? lang === 'ar'
      ? `السلام عليكم، هذا رابط متابعة ${student.firstName} (الحضور والتقدّم والاشتراكات): ${link.url}`
      : `Bonjour, voici le lien de suivi de ${student.firstName} (présences, progression, cotisations) : ${link.url}`
    : '';
  const email = student.guardians?.find((g) => g.email)?.email || student.email || '';

  async function copy() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link.url);
      toast.ok(t('Lien copié', 'تم نسخ الرابط'));
    } catch {
      toast.error(t('Copie impossible : sélectionnez le lien à la main.', 'تعذّر النسخ: حدّد الرابط يدوياً.'));
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={t('Lien de suivi pour les parents', 'رابط متابعة لأولياء الأمور')}>
      <div className="space-y-4">
        <p className="text-sm text-brand-600">
          {t(
            `Ce lien permet de consulter le suivi de ${student.firstName} (présences, progression, cotisations, reçus) sans compte. Il est personnel : ne l’envoyez qu’aux parents.`,
            `يتيح هذا الرابط الاطلاع على متابعة ${student.firstName} (الحضور والتقدّم والاشتراكات والإيصالات) دون حساب. هو شخصي: أرسله لأولياء الأمور فقط.`,
          )}
        </p>
        <Field label={t('Langue de la page', 'لغة الصفحة')}>
          <Chips value={lang} onChange={(v) => setLang(v as 'fr' | 'ar')} options={[{ value: 'fr', label: 'Français' }, { value: 'ar', label: 'العربية' }]} />
        </Field>
        {busy && (
          <div className="flex justify-center py-4">
            <Spinner />
          </div>
        )}
        {err && <Notice tone="bad">{err}</Notice>}
        {link && (
          <>
            <div className="rounded-2xl bg-sand-100 p-3">
              <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-brand-500">
                <Link2 className="size-3.5" />
                {t(`Valable jusqu’au ${date(link.expiresAt)}`, `صالح حتى ${date(link.expiresAt)}`)}
              </p>
              <p dir="ltr" className="break-all text-start text-sm text-brand-700">{link.url}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="primary" icon={<Copy className="size-4" />} onClick={copy}>{t('Copier', 'نسخ')}</Button>
              <Button variant="soft" icon={<MessageCircle className="size-4" />} onClick={() => window.open(waLink('', message), '_blank')}>WhatsApp</Button>
              <Button
                variant="soft"
                icon={<Mail className="size-4" />}
                onClick={() => (window.location.href = `mailto:${email}?subject=${encodeURIComponent(t('Suivi de ' + student.firstName, 'متابعة ' + student.firstName))}&body=${encodeURIComponent(message)}`)}
              >
                {t('E-mail', 'بريد')}
              </Button>
              <Button variant="ghost" icon={<ExternalLink className="size-4" />} onClick={() => window.open(link.url, '_blank')}>{t('Aperçu', 'معاينة')}</Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
