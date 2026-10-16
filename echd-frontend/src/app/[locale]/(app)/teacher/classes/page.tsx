'use client';

import { School, Users } from 'lucide-react';
import { CourseIcon } from '@/components/course-icon';
import { Badge, Card, PageHeader } from '@/components/ui/display';
import { EmptyState, ErrorState, SkeletonCards } from '@/components/ui/feedback';
import { useApi } from '@/lib/hooks';
import { useLocale } from '@/lib/i18n';

export default function TeacherClasses() {
  const { t, pick, num, weekday, time } = useLocale();
  const { data, error, loading, reload } = useApi<any[]>('/classes', { active: 'true' });
  return (
    <div>
      <PageHeader title={t('Mes classes', 'أقسامي')} />
      {error ? (
        <ErrorState message={error.message} onRetry={reload} />
      ) : loading || !data ? (
        <SkeletonCards n={3} />
      ) : data.length === 0 ? (
        <EmptyState icon={<School className="size-6" />} title={t('Aucune classe', 'لا توجد أقسام')} text={t('L’administration vous attribuera vos classes.', 'ستُسند إليك الإدارة أقسامك.')} />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {data.map((c) => (
            <Card key={c.id} href={`/teacher/classes/${c.id}`}>
              <div className="flex items-start gap-3.5">
                <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-brand-50 text-brand-600"><CourseIcon name={c.course.icon} className="size-6" /></span>
                <div className="min-w-0 flex-1">
                  <p className="font-serif text-lg font-bold text-brand-800">{c.name}</p>
                  <p className="text-xs text-brand-400">{pick(c.course.titleFr, c.course.titleAr)}</p>
                  <p className="mt-1 inline-flex items-center gap-1.5 text-sm text-brand-500"><Users className="size-4" /> {num(c.studentsCount)} {t('élèves', 'طلاب')}</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {c.slots.map((s: any) => <Badge key={s.id}><span dir="ltr" className="num">{weekday(s.weekday, 'short')} {time(s.startTime)}–{time(s.endTime)}</span></Badge>)}
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
