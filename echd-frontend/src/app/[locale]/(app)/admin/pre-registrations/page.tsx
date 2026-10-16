'use client';

import { Check, Clock, Inbox, Mail, MessageCircle, Phone, Trash2, UserCheck } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button, Link } from '@/components/ui/button';
import { Avatar, Badge, Card, PageHeader, Pagination, type Tone } from '@/components/ui/display';
import { EmptyState, ErrorState, Modal, Notice, SkeletonCards, useConfirm, useToast } from '@/components/ui/feedback';
import { Chips, Field, SearchBox, SelectField, TextareaField } from '@/components/ui/form';
import { audienceLabel } from '@/components/app/labels';
import { ApiError, api, del, patch, post } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { invalidate, messageOf, useApi } from '@/lib/hooks';
import { useLocale } from '@/lib/i18n';
import { useLookups } from '@/lib/lookups';
import { useUrlState } from '@/lib/url-state';
import { telLink, waLink } from '@/lib/utils';

const statusOf = (s: string, t: (a: string, b: string) => string): { label: string; tone: Tone } =>
  ({
    NEW: { label: t('Nouvelle', 'جديد'), tone: 'gold' as Tone },
    CONTACTED: { label: t('Contactée', 'تم الاتصال'), tone: 'info' as Tone },
    ACCEPTED: { label: t('Acceptée', 'مقبول'), tone: 'ok' as Tone },
    WAITLIST: { label: t('Liste d’attente', 'قائمة الانتظار'), tone: 'warn' as Tone },
    REFUSED: { label: t('Refusée', 'مرفوض'), tone: 'bad' as Tone },
  }[s] || { label: s, tone: 'neutral' as Tone });

const PAGE = 20;

export default function PreRegistrationsPage() {
  const { t, date, num } = useLocale();
  const [f, set] = useUrlState({ status: '', q: '', page: '1', open: '' });
  const { data, error, loading, reload } = useApi<any>('/pre-registrations', { status: f.status || undefined, q: f.q || undefined, page: Number(f.page), pageSize: PAGE });
  const counts = useApi<any>('/pre-registrations/count');

  return (
    <div>
      <PageHeader title={t('Préinscriptions', 'التسجيلات المسبقة')} subtitle={data ? t(`${num(data.total)} demande(s)`, `${num(data.total)} طلب`) : undefined} />
      <div className="mb-4 space-y-3">
        <SearchBox value={f.q} onChange={(v) => set({ q: v })} placeholder={t('Nom, téléphone ou référence…', 'الاسم أو الهاتف أو المرجع…')} />
        <Chips
          value={f.status}
          onChange={(v) => set({ status: v })}
          options={[
            { value: '', label: t('Toutes', 'الكل') },
            { value: 'NEW', label: t('Nouvelles', 'جديدة'), count: counts.data?.new || undefined },
            { value: 'CONTACTED', label: t('Contactées', 'تم الاتصال') },
            { value: 'WAITLIST', label: t('En attente', 'الانتظار') },
            { value: 'ACCEPTED', label: t('Acceptées', 'مقبولة') },
            { value: 'REFUSED', label: t('Refusées', 'مرفوضة') },
          ]}
        />
      </div>

      {error ? (
        <ErrorState message={error.message} onRetry={reload} />
      ) : loading || !data ? (
        <SkeletonCards n={4} />
      ) : data.items.length === 0 ? (
        <EmptyState icon={<Inbox className="size-6" />} title={t('Aucune demande', 'لا توجد طلبات')} text={t('Les demandes envoyées depuis le site public arrivent ici.', 'تصل هنا الطلبات المُرسلة من الموقع العام.')} />
      ) : (
        <>
          <div className="grid gap-3 md:grid-cols-2">
            {data.items.map((p: any) => {
              const st = statusOf(p.status, t);
              return (
                <Card key={p.id} onClick={() => set({ open: p.id }, false)} className="flex gap-3.5">
                  <div className="flex -space-x-3 rtl:space-x-reverse">
                    {p.persons.slice(0, 3).map((x: any) => (
                      <Avatar key={x.id} src={x.photoUrl} first={x.firstName} last={x.lastName} size={46} />
                    ))}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="truncate font-serif font-bold text-brand-800">{p.persons.map((x: any) => `${x.firstName} ${x.lastName}`).join(', ')}</p>
                      <Badge tone={st.tone}>{st.label}</Badge>
                    </div>
                    <p className="text-xs text-brand-400">{p.reference} · {audienceLabel(p.audience, t)} · {date(p.createdAt)}</p>
                    <p dir="ltr" className="num mt-1.5 text-start text-sm text-brand-600">{p.phone}</p>
                    {p.waitingDays > 3 && <p className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-warn"><Clock className="size-3.5" /> {t(`En attente depuis ${num(p.waitingDays)} jours`, `في الانتظار منذ ${num(p.waitingDays)} يوماً`)}</p>}
                  </div>
                </Card>
              );
            })}
          </div>
          <Pagination page={Number(f.page)} pageSize={PAGE} total={data.total} onChange={(p) => set({ page: String(p) }, false)} />
        </>
      )}

      <DetailModal id={f.open || null} onClose={() => set({ open: '' }, false)} />
    </div>
  );
}

function DetailModal({ id, onClose }: { id: string | null; onClose: () => void }) {
  const { t, date, dateTime } = useLocale();
  const { isAdmin } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const { data, error, reload } = useApi<any>(id ? `/pre-registrations/${id}` : null);
  const [notes, setNotes] = useState('');
  const [convert, setConvert] = useState(false);
  useEffect(() => setNotes(data?.internalNotes || ''), [data?.id, data?.internalNotes]);

  async function save(patchBody: any, okMsg?: string) {
    try {
      await patch(`/pre-registrations/${id}`, patchBody);
      await Promise.all([reload(), invalidate('/pre-registrations', '/dashboard')]);
      if (okMsg) toast.ok(okMsg);
    } catch (e) {
      toast.error(messageOf(e));
    }
  }
  async function remove() {
    if (!(await confirm({ title: t('Supprimer cette demande ?', 'حذف هذا الطلب؟'), danger: true, confirmLabel: t('Supprimer', 'حذف') }))) return;
    try {
      await del(`/pre-registrations/${id}`);
      await invalidate('/pre-registrations', '/dashboard');
      onClose();
    } catch (e) {
      toast.error(messageOf(e));
    }
  }

  const pending = data?.persons.filter((p: any) => !p.studentId).length || 0;
  const contact = data?.contactName;

  return (
    <>
    <Modal
      open={!!id}
      onClose={onClose}
      size="lg"
      title={data ? `${t('Demande', 'طلب')} ${data.reference}` : '…'}
      footer={
        data && (
          <>
            {isAdmin && <Button variant="ghost" className="me-auto text-bad" onClick={remove} icon={<Trash2 className="size-4" />}>{t('Supprimer', 'حذف')}</Button>}
            {data.status !== 'REFUSED' && pending > 0 && (
              <Button variant="primary" onClick={() => setConvert(true)} icon={<UserCheck className="size-4" />}>
                {pending > 1 ? t('Créer les fiches élèves', 'إنشاء ملفات الطلاب') : t('Valider et créer l’élève', 'تأكيد وإنشاء الطالب')}
              </Button>
            )}
          </>
        )
      }
    >
      {error ? (
        <ErrorState message={error.message} onRetry={reload} />
      ) : !data ? (
        <SkeletonCards n={2} />
      ) : (
        <div className="space-y-5">
          <div>
            <p className="mb-2 text-sm font-semibold text-brand-500">{t('Statut', 'الحالة')}</p>
            <Chips
              value={data.status}
              onChange={(v) => save({ status: v })}
              options={['NEW', 'CONTACTED', 'WAITLIST', 'ACCEPTED', 'REFUSED'].map((s) => ({ value: s, label: statusOf(s, t).label }))}
            />
          </div>

          <div className="space-y-2.5">
            {data.persons.map((p: any) => (
              <div key={p.id} className="flex items-center gap-3 rounded-2xl bg-sand-100 p-3">
                <Avatar src={p.photoUrl} first={p.firstName} last={p.lastName} size={48} />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-brand-800">{p.firstName} {p.lastName}</p>
                  <p className="text-xs text-brand-500">
                    {p.birthDate ? date(p.birthDate) : t('Date de naissance non indiquée', 'تاريخ الميلاد غير مذكور')}
                    {p.gender === 'MALE' ? ` · ${t('Garçon', 'ذكر')}` : p.gender === 'FEMALE' ? ` · ${t('Fille', 'أنثى')}` : ''}
                  </p>
                </div>
                {p.studentId ? (
                  <Link href={`/admin/students/${p.studentId}`} className="inline-flex items-center gap-1 rounded-full bg-ok-soft px-3 py-1 text-xs font-bold text-ok"><Check className="size-3.5" /> {t('Fiche créée', 'تم إنشاء الملف')}</Link>
                ) : null}
              </div>
            ))}
          </div>

          <div className="rounded-2xl bg-sand-100 p-4">
            {contact && <p className="font-semibold text-brand-800">{contact}{data.relationship ? ` · ${data.relationship}` : ''}</p>}
            <p dir="ltr" className="num text-start font-semibold text-brand-700">{data.phone}</p>
            {data.email && <p dir="ltr" className="text-start text-sm text-brand-500">{data.email}</p>}
            {(data.address || data.city) && <p className="text-sm text-brand-500">{[data.address, data.postalCode, data.city].filter(Boolean).join(', ')}</p>}
            <div className="mt-3 flex flex-wrap gap-2">
              <a href={waLink(data.phone)} target="_blank" rel="noreferrer" className="tap inline-flex items-center gap-2 rounded-xl bg-white px-3 text-sm font-semibold text-ok shadow-card"><MessageCircle className="size-4" /> WhatsApp</a>
              <a href={telLink(data.phone)} className="tap inline-flex items-center gap-2 rounded-xl bg-white px-3 text-sm font-semibold text-brand-700 shadow-card"><Phone className="size-4" /> {t('Appeler', 'اتصال')}</a>
              {data.email && <a href={`mailto:${data.email}`} className="tap inline-flex items-center gap-2 rounded-xl bg-white px-3 text-sm font-semibold text-brand-700 shadow-card"><Mail className="size-4" /> {t('E-mail', 'بريد')}</a>}
            </div>
          </div>

          <dl className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
            <div className="flex justify-between gap-3"><dt className="text-brand-400">{t('Public', 'الفئة')}</dt><dd className="font-medium text-brand-700">{audienceLabel(data.audience, t)}</dd></div>
            {data.course && <div className="flex justify-between gap-3"><dt className="text-brand-400">{t('Cours souhaité', 'الدرس المطلوب')}</dt><dd className="font-medium text-brand-700">{t(data.course.titleFr, data.course.titleAr)}</dd></div>}
            <div className="flex justify-between gap-3"><dt className="text-brand-400">{t('Reçue le', 'تاريخ الاستلام')}</dt><dd className="font-medium text-brand-700">{dateTime(data.createdAt)}</dd></div>
            {data.consentAt && <div className="flex justify-between gap-3"><dt className="text-brand-400">{t('Consentement RGPD', 'موافقة حماية البيانات')}</dt><dd className="font-medium text-brand-700">{date(data.consentAt)}</dd></div>}
          </dl>

          {data.message && (
            <div>
              <p className="mb-1 text-sm font-semibold text-brand-500">{t('Message', 'الرسالة')}</p>
              <p className="whitespace-pre-wrap rounded-2xl bg-white p-3 text-sm text-brand-700 ring-1 ring-sand-200">{data.message}</p>
            </div>
          )}

          <div>
            <TextareaField label={t('Notes internes', 'ملاحظات داخلية')} rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
            {notes !== (data.internalNotes || '') && (
              <div className="mt-2 text-end"><Button size="sm" variant="soft" onClick={() => save({ internalNotes: notes }, t('Note enregistrée', 'تم حفظ الملاحظة'))}>{t('Enregistrer la note', 'حفظ الملاحظة')}</Button></div>
            )}
          </div>
        </div>
      )}
    </Modal>
    {data && <ConvertModal open={convert} pre={data} onClose={() => setConvert(false)} onDone={() => { reload(); }} />}
    </>
  );
}

function ConvertModal({ open, pre, onClose, onDone }: { open: boolean; pre: any; onClose: () => void; onDone: () => void }) {
  const { t } = useLocale();
  const toast = useToast();
  const { lk } = useLookups();
  const [classId, setClassId] = useState('');
  const [busy, setBusy] = useState(false);
  const [dups, setDups] = useState<any[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const classes = lk?.classes.filter((c) => c.active && (!lk.currentSchoolYear || c.schoolYearId === lk.currentSchoolYear.id)) || [];

  async function go(force?: boolean) {
    setBusy(true);
    setErr(null);
    try {
      const r = await post(`/pre-registrations/${pre.id}/convert`, { classId: classId || undefined, force: force || undefined });
      await invalidate('/pre-registrations', '/students', '/dashboard', '/classes');
      toast.ok(t(`${r.students.length} fiche(s) élève créée(s)`, `تم إنشاء ${r.students.length} ملف(ات)`));
      r.warnings?.forEach((w: string) => toast.info(w));
      setDups(null);
      onClose();
      onDone();
    } catch (e) {
      if (e instanceof ApiError && e.code === 'DUPLICATE_STUDENT') setDups(e.data?.duplicates || []);
      else setErr(messageOf(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={t('Créer les fiches élèves', 'إنشاء ملفات الطلاب')}>
      <div className="space-y-4">
        <p className="text-sm text-brand-500">{t('Les informations de la demande (identité, photo, responsable, consentement) sont reprises sans ressaisie.', 'تُنقل معلومات الطلب (الهوية والصورة والوليّ والموافقة) دون إعادة إدخال.')}</p>
        <SelectField label={t('Inscrire directement dans une classe', 'تسجيل مباشر في قسم')} hint={t('Facultatif', 'اختياري')} value={classId} onChange={(e) => setClassId(e.target.value)}>
          <option value="">{t('— Pas de classe pour l’instant —', '— دون قسم حالياً —')}</option>
          {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </SelectField>
        {dups && (
          <Notice tone="warn">
            <p className="mb-1 font-semibold">{t('Des élèves très proches existent déjà :', 'يوجد طلاب مشابهون جداً:')}</p>
            <ul className="list-disc ps-5 text-sm">
              {dups.map((d, i) => <li key={i}>{d.person}</li>)}
            </ul>
          </Notice>
        )}
        {err && <Notice tone="bad">{err}</Notice>}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>{t('Annuler', 'إلغاء')}</Button>
          {dups ? <Button variant="danger" loading={busy} onClick={() => go(true)}>{t('Créer quand même', 'إنشاء رغم ذلك')}</Button> : <Button variant="primary" loading={busy} onClick={() => go()}>{t('Valider', 'تأكيد')}</Button>}
        </div>
      </div>
    </Modal>
  );
}
