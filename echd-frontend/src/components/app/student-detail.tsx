'use client';

import {
  Archive, ArchiveRestore, CalendarCheck, CalendarX, ClipboardList, FileText, GraduationCap, History, Mail, MapPin, MessageCircle, MoreHorizontal, Pencil, Phone, Plus, Printer,
  Repeat, ShieldCheck, Trash2, UserPlus, Users, Wallet,
} from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import { Button, IconButton, Link, LinkButton } from '@/components/ui/button';
import { Avatar, Badge, Card, CardTitle, KV, ProgressBar, Tabs } from '@/components/ui/display';
import { EmptyState, ErrorState, Modal, Notice, SkeletonCards, useConfirm, useToast } from '@/components/ui/feedback';
import { Field, Select, SelectField } from '@/components/ui/form';
import { Popover } from '@/components/ui/popover';
import { ApiError, api, del, openDocument, post } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { invalidate, messageOf, useApi } from '@/lib/hooks';
import { useLocale } from '@/lib/i18n';
import { useLookups } from '@/lib/lookups';
import { telLink, waLink, cn } from '@/lib/utils';
import { actionLabel, actionTone, entityLabel } from './audit-labels';
import { CancelPaymentModal, DueCard, ExemptModal, NewDueModal, PaymentCard, PaymentModal, ReminderModal } from './finance-bits';
import { attendanceStatus, audienceLabel, enrollmentStatus, genderLabel, studentStatus } from './labels';
import { StudentProgress } from './student-progress';
import { StudentCard } from './student-card';

type TabId = 'info' | 'classes' | 'progress' | 'attendance' | 'finance' | 'history';
const refresh = (id: string) => invalidate(`/students/${id}`, '/students', '/classes', '/dashboard', '/dues');

/** Fiche élève. `mode="teacher"` : lecture seule des infos, suivi pédagogique et présences, jamais d'argent. */
export function StudentDetail({ id, mode }: { id: string; mode: 'staff' | 'teacher' }) {
  const { t, isAr, num, pick } = useLocale();
  const { isAdmin } = useAuth();
  const router = useRouter();
  const sp = useSearchParams();
  const toast = useToast();
  const confirm = useConfirm();
  const staff = mode === 'staff';
  const { data: s, error, loading, reload } = useApi<any>(`/students/${id}`);
  const [tab, setTabState] = useState<TabId>((sp.get('tab') as TabId) || (staff ? 'info' : 'progress'));
  const [statusModal, setStatusModal] = useState(false);

  const setTab = (v: TabId) => {
    setTabState(v);
    const next = new URLSearchParams(sp.toString());
    next.set('tab', v);
    window.history.replaceState(null, '', `?${next.toString()}`);
  };

  if (error) return <ErrorState message={error.message} onRetry={reload} />;
  if (loading || !s) return <SkeletonCards n={3} />;

  const st = studentStatus(s.status, t);
  const base = staff ? '/admin' : '/teacher';

  const tabs: Array<{ value: TabId; label: string; badge?: number }> = staff
    ? [
        { value: 'info', label: t('Infos', 'المعلومات') },
        { value: 'classes', label: t('Classes', 'الأقسام'), badge: s.enrollments.filter((e: any) => e.status !== 'ENDED').length },
        { value: 'progress', label: t('Progression', 'التقدّم') },
        { value: 'attendance', label: t('Présences', 'الحضور') },
        { value: 'finance', label: t('Cotisations', 'الاشتراكات') },
        { value: 'history', label: t('Historique', 'السجل') },
      ]
    : [
        { value: 'progress', label: t('Progression', 'التقدّم') },
        { value: 'attendance', label: t('Présences', 'الحضور') },
        { value: 'info', label: t('Infos', 'المعلومات') },
      ];

  async function archive() {
    if (!(await confirm({ title: t('Archiver ce dossier ?', 'أرشفة هذا الملف؟'), message: t('L’élève sera marqué « parti » et ses inscriptions seront clôturées. L’historique est conservé.', 'سيُعتبر الطالب «غادر» وتُنهى تسجيلاته. يبقى السجل محفوظاً.'), confirmLabel: t('Archiver', 'أرشفة') }))) return;
    try {
      await post(`/students/${id}/archive`);
      await refresh(id);
      toast.ok(t('Dossier archivé', 'تمت الأرشفة'));
    } catch (e) {
      toast.error(messageOf(e));
    }
  }
  async function unarchive() {
    try {
      await post(`/students/${id}/unarchive`);
      await refresh(id);
      toast.ok(t('Dossier désarchivé', 'تم إلغاء الأرشفة'));
    } catch (e) {
      toast.error(messageOf(e));
    }
  }
  async function remove() {
    if (!(await confirm({ title: t('Supprimer définitivement ?', 'حذف نهائي؟'), message: t('Toutes les données de cet élève (présences, paiements, progression) seront effacées. Cette action est irréversible.', 'ستُمحى كل بيانات هذا الطالب (الحضور، المدفوعات، التقدّم) ولا يمكن التراجع.'), danger: true, confirmLabel: t('Supprimer', 'حذف') }))) return;
    try {
      await del(`/students/${id}?confirm=yes`);
      await invalidate('/students', '/dashboard');
      toast.ok(t('Élève supprimé', 'تم حذف الطالب'));
      router.push(`/${isAr ? 'ar' : 'fr'}/admin/students`);
    } catch (e) {
      toast.error(messageOf(e));
    }
  }

  return (
    <div>
      <Link href={`${base}/${staff ? 'students' : 'classes'}`} className="mb-3 inline-flex items-center gap-1 text-sm font-semibold text-brand-500 hover:text-brand-700">
        ← {staff ? t('Élèves', 'الطلاب') : t('Mes classes', 'أقسامي')}
      </Link>

      <Card className="mb-5 !p-0 overflow-hidden">
        <div className="h-16 bg-brand-700 pattern-star sm:h-20" />
        <div className="-mt-9 flex flex-wrap items-start gap-4 px-4 pb-4 sm:px-5">
          <Avatar src={s.photoUrl} first={s.firstName} last={s.lastName} size={84} className="!ring-4" />
          <div className="min-w-0 flex-1 pt-10">
            <h1 className="font-serif text-2xl font-bold leading-tight text-brand-800">{s.firstName} {s.lastName}</h1>
            {s.arabicName && <p dir="rtl" className="font-arabic text-lg text-brand-500">{s.arabicName}</p>}
            <div className="mt-2 flex flex-wrap gap-1.5">
              <Badge tone={st.tone}>{st.label}</Badge>
              <Badge>{audienceLabel(s.audience, t)}{s.age != null && ` · ${num(s.age)} ${t('ans', 'سنة')}`}</Badge>
              {s.currentLevel && <Badge tone="gold">{pick(s.currentLevel.labelFr, s.currentLevel.labelAr)}</Badge>}
              {s.archivedAt && <Badge tone="warn">{t('Archivé', 'مؤرشف')}</Badge>}
            </div>
          </div>
          {staff && (
            <div className="ms-auto flex items-center gap-2 pt-10">
              <LinkButton href={`/admin/students/${id}/edit`} variant="outline" icon={<Pencil className="size-4" />}>
                <span className="hidden sm:inline">{t('Modifier', 'تعديل')}</span>
              </LinkButton>
              <Popover trigger={({ toggle }) => <IconButton label={t('Plus d’actions', 'المزيد')} variant="outline" onClick={toggle}><MoreHorizontal className="size-5" /></IconButton>}>
                {(close) => (
                  <div className="space-y-0.5">
                    <MenuItem icon={<Printer className="size-4" />} onClick={() => { close(); openDocument('student-sheet', id, isAr ? 'ar' : 'fr').catch((e) => toast.error(messageOf(e))); }}>{t('Fiche élève (PDF)', 'بطاقة الطالب (PDF)')}</MenuItem>
                    <MenuItem icon={<Printer className="size-4" />} onClick={() => { close(); openDocument('timetable', id, isAr ? 'ar' : 'fr').catch((e) => toast.error(messageOf(e))); }}>{t('Emploi du temps', 'الجدول')}</MenuItem>
                    <MenuItem icon={<UserPlus className="size-4" />} onClick={() => { close(); router.push(`/${isAr ? 'ar' : 'fr'}/admin/students/new?sibling=${id}`); }}>{t('Ajouter un frère / une sœur', 'إضافة أخ / أخت')}</MenuItem>
                    <MenuItem icon={<Repeat className="size-4" />} onClick={() => { close(); setStatusModal(true); }}>{t('Changer le statut', 'تغيير الحالة')}</MenuItem>
                    {s.archivedAt ? (
                      <MenuItem icon={<ArchiveRestore className="size-4" />} onClick={() => { close(); unarchive(); }}>{t('Désarchiver', 'إلغاء الأرشفة')}</MenuItem>
                    ) : (
                      <MenuItem icon={<Archive className="size-4" />} onClick={() => { close(); archive(); }}>{t('Archiver', 'أرشفة')}</MenuItem>
                    )}
                    {isAdmin && <MenuItem danger icon={<Trash2 className="size-4" />} onClick={() => { close(); remove(); }}>{t('Supprimer', 'حذف')}</MenuItem>}
                  </div>
                )}
              </Popover>
            </div>
          )}
        </div>
      </Card>

      <Tabs value={tab} onChange={setTab} tabs={tabs} />

      {tab === 'info' && <InfoTab s={s} staff={staff} />}
      {tab === 'classes' && staff && <ClassesTab s={s} />}
      {tab === 'progress' && <StudentProgress studentId={id} staff={staff} />}
      {tab === 'attendance' && <AttendanceTab id={id} />}
      {tab === 'finance' && staff && <FinanceTab id={id} />}
      {tab === 'history' && staff && <HistoryTab id={id} />}

      <StatusModal open={statusModal} student={s} onClose={() => setStatusModal(false)} />
    </div>
  );
}

function MenuItem({ icon, children, onClick, danger }: { icon: React.ReactNode; children: React.ReactNode; onClick: () => void; danger?: boolean }) {
  return (
    <button type="button" onClick={onClick} className={cn('tap flex w-full items-center gap-3 rounded-xl px-3 text-start text-sm font-medium hover:bg-brand-50', danger ? 'text-bad' : 'text-brand-700')}>
      {icon} {children}
    </button>
  );
}

/* ─────────── Infos ─────────── */

function ContactLine({ phone, label }: { phone: string; label?: string }) {
  const { t } = useLocale();
  return (
    <div className="flex items-center justify-between gap-2 rounded-2xl bg-sand-100 px-3 py-2">
      <div className="min-w-0">
        {label && <p className="truncate text-xs text-brand-400">{label}</p>}
        <p dir="ltr" className="num text-start font-semibold text-brand-800">{phone}</p>
      </div>
      <div className="flex gap-1.5">
        <a href={telLink(phone)} aria-label={t('Appeler', 'اتصال')} className="tap grid size-10 place-items-center rounded-xl bg-white text-brand-600 shadow-card"><Phone className="size-4" /></a>
        <a href={waLink(phone)} target="_blank" rel="noreferrer" aria-label="WhatsApp" className="tap grid size-10 place-items-center rounded-xl bg-white text-ok shadow-card"><MessageCircle className="size-4" /></a>
      </div>
    </div>
  );
}

function InfoTab({ s, staff }: { s: any; staff: boolean }) {
  const { t, date } = useLocale();
  const address = [s.address, [s.postalCode, s.city].filter(Boolean).join(' ')].filter(Boolean).join(', ');
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      {(s.phone || s.email || address) && <Card>
        <CardTitle icon={<Phone className="size-4" />}>{t('Contact', 'الاتصال')}</CardTitle>
        <div className="space-y-2.5">
          {s.phone && <ContactLine phone={s.phone} />}
          {s.email && (
            <a href={`mailto:${s.email}`} className="flex items-center gap-2 text-sm text-brand-600 hover:underline"><Mail className="size-4" /> <span dir="ltr">{s.email}</span></a>
          )}
          {address && (
            <p className="flex items-start gap-2 text-sm text-brand-600"><MapPin className="mt-0.5 size-4 shrink-0" /> {address}</p>
          )}
        </div>
      </Card>}

      <Card>
        <CardTitle icon={<Users className="size-4" />}>{t('Responsables', 'الأولياء')}</CardTitle>
        {s.guardians?.length ? (
          <div className="space-y-2.5">
            {s.guardians.map((g: any) => (
              <div key={g.id}>
                {g.phone ? <ContactLine phone={g.phone} label={`${g.name}${g.relationship ? ` · ${g.relationship}` : ''}`} /> : <p className="text-sm font-semibold text-brand-700">{g.name}</p>}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-brand-400">{s.audience === 'ADULT' ? t('Élève adulte.', 'طالب بالغ.') : t('Aucun responsable enregistré.', 'لا يوجد وليّ مسجّل.')}</p>
        )}
      </Card>

      <Card>
        <CardTitle icon={<ClipboardList className="size-4" />}>{t('Dossier', 'الملف')}</CardTitle>
        <dl className="space-y-2">
          <KV label={t('Sexe', 'الجنس')}>{genderLabel(s.gender, t)}</KV>
          {s.birthDate && <KV label={t('Naissance', 'الميلاد')}>{date(s.birthDate)}</KV>}
          {s.enrolledAt && <KV label={t('Inscrit depuis', 'مسجّل منذ')}>{date(s.enrolledAt)}</KV>}
          {s.leftAt && <KV label={t('Départ', 'المغادرة')}>{date(s.leftAt)}</KV>}
          {staff && (
            <>
              <KV label={t('Consentement RGPD', 'موافقة حماية البيانات')}>{s.gdprConsentAt ? <Badge tone="ok"><ShieldCheck className="me-1 inline size-3" />{date(s.gdprConsentAt)}</Badge> : <Badge tone="warn">{t('Non recueilli', 'غير مأخوذة')}</Badge>}</KV>
              <KV label={t('Droit à l’image', 'استخدام الصورة')}>{s.imageRightsConsent ? t('Autorisé', 'مسموح') : t('Non', 'لا')}</KV>
            </>
          )}
        </dl>
      </Card>

      {staff && s.siblings?.length > 0 && (
        <Card>
          <CardTitle icon={<Users className="size-4" />}>{t('Frères et sœurs', 'الإخوة والأخوات')}</CardTitle>
          <div className="space-y-2.5">
            {s.siblings.map((x: any) => (
              <StudentCard key={x.id} s={{ ...x, classes: [] }} href={`/admin/students/${x.id}`} showMoney={false} />
            ))}
          </div>
        </Card>
      )}

      {staff && s.notes && (
        <Card className="lg:col-span-2">
          <CardTitle icon={<FileText className="size-4" />}>{t('Notes internes', 'ملاحظات داخلية')}</CardTitle>
          <p className="whitespace-pre-wrap text-sm text-brand-700">{s.notes}</p>
        </Card>
      )}
    </div>
  );
}

/* ─────────── Classes ─────────── */

function ClassesTab({ s }: { s: any }) {
  const { t, pick, weekday, time, date } = useLocale();
  const toast = useToast();
  const confirm = useConfirm();
  const [enroll, setEnroll] = useState(false);
  const [transfer, setTransfer] = useState<any | null>(null);
  const active = s.enrollments.filter((e: any) => e.status !== 'ENDED');
  const ended = s.enrollments.filter((e: any) => e.status === 'ENDED');

  async function end(e: any) {
    if (!(await confirm({ title: t('Terminer cette inscription ?', 'إنهاء هذا التسجيل؟'), message: e.class.name, confirmLabel: t('Terminer', 'إنهاء'), danger: true }))) return;
    try {
      await post(`/enrollments/${e.id}/end`, {});
      await refresh(s.id);
    } catch (er) {
      toast.error(messageOf(er));
    }
  }
  async function promote(e: any) {
    try {
      await post(`/enrollments/${e.id}/promote`, {});
      await refresh(s.id);
      toast.ok(t('Élève inscrit', 'تم تسجيل الطالب'));
    } catch (er) {
      toast.error(messageOf(er));
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex justify-end">
        <Button variant="primary" icon={<Plus className="size-4" />} onClick={() => setEnroll(true)}>{t('Inscrire dans une classe', 'تسجيل في قسم')}</Button>
      </div>
      {active.length === 0 ? (
        <EmptyState icon={<GraduationCap className="size-6" />} title={t('Aucune classe', 'لا توجد أقسام')} text={t('Cet élève n’est inscrit dans aucune classe.', 'هذا الطالب غير مسجّل في أي قسم.')} />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {active.map((e: any) => {
            const es = enrollmentStatus(e.status, t);
            return (
              <Card key={e.id}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <Link href={`/admin/classes/${e.class.id}`} className="font-serif font-bold text-brand-800 hover:underline">{e.class.name}</Link>
                    <p className="text-xs text-brand-400">{pick(e.class.course.titleFr, e.class.course.titleAr)}</p>
                  </div>
                  <Badge tone={es.tone}>{es.label}</Badge>
                </div>
                {e.class.teacher && <p className="mt-2 text-sm text-brand-500">{e.class.teacher.firstName} {e.class.teacher.lastName}</p>}
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {e.class.slots?.map((sl: any) => (
                    <Badge key={sl.id} tone="neutral"><span dir="ltr" className="num">{weekday(sl.weekday, 'short')} {time(sl.startTime)}–{time(sl.endTime)}</span></Badge>
                  ))}
                </div>
                <p className="mt-2 text-xs text-brand-400">{t('Depuis le', 'منذ')} {date(e.startDate)}</p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {e.status === 'WAITLIST' && <Button size="sm" variant="primary" onClick={() => promote(e)}>{t('Donner la place', 'منح المقعد')}</Button>}
                  <Button size="sm" variant="soft" onClick={() => setTransfer(e)}>{t('Changer de classe', 'تغيير القسم')}</Button>
                  <Button size="sm" variant="ghost" className="text-bad" onClick={() => end(e)}>{t('Terminer', 'إنهاء')}</Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}
      {ended.length > 0 && (
        <div>
          <p className="mb-2 text-sm font-semibold text-brand-500">{t('Inscriptions terminées', 'تسجيلات منتهية')}</p>
          <div className="grid gap-2 md:grid-cols-2">
            {ended.map((e: any) => (
              <Card key={e.id} className="opacity-75">
                <p className="font-semibold text-brand-700">{e.class.name}</p>
                <p className="text-xs text-brand-400">{date(e.startDate)} → {e.endDate ? date(e.endDate) : '—'}</p>
              </Card>
            ))}
          </div>
        </div>
      )}
      <EnrollModal open={enroll} student={s} onClose={() => setEnroll(false)} />
      <TransferModal enrollment={transfer} student={s} onClose={() => setTransfer(null)} />
    </div>
  );
}

const WARN_LABEL = (code: string | undefined, t: (a: string, b: string) => string) =>
  code === 'AUDIENCE_MISMATCH' ? t('Ce cours est prévu pour un autre public.', 'هذا الدرس مخصّص لفئة أخرى.')
  : code === 'MIN_AGE' ? t('L’élève est plus jeune que l’âge minimum du cours.', 'عمر الطالب أقل من الحد الأدنى للدرس.')
  : code === 'STUDENT_SCHEDULE_CONFLICT' ? t('Cet horaire chevauche une autre classe de l’élève.', 'هذا الموعد يتداخل مع قسم آخر للطالب.')
  : undefined;

function EnrollModal({ open, student, onClose }: { open: boolean; student: any; onClose: () => void }) {
  const { t, pick } = useLocale();
  const toast = useToast();
  const { lk } = useLookups();
  const [classId, setClassId] = useState('');
  const [busy, setBusy] = useState(false);
  const [warn, setWarn] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const taken = new Set(student.enrollments.filter((e: any) => e.status !== 'ENDED').map((e: any) => e.class.id));
  const options = lk?.classes.filter((c) => c.active && !taken.has(c.id) && (!lk.currentSchoolYear || c.schoolYearId === lk.currentSchoolYear.id)) || [];

  async function go(force?: boolean) {
    setBusy(true);
    setErr(null);
    try {
      const r = await post(`/students/${student.id}/enrollments`, { classId, force: force || undefined });
      await refresh(student.id);
      toast.ok(r.waitlisted ? t('Classe pleine : élève mis en liste d’attente', 'القسم ممتلئ: أُضيف إلى قائمة الانتظار') : t('Élève inscrit', 'تم تسجيل الطالب'));
      setWarn(null);
      setClassId('');
      onClose();
    } catch (e) {
      if (e instanceof ApiError && e.status === 409 && WARN_LABEL(e.code, t)) setWarn(e.message || WARN_LABEL(e.code, t)!);
      else setErr(messageOf(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal open={open} onClose={() => { setWarn(null); onClose(); }} title={t('Inscrire dans une classe', 'تسجيل في قسم')}>
      <div className="space-y-4">
        <SelectField label={t('Classe', 'القسم')} value={classId} onChange={(e) => { setClassId(e.target.value); setWarn(null); }}>
          <option value="">—</option>
          {options.map((c) => {
            const course = lk?.courses.find((x) => x.id === c.courseId);
            return <option key={c.id} value={c.id}>{c.name}{course ? ` — ${pick(course.titleFr, course.titleAr)}` : ''}</option>;
          })}
        </SelectField>
        {warn && <Notice tone="warn">{warn}</Notice>}
        {err && <Notice tone="bad">{err}</Notice>}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>{t('Annuler', 'إلغاء')}</Button>
          {warn ? (
            <Button variant="danger" loading={busy} onClick={() => go(true)}>{t('Inscrire quand même', 'تسجيل رغم ذلك')}</Button>
          ) : (
            <Button variant="primary" disabled={!classId} loading={busy} onClick={() => go()}>{t('Inscrire', 'تسجيل')}</Button>
          )}
        </div>
      </div>
    </Modal>
  );
}

function TransferModal({ enrollment, student, onClose }: { enrollment: any | null; student: any; onClose: () => void }) {
  const { t } = useLocale();
  const toast = useToast();
  const { lk } = useLookups();
  const [to, setTo] = useState('');
  const [busy, setBusy] = useState(false);
  const [warn, setWarn] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const options = lk?.classes.filter((c) => c.active && c.id !== enrollment?.class.id && (!lk.currentSchoolYear || c.schoolYearId === lk.currentSchoolYear.id)) || [];
  async function go(force?: boolean) {
    setBusy(true);
    setErr(null);
    try {
      await post(`/enrollments/${enrollment.id}/transfer`, { toClassId: to, force: force || undefined });
      await refresh(student.id);
      toast.ok(t('Classe changée', 'تم تغيير القسم'));
      setWarn(null);
      setTo('');
      onClose();
    } catch (e) {
      if (e instanceof ApiError && e.status === 409 && WARN_LABEL(e.code, t)) setWarn(e.message);
      else setErr(messageOf(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal open={!!enrollment} onClose={() => { setWarn(null); onClose(); }} title={t('Changer de classe', 'تغيير القسم')}>
      <div className="space-y-4">
        <p className="text-sm text-brand-500">{t('Classe actuelle', 'القسم الحالي')} : <strong>{enrollment?.class.name}</strong></p>
        <SelectField label={t('Nouvelle classe', 'القسم الجديد')} value={to} onChange={(e) => { setTo(e.target.value); setWarn(null); }}>
          <option value="">—</option>
          {options.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </SelectField>
        {warn && <Notice tone="warn">{warn}</Notice>}
        {err && <Notice tone="bad">{err}</Notice>}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>{t('Annuler', 'إلغاء')}</Button>
          {warn ? <Button variant="danger" loading={busy} onClick={() => go(true)}>{t('Changer quand même', 'تغيير رغم ذلك')}</Button> : <Button variant="primary" disabled={!to} loading={busy} onClick={() => go()}>{t('Valider', 'تأكيد')}</Button>}
        </div>
      </div>
    </Modal>
  );
}

/* ─────────── Présences ─────────── */

function AttendanceTab({ id }: { id: string }) {
  const { t, date, num } = useLocale();
  const { data, error, loading, reload } = useApi<any>(`/students/${id}/attendance`);
  if (error) return <ErrorState message={error.message} onRetry={reload} />;
  if (loading || !data) return <SkeletonCards n={3} />;
  const sm = data.summary;
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Mini label={t('Présent', 'حاضر')} value={sm.present} tone="ok" />
        <Mini label={t('Absent', 'غائب')} value={sm.absent} tone="bad" />
        <Mini label={t('En retard', 'متأخر')} value={sm.late} tone="warn" />
        <Mini label={t('Excusé', 'بعذر')} value={sm.excused} tone="info" />
      </div>
      {sm.rate != null && (
        <Card>
          <div className="mb-2 flex justify-between text-sm"><span className="font-semibold text-brand-700">{t('Assiduité', 'الانتظام')}</span><span className="num font-bold text-brand-800">{num(sm.rate)} %</span></div>
          <ProgressBar value={sm.rate} tone={sm.rate >= 80 ? 'ok' : sm.rate >= 60 ? 'gold' : 'bad'} />
        </Card>
      )}
      {data.items.length === 0 ? (
        <EmptyState icon={<CalendarCheck className="size-6" />} title={t('Aucune présence enregistrée', 'لا يوجد حضور مسجّل')} />
      ) : (
        <Card padded={false}>
          <ul className="divide-y divide-sand-200">
            {data.items.map((a: any) => {
              const as = attendanceStatus(a.status, t);
              return (
                <li key={a.id} className="flex items-center justify-between gap-3 px-4 py-3 sm:px-5">
                  <div className="min-w-0">
                    <p className="font-medium text-brand-800">{date(a.date, 'long')}</p>
                    <p className="truncate text-xs text-brand-400">{a.class?.name}{a.comment ? ` · ${a.comment}` : ''}</p>
                  </div>
                  <Badge tone={as.tone}>{as.label}</Badge>
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </div>
  );
}

function Mini({ label, value, tone }: { label: string; value: number; tone: 'ok' | 'bad' | 'warn' | 'info' }) {
  const { num } = useLocale();
  const c = { ok: 'text-ok', bad: 'text-bad', warn: 'text-warn', info: 'text-info' }[tone];
  return (
    <Card className="text-center !p-3">
      <p className={cn('num font-serif text-2xl font-bold', c)}>{num(value)}</p>
      <p className="text-xs text-brand-500">{label}</p>
    </Card>
  );
}

/* ─────────── Cotisations ─────────── */

function FinanceTab({ id }: { id: string }) {
  const { t, money, date } = useLocale();
  const toast = useToast();
  const { data, error, loading, reload } = useApi<any>(`/students/${id}/finance`);
  const [pay, setPay] = useState<any | null>(null);
  const [cancel, setCancel] = useState<any | null>(null);
  const [exempt, setExempt] = useState<any | null>(null);
  const [remind, setRemind] = useState<{ studentId?: string; dueId?: string } | null>(null);
  const [newDue, setNewDue] = useState(false);
  const [allUpcoming, setAllUpcoming] = useState(false);

  if (error) return <ErrorState message={error.message} onRetry={reload} />;
  if (loading || !data) return <SkeletonCards n={3} />;
  const tt = data.totals;
  const openAll = data.dues.filter((d: any) => d.status !== 'PAID' && d.status !== 'EXEMPT');
  // Les échéances à venir lointaines sont repliées : on garde les retards, les partiels et les 2 prochaines
  let upcomingSeen = 0;
  const open = openAll.filter((d: any) => d.status !== 'UPCOMING' || allUpcoming || ++upcomingSeen <= 2);
  const hidden = openAll.length - open.length;
  const closed = data.dues.filter((d: any) => d.status === 'PAID' || d.status === 'EXEMPT');

  async function unexempt(d: any) {
    try {
      await post(`/dues/${d.id}/unexempt`);
      await invalidate(`/students/${id}/finance`, '/dues');
    } catch (e) {
      toast.error(messageOf(e));
    }
  }
  async function generate() {
    try {
      const r = await post('/fees/generate', { studentId: id });
      await invalidate(`/students/${id}/finance`, '/dues');
      toast.ok(t('Échéances mises à jour', 'تم تحديث الاستحقاقات'));
      return r;
    } catch (e) {
      toast.error(messageOf(e));
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="text-center"><p className="text-xs text-brand-500">{t('Total dû', 'المجموع المستحق')}</p><p className="num font-serif text-xl font-bold text-brand-800">{money(tt.totalCents)}</p></Card>
        <Card className="text-center"><p className="text-xs text-brand-500">{t('Payé', 'المدفوع')}</p><p className="num font-serif text-xl font-bold text-ok">{money(tt.paidCents)}</p></Card>
        <Card className="text-center"><p className="text-xs text-brand-500">{t('Reste à payer', 'المتبقي')}</p><p className={cn('num font-serif text-xl font-bold', tt.remainingCents > 0 ? 'text-bad' : 'text-brand-800')}>{money(tt.remainingCents)}</p></Card>
      </div>

      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="outline" size="sm" onClick={generate}>{t('Générer les échéances', 'توليد الاستحقاقات')}</Button>
        {tt.remainingCents > 0 && <Button variant="soft" size="sm" onClick={() => setRemind({ studentId: id })}>{t('Relancer', 'تذكير')}</Button>}
        <Button variant="primary" size="sm" icon={<Plus className="size-4" />} onClick={() => setNewDue(true)}>{t('Échéance', 'استحقاق')}</Button>
      </div>

      <section>
        <h3 className="mb-3 font-serif text-lg font-bold text-brand-800">{t('À payer', 'المطلوب')}</h3>
        {openAll.length === 0 ? (
          <EmptyState icon={<Wallet className="size-6" />} title={t('Tout est réglé', 'كل شيء مسدّد')} />
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {open.map((d: any) => <DueCard key={d.id} d={d} onPay={setPay} onRemind={(x) => setRemind({ dueId: x.id })} onExempt={setExempt} />)}
          </div>
        )}
        {hidden > 0 && (
          <div className="mt-3 text-center">
            <Button variant="ghost" size="sm" onClick={() => setAllUpcoming(true)}>{t(`Voir les ${hidden} échéances suivantes`, `عرض الاستحقاقات التالية (${hidden})`)}</Button>
          </div>
        )}
      </section>

      {closed.length > 0 && (
        <section>
          <h3 className="mb-3 font-serif text-lg font-bold text-brand-800">{t('Réglées ou exonérées', 'مسدّدة أو معفاة')}</h3>
          <div className="grid gap-3 md:grid-cols-2">
            {closed.map((d: any) => <DueCard key={d.id} d={d} onUnexempt={unexempt} />)}
          </div>
        </section>
      )}

      <section>
        <h3 className="mb-3 font-serif text-lg font-bold text-brand-800">{t('Paiements', 'المدفوعات')}</h3>
        {data.payments.length === 0 ? (
          <p className="text-sm text-brand-400">{t('Aucun paiement enregistré.', 'لا توجد مدفوعات.')}</p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {data.payments.map((p: any) => <PaymentCard key={p.id} p={p} onCancel={setCancel} />)}
          </div>
        )}
      </section>

      {data.reminders.length > 0 && (
        <section>
          <h3 className="mb-3 font-serif text-lg font-bold text-brand-800">{t('Relances envoyées', 'التذكيرات المرسلة')}</h3>
          <Card padded={false}>
            <ul className="divide-y divide-sand-200">
              {data.reminders.map((r: any) => (
                <li key={r.id} className="px-4 py-3 sm:px-5">
                  <p className="text-sm font-medium text-brand-700">{r.channel === 'WHATSAPP' ? 'WhatsApp' : t('E-mail', 'بريد')} · <span className="text-brand-400">{date(r.createdAt)} · {r.createdByLabel}</span></p>
                  <p className="line-clamp-2 text-xs text-brand-500">{r.message}</p>
                </li>
              ))}
            </ul>
          </Card>
        </section>
      )}

      <PaymentModal due={pay} onClose={() => setPay(null)} onDone={() => invalidate(`/students/${id}/finance`)} />
      <CancelPaymentModal payment={cancel} onClose={() => { setCancel(null); invalidate(`/students/${id}/finance`); }} />
      <ExemptModal due={exempt} onClose={() => { setExempt(null); invalidate(`/students/${id}/finance`); }} />
      <ReminderModal target={remind} onClose={() => { setRemind(null); invalidate(`/students/${id}/finance`); }} />
      <NewDueModal studentId={id} open={newDue} onClose={() => { setNewDue(false); invalidate(`/students/${id}/finance`); }} />
    </div>
  );
}

/* ─────────── Historique ─────────── */

function HistoryTab({ id }: { id: string }) {
  const { t, dateTime } = useLocale();
  const { data, error, loading, reload } = useApi<any[]>(`/students/${id}/history`);
  if (error) return <ErrorState message={error.message} onRetry={reload} />;
  if (loading || !data) return <SkeletonCards n={4} />;
  if (!data.length) return <EmptyState icon={<History className="size-6" />} title={t('Aucun historique', 'لا يوجد سجل')} />;
  return (
    <ol className="relative space-y-3 ps-6 before:absolute before:inset-y-2 before:start-2 before:w-0.5 before:bg-sand-300">
      {data.map((h) => (
        <li key={h.id} className="relative">
          <span className="absolute -start-[1.15rem] top-4 size-3 rounded-full bg-gold-500 ring-4 ring-paper" />
          <Card className="!p-3.5">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={actionTone(h.action)}>{actionLabel(h.action, t)}</Badge>
              <span className="text-xs text-brand-400">{entityLabel(h.entity, t)}</span>
            </div>
            <p className="mt-1 text-xs text-brand-500">{dateTime(h.createdAt)} · {h.userLabel}</p>
          </Card>
        </li>
      ))}
    </ol>
  );
}

/* ─────────── Changement de statut ─────────── */

function StatusModal({ open, student, onClose }: { open: boolean; student: any; onClose: () => void }) {
  const { t } = useLocale();
  const toast = useToast();
  const [status, setStatus] = useState(student.status);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  async function go() {
    setBusy(true);
    try {
      await post(`/students/${student.id}/status`, { status, reason: reason.trim() || undefined });
      await refresh(student.id);
      toast.ok(t('Statut mis à jour', 'تم تحديث الحالة'));
      onClose();
    } catch (e) {
      setErr(messageOf(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal open={open} onClose={onClose} title={t('Changer le statut', 'تغيير الحالة')}>
      <div className="space-y-4">
        <Field label={t('Nouveau statut', 'الحالة الجديدة')}>
          <Select value={status} onChange={(e) => setStatus(e.target.value)}>
            {['ENROLLED', 'PREREGISTERED', 'WAITLIST', 'SUSPENDED', 'LEFT'].map((v) => <option key={v} value={v}>{studentStatus(v, t).label}</option>)}
          </Select>
        </Field>
        {status === 'LEFT' && <Notice tone="warn">{t('Les inscriptions en cours seront clôturées (l’historique reste).', 'ستُنهى التسجيلات الجارية (يبقى السجل).')}</Notice>}
        <Field label={t('Motif (facultatif)', 'السبب (اختياري)')}>
          <input className="w-full rounded-2xl border border-sand-300 bg-white px-4 py-3" value={reason} onChange={(e) => setReason(e.target.value)} />
        </Field>
        {err && <Notice tone="bad">{err}</Notice>}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>{t('Annuler', 'إلغاء')}</Button>
          <Button variant="primary" loading={busy} onClick={go}>{t('Enregistrer', 'حفظ')}</Button>
        </div>
      </div>
    </Modal>
  );
}
