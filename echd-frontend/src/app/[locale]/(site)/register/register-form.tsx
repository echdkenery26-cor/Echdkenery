'use client';

import { Check, CheckCircle2, MessageCircle, Plus, Trash2, User, Users } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Button, Link, LinkButton } from '@/components/ui/button';
import { Card } from '@/components/ui/display';
import { Notice } from '@/components/ui/feedback';
import { Checkbox, Field, PhotoPicker, SelectField, TextField, TextareaField } from '@/components/ui/form';
import { ApiError, api, post } from '@/lib/api';
import { usePublic } from '@/lib/hooks';
import { useLocale } from '@/lib/i18n';
import { cn } from '@/lib/utils';

interface Person {
  firstName: string;
  lastName: string;
  arabicName: string;
  birthDate: string;
  gender: '' | 'MALE' | 'FEMALE';
  photoKey: string;
  imageRights: boolean;
  uploading?: boolean;
}

const blank = (lastName = ''): Person => ({ firstName: '', lastName, arabicName: '', birthDate: '', gender: '', photoKey: '', imageRights: false });
const MAX_PERSONS = 8;

export function RegisterForm() {
  const { t, pick, money, num } = useLocale();
  const settings = usePublic<any>('/public/settings');
  const courses = usePublic<any[]>('/public/courses');

  const [step, setStep] = useState(1);
  const [audience, setAudience] = useState<'CHILD' | 'ADULT' | ''>('');
  const [courseId, setCourseId] = useState('');
  const [persons, setPersons] = useState<Person[]>([blank()]);
  const [contact, setContact] = useState({ contactName: '', relationship: 'père', phone: '', email: '', address: '', postalCode: '', city: '', message: '' });
  const [website, setWebsite] = useState(''); // champ piège anti-spam
  const [consent, setConsent] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<any>(null);

  const open = settings.data ? settings.data['site.registrationOpen'] !== false : true;
  const list = useMemo(() => (courses.data || []).filter((c) => !audience || c.audience === audience), [courses.data, audience]);

  const setP = (i: number, patch: Partial<Person>) => setPersons((l) => l.map((p, k) => (k === i ? { ...p, ...patch } : p)));

  async function uploadPhoto(i: number, file: File) {
    setP(i, { uploading: true });
    try {
      const fd = new FormData();
      fd.append('file', file);
      const r = await api<{ key: string }>('/public/uploads/photo', { method: 'POST', body: fd, anonymous: true });
      setP(i, { photoKey: r.key, uploading: false });
    } catch {
      setP(i, { uploading: false, photoKey: '' });
      setErrors((e) => ({ ...e, [`photo${i}`]: t('La photo n’a pas pu être envoyée. Vous pouvez continuer sans photo.', 'تعذّر إرسال الصورة. يمكنكم المتابعة بدونها.') }));
    }
  }

  function validate(s: number) {
    const e: Record<string, string> = {};
    const req = t('Champ obligatoire', 'حقل إلزامي');
    if (s === 1 && !audience) e.audience = t('Choisissez qui s’inscrit.', 'اختاروا من سيسجَّل.');
    if (s === 2)
      persons.forEach((p, i) => {
        if (!p.firstName.trim()) e[`firstName${i}`] = req;
        if (!p.lastName.trim()) e[`lastName${i}`] = req;
        if (audience === 'CHILD' && !p.birthDate) e[`birthDate${i}`] = t('La date de naissance sert à vérifier l’âge minimum.', 'تاريخ الميلاد لازم للتحقق من السن الأدنى.');
      });
    if (s === 3) {
      if (audience === 'CHILD' && !contact.contactName.trim()) e.contactName = req;
      if (contact.phone.replace(/\D/g, '').length < 6) e.phone = t('Indiquez un numéro de téléphone valide.', 'أدخلوا رقم هاتف صالحاً.');
      if (contact.email && !/^\S+@\S+\.\S+$/.test(contact.email)) e.email = t('Adresse e-mail invalide.', 'بريد إلكتروني غير صالح.');
      if (!consent) e.consent = t('Votre accord est nécessaire pour enregistrer la demande.', 'موافقتكم لازمة لتسجيل الطلب.');
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  const next = () => validate(step) && setStep((s) => s + 1);

  async function submit() {
    if (!validate(3)) return;
    setBusy(true);
    setServerError('');
    try {
      const body = {
        audience,
        courseId: courseId || undefined,
        contactName: contact.contactName.trim() || undefined,
        relationship: audience === 'CHILD' ? contact.relationship : undefined,
        phone: contact.phone.trim(),
        email: contact.email.trim() || undefined,
        address: contact.address.trim() || undefined,
        postalCode: contact.postalCode.trim() || undefined,
        city: contact.city.trim() || undefined,
        message: contact.message.trim() || undefined,
        persons: persons.map((p) => ({
          firstName: p.firstName.trim(),
          lastName: p.lastName.trim(),
          arabicName: p.arabicName.trim() || undefined,
          birthDate: p.birthDate || undefined,
          gender: p.gender || undefined,
          photoKey: p.photoKey || undefined,
          imageRights: p.imageRights || undefined,
        })),
        consent: true,
        website,
      };
      setDone(await api('/public/pre-registrations', { method: 'POST', body, anonymous: true }));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) {
      setServerError(e instanceof ApiError ? e.details?.join(' ') || e.message : t('Une erreur est survenue. Réessayez dans un instant.', 'حدث خطأ. أعيدوا المحاولة بعد قليل.'));
    } finally {
      setBusy(false);
    }
  }

  if (!open)
    return (
      <div className="mx-auto max-w-xl">
        <Notice tone="warn">{t('Les pré-inscriptions sont fermées pour le moment. Revenez bientôt ou contactez-nous.', 'التسجيل المسبق مغلق حالياً. عودوا قريباً أو اتصلوا بنا.')}</Notice>
        <LinkButton href="/contact" variant="dark" className="mt-4">
          {t('Nous contacter', 'اتصل بنا')}
        </LinkButton>
      </div>
    );

  if (done)
    return (
      <div className="mx-auto max-w-xl">
        <Card className="text-center !p-8">
          <span className="mx-auto mb-4 grid size-16 place-items-center rounded-full bg-ok-soft text-ok">
            <CheckCircle2 className="size-9" />
          </span>
          <h2 className="font-serif text-2xl font-bold text-brand-800">{t('Demande envoyée', 'تم إرسال الطلب')}</h2>
          <p className="mt-2 text-brand-500">
            {persons.length > 1
              ? t(`Nous avons bien reçu la demande pour ${num(persons.length)} personnes.`, `استلمنا الطلب لـ ${num(persons.length)} أشخاص.`)
              : t('Nous avons bien reçu votre demande.', 'استلمنا طلبكم.')}
          </p>
          <p className="mt-5 text-sm text-brand-400">{t('Votre référence', 'مرجعكم')}</p>
          <p dir="ltr" className="num font-serif text-2xl font-bold tracking-wide text-brand-700">
            {done.reference}
          </p>
          <p className="mt-5 text-brand-600">{t('Nous vous appelons très prochainement pour confirmer la place.', 'سنتصل بكم قريباً جداً لتأكيد المقعد.')}</p>
          {done.registrationFee && (
            <p className="mt-4 rounded-2xl bg-sand-200/70 px-4 py-3 text-sm text-brand-700">
              {pick(done.registrationFee.titleFr, done.registrationFee.titleAr)} : <strong className="num">{money(done.registrationFee.amountCents, done.registrationFee.currency)}</strong>{' '}
              {t('(à régler après confirmation)', '(يُسدَّد بعد التأكيد)')}
            </p>
          )}
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
            {done.whatsappUrl && (
              <a href={done.whatsappUrl} target="_blank" rel="noreferrer" className="tap inline-flex items-center justify-center gap-2 rounded-xl bg-gold-500 px-5 py-2.5 font-semibold text-brand-800">
                <MessageCircle className="size-4" /> {t('Écrire sur WhatsApp', 'مراسلتنا على واتساب')}
              </a>
            )}
            <LinkButton href="/" variant="outline">
              {t('Retour à l’accueil', 'العودة إلى الرئيسية')}
            </LinkButton>
          </div>
        </Card>
      </div>
    );

  const steps = [t('Qui', 'من'), t('Détails', 'التفاصيل'), t('Contact', 'التواصل')];

  return (
    <div className="mx-auto max-w-2xl">
      <ol className="mb-8 flex items-center gap-2" aria-label={t('Étapes', 'الخطوات')}>
        {steps.map((label, i) => {
          const n = i + 1;
          const on = n === step;
          const past = n < step;
          return (
            <li key={label} className="flex flex-1 items-center gap-2" aria-current={on ? 'step' : undefined}>
              <span
                className={cn(
                  'num grid size-9 shrink-0 place-items-center rounded-full text-sm font-bold transition',
                  on ? 'bg-brand-600 text-gold-400' : past ? 'bg-mint text-brand-800' : 'bg-sand-300 text-brand-500',
                )}
              >
                {past ? <Check className="size-4" /> : num(n)}
              </span>
              <span className={cn('truncate text-sm font-semibold', on ? 'text-brand-800' : 'text-brand-400')}>{label}</span>
              {i < steps.length - 1 && <span className="h-px flex-1 bg-sand-300" />}
            </li>
          );
        })}
      </ol>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          step < 3 ? next() : submit();
        }}
        noValidate
        className="space-y-5"
      >
        {step === 1 && (
          <>
            <fieldset>
              <legend className="mb-3 font-serif text-lg font-bold text-brand-800">{t('Qui souhaite s’inscrire ?', 'من يرغب في التسجيل؟')}</legend>
              <div className="grid gap-3 sm:grid-cols-2">
                {(
                  [
                    ['CHILD', t('Un enfant', 'طفل'), t('Dès 6 ans · un ou plusieurs enfants de la même famille', 'من سن 6 سنوات · طفل أو عدة أطفال من العائلة نفسها'), Users],
                    ['ADULT', t('Un adulte', 'شخص بالغ'), t('Cours adaptés aux adultes, tous niveaux', 'دروس مناسبة للكبار، جميع المستويات'), User],
                  ] as const
                ).map(([v, title, text, Icon]) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => {
                      setAudience(v);
                      setCourseId('');
                      setPersons((l) => (v === 'ADULT' ? [l[0]] : l));
                      setErrors({});
                    }}
                    aria-pressed={audience === v}
                    className={cn(
                      'flex items-start gap-4 rounded-[1.25rem] p-5 text-start shadow-card transition',
                      audience === v ? 'bg-brand-600 text-white shadow-lift' : 'bg-white hover:-translate-y-0.5 hover:shadow-lift',
                    )}
                  >
                    <span className={cn('grid size-12 shrink-0 place-items-center rounded-2xl', audience === v ? 'bg-white/15 text-gold-400' : 'bg-brand-50 text-brand-600')}>
                      <Icon className="size-6" />
                    </span>
                    <span>
                      <span className="block font-serif text-lg font-bold">{title}</span>
                      <span className={cn('text-sm', audience === v ? 'text-white/75' : 'text-brand-500')}>{text}</span>
                    </span>
                  </button>
                ))}
              </div>
              {errors.audience && <p className="mt-2 text-sm font-medium text-bad">{errors.audience}</p>}
            </fieldset>

            {audience && (
              <SelectField label={t('Cours souhaité (facultatif)', 'الدرس المرغوب (اختياري)')} value={courseId} onChange={(e) => setCourseId(e.target.value)} hint={t('Si vous hésitez, laissez vide : nous vous conseillerons.', 'إن لم تكونوا متأكدين اتركوه فارغاً وسننصحكم.')}>
                <option value="">{t('Je ne sais pas encore', 'لا أعرف بعد')}</option>
                {list.map((c) => (
                  <option key={c.id} value={c.id}>
                    {pick(c.titleFr, c.titleAr)}
                  </option>
                ))}
              </SelectField>
            )}
          </>
        )}

        {step === 2 && (
          <>
            <h2 className="font-serif text-lg font-bold text-brand-800">
              {audience === 'CHILD' ? t('Les enfants à inscrire', 'الأطفال المراد تسجيلهم') : t('Vos informations', 'معلوماتكم')}
            </h2>
            {persons.map((p, i) => (
              <Card key={i} className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-brand-700">{audience === 'CHILD' ? t(`Enfant ${num(i + 1)}`, `الطفل ${num(i + 1)}`) : t('Personne à inscrire', 'الشخص المراد تسجيله')}</p>
                  {persons.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setPersons((l) => l.filter((_, k) => k !== i))}
                      className="tap inline-flex items-center gap-1.5 rounded-xl px-3 text-sm font-semibold text-bad hover:bg-bad-soft"
                    >
                      <Trash2 className="size-4" /> {t('Retirer', 'إزالة')}
                    </button>
                  )}
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <TextField label={t('Prénom', 'الاسم الأول')} required value={p.firstName} onChange={(e) => setP(i, { firstName: e.target.value })} error={errors[`firstName${i}`]} autoComplete="given-name" />
                  <TextField label={t('Nom', 'اسم العائلة')} required value={p.lastName} onChange={(e) => setP(i, { lastName: e.target.value })} error={errors[`lastName${i}`]} autoComplete="family-name" />
                  <TextField label={t('Nom en arabe (facultatif)', 'الاسم بالعربية (اختياري)')} dir="rtl" value={p.arabicName} onChange={(e) => setP(i, { arabicName: e.target.value })} />
                  <TextField
                    label={t('Date de naissance', 'تاريخ الميلاد')}
                    type="date"
                    required={audience === 'CHILD'}
                    value={p.birthDate}
                    max={new Date().toISOString().slice(0, 10)}
                    onChange={(e) => setP(i, { birthDate: e.target.value })}
                    error={errors[`birthDate${i}`]}
                  />
                </div>
                <Field label={t('Sexe (facultatif)', 'الجنس (اختياري)')}>
                  <div className="flex gap-2">
                    {(
                      [
                        ['MALE', t('Garçon / Homme', 'ذكر')],
                        ['FEMALE', t('Fille / Femme', 'أنثى')],
                      ] as const
                    ).map(([v, label]) => (
                      <button
                        key={v}
                        type="button"
                        aria-pressed={p.gender === v}
                        onClick={() => setP(i, { gender: p.gender === v ? '' : v })}
                        className={cn('tap flex-1 rounded-xl px-3 text-sm font-semibold ring-1 ring-inset transition', p.gender === v ? 'bg-brand-600 text-white ring-brand-600' : 'bg-white text-brand-600 ring-sand-300')}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </Field>
                <PhotoPicker onPick={(f) => uploadPhoto(i, f)} busy={p.uploading} label={t('Ajouter une photo (facultatif)', 'إضافة صورة (اختياري)')} />
                {errors[`photo${i}`] && <p className="text-sm text-bad">{errors[`photo${i}`]}</p>}
                <Checkbox checked={p.imageRights} onChange={(v) => setP(i, { imageRights: v })}>
                  {t('J’autorise l’école à utiliser cette photo dans ses communications (facultatif).', 'أسمح للمدرسة باستخدام هذه الصورة في منشوراتها (اختياري).')}
                </Checkbox>
              </Card>
            ))}
            {audience === 'CHILD' && persons.length < MAX_PERSONS && (
              <Button variant="outline" icon={<Plus className="size-4" />} onClick={() => setPersons((l) => [...l, blank(l[0]?.lastName)])} full>
                {t('Ajouter un autre enfant', 'إضافة طفل آخر')}
              </Button>
            )}
          </>
        )}

        {step === 3 && (
          <>
            <h2 className="font-serif text-lg font-bold text-brand-800">{audience === 'CHILD' ? t('Le responsable légal', 'ولي الأمر') : t('Comment vous joindre', 'كيف نتصل بكم')}</h2>
            <Card className="space-y-4">
              {audience === 'CHILD' && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <TextField label={t('Nom du responsable', 'اسم ولي الأمر')} required value={contact.contactName} onChange={(e) => setContact({ ...contact, contactName: e.target.value })} error={errors.contactName} autoComplete="name" />
                  <SelectField label={t('Lien avec l’enfant', 'صلة القرابة')} value={contact.relationship} onChange={(e) => setContact({ ...contact, relationship: e.target.value })}>
                    <option value="père">{t('Père', 'الأب')}</option>
                    <option value="mère">{t('Mère', 'الأم')}</option>
                    <option value="tuteur">{t('Tuteur / tutrice', 'وصي')}</option>
                    <option value="autre">{t('Autre', 'آخر')}</option>
                  </SelectField>
                </div>
              )}
              <div className="grid gap-4 sm:grid-cols-2">
                <TextField label={t('Téléphone', 'الهاتف')} required type="tel" inputMode="tel" dir="ltr" value={contact.phone} onChange={(e) => setContact({ ...contact, phone: e.target.value })} error={errors.phone} autoComplete="tel" hint={t('De préférence avec WhatsApp', 'يفضَّل أن يكون عليه واتساب')} />
                <TextField label={t('E-mail (facultatif)', 'البريد الإلكتروني (اختياري)')} type="email" dir="ltr" value={contact.email} onChange={(e) => setContact({ ...contact, email: e.target.value })} error={errors.email} autoComplete="email" />
              </div>
              <TextField label={t('Adresse (facultatif)', 'العنوان (اختياري)')} value={contact.address} onChange={(e) => setContact({ ...contact, address: e.target.value })} autoComplete="street-address" />
              <div className="grid gap-4 sm:grid-cols-[1fr_2fr]">
                <TextField label={t('Code postal', 'الرمز البريدي')} value={contact.postalCode} onChange={(e) => setContact({ ...contact, postalCode: e.target.value })} autoComplete="postal-code" />
                <TextField label={t('Ville', 'المدينة')} value={contact.city} onChange={(e) => setContact({ ...contact, city: e.target.value })} autoComplete="address-level2" />
              </div>
              <TextareaField label={t('Un message ? (facultatif)', 'رسالة؟ (اختياري)')} value={contact.message} onChange={(e) => setContact({ ...contact, message: e.target.value })} />
              {/* Champ piège : invisible pour les personnes, rempli par les robots */}
              <div aria-hidden className="absolute -start-[9999px] h-0 w-0 overflow-hidden">
                <label>
                  Website
                  <input tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
                </label>
              </div>
            </Card>
            <Checkbox checked={consent} onChange={setConsent} error={errors.consent}>
              {t('J’accepte que ces informations soient utilisées par l’école pour traiter cette demande. ', 'أوافق على استخدام المدرسة لهذه المعلومات لمعالجة الطلب. ')}
              <Link href="/privacy" target="_blank" className="font-semibold text-brand-600 underline">
                {t('Politique de confidentialité', 'سياسة الخصوصية')}
              </Link>
            </Checkbox>
            {serverError && <Notice tone="bad">{serverError}</Notice>}
          </>
        )}

        <div className="flex items-center justify-between gap-3 pt-2">
          {step > 1 ? (
            <Button variant="outline" onClick={() => setStep((s) => s - 1)}>
              {t('Retour', 'رجوع')}
            </Button>
          ) : (
            <span />
          )}
          {step < 3 ? (
            <Button type="submit" variant="dark" size="lg">
              {t('Continuer', 'متابعة')}
            </Button>
          ) : (
            <Button type="submit" variant="primary" size="lg" loading={busy}>
              {t('Envoyer la demande', 'إرسال الطلب')}
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}
