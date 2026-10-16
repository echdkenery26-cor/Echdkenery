'use client';

import { CheckCircle2 } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { Button, Link } from '@/components/ui/button';
import { Notice } from '@/components/ui/feedback';
import { TextField } from '@/components/ui/form';
import { post } from '@/lib/api';
import { messageOf } from '@/lib/hooks';
import { useLocale } from '@/lib/i18n';
import { passwordProblem } from '@/lib/password';

function ResetForm() {
  const { t } = useLocale();
  const token = useSearchParams().get('token') || '';
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const problem = passwordProblem(pw, t);
    if (problem) return setError(problem);
    if (pw !== pw2) return setError(t('Les deux mots de passe sont différents.', 'كلمتا المرور غير متطابقتين.'));
    setBusy(true);
    setError('');
    try {
      await post('/auth/reset-password', { token, newPassword: pw });
      setDone(true);
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setBusy(false);
    }
  }

  if (!token)
    return (
      <div className="rounded-[1.5rem] bg-paper p-6 shadow-lift">
        <Notice tone="bad">{t('Lien invalide. Refaites une demande de réinitialisation.', 'رابط غير صالح. أعد طلب إعادة التعيين.')}</Notice>
        <Link href="/forgot-password" className="tap mt-4 inline-flex items-center font-semibold text-brand-600 underline">
          {t('Nouvelle demande', 'طلب جديد')}
        </Link>
      </div>
    );

  return (
    <div className="rounded-[1.5rem] bg-paper p-6 shadow-lift sm:p-8">
      {done ? (
        <div className="text-center">
          <span className="mx-auto mb-4 grid size-14 place-items-center rounded-full bg-ok-soft text-ok">
            <CheckCircle2 className="size-7" />
          </span>
          <h1 className="font-serif text-xl font-bold text-brand-800">{t('Mot de passe modifié', 'تم تغيير كلمة المرور')}</h1>
          <Link href="/login" className="tap mt-6 inline-flex items-center rounded-xl bg-brand-600 px-5 font-semibold text-white">
            {t('Se connecter', 'تسجيل الدخول')}
          </Link>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <h1 className="font-serif text-2xl font-bold text-brand-800">{t('Nouveau mot de passe', 'كلمة مرور جديدة')}</h1>
          <TextField label={t('Nouveau mot de passe', 'كلمة المرور الجديدة')} type="password" dir="ltr" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" hint={t('8 caractères minimum, avec une lettre et un chiffre.', '8 أحرف على الأقل، مع حرف ورقم.')} required />
          <TextField label={t('Confirmer', 'تأكيد')} type="password" dir="ltr" value={pw2} onChange={(e) => setPw2(e.target.value)} autoComplete="new-password" required />
          {error && <Notice tone="bad">{error}</Notice>}
          <Button type="submit" variant="primary" size="lg" full loading={busy}>
            {t('Enregistrer', 'حفظ')}
          </Button>
        </form>
      )}
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetForm />
    </Suspense>
  );
}
