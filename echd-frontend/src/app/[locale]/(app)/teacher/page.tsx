'use client';

import { CalendarClock, CheckCircle2, ClipboardCheck, GraduationCap, Megaphone, Users } from 'lucide-react';
import { SessionCard } from '@/components/app/session-card';
import { Badge, Card, CardTitle, SectionTitle, StatCard } from '@/components/ui/display';
import { Link } from '@/components/ui/button';
import { EmptyState, ErrorState, SkeletonCards } from '@/components/ui/feedback';
import { CourseIcon } from '@/components/course-icon';
import { useAuth } from '@/lib/auth';
import { useApi } from '@/lib/hooks';
import { useLocale } from '@/lib/i18n';

export default function TeacherHome() {
  const { t, pick, date, num } = useLocale();
  const { user } = useAuth();
  const { data, error, loading, reload } = useApi<any>('/dashboard');

  if (error) return <ErrorState message={error.message} onRetry={reload} />;
  if (loading || !data) return <SkeletonCards n={5} />;

  const today: any[] = data.todaySessions || [];
  const later: any[] = (data.nextSessions || []).filter((s: any) => s.date !== data.today);

  return (
    <div className="space-y-6">
      <header className="pt-2">
        <h1 className="font-serif text-2xl font-bold text-brand-800 sm:text-3xl">
          {t('Bonjour', 'مرحباً')} {user?.firstName}
        </h1>
        <p className="text-sm text-brand-500">{date(data.today, 'long')}</p>
      </header>

      <div className="grid grid-cols-2 gap-3">
        <StatCard icon={<Users className="size-6" />} value={num(data.myClasses.length)} label={t('Mes classes', 'أقسامي')} href="/teacher/classes" />
        <StatCard icon={<GraduationCap className="size-6" />} tone="gold" value={num(data.myStudentsCount)} label={t('Mes élèves', 'طلابي')} href="/teacher/classes" />
      </div>

      <section>
        <SectionTitle>{t('Aujourd’hui', 'اليوم')}</SectionTitle>
        {today.length ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {today.map((s) => (
              <SessionCard key={s.slotId} s={s} done={s.attendanceDone} href={`/teacher/attendance?classId=${s.classId}&date=${s.date}`} />
            ))}
          </div>
        ) : (
          <Card className="flex items-center gap-3 text-brand-600">
            <CheckCircle2 className="size-6 text-ok" />
            <p className="font-medium">{t('Pas de séance aujourd’hui.', 'لا توجد حصة اليوم.')}</p>
          </Card>
        )}
      </section>

      <section>
        <SectionTitle>{t('Mes classes', 'أقسامي')}</SectionTitle>
        {data.myClasses.length ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {data.myClasses.map((c: any) => (
              <Card key={c.id} href={`/teacher/classes/${c.id}`} className="flex items-center gap-3.5">
                <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-brand-50 text-brand-600">
                  <CourseIcon name={c.course?.icon} className="size-6" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-serif font-bold text-brand-800">{c.name}</p>
                  <p className="truncate text-xs text-brand-400">{c.course ? pick(c.course.titleFr, c.course.titleAr) : ''}</p>
                  <p className="mt-1 text-sm text-brand-500">
                    {num(c.studentsCount)} {t('élèves', 'طلاب')}
                  </p>
                </div>
                {c.attendanceDoneToday && <Badge tone="ok">{t('Fait', 'تم')}</Badge>}
              </Card>
            ))}
          </div>
        ) : (
          <EmptyState icon={<Users className="size-6" />} title={t('Aucune classe pour le moment', 'لا توجد أقسام حالياً')} text={t('L’administration vous attribuera vos classes.', 'ستُسند إليك الإدارة أقسامك.')} />
        )}
      </section>

      {later.length > 0 && (
        <section>
          <SectionTitle>{t('Prochaines séances', 'الحصص القادمة')}</SectionTitle>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {later.slice(0, 6).map((s) => (
              <SessionCard key={`${s.slotId}-${s.date}`} s={s} />
            ))}
          </div>
        </section>
      )}

      {data.announcements?.length > 0 && (
        <Card>
          <CardTitle icon={<Megaphone className="size-4" />}>{t('Annonces de l’école', 'إعلانات المدرسة')}</CardTitle>
          <ul className="space-y-2">
            {data.announcements.map((a: any) => (
              <li key={a.id} className="rounded-xl bg-sand-100 p-3">
                <p className="font-semibold text-brand-800">{pick(a.titleFr, a.titleAr) || a.title}</p>
                {a.date && <p className="text-xs text-brand-400">{date(a.date)}</p>}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
