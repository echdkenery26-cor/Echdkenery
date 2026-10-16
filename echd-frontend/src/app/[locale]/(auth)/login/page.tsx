'use client';

import { Eye, EyeOff } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { Button, Link } from '@/components/ui/button';
import { Notice } from '@/components/ui/feedback';
import { Input, Field } from '@/components/ui/form';
import { ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useLocale } from '@/lib/i18n';

function LoginForm() {
  const { t, href } = useLocale();
  const router = useRouter();
  const params = useSearchParams();
  const { login, status, user, mustChangePassword } = useAuth();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const next = params.get('next');
  const home = (role?: string) => (role === 'TEACHER' ? '/teacher' : '/admin');

  // Déjà connecté : on va directement à la bonne page
  useEffect(() => {
    if (status !== 'authed' || !user) return;
    if (mustChangePassword) router.replace(href('/change-password'));
    else router.replace(next && next.startsWith('/') ? next : href(home(user.role)));
  }, [status, user, mustChangePassword, next, router, href]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await login(identifier.trim(), password);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : '';
      setError(
        err instanceof ApiError && err.status === 429
          ? t('Trop de tentatives. Patientez une minute avant de réessayer.', 'محاولات كثيرة. انتظر دقيقة ثم أعد المحاولة.')
          : msg || t('Connexion impossible. Vérifiez votre connexion internet.', 'تعذّر تسجيل الدخول. تحقق من اتصالك بالإنترنت.'),
      );
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="rounded-[1.5rem] bg-paper p-6 shadow-lift sm:p-8">
      <h1 className="font-serif text-2xl font-bold text-brand-800">{t('Connexion', 'تسجيل الدخول')}</h1>
      <p className="mt-1 text-sm text-brand-500">{t('Espace réservé à l’équipe de l’école.', 'فضاء خاص بفريق المدرسة.')}</p>
      <div className="mt-6 space-y-4">
        <Field label={t('Identifiant ou e-mail', 'اسم المستخدم أو البريد')} htmlFor="identifier">
          <Input id="identifier" name="identifier" value={identifier} onChange={(e) => setIdentifier(e.target.value)} autoComplete="username" autoCapitalize="none" autoCorrect="off" dir="ltr" required autoFocus />
        </Field>
        <Field label={t('Mot de passe', 'كلمة المرور')} htmlFor="password">
          <div className="relative">
            <Input id="password" name="password" type={show ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" dir="ltr" required className="pe-12" />
            <button
              type="button"
              onClick={() => setShow((s) => !s)}
              aria-label={show ? t('Masquer le mot de passe', 'إخفاء كلمة المرور') : t('Afficher le mot de passe', 'إظهار كلمة المرور')}
              className="absolute end-1 top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded-lg text-brand-400 hover:bg-sand-200"
            >
              {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
        </Field>
        {error && <Notice tone="bad">{error}</Notice>}
        <Button type="submit" variant="primary" size="lg" full loading={busy}>
          {t('Se connecter', 'دخول')}
        </Button>
        <p className="text-center text-sm">
          <Link href="/forgot-password" className="font-semibold text-brand-600 underline-offset-2 hover:underline">
            {t('Mot de passe oublié ?', 'نسيت كلمة المرور؟')}
          </Link>
        </p>
      </div>
    </form>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
