'use client';

import { KeyRound, Pencil, Plus, Power, ShieldCheck, UserRound } from 'lucide-react';
import { useEffect, useState } from 'react';
import { CredentialsModal, type Credentials } from '@/components/app/credentials';
import { roleLabel } from '@/components/app/nav';
import { Button, IconButton } from '@/components/ui/button';
import { Avatar, Badge, Card, PageHeader } from '@/components/ui/display';
import { ErrorState, Modal, Notice, SkeletonCards, useConfirm, useToast } from '@/components/ui/feedback';
import { Chips, Field, TextField } from '@/components/ui/form';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { invalidate, messageOf, useApi } from '@/lib/hooks';
import { useLocale } from '@/lib/i18n';
import { clean } from '@/lib/utils';

export default function UsersPage() {
  const { t, dateTime } = useLocale();
  const { user: me } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const { data, error, loading, reload } = useApi<any[]>('/users');
  const [form, setForm] = useState<{ open: boolean; user: any | null }>({ open: false, user: null });
  const [creds, setCreds] = useState<{ c: Credentials; name: string } | null>(null);

  async function toggle(u: any) {
    try {
      await api(`/users/${u.id}`, { method: 'PATCH', body: { active: !u.active } });
      await invalidate('/users', '/teachers');
    } catch (e) {
      toast.error(messageOf(e));
    }
  }
  async function reset(u: any) {
    if (!(await confirm({ title: t('Réinitialiser le mot de passe ?', 'إعادة تعيين كلمة المرور؟'), message: t(`Un nouveau mot de passe provisoire sera créé pour ${u.firstName}. L’ancien ne fonctionnera plus.`, `ستُنشأ كلمة مرور مؤقتة جديدة لـ ${u.firstName}. ولن تعمل القديمة.`), confirmLabel: t('Réinitialiser', 'إعادة تعيين') }))) return;
    try {
      const r = await api(`/users/${u.id}/reset-password`, { method: 'POST', body: {} });
      setCreds({ c: r.credentials, name: u.firstName });
    } catch (e) {
      toast.error(messageOf(e));
    }
  }

  return (
    <div>
      <PageHeader
        title={t('Comptes', 'الحسابات')}
        subtitle={t('Personnes qui peuvent se connecter à l’administration.', 'الأشخاص الذين يمكنهم الدخول إلى الإدارة.')}
        actions={<Button variant="primary" icon={<Plus className="size-4" />} onClick={() => setForm({ open: true, user: null })}>{t('Nouveau compte', 'حساب جديد')}</Button>}
      />
      {error ? (
        <ErrorState message={error.message} onRetry={reload} />
      ) : loading || !data ? (
        <SkeletonCards n={4} />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {data.map((u) => (
            <Card key={u.id} className={u.active ? '' : 'opacity-60'}>
              <div className="flex items-start gap-3.5">
                <Avatar first={u.firstName} last={u.lastName} size={48} />
                <div className="min-w-0 flex-1">
                  <p className="font-serif font-bold text-brand-800">{u.firstName} {u.lastName}{u.id === me?.id && <span className="ms-2 text-xs font-normal text-brand-400">({t('vous', 'أنت')})</span>}</p>
                  <p dir="ltr" className="text-start font-mono text-xs text-brand-500">{u.username}</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <Badge tone={u.role === 'ADMIN' ? 'dark' : u.role === 'MANAGER' ? 'gold' : 'info'}>{roleLabel(u.role, t)}</Badge>
                    {!u.active && <Badge tone="warn">{t('Désactivé', 'معطّل')}</Badge>}
                    {u.mustChangePassword && <Badge tone="neutral">{t('Mot de passe à changer', 'يجب تغيير كلمة المرور')}</Badge>}
                  </div>
                  <p className="mt-2 text-xs text-brand-400">{u.lastLoginAt ? `${t('Dernière connexion', 'آخر دخول')} : ${dateTime(u.lastLoginAt)}` : t('Jamais connecté', 'لم يدخل بعد')}</p>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5 border-t border-sand-200 pt-3">
                <Button size="sm" variant="soft" icon={<Pencil className="size-4" />} onClick={() => setForm({ open: true, user: u })}>{t('Modifier', 'تعديل')}</Button>
                <Button size="sm" variant="ghost" icon={<KeyRound className="size-4" />} onClick={() => reset(u)}>{t('Mot de passe', 'كلمة المرور')}</Button>
                {u.id !== me?.id && <Button size="sm" variant="ghost" icon={<Power className="size-4" />} onClick={() => toggle(u)}>{u.active ? t('Désactiver', 'تعطيل') : t('Réactiver', 'تفعيل')}</Button>}
              </div>
            </Card>
          ))}
        </div>
      )}
      <UserForm open={form.open} user={form.user} onClose={() => setForm({ open: false, user: null })} onCreds={(c, name) => setCreds({ c, name })} />
      <CredentialsModal creds={creds?.c || null} name={creds?.name} onClose={() => setCreds(null)} />
    </div>
  );
}

function UserForm({ open, user, onClose, onCreds }: { open: boolean; user: any | null; onClose: () => void; onCreds: (c: Credentials, name: string) => void }) {
  const { t } = useLocale();
  const [f, setF] = useState<any>({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    if (open) {
      setErr(null);
      setF({ firstName: user?.firstName || '', lastName: user?.lastName || '', email: user?.email || '', username: '', password: '', role: user?.role || 'MANAGER', language: user?.language || 'fr' });
    }
  }, [open, user]);
  const set = (k: string, v: any) => setF((p: any) => ({ ...p, [k]: v }));
  const teacher = user?.role === 'TEACHER';

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (user) {
        await api(`/users/${user.id}`, { method: 'PATCH', body: { firstName: f.firstName.trim(), lastName: f.lastName.trim(), email: f.email.trim() || undefined, role: teacher ? undefined : f.role, language: f.language } });
        onClose();
      } else {
        const r = await api('/users', { method: 'POST', body: clean({ firstName: f.firstName, lastName: f.lastName, email: f.email, username: f.username, password: f.password, role: f.role, language: f.language }) });
        onClose();
        onCreds(r.credentials, f.firstName);
      }
      await invalidate('/users');
    } catch (e) {
      setErr(messageOf(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal open={open} onClose={onClose} title={user ? t('Modifier le compte', 'تعديل الحساب') : t('Nouveau compte', 'حساب جديد')}>
      <form onSubmit={save} className="space-y-4">
        {!user && <Notice tone="info">{t('Pour un enseignant, créez plutôt sa fiche dans « Équipe » : le compte est créé avec.', 'للمعلّم، أنشئ ملفه في «الفريق»: يُنشأ الحساب معه.')}</Notice>}
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label={t('Prénom', 'الاسم الأول')} required value={f.firstName || ''} onChange={(e) => set('firstName', e.target.value)} />
          <TextField label={t('Nom', 'اللقب')} value={f.lastName || ''} onChange={(e) => set('lastName', e.target.value)} />
        </div>
        <TextField label={t('E-mail', 'البريد')} type="email" dir="ltr" value={f.email || ''} onChange={(e) => set('email', e.target.value)} className="[&_input]:text-start" hint={t('Sert à réinitialiser le mot de passe.', 'يفيد في استعادة كلمة المرور.')} />
        {!teacher && (
          <Field label={t('Rôle', 'الدور')}>
            <Chips value={f.role || 'MANAGER'} onChange={(v) => set('role', v)} options={[{ value: 'MANAGER', label: t('Gestionnaire', 'مسؤول') }, { value: 'ADMIN', label: t('Administrateur', 'مدير') }]} />
            <p className="mt-1.5 text-xs text-brand-400">{f.role === 'ADMIN' ? t('Accès complet : comptes, paramètres, journal, sauvegarde.', 'وصول كامل: الحسابات والإعدادات والسجل والنسخ الاحتياطي.') : t('Élèves, classes, cotisations, annonces. Pas de paramètres ni de comptes.', 'الطلاب والأقسام والاشتراكات والإعلانات. دون إعدادات أو حسابات.')}</p>
          </Field>
        )}
        {!user && (
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField label={t('Identifiant', 'اسم المستخدم')} hint={t('Vide : généré', 'فارغ: يُولَّد')} dir="ltr" value={f.username || ''} onChange={(e) => set('username', e.target.value)} className="[&_input]:text-start" />
            <TextField label={t('Mot de passe provisoire', 'كلمة مرور مؤقتة')} hint={t('Vide : généré', 'فارغ: يُولَّد')} dir="ltr" value={f.password || ''} onChange={(e) => set('password', e.target.value)} className="[&_input]:text-start" />
          </div>
        )}
        <Field label={t('Langue', 'اللغة')}>
          <Chips value={f.language || 'fr'} onChange={(v) => set('language', v)} options={[{ value: 'fr', label: 'Français' }, { value: 'ar', label: 'العربية' }]} />
        </Field>
        {err && <Notice tone="bad">{err}</Notice>}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>{t('Annuler', 'إلغاء')}</Button>
          <Button type="submit" variant="primary" loading={busy}>{t('Enregistrer', 'حفظ')}</Button>
        </div>
      </form>
    </Modal>
  );
}
