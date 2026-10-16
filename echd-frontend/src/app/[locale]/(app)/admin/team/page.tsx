'use client';

import { BookOpen, Eye, EyeOff, KeyRound, Pencil, Phone, Plus, Trash2, UserCog, Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import { CredentialsModal, type Credentials } from '@/components/app/credentials';
import { Button, IconButton } from '@/components/ui/button';
import { Avatar, Badge, Card, PageHeader, Tabs } from '@/components/ui/display';
import { EmptyState, ErrorState, Modal, Notice, SkeletonCards, useConfirm, useToast } from '@/components/ui/feedback';
import { Chips, Field, PhotoPicker, Switch, TextField } from '@/components/ui/form';
import { api, del } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { clean, telLink } from '@/lib/utils';
import { invalidate, messageOf, useApi } from '@/lib/hooks';
import { useLocale } from '@/lib/i18n';
import { useUrlState } from '@/lib/url-state';

export default function TeamPage() {
  const { t } = useLocale();
  const { isAdmin } = useAuth();
  const [f, set] = useUrlState({ tab: 'teachers' });
  return (
    <div>
      <PageHeader title={t('Équipe', 'الفريق')} subtitle={t('Enseignants et personnes présentées sur le site.', 'المعلّمون والأشخاص المعروضون في الموقع.')} />
      <Tabs value={f.tab as 'teachers' | 'staff'} onChange={(v) => set({ tab: v })} tabs={[{ value: 'teachers', label: t('Enseignants', 'المعلّمون') }, { value: 'staff', label: t('Équipe du site', 'فريق الموقع') }]} />
      {f.tab === 'staff' ? <StaffList admin={isAdmin} /> : <TeachersList admin={isAdmin} />}
    </div>
  );
}

/* ─────────── Enseignants ─────────── */

function TeachersList({ admin }: { admin: boolean }) {
  const { t: tt, num: n } = useLocale();
  const toast = useToast();
  const confirm = useConfirm();
  const { data, error, loading, reload } = useApi<any[]>('/teachers');
  const [form, setForm] = useState<{ open: boolean; teacher: any | null }>({ open: false, teacher: null });
  const [creds, setCreds] = useState<{ c: Credentials; name: string } | null>(null);
  const [acct, setAcct] = useState<any | null>(null);

  async function remove(x: any) {
    if (!(await confirm({ title: tt('Supprimer cet enseignant ?', 'حذف هذا المعلّم؟'), message: tt('Son compte sera supprimé. Impossible s’il a des classes : désactivez-le plutôt.', 'سيُحذف حسابه. غير ممكن إذا كانت له أقسام: عطّله بدلاً من ذلك.'), danger: true, confirmLabel: tt('Supprimer', 'حذف') }))) return;
    try {
      await del(`/teachers/${x.id}`);
      await invalidate('/teachers', '/lookups', '/users');
    } catch (e) {
      toast.error(messageOf(e));
    }
  }

  return (
    <div>
      {admin && (
        <div className="mb-4 flex justify-end">
          <Button variant="primary" icon={<Plus className="size-4" />} onClick={() => setForm({ open: true, teacher: null })}>{tt('Nouvel enseignant', 'معلّم جديد')}</Button>
        </div>
      )}
      {error ? (
        <ErrorState message={error.message} onRetry={reload} />
      ) : loading || !data ? (
        <SkeletonCards n={4} />
      ) : data.length === 0 ? (
        <EmptyState icon={<Users className="size-6" />} title={tt('Aucun enseignant', 'لا يوجد معلّمون')} />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {data.map((x) => (
            <Card key={x.id} className={x.active ? '' : 'opacity-60'}>
              <div className="flex gap-3.5">
                <Avatar src={x.photoUrl} first={x.firstName} last={x.lastName} size={56} />
                <div className="min-w-0 flex-1">
                  <p className="font-serif text-lg font-bold leading-tight text-brand-800">{x.firstName} {x.lastName}</p>
                  {x.specialty && <p className="text-sm text-brand-500">{x.specialty}</p>}
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <Badge tone="info">{tt(`${n(x.classesCount)} classe(s)`, `${n(x.classesCount)} قسم`)}</Badge>
                    <Badge>{tt(`${n(x.studentsCount)} élève(s)`, `${n(x.studentsCount)} طالب`)}</Badge>
                    {!x.active && <Badge tone="warn">{tt('Inactif', 'غير نشط')}</Badge>}
                    {x.showOnSite && <Badge tone="ok"><Eye className="me-1 inline size-3" />{tt('Sur le site', 'ظاهر')}</Badge>}
                  </div>
                  <div className="mt-3 rounded-xl bg-sand-100 px-3 py-2 text-sm">
                    {x.user ? (
                      <p className="flex items-center gap-2 text-brand-600"><KeyRound className="size-4 text-ok" /> <span dir="ltr" className="font-mono text-xs">{x.user.username}</span></p>
                    ) : (
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-brand-500">{tt('Pas de compte de connexion', 'لا يوجد حساب دخول')}</span>
                        {admin && <Button size="sm" variant="soft" onClick={() => setAcct(x)}>{tt('Créer le compte', 'إنشاء الحساب')}</Button>}
                      </div>
                    )}
                  </div>
                  {x.phone && <a href={telLink(x.phone)} dir="ltr" className="num mt-2 inline-flex items-center gap-1.5 text-sm text-brand-500 hover:underline"><Phone className="size-3.5" /> {x.phone}</a>}
                </div>
                {admin && (
                  <div className="flex flex-col gap-1">
                    <IconButton label={tt('Modifier', 'تعديل')} className="!size-9" onClick={() => setForm({ open: true, teacher: x })}><Pencil className="size-4" /></IconButton>
                    <IconButton label={tt('Supprimer', 'حذف')} className="!size-9" onClick={() => remove(x)}><Trash2 className="size-4" /></IconButton>
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
      <TeacherForm open={form.open} teacher={form.teacher} onClose={() => setForm({ open: false, teacher: null })} onCreds={(c, name) => setCreds({ c, name })} />
      <AccountModal teacher={acct} onClose={() => setAcct(null)} onCreds={(c, name) => setCreds({ c, name })} />
      <CredentialsModal creds={creds?.c || null} name={creds?.name} onClose={() => setCreds(null)} />
    </div>
  );
}

function TeacherForm({ open, teacher, onClose, onCreds }: { open: boolean; teacher: any | null; onClose: () => void; onCreds: (c: Credentials, name: string) => void }) {
  const { t } = useLocale();
  const toast = useToast();
  const [f, setF] = useState<any>({});
  const [withAccount, setWithAccount] = useState(true);
  const [acc, setAcc] = useState({ username: '', password: '' });
  const [photo, setPhoto] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    if (!open) return;
    setErr(null);
    setPhoto(null);
    setWithAccount(true);
    setAcc({ username: '', password: '' });
    setF({ firstName: teacher?.firstName || '', lastName: teacher?.lastName || '', phone: teacher?.phone || '', email: teacher?.email || '', specialty: teacher?.specialty || '', audiences: teacher?.audiences || ['CHILD', 'ADULT'], active: teacher?.active ?? true, showOnSite: teacher?.showOnSite ?? true });
  }, [open, teacher]);
  const set = (k: string, v: any) => setF((p: any) => ({ ...p, [k]: v }));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const body: any = { ...clean({ firstName: f.firstName, lastName: f.lastName, phone: f.phone, email: f.email, specialty: f.specialty }), audiences: f.audiences, active: f.active, showOnSite: f.showOnSite };
      let id = teacher?.id;
      let creds: Credentials | undefined;
      if (teacher) await api(`/teachers/${id}`, { method: 'PATCH', body });
      else {
        if (withAccount) body.account = clean(acc);
        const r = await api('/teachers', { method: 'POST', body });
        id = r.teacher.id;
        creds = r.credentials;
      }
      if (photo) {
        const fd = new FormData();
        fd.append('file', photo);
        await api(`/teachers/${id}/photo`, { method: 'POST', body: fd }).catch(() => toast.error(t('La photo n’a pas pu être envoyée.', 'تعذّر إرسال الصورة.')));
      }
      await invalidate('/teachers', '/lookups', '/users', '/public');
      toast.ok(t('Enseignant enregistré', 'تم حفظ المعلّم'));
      onClose();
      if (creds) onCreds(creds, f.firstName);
    } catch (e) {
      setErr(messageOf(e));
    } finally {
      setBusy(false);
    }
  }
  const aud = (a: string) => (f.audiences || []).includes(a);
  const toggleAud = (a: string) => set('audiences', aud(a) ? f.audiences.filter((x: string) => x !== a) : [...(f.audiences || []), a]);

  return (
    <Modal open={open} onClose={onClose} size="lg" title={teacher ? t('Modifier l’enseignant', 'تعديل المعلّم') : t('Nouvel enseignant', 'معلّم جديد')}>
      <form onSubmit={save} className="space-y-4">
        <PhotoPicker src={teacher?.photoUrl} onPick={setPhoto} />
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label={t('Prénom', 'الاسم الأول')} required value={f.firstName || ''} onChange={(e) => set('firstName', e.target.value)} />
          <TextField label={t('Nom', 'اللقب')} value={f.lastName || ''} onChange={(e) => set('lastName', e.target.value)} />
          <TextField label={t('Téléphone', 'الهاتف')} type="tel" dir="ltr" value={f.phone || ''} onChange={(e) => set('phone', e.target.value)} className="[&_input]:text-start" />
          <TextField label={t('E-mail', 'البريد')} type="email" dir="ltr" value={f.email || ''} onChange={(e) => set('email', e.target.value)} className="[&_input]:text-start" />
        </div>
        <TextField label={t('Spécialité', 'التخصص')} value={f.specialty || ''} onChange={(e) => set('specialty', e.target.value)} placeholder={t('Ex. Tajwid, langue arabe', 'مثال: التجويد، اللغة العربية')} />
        <Field label={t('Enseigne à', 'يدرّس لـ')}>
          <div className="flex gap-2">
            <Chips value={aud('CHILD') ? 'y' : 'n'} onChange={() => toggleAud('CHILD')} options={[{ value: 'y', label: t('Enfants', 'الأطفال') }]} />
            <Chips value={aud('ADULT') ? 'y' : 'n'} onChange={() => toggleAud('ADULT')} options={[{ value: 'y', label: t('Adultes', 'الكبار') }]} />
          </div>
        </Field>
        <div className="space-y-3">
          <Switch checked={!!f.showOnSite} onChange={(v) => set('showOnSite', v)} label={t('Afficher sur la page « Équipe » du site', 'عرضه في صفحة «الفريق» بالموقع')} />
          <Switch checked={!!f.active} onChange={(v) => set('active', v)} label={t('Enseignant actif', 'معلّم نشط')} />
        </div>
        {!teacher && (
          <div className="rounded-2xl bg-sand-100 p-4">
            <Switch checked={withAccount} onChange={setWithAccount} label={t('Créer son compte de connexion', 'إنشاء حساب الدخول')} hint={t('Il pourra faire l’appel et suivre ses élèves.', 'سيتمكّن من تسجيل الحضور ومتابعة طلابه.')} />
            {withAccount && (
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <TextField label={t('Identifiant', 'اسم المستخدم')} hint={t('Laissez vide : prenom.nom', 'اتركه فارغاً: الاسم.اللقب')} dir="ltr" value={acc.username} onChange={(e) => setAcc({ ...acc, username: e.target.value })} className="[&_input]:text-start" />
                <TextField label={t('Mot de passe provisoire', 'كلمة مرور مؤقتة')} hint={t('Laissez vide : généré automatiquement', 'اتركه فارغاً: يُولَّد تلقائياً')} dir="ltr" value={acc.password} onChange={(e) => setAcc({ ...acc, password: e.target.value })} className="[&_input]:text-start" />
              </div>
            )}
          </div>
        )}
        {err && <Notice tone="bad">{err}</Notice>}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>{t('Annuler', 'إلغاء')}</Button>
          <Button type="submit" variant="primary" loading={busy}>{t('Enregistrer', 'حفظ')}</Button>
        </div>
      </form>
    </Modal>
  );
}

function AccountModal({ teacher, onClose, onCreds }: { teacher: any | null; onClose: () => void; onCreds: (c: Credentials, name: string) => void }) {
  const { t } = useLocale();
  const [acc, setAcc] = useState({ username: '', password: '' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    if (teacher) {
      setAcc({ username: '', password: '' });
      setErr(null);
    }
  }, [teacher]);
  async function go(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await api(`/teachers/${teacher.id}/account`, { method: 'POST', body: clean(acc) });
      await invalidate('/teachers', '/users');
      onClose();
      onCreds(r.credentials, teacher.firstName);
    } catch (e) {
      setErr(messageOf(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal open={!!teacher} onClose={onClose} title={t('Créer le compte de connexion', 'إنشاء حساب الدخول')}>
      <form onSubmit={go} className="space-y-4">
        <p className="text-sm text-brand-500">{teacher && `${teacher.firstName} ${teacher.lastName}`}</p>
        <TextField label={t('Identifiant', 'اسم المستخدم')} hint={t('Laissez vide : prenom.nom', 'اتركه فارغاً: الاسم.اللقب')} dir="ltr" value={acc.username} onChange={(e) => setAcc({ ...acc, username: e.target.value })} className="[&_input]:text-start" />
        <TextField label={t('Mot de passe provisoire', 'كلمة مرور مؤقتة')} hint={t('Laissez vide : généré automatiquement', 'اتركه فارغاً: يُولَّد تلقائياً')} dir="ltr" value={acc.password} onChange={(e) => setAcc({ ...acc, password: e.target.value })} className="[&_input]:text-start" />
        {err && <Notice tone="bad">{err}</Notice>}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>{t('Annuler', 'إلغاء')}</Button>
          <Button type="submit" variant="primary" loading={busy}>{t('Créer le compte', 'إنشاء الحساب')}</Button>
        </div>
      </form>
    </Modal>
  );
}

/* ─────────── Équipe affichée sur le site ─────────── */

function StaffList({ admin }: { admin: boolean }) {
  const { t, pick } = useLocale();
  const toast = useToast();
  const confirm = useConfirm();
  const { data, error, loading, reload } = useApi<any[]>('/staff');
  const [form, setForm] = useState<{ open: boolean; member: any | null }>({ open: false, member: null });

  async function remove(x: any) {
    if (!(await confirm({ title: t('Retirer cette personne ?', 'إزالة هذا الشخص؟'), danger: true, confirmLabel: t('Retirer', 'إزالة') }))) return;
    try {
      await del(`/staff/${x.id}`);
      await invalidate('/staff', '/public');
    } catch (e) {
      toast.error(messageOf(e));
    }
  }
  return (
    <div>
      {admin && (
        <div className="mb-4 flex justify-end">
          <Button variant="primary" icon={<Plus className="size-4" />} onClick={() => setForm({ open: true, member: null })}>{t('Ajouter', 'إضافة')}</Button>
        </div>
      )}
      {error ? (
        <ErrorState message={error.message} onRetry={reload} />
      ) : loading || !data ? (
        <SkeletonCards n={3} />
      ) : data.length === 0 ? (
        <EmptyState icon={<UserCog className="size-6" />} title={t('Personne pour le moment', 'لا أحد حالياً')} text={t('Direction, secrétariat… : ajoutez les personnes à présenter sur le site.', 'الإدارة، الأمانة…: أضف من تريد عرضهم في الموقع.')} />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {data.map((x) => (
            <Card key={x.id} className={x.visible ? '' : 'opacity-60'}>
              <div className="flex items-center gap-3.5">
                <Avatar src={x.photoUrl} first={x.name} last="" size={52} />
                <div className="min-w-0 flex-1">
                  <p className="font-serif font-bold text-brand-800">{x.name}</p>
                  <p className="text-sm text-brand-500">{pick(x.roleFr, x.roleAr || x.roleFr)}</p>
                  <div className="mt-1.5">{x.visible ? <Badge tone="ok"><Eye className="me-1 inline size-3" />{t('Sur le site', 'ظاهر')}</Badge> : <Badge><EyeOff className="me-1 inline size-3" />{t('Masqué', 'مخفي')}</Badge>}</div>
                </div>
                {admin && (
                  <div className="flex flex-col gap-1">
                    <IconButton label={t('Modifier', 'تعديل')} className="!size-9" onClick={() => setForm({ open: true, member: x })}><Pencil className="size-4" /></IconButton>
                    <IconButton label={t('Supprimer', 'حذف')} className="!size-9" onClick={() => remove(x)}><Trash2 className="size-4" /></IconButton>
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
      <StaffForm open={form.open} member={form.member} onClose={() => setForm({ open: false, member: null })} />
    </div>
  );
}

function StaffForm({ open, member, onClose }: { open: boolean; member: any | null; onClose: () => void }) {
  const { t } = useLocale();
  const toast = useToast();
  const [f, setF] = useState<any>({});
  const [photo, setPhoto] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    if (open) {
      setErr(null);
      setPhoto(null);
      setF({ name: member?.name || '', roleFr: member?.roleFr || '', roleAr: member?.roleAr || '', order: String(member?.order ?? 0), visible: member?.visible ?? true });
    }
  }, [open, member]);
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const body = { name: f.name.trim(), roleFr: f.roleFr.trim(), roleAr: f.roleAr.trim(), order: Number(f.order || 0), visible: f.visible };
      const r = member ? await api(`/staff/${member.id}`, { method: 'PATCH', body }) : await api('/staff', { method: 'POST', body });
      if (photo) {
        const fd = new FormData();
        fd.append('file', photo);
        await api(`/staff/${r.id || member.id}/photo`, { method: 'POST', body: fd }).catch(() => toast.error(t('La photo n’a pas pu être envoyée.', 'تعذّر إرسال الصورة.')));
      }
      await invalidate('/staff', '/public');
      onClose();
    } catch (e) {
      setErr(messageOf(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal open={open} onClose={onClose} title={member ? t('Modifier', 'تعديل') : t('Ajouter une personne', 'إضافة شخص')}>
      <form onSubmit={save} className="space-y-4">
        <PhotoPicker src={member?.photoUrl} onPick={setPhoto} />
        <TextField label={t('Nom', 'الاسم')} required value={f.name || ''} onChange={(e) => setF({ ...f, name: e.target.value })} />
        <TextField label={t('Fonction (français)', 'الوظيفة (فرنسي)')} required value={f.roleFr || ''} onChange={(e) => setF({ ...f, roleFr: e.target.value })} />
        <TextField label={t('Fonction (arabe)', 'الوظيفة (عربي)')} dir="rtl" value={f.roleAr || ''} onChange={(e) => setF({ ...f, roleAr: e.target.value })} />
        <TextField label={t('Ordre d’affichage', 'ترتيب العرض')} type="number" dir="ltr" value={f.order ?? '0'} onChange={(e) => setF({ ...f, order: e.target.value })} className="[&_input]:text-start" />
        <Switch checked={!!f.visible} onChange={(v) => setF({ ...f, visible: v })} label={t('Visible sur le site', 'ظاهر في الموقع')} />
        {err && <Notice tone="bad">{err}</Notice>}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>{t('Annuler', 'إلغاء')}</Button>
          <Button type="submit" variant="primary" loading={busy}>{t('Enregistrer', 'حفظ')}</Button>
        </div>
      </form>
    </Modal>
  );
}
