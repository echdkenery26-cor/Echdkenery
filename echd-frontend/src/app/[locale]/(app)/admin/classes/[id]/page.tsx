'use client';

import { ArrowLeft, CalendarCheck, CalendarX, ClipboardCheck, DoorOpen, Pencil, Plus, Power, Trash2, TrendingUp, UserRound } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { use, useState } from 'react';
import { ClassFormModal, ExceptionModal, SlotModal } from '@/components/app/class-parts';
import { Button, IconButton, Link, LinkButton } from '@/components/ui/button';
import { Avatar, Badge, Card, CardTitle, PageHeader, ProgressBar } from '@/components/ui/display';
import { EmptyState, ErrorState, SkeletonCards, useConfirm, useToast } from '@/components/ui/feedback';
import { api, del } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { invalidate, messageOf, useApi } from '@/lib/hooks';
import { useLocale } from '@/lib/i18n';

export default function ClassDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { t, pick, num, weekday, time, isAr, date } = useLocale();
  const { isAdmin } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();
  const { data: c, error, loading, reload } = useApi<any>(`/classes/${id}`);
  const studs = useApi<any>(`/classes/${id}/students`);
  const [edit, setEdit] = useState(false);
  const [slot, setSlot] = useState<{ open: boolean; slot: any | null }>({ open: false, slot: null });
  const [exc, setExc] = useState<any | null>(null);

  if (error) return <ErrorState message={error.message} onRetry={reload} />;
  if (loading || !c) return <SkeletonCards n={3} />;

  async function toggleActive() {
    try {
      await api(`/classes/${id}`, { method: 'PATCH', body: { active: !c.active } });
      await invalidate('/classes', '/lookups', '/dashboard');
    } catch (e) {
      toast.error(messageOf(e));
    }
  }
  async function remove() {
    if (!(await confirm({ title: t('Supprimer cette classe ?', 'حذف هذا القسم؟'), message: t('Impossible si des élèves ou des présences y sont rattachés : désactivez-la plutôt.', 'غير ممكن إذا كان مرتبطاً بطلاب أو حضور: عطّله بدلاً من ذلك.'), danger: true, confirmLabel: t('Supprimer', 'حذف') }))) return;
    try {
      await del(`/classes/${id}`);
      await invalidate('/classes', '/lookups', '/timetable');
      router.push(`/${isAr ? 'ar' : 'fr'}/admin/classes`);
    } catch (e) {
      toast.error(messageOf(e));
    }
  }
  async function removeSlot(s: any) {
    if (!(await confirm({ title: t('Supprimer ce créneau ?', 'حذف هذا الموعد؟'), danger: true, confirmLabel: t('Supprimer', 'حذف') }))) return;
    try {
      await del(`/slots/${s.id}`);
      await invalidate('/classes', '/timetable');
    } catch (e) {
      toast.error(messageOf(e));
    }
  }

  const people = (list: any[], waiting?: boolean) => (
    <div className="grid gap-2.5 sm:grid-cols-2">
      {list.map((s) => (
        <Card key={s.id} href={`/admin/students/${s.id}`} className="flex items-center gap-3 !p-3">
          <Avatar src={s.photoUrl} first={s.firstName} last={s.lastName} size={42} />
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold text-brand-800">{s.firstName} {s.lastName}</p>
            <p className="truncate text-xs text-brand-400">{s.currentLevel ? pick(s.currentLevel.labelFr, s.currentLevel.labelAr) : ''}</p>
          </div>
          {waiting ? <Badge tone="info">{t('Attente', 'انتظار')}</Badge> : s.status !== 'ENROLLED' && <Badge tone="warn">{s.status === 'SUSPENDED' ? t('Suspendu', 'موقوف') : t('Parti', 'غادر')}</Badge>}
        </Card>
      ))}
    </div>
  );

  return (
    <div>
      <PageHeader
        back={<Link href="/admin/classes" className="mb-2 inline-flex items-center gap-1 text-sm font-semibold text-brand-500 hover:text-brand-700"><ArrowLeft className="size-4 rtl:rotate-180" /> {t('Classes', 'الأقسام')}</Link>}
        title={<>{c.name} {!c.active && <Badge>{t('Désactivée', 'معطّل')}</Badge>}</>}
        subtitle={pick(c.course.titleFr, c.course.titleAr)}
        actions={
          <>
            <LinkButton href={`/admin/attendance?classId=${id}`} variant="outline" icon={<ClipboardCheck className="size-4" />}>{t('Faire l’appel', 'تسجيل الحضور')}</LinkButton>
            <LinkButton href={`/admin/progress?classId=${id}`} variant="outline" icon={<TrendingUp className="size-4" />}>{t('Progression', 'التقدّم')}</LinkButton>
            {isAdmin && <Button variant="dark" icon={<Pencil className="size-4" />} onClick={() => setEdit(true)}>{t('Modifier', 'تعديل')}</Button>}
          </>
        }
      />

      <div className="grid gap-5 lg:grid-cols-[1fr_1.4fr]">
        <div className="space-y-5">
          <Card>
            <div className="mb-1 flex items-baseline justify-between"><p className="num font-serif text-3xl font-bold text-brand-800">{num(c.studentsCount)}<span className="text-lg text-brand-400"> / {num(c.capacity)}</span></p><p className="text-sm text-brand-500">{t('places occupées', 'مقاعد مشغولة')}</p></div>
            <ProgressBar value={c.studentsCount} max={c.capacity} tone={c.full ? 'bad' : 'ok'} />
            <p className="mt-2 text-sm text-brand-500">{c.full ? t('Classe complète', 'القسم ممتلئ') : t(`${num(c.seatsLeft)} place(s) libre(s)`, `${num(c.seatsLeft)} مقعد شاغر`)}{c.waitlistCount > 0 && ` · ${num(c.waitlistCount)} ${t('en attente', 'في الانتظار')}`}</p>
            <div className="mt-4 space-y-1.5 border-t border-sand-200 pt-3 text-sm text-brand-600">
              <p className="flex items-center gap-2"><UserRound className="size-4 text-brand-400" /> {c.teacher ? `${c.teacher.firstName} ${c.teacher.lastName}` : <span className="text-warn">{t('Sans enseignant', 'بلا معلّم')}</span>}</p>
              {c.room && <p className="flex items-center gap-2"><DoorOpen className="size-4 text-brand-400" /> {pick(c.room.name, c.room.nameAr || c.room.name)}</p>}
            </div>
            {isAdmin && (
              <div className="mt-4 flex flex-wrap gap-2 border-t border-sand-200 pt-3">
                <Button size="sm" variant="soft" icon={<Power className="size-4" />} onClick={toggleActive}>{c.active ? t('Désactiver', 'تعطيل') : t('Réactiver', 'تفعيل')}</Button>
                <Button size="sm" variant="ghost" className="text-bad" icon={<Trash2 className="size-4" />} onClick={remove}>{t('Supprimer', 'حذف')}</Button>
              </div>
            )}
          </Card>

          <Card>
            <CardTitle action={isAdmin && <Button size="sm" variant="soft" icon={<Plus className="size-4" />} onClick={() => setSlot({ open: true, slot: null })}>{t('Créneau', 'موعد')}</Button>}>{t('Horaires', 'المواعيد')}</CardTitle>
            {c.slots.length === 0 ? (
              <p className="text-sm text-brand-400">{t('Aucun créneau défini.', 'لا توجد مواعيد.')}</p>
            ) : (
              <ul className="space-y-2">
                {c.slots.map((s: any) => (
                  <li key={s.id} className="flex items-center gap-2 rounded-2xl bg-sand-100 p-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-brand-800">{weekday(s.weekday)}</p>
                      <p dir="ltr" className="num text-start text-sm text-brand-600">{time(s.startTime)} – {time(s.endTime)}{s.room ? ` · ${pick(s.room.name, s.room.nameAr || s.room.name)}` : ''}</p>
                    </div>
                    <IconButton label={t('Annuler ou déplacer une séance', 'إلغاء أو نقل حصة')} className="!size-9" onClick={() => setExc(s)}><CalendarX className="size-4" /></IconButton>
                    {isAdmin && (
                      <>
                        <IconButton label={t('Modifier', 'تعديل')} className="!size-9" onClick={() => setSlot({ open: true, slot: s })}><Pencil className="size-4" /></IconButton>
                        <IconButton label={t('Supprimer', 'حذف')} className="!size-9" onClick={() => removeSlot(s)}><Trash2 className="size-4" /></IconButton>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="space-y-5">
          <section>
            <h3 className="mb-3 font-serif text-lg font-bold text-brand-800">{t('Élèves', 'الطلاب')} <span className="text-sm font-normal text-brand-400">({num(studs.data?.active.length || 0)})</span></h3>
            {!studs.data ? <SkeletonCards n={2} /> : studs.data.active.length === 0 ? <EmptyState icon={<UserRound className="size-6" />} title={t('Aucun élève inscrit', 'لا يوجد طلاب مسجّلون')} /> : people(studs.data.active)}
          </section>
          {studs.data?.waitlist.length > 0 && (
            <section>
              <h3 className="mb-3 font-serif text-lg font-bold text-brand-800">{t('Liste d’attente', 'قائمة الانتظار')}</h3>
              {people(studs.data.waitlist, true)}
              <p className="mt-2 text-xs text-brand-400">{t('Pour donner une place : ouvrez la fiche de l’élève, onglet Classes.', 'لمنح مقعد: افتح ملف الطالب ثم تبويب الأقسام.')}</p>
            </section>
          )}
        </div>
      </div>

      <ClassFormModal open={edit} cls={c} onClose={() => setEdit(false)} />
      <SlotModal open={slot.open} classId={id} slot={slot.slot} onClose={() => setSlot({ open: false, slot: null })} />
      <ExceptionModal open={!!exc} slot={exc} onClose={() => setExc(null)} />
    </div>
  );
}
