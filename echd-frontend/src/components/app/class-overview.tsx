'use client';

import { BookOpen, CalendarCheck, Star, Users } from 'lucide-react';
import { Avatar, Badge, Card, ProgressBar } from '@/components/ui/display';
import { EmptyState, ErrorState, SkeletonCards } from '@/components/ui/feedback';
import { useApi } from '@/lib/hooks';
import { useLocale } from '@/lib/i18n';
import { apprLabel } from './student-progress';

/** Vue d'ensemble d'une classe : avancement, mémorisation, assiduité et dernière évaluation de chaque élève. */
export function ClassOverview({ classId, studentBase }: { classId: string; studentBase: string }) {
  const { t, pick, num, date } = useLocale();
  const { data, error, loading, reload } = useApi<any>(`/classes/${classId}/progress-overview`);
  if (error) return <ErrorState message={error.message} onRetry={reload} />;
  if (loading || !data) return <SkeletonCards n={4} />;
  if (data.students.length === 0) return <EmptyState icon={<Users className="size-6" />} title={t('Aucun élève dans cette classe', 'لا يوجد طلاب في هذا القسم')} />;
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {data.students.map((s: any) => (
        <Card key={s.id} href={`${studentBase}/${s.id}?tab=progress`}>
          <div className="flex items-center gap-3">
            <Avatar src={s.photoUrl} first={s.firstName} last={s.lastName} size={46} />
            <div className="min-w-0 flex-1">
              <p className="truncate font-serif font-bold text-brand-800">{s.firstName} {s.lastName}</p>
              <p className="truncate text-xs text-brand-400">{s.level ? pick(s.level.labelFr, s.level.labelAr) : t('Niveau non défini', 'مستوى غير محدد')}</p>
            </div>
            <span className="num font-serif text-xl font-bold text-brand-700">{num(s.percent)}%</span>
          </div>
          <div className="mt-3"><ProgressBar value={s.percent} tone={s.percent >= 100 ? 'ok' : 'gold'} /></div>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-brand-500">
            <span className="inline-flex items-center gap-1"><BookOpen className="size-3.5" /> {t(`${num(s.validatedSurahs)} sourate(s)`, `${num(s.validatedSurahs)} سورة`)}</span>
            {s.attendance.rate != null && (
              <span className={`inline-flex items-center gap-1 ${s.attendance.rate < 60 ? 'font-semibold text-bad' : ''}`}><CalendarCheck className="size-3.5" /> {num(s.attendance.rate)} %</span>
            )}
            {s.lastEvaluation && <span className="inline-flex items-center gap-1"><Star className="size-3.5" /> {apprLabel(s.lastEvaluation.appreciation, t)} · {date(s.lastEvaluation.date)}</span>}
          </div>
        </Card>
      ))}
    </div>
  );
}
