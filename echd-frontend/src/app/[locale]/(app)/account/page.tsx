'use client';

import { KeyRound, Save } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button, LinkButton } from '@/components/ui/button';
import { Card, CardTitle, PageHeader } from '@/components/ui/display';
import { Chips, Field, TextField } from '@/components/ui/form';
import { useToast } from '@/components/ui/feedback';
import { roleLabel } from '@/components/app/nav';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { messageOf } from '@/lib/hooks';
import { useLocale } from '@/lib/i18n';

export default function AccountPage() {
  const { t } = useLocale();
  const { user, reload } = useAuth();
  const toast = useToast();
  const [f, setF] = useState({ firstName: '', lastName: '', email: '', language: 'fr' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (user) setF({ firstName: user.firstName || '', lastName: user.lastName || '', email: user.email || '', language: user.language || 'fr' });
  }, [user]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      await api('/auth/me', { method: 'PATCH', body: { firstName: f.firstName.trim(), lastName: f.lastName.trim(), email: f.email.trim() || undefined, language: f.language } });
      await reload();
      toast.ok(t('Profil enregistré', 'تم حفظ الملف الشخصي'));
    } catch (e) {
      setErr(messageOf(e));
    } finally {
      setBusy(false);
    }
  }

  if (!user) return null;
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title={t('Mon compte', 'حسابي')} subtitle={`${user.username} · ${roleLabel(user.role, t)}`} />
      <form onSubmit={save} className="space-y-5">
        <Card>
          <CardTitle>{t('Mes informations', 'معلوماتي')}</CardTitle>
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField label={t('Prénom', 'الاسم الأول')} required value={f.firstName} onChange={(e) => setF({ ...f, firstName: e.target.value })} />
            <TextField label={t('Nom', 'اللقب')} required value={f.lastName} onChange={(e) => setF({ ...f, lastName: e.target.value })} />
          </div>
          <TextField className="mt-4" label={t('E-mail', 'البريد الإلكتروني')} type="email" dir="ltr" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} hint={t('Utile pour réinitialiser votre mot de passe.', 'يفيد في استعادة كلمة المرور.')} />
          <Field className="mt-4" label={t('Langue des e-mails et documents', 'لغة الرسائل والوثائق')}>
            <Chips value={f.language} onChange={(v) => setF({ ...f, language: v })} options={[{ value: 'fr', label: 'Français' }, { value: 'ar', label: 'العربية' }]} />
          </Field>
          {err && <p className="mt-3 text-sm font-medium text-bad">{err}</p>}
          <div className="mt-5 flex justify-end">
            <Button type="submit" variant="primary" loading={busy} icon={<Save className="size-4" />}>
              {t('Enregistrer', 'حفظ')}
            </Button>
          </div>
        </Card>
        <Card className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-serif font-bold text-brand-800">{t('Mot de passe', 'كلمة المرور')}</p>
            <p className="text-sm text-brand-500">{t('Changez-le régulièrement.', 'غيّرها بانتظام.')}</p>
          </div>
          <LinkButton href="/change-password" variant="outline" icon={<KeyRound className="size-4" />}>
            {t('Changer le mot de passe', 'تغيير كلمة المرور')}
          </LinkButton>
        </Card>
      </form>
    </div>
  );
}
