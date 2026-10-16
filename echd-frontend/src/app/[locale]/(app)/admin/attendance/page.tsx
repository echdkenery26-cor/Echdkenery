'use client';

import { AttendanceSheet } from '@/components/app/attendance-sheet';
import { PageHeader } from '@/components/ui/display';
import { useLocale } from '@/lib/i18n';

export default function AttendancePage() {
  const { t } = useLocale();
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title={t('Présences', 'الحضور')} subtitle={t('Faites l’appel en un geste : présent, absent, en retard ou excusé.', 'سجّل الحضور بلمسة: حاضر أو غائب أو متأخر أو بعذر.')} />
      <AttendanceSheet />
    </div>
  );
}
