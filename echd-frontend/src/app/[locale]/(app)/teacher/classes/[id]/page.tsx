'use client';

import { ArrowLeft, ClipboardCheck } from 'lucide-react';
import { use } from 'react';
import { ClassOverview } from '@/components/app/class-overview';
import { LinkButton, Link } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/display';
import { ErrorState, SkeletonCards } from '@/components/ui/feedback';
import { useApi } from '@/lib/hooks';
import { useLocale } from '@/lib/i18n';

export default function TeacherClassPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { t, pick } = useLocale();
  const { data: c, error, reload } = useApi<any>(`/classes/${id}`);
  if (error) return <ErrorState message={error.message} onRetry={reload} />;
  if (!c) return <SkeletonCards n={2} />;
  return (
    <div>
      <PageHeader
        back={<Link href="/teacher/classes" className="mb-2 inline-flex items-center gap-1 text-sm font-semibold text-brand-500 hover:text-brand-700"><ArrowLeft className="size-4 rtl:rotate-180" /> {t('Mes classes', 'أقسامي')}</Link>}
        title={c.name}
        subtitle={pick(c.course.titleFr, c.course.titleAr)}
        actions={<LinkButton href={`/teacher/attendance?classId=${id}`} variant="primary" icon={<ClipboardCheck className="size-4" />}>{t('Faire l’appel', 'تسجيل الحضور')}</LinkButton>}
      />
      <ClassOverview classId={id} studentBase="/teacher/students" />
    </div>
  );
}
