'use client';

import { ArrowLeft } from 'lucide-react';
import { use } from 'react';
import { StudentForm } from '@/components/app/student-form';
import { Link } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/display';
import { ErrorState, SkeletonCards } from '@/components/ui/feedback';
import { useApi } from '@/lib/hooks';
import { useLocale } from '@/lib/i18n';

export default function EditStudentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { t } = useLocale();
  const { data, error, loading, reload } = useApi<any>(`/students/${id}`);
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        back={
          <Link href={`/admin/students/${id}`} className="mb-2 inline-flex items-center gap-1 text-sm font-semibold text-brand-500 hover:text-brand-700">
            <ArrowLeft className="size-4 rtl:rotate-180" /> {t('Retour à la fiche', 'العودة إلى الملف')}
          </Link>
        }
        title={t('Modifier la fiche', 'تعديل الملف')}
      />
      {error ? <ErrorState message={error.message} onRetry={reload} /> : loading || !data ? <SkeletonCards n={3} /> : <StudentForm student={data} />}
    </div>
  );
}
