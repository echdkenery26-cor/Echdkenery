'use client';

import { ShieldCheck } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Notice } from '@/components/ui/feedback';
import { TextField } from '@/components/ui/form';
import { post } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { messageOf } from '@/lib/hooks';
import { useLocale } from '@/lib/i18n';
import { passwordProblem } from '@/lib/password';

export default function ChangePasswordPage() {
  const { t, href } = useLocale();
  const router = useRouter();
  const { status, user, mustChangePassword, login, logout } = useAuth();
  const [current, setCurrent] = useState('');
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (status === 'anon') router.replace(href('/login'));
  }, [status, router, href]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const problem = passwordProblem(pw, t);
    if (problem) return setError(problem);
    if (pw !== pw2) return setError(t('Les deux mots de passe sont différents.', 'كلمتا المرور غير متطابقتين.'));
    setBusy(true);
    setError('');
    try {
      await post('/auth/change-password', { currentPassword: current, newPassword: pw });
      // Les sessions sont renouvelées : on se reconnecte avec le nouveau mot de passe.
      const u = await login(user!.username, pw);
      router.replace(href(u.role === 'TEACHER' ? '/teacher' : '/admin'));
    } catch (err) {
      setError(messageOf(err));
      setBusy(false);
    }
  }

  if (status !== 'authed') return null;

  return (
    <form onSubmit={submit} className="rounded-[1.5rem] bg-paper p-6 shadow-lift sm:p-8">
      <span className="mb-4 grid size-12 place-items-center rounded-2xl bg-gold-200 text-gold-700">
        <ShieldCheck className="size-6" />
      </span>
      <h1 className="font-serif text-2xl font-bold text-brand-800">{t('Choisissez votre mot de passe', 'اختر كلمة مرورك')}</h1>
      <p className="mt-1 text-sm text-brand-500">
        {mustChangePassword
          ? t('Le mot de passe reçu est temporaire. Remplacez-le par un mot de passe que vous seul connaissez.', 'كلمة المرور التي تلقيتها مؤقتة. استبدلها بكلمة مرور لا يعرفها غيرك.')
          : t('Choisissez un nouveau mot de passe.', 'اختر كلمة مرور جديدة.')}
      </p>
      <div className="mt-6 space-y-4">
        <TextField label={t('Mot de passe actuel', 'كلمة المرور الحالية')} type="password" dir="ltr" value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" required />
        <TextField label={t('Nouveau mot de passe', 'كلمة المرور الجديدة')} type="password" dir="ltr" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" hint={t('8 caractères minimum, avec une lettre et un chiffre.', '8 أحرف على الأقل، مع حرف ورقم.')} required />
        <TextField label={t('Confirmer le nouveau mot de passe', 'تأكيد كلمة المرور الجديدة')} type="password" dir="ltr" value={pw2} onChange={(e) => setPw2(e.target.value)} autoComplete="new-password" required />
        {error && <Notice tone="bad">{error}</Notice>}
        <Button type="submit" variant="primary" size="lg" full loading={busy}>
          {t('Enregistrer', 'حفظ')}
        </Button>
        {mustChangePassword && (
          <button type="button" onClick={() => logout().then(() => router.replace(href('/login')))} className="tap w-full text-sm font-semibold text-brand-500 hover:underline">
            {t('Se déconnecter', 'تسجيل الخروج')}
          </button>
        )}
      </div>
    </form>
  );
}
