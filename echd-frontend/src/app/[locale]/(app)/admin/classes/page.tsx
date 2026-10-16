'use client';

import { DoorOpen, Plus, School, UserRound } from 'lucide-react';
import { useState } from 'react';
import { ClassFormModal } from '@/components/app/class-parts';
import { CourseIcon } from '@/components/course-icon';
import { Button } from '@/components/ui/button';
import { Badge, Card, PageHeader, ProgressBar } from '@/components/ui/display';
import { EmptyState, ErrorState, SkeletonCards } from '@/components/ui/feedback';
import { Chips } from '@/components/ui/form';
import { useAuth } from '@/lib/auth';
import { useApi } from '@/lib/hooks';
import { useLocale } from '@/lib/i18n';
import { useLookups } from '@/lib/lookups';
import { useUrlState } from '@/lib/url-state';

export default function ClassesPage() {
  const { t, pick, num, weekday, time } = useLocale();
  const { isAdmin } = useAuth();
  const { lk } = useLookups();
  const [f, set] = useUrlState({ courseId: '', state: 'active' });
  const [create, setCreate] = useState(false);
  const { data, error, loading, reload } = useApi<any[]>('/classes', { courseId: f.courseId || undefined, active: f.state === 'active' ? 'true' : f.state === 'inactive' ? 'false' : undefined });

  return (
    <div>
      <PageHeader
        title={t('Classes', 'الأقسام')}
        subtitle={lk?.currentSchoolYear ? `${t('Année', 'السنة')} ${lk.currentSchoolYear.name}` : undefined}
        actions={isAdmin && <Button variant="primary" icon={<Plus className="size-4" />} onClick={() => setCreate(true)}>{t('Nouvelle classe', 'قسم جديد')}</Button>}
      />
      <div className="mb-4 space-y-3">
        <Chips
          value={f.courseId}
          onChange={(v) => set({ courseId: v })}
          options={[{ value: '', label: t('Tous les cours', 'كل الدروس') }, ...(lk?.courses.filter((c) => c.active).map((c) => ({ value: c.id, label: pick(c.titleFr, c.titleAr) })) || [])]}
        />
        <Chips
          value={f.state}
          onChange={(v) => set({ state: v })}
          options={[{ value: 'active', label: t('Actives', 'النشطة') }, { value: 'inactive', label: t('Désactivées', 'المعطّلة') }, { value: 'all', label: t('Toutes', 'الكل') }]}
        />
      </div>

      {error ? (
        <ErrorState message={error.message} onRetry={reload} />
      ) : loading || !data ? (
        <SkeletonCards n={4} />
      ) : data.length === 0 ? (
        <EmptyState icon={<School className="size-6" />} title={t('Aucune classe', 'لا توجد أقسام')} text={t('Créez une classe pour pouvoir y inscrire des élèves.', 'أنشئ قسماً لتتمكن من تسجيل الطلاب.')} action={isAdmin && <Button variant="primary" onClick={() => setCreate(true)}>{t('Nouvelle classe', 'قسم جديد')}</Button>} />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {data.map((c) => (
            <Card key={c.id} href={`/admin/classes/${c.id}`} className={c.active ? '' : 'opacity-70'}>
              <div className="flex items-start gap-3">
                <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-brand-50 text-brand-600"><CourseIcon name={c.course.icon} className="size-5" /></span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-serif font-bold text-brand-800">{c.name}</p>
                  <p className="truncate text-xs text-brand-400">{pick(c.course.titleFr, c.course.titleAr)}</p>
                </div>
                {c.full ? <Badge tone="bad">{t('Complète', 'ممتلئ')}</Badge> : !c.active && <Badge>{t('Désactivée', 'معطّل')}</Badge>}
              </div>
              <div className="mt-3">
                <div className="mb-1 flex justify-between text-xs text-brand-500">
                  <span>{num(c.studentsCount)} / {num(c.capacity)} {t('élèves', 'طلاب')}</span>
                  {c.waitlistCount > 0 && <span className="font-semibold text-info">+{num(c.waitlistCount)} {t('en attente', 'انتظار')}</span>}
                </div>
                <ProgressBar value={c.studentsCount} max={c.capacity} tone={c.full ? 'bad' : 'ok'} />
              </div>
              <div className="mt-3 space-y-1 text-sm text-brand-500">
                <p className="flex items-center gap-2"><UserRound className="size-4" /> {c.teacher ? `${c.teacher.firstName} ${c.teacher.lastName}` : <span className="text-warn">{t('Sans enseignant', 'بلا معلّم')}</span>}</p>
                {c.slots.length > 0 && (
                  <p className="flex flex-wrap gap-1.5 pt-1">
                    {c.slots.map((s: any) => <Badge key={s.id}><span dir="ltr" className="num">{weekday(s.weekday, 'short')} {time(s.startTime)}–{time(s.endTime)}</span></Badge>)}
                  </p>
                )}
                {(c.room || c.slots[0]?.room) && <p className="flex items-center gap-2"><DoorOpen className="size-4" /> {pick((c.room || c.slots[0].room).name, (c.room || c.slots[0].room).nameAr || (c.room || c.slots[0].room).name)}</p>}
              </div>
            </Card>
          ))}
        </div>
      )}
      <ClassFormModal open={create} onClose={() => setCreate(false)} />
    </div>
  );
}
