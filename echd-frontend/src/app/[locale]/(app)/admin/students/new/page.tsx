'use client';

import { ArrowLeft } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { StudentForm } from '@/components/app/student-form';
import { Link } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/display';
import { useApi } from '@/lib/hooks';
import { useLocale } from '@/lib/i18n';

export default function NewStudentPage() {
  const { t } = useLocale();
  const sibling = useSearchParams().get('sibling');
  const { data, loading } = useApi<any>(sibling ? `/students/${sibling}` : null);
  if (sibling && loading) return null;
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        back={
          <Link href="/admin/students" className="mb-2 inline-flex items-center gap-1 text-sm font-semibold text-brand-500 hover:text-brand-700">
            <ArrowLeft className="size-4 rtl:rotate-180" /> {t('Élèves', 'الطلاب')}
          </Link>
        }
        title={sibling ? t('Ajouter un frère ou une sœur', 'إضافة أخ أو أخت') : t('Nouvel élève', 'طالب جديد')}
      />
      <StudentForm siblingOf={data ? { id: data.id, lastName: data.lastName, audience: data.audience } : null} />
    </div>
  );
}
