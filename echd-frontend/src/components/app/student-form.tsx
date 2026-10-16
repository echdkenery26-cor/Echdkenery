'use client';

import { AlertTriangle, Plus, Save, Trash2, UserRound } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge, Card, CardTitle } from '@/components/ui/display';
import { Modal, Notice, useToast } from '@/components/ui/feedback';
import { Checkbox, Chips, Field, PhotoPicker, SelectField, TextField, TextareaField } from '@/components/ui/form';
import { ApiError, api } from '@/lib/api';
import { invalidate, messageOf } from '@/lib/hooks';
import { useLocale } from '@/lib/i18n';
import { useLookups } from '@/lib/lookups';
import { clean, cn } from '@/lib/utils';
import { Link } from '@/components/ui/button';

interface Guardian {
  name: string;
  relationship: string;
  phone: string;
  email: string;
}
const blankGuardian = (): Guardian => ({ name: '', relationship: '', phone: '', email: '' });

/**
 * Formulaire élève : création (avec classes, fratrie, doublons) et modification.
 * `student` fourni = modification.
 */
export function StudentForm({ student, siblingOf }: { student?: any; siblingOf?: { id: string; lastName: string; audience?: string } | null }) {
  const { t, pick, num, isAr } = useLocale();
  const router = useRouter();
  const toast = useToast();
  const { lk } = useLookups();
  const editing = !!student;

  const [f, setF] = useState(() => ({
    firstName: student?.firstName || '',
    lastName: student?.lastName || siblingOf?.lastName || '',
    arabicName: student?.arabicName || '',
    audience: (student?.audience || siblingOf?.audience || 'CHILD') as 'CHILD' | 'ADULT',
    gender: student?.gender || '',
    birthDate: student?.birthDate ? String(student.birthDate).slice(0, 10) : '',
    phone: student?.phone || '',
    email: student?.email || '',
    address: student?.address || '',
    postalCode: student?.postalCode || '',
    city: student?.city || '',
    startLevelId: student?.startLevelId || '',
    notes: student?.notes || '',
    imageRightsConsent: !!student?.imageRightsConsent,
    gdprConsent: editing ? !!student?.gdprConsentAt : false,
  }));
  const [guardians, setGuardians] = useState<Guardian[]>(() =>
    student?.guardians?.length
      ? student.guardians.map((g: any) => ({ name: g.name || '', relationship: g.relationship || '', phone: g.phone || '', email: g.email || '' }))
      : [blankGuardian()],
  );
  const [classIds, setClassIds] = useState<string[]>([]);
  const [photo, setPhoto] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [dups, setDups] = useState<any[] | null>(null);

  const up = (k: keyof typeof f, v: any) => setF((p) => ({ ...p, [k]: v }));
  const upG = (i: number, k: keyof Guardian, v: string) => setGuardians((g) => g.map((x, j) => (j === i ? { ...x, [k]: v } : x)));
  const isChild = f.audience === 'CHILD';

  const classOptions = useMemo(() => {
    if (!lk) return [];
    const cur = lk.currentSchoolYear?.id;
    return lk.classes
      .filter((c) => c.active && (!cur || c.schoolYearId === cur))
      .map((c) => ({ ...c, course: lk.courses.find((x) => x.id === c.courseId) }))
      .filter((c) => !c.course || c.course.audience === 'ALL' || c.course.audience === f.audience || c.course.audience === 'BOTH');
  }, [lk, f.audience]);

  function body(force?: boolean) {
    const g = guardians.map((x) => clean(x)).filter((x) => x.name);
    return {
      ...clean({
        firstName: f.firstName,
        lastName: f.lastName,
        arabicName: f.arabicName,
        audience: f.audience,
        gender: f.gender,
        birthDate: f.birthDate,
        phone: f.phone,
        email: f.email,
        address: f.address,
        postalCode: f.postalCode,
        city: f.city,
        startLevelId: f.startLevelId,
        notes: f.notes,
      }),
      imageRightsConsent: f.imageRightsConsent,
      guardians: g,
      ...(editing ? {} : { gdprConsent: f.gdprConsent, classIds, siblingOfStudentId: siblingOf?.id, force: force || undefined }),
    };
  }

  async function submit(e?: React.FormEvent, force?: boolean) {
    e?.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      if (editing) {
        await api(`/students/${student.id}`, { method: 'PATCH', body: body() });
        invalidate('/students');
        toast.ok(t('Fiche enregistrée', 'تم حفظ الملف'));
        router.push(`/${isAr ? 'ar' : 'fr'}/admin/students/${student.id}`);
        return;
      }
      const r = await api<{ student: any; warnings: string[] }>('/students', { method: 'POST', body: body(force) });
      if (photo) {
        const fd = new FormData();
        fd.append('file', photo);
        await api(`/students/${r.student.id}/photo`, { method: 'POST', body: fd }).catch(() => toast.error(t('La photo n’a pas pu être envoyée.', 'تعذّر إرسال الصورة.')));
      }
      invalidate('/students', '/dashboard', '/classes', '/dues');
      toast.ok(t('Élève ajouté', 'تمت إضافة الطالب'));
      r.warnings?.forEach((w) => toast.info(w));
      router.push(`/${isAr ? 'ar' : 'fr'}/admin/students/${r.student.id}`);
    } catch (e) {
      if (e instanceof ApiError && e.code === 'DUPLICATE_STUDENT') setDups(e.data?.duplicates || []);
      else setErr(messageOf(e));
    } finally {
      setBusy(false);
    }
  }

  const needGuardianPhone = isChild && !guardians.some((g) => g.name && g.phone);

  return (
    <form onSubmit={(e) => submit(e)} className="space-y-5">
      {siblingOf && (
        <Notice tone="info">
          {t('Cet élève sera ajouté à la fratrie de', 'سيُضاف هذا الطالب إلى إخوة')} <strong>{siblingOf.lastName}</strong>.
        </Notice>
      )}

      <Card>
        <CardTitle icon={<UserRound className="size-4" />}>{t('Identité', 'الهوية')}</CardTitle>
        <div className="mb-4">
          <Chips
            value={f.audience}
            onChange={(v) => up('audience', v)}
            options={[
              { value: 'CHILD', label: t('Enfant', 'طفل') },
              { value: 'ADULT', label: t('Adulte', 'بالغ') },
            ]}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label={t('Prénom', 'الاسم الأول')} required value={f.firstName} onChange={(e) => up('firstName', e.target.value)} autoComplete="off" />
          <TextField label={t('Nom', 'اللقب')} required value={f.lastName} onChange={(e) => up('lastName', e.target.value)} autoComplete="off" />
          <TextField label={t('Nom en arabe', 'الاسم بالعربية')} hint={t('Facultatif', 'اختياري')} dir="rtl" value={f.arabicName} onChange={(e) => up('arabicName', e.target.value)} />
          <TextField label={t('Date de naissance', 'تاريخ الميلاد')} type="date" dir="ltr" value={f.birthDate} onChange={(e) => up('birthDate', e.target.value)} className="[&_input]:text-start" />
          <Field label={t('Sexe', 'الجنس')}>
            <Chips
              value={f.gender}
              onChange={(v) => up('gender', v)}
              options={[
                { value: 'MALE', label: t('Masculin', 'ذكر') },
                { value: 'FEMALE', label: t('Féminin', 'أنثى') },
              ]}
            />
          </Field>
          <SelectField label={t('Niveau de départ', 'مستوى البداية')} value={f.startLevelId} onChange={(e) => up('startLevelId', e.target.value)}>
            <option value="">{t('— À définir —', '— غير محدد —')}</option>
            {lk?.levels.filter((l) => l.active !== false).map((l) => (
              <option key={l.id} value={l.id}>{pick(l.labelFr, l.labelAr)}</option>
            ))}
          </SelectField>
        </div>
        {!editing && (
          <div className="mt-5 border-t border-sand-200 pt-4">
            <PhotoPicker onPick={setPhoto} src={null} />
          </div>
        )}
      </Card>

      <Card>
        <CardTitle>{isChild ? t('Responsables légaux', 'الأولياء') : t('Coordonnées', 'بيانات الاتصال')}</CardTitle>
        {isChild ? (
          <div className="space-y-4">
            {guardians.map((g, i) => (
              <div key={i} className="rounded-2xl bg-sand-100 p-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <TextField label={t('Nom complet', 'الاسم الكامل')} value={g.name} onChange={(e) => upG(i, 'name', e.target.value)} />
                  <TextField label={t('Lien (père, mère…)', 'الصلة (أب، أم…)')} value={g.relationship} onChange={(e) => upG(i, 'relationship', e.target.value)} />
                  <TextField label={t('Téléphone', 'الهاتف')} type="tel" dir="ltr" value={g.phone} onChange={(e) => upG(i, 'phone', e.target.value)} className="[&_input]:text-start" />
                  <TextField label={t('E-mail', 'البريد الإلكتروني')} type="email" dir="ltr" value={g.email} onChange={(e) => upG(i, 'email', e.target.value)} className="[&_input]:text-start" />
                </div>
                {guardians.length > 1 && (
                  <div className="mt-2 text-end">
                    <Button variant="ghost" size="sm" onClick={() => setGuardians((x) => x.filter((_, j) => j !== i))} icon={<Trash2 className="size-4" />}>
                      {t('Retirer', 'إزالة')}
                    </Button>
                  </div>
                )}
              </div>
            ))}
            {guardians.length < 4 && (
              <Button variant="soft" onClick={() => setGuardians((g) => [...g, blankGuardian()])} icon={<Plus className="size-4" />}>
                {t('Ajouter un responsable', 'إضافة ولي')}
              </Button>
            )}
            {needGuardianPhone && <p className="text-xs font-medium text-warn">{t('Au moins un responsable avec un numéro de téléphone est obligatoire.', 'يلزم ولي أمر واحد على الأقل مع رقم هاتف.')}</p>}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField label={t('Téléphone', 'الهاتف')} required type="tel" dir="ltr" value={f.phone} onChange={(e) => up('phone', e.target.value)} className="[&_input]:text-start" />
            <TextField label={t('E-mail', 'البريد الإلكتروني')} type="email" dir="ltr" value={f.email} onChange={(e) => up('email', e.target.value)} className="[&_input]:text-start" />
          </div>
        )}
        <div className="mt-5 grid gap-4 border-t border-sand-200 pt-4 sm:grid-cols-6">
          <TextField className="sm:col-span-6" label={t('Adresse', 'العنوان')} value={f.address} onChange={(e) => up('address', e.target.value)} />
          <TextField className="sm:col-span-2" label={t('Code postal', 'الرمز البريدي')} dir="ltr" value={f.postalCode} onChange={(e) => up('postalCode', e.target.value)} />
          <TextField className="sm:col-span-4" label={t('Ville', 'المدينة')} value={f.city} onChange={(e) => up('city', e.target.value)} />
          {isChild && (
            <>
              <TextField className="sm:col-span-3" label={t('Téléphone de l’enfant', 'هاتف الطفل')} hint={t('Facultatif', 'اختياري')} type="tel" dir="ltr" value={f.phone} onChange={(e) => up('phone', e.target.value)} />
              <TextField className="sm:col-span-3" label={t('E-mail de l’enfant', 'بريد الطفل')} hint={t('Facultatif', 'اختياري')} type="email" dir="ltr" value={f.email} onChange={(e) => up('email', e.target.value)} />
            </>
          )}
        </div>
      </Card>

      {!editing && (
        <Card>
          <CardTitle>{t('Inscription en classe', 'التسجيل في قسم')}</CardTitle>
          {!lk ? null : classOptions.length === 0 ? (
            <p className="text-sm text-brand-500">{t('Aucune classe ouverte pour ce public. Vous pourrez inscrire l’élève plus tard.', 'لا توجد أقسام مفتوحة لهذه الفئة. يمكنك التسجيل لاحقاً.')}</p>
          ) : (
            <>
              <p className="mb-3 text-sm text-brand-500">{t('Facultatif : vous pouvez aussi inscrire l’élève plus tard depuis sa fiche.', 'اختياري: يمكنك التسجيل لاحقاً من ملف الطالب.')}</p>
              <ul className="grid gap-2 sm:grid-cols-2">
                {classOptions.map((c) => {
                  const on = classIds.includes(c.id);
                  return (
                    <li key={c.id}>
                      <button
                        type="button"
                        onClick={() => setClassIds((x) => (on ? x.filter((i) => i !== c.id) : [...x, c.id]))}
                        aria-pressed={on}
                        className={cn('tap flex w-full items-center justify-between gap-2 rounded-2xl px-4 py-3 text-start transition', on ? 'bg-brand-600 text-white shadow-lift' : 'bg-sand-100 text-brand-700 hover:bg-brand-50')}
                      >
                        <span className="min-w-0">
                          <span className="block truncate font-semibold">{c.name}</span>
                          {c.course && <span className={cn('block truncate text-xs', on ? 'text-white/70' : 'text-brand-400')}>{pick(c.course.titleFr, c.course.titleAr)}</span>}
                        </span>
                        <span className="num shrink-0 text-xs opacity-80">{num(c.capacity)} {t('places', 'مقعد')}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </Card>
      )}

      <Card>
        <CardTitle>{t('Notes et consentements', 'ملاحظات وموافقات')}</CardTitle>
        <TextareaField label={t('Notes internes', 'ملاحظات داخلية')} hint={t('Visibles de l’administration seulement.', 'تظهر للإدارة فقط.')} rows={3} value={f.notes} onChange={(e) => up('notes', e.target.value)} />
        <div className="mt-4 space-y-3">
          {!editing && (
            <Checkbox checked={f.gdprConsent} onChange={(v) => up('gdprConsent', v)}>
              {t('Consentement RGPD recueilli (données personnelles)', 'تم أخذ موافقة حماية البيانات الشخصية')}
            </Checkbox>
          )}
          <Checkbox checked={f.imageRightsConsent} onChange={(v) => up('imageRightsConsent', v)}>{t('Autorisation de droit à l’image', 'الإذن باستخدام الصورة')}</Checkbox>
        </div>
      </Card>

      {err && <Notice tone="bad">{err}</Notice>}

      <div className="safe-bottom sticky bottom-20 z-10 flex justify-end gap-2 rounded-2xl bg-white/95 p-2.5 shadow-lift backdrop-blur lg:bottom-4">
        <Button variant="ghost" onClick={() => router.back()}>{t('Annuler', 'إلغاء')}</Button>
        <Button type="submit" variant="primary" loading={busy} icon={<Save className="size-4" />}>
          {editing ? t('Enregistrer', 'حفظ') : t('Créer la fiche', 'إنشاء الملف')}
        </Button>
      </div>

      <Modal
        open={!!dups}
        onClose={() => setDups(null)}
        title={t('Cet élève existe peut-être déjà', 'ربما هذا الطالب موجود مسبقاً')}
        footer={
          <>
            <Button variant="ghost" onClick={() => setDups(null)}>{t('Corriger', 'تعديل')}</Button>
            <Button
              variant="primary"
              onClick={() => {
                setDups(null);
                submit(undefined, true);
              }}
            >
              {t('Créer quand même', 'إنشاء رغم ذلك')}
            </Button>
          </>
        }
      >
        <div className="mb-3 flex gap-3 text-warn">
          <AlertTriangle className="size-5 shrink-0" />
          <p className="text-sm text-brand-600">{t('Un élève très proche existe déjà (même nom et même téléphone ou date de naissance).', 'يوجد طالب مشابه جداً (نفس الاسم ونفس الهاتف أو تاريخ الميلاد).')}</p>
        </div>
        <ul className="space-y-2">
          {dups?.map((d) => (
            <li key={d.id}>
              <Link href={`/admin/students/${d.id}`} target="_blank" className="flex items-center justify-between rounded-xl bg-sand-100 p-3 hover:bg-brand-50">
                <span className="font-semibold text-brand-800">{d.firstName} {d.lastName}</span>
                <Badge>{t('Voir la fiche', 'عرض الملف')}</Badge>
              </Link>
            </li>
          ))}
        </ul>
      </Modal>
    </form>
  );
}
