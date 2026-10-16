'use client';

import { MailCheck } from 'lucide-react';
import { useState } from 'react';
import { Button, Link } from '@/components/ui/button';
import { Notice } from '@/components/ui/feedback';
import { TextField } from '@/components/ui/form';
import { messageOf } from '@/lib/hooks';
import { post } from '@/lib/api';
import { useLocale } from '@/lib/i18n';

export default function ForgotPasswordPage() {
  const { t } = useLocale();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await post('/auth/forgot-password', { email: email.trim() });
      setSent(true);
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-[1.5rem] bg-paper p-6 shadow-lift sm:p-8">
      {sent ? (
        <div className="text-center">
          <span className="mx-auto mb-4 grid size-14 place-items-center rounded-full bg-ok-soft text-ok">
            <MailCheck className="size-7" />
          </span>
          <h1 className="font-serif text-xl font-bold text-brand-800">{t('Vérifiez votre boîte mail', 'تحقق من بريدك الإلكتروني')}</h1>
          <p className="mt-2 text-sm text-brand-500">
            {t('Si un compte existe avec cette adresse, un lien de réinitialisation valable 1 heure vient d’être envoyé.', 'إن وُجد حساب بهذا البريد فقد أُرسل إليه رابط لإعادة التعيين صالح لمدة ساعة.')}
          </p>
          <Link href="/login" className="tap mt-6 inline-flex items-center font-semibold text-brand-600 underline">
            {t('Retour à la connexion', 'العودة إلى تسجيل الدخول')}
          </Link>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <h1 className="font-serif text-2xl font-bold text-brand-800">{t('Mot de passe oublié', 'نسيت كلمة المرور')}</h1>
          <p className="text-sm text-brand-500">
            {t('Saisissez l’e-mail de votre compte. Sans e-mail enregistré, demandez à l’administrateur de réinitialiser votre mot de passe.', 'أدخل بريد حسابك. إن لم يكن لديك بريد مسجَّل فاطلب من المدير إعادة تعيين كلمة المرور.')}
          </p>
          <TextField label={t('Adresse e-mail', 'البريد الإلكتروني')} type="email" dir="ltr" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
          {error && <Notice tone="bad">{error}</Notice>}
          <Button type="submit" variant="primary" size="lg" full loading={busy}>
            {t('Envoyer le lien', 'إرسال الرابط')}
          </Button>
          <p className="text-center text-sm">
            <Link href="/login" className="font-semibold text-brand-600 hover:underline">
              {t('Retour à la connexion', 'العودة إلى تسجيل الدخول')}
            </Link>
          </p>
        </form>
      )}
    </div>
  );
}
