'use client';

import { DoorOpen, UserRound } from 'lucide-react';
import { Badge, Card } from '@/components/ui/display';
import { useLocale } from '@/lib/i18n';

/** Une séance (date, horaire, classe, enseignant, salle) */
export function SessionCard({ s, href, done }: { s: any; href?: string; done?: boolean }) {
  const { t, pick, date, time, weekday } = useLocale();
  const cls = s.class;
  const cancelled = s.status === 'CANCELLED';
  return (
    <Card href={href} className="flex gap-4">
      <div className="grid w-14 shrink-0 place-items-center rounded-2xl bg-brand-50 py-2 text-center">
        <span className="text-xs font-semibold text-brand-500">{weekday(s.weekday, 'short')}</span>
        <span className="num font-serif text-xl font-bold leading-none text-brand-700">{new Date(s.date).getUTCDate()}</span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p dir="ltr" className="num font-serif font-bold text-brand-700">
            {time(s.startTime)}–{time(s.endTime)}
          </p>
          {cancelled && <Badge tone="bad">{t('Annulée', 'ملغاة')}</Badge>}
          {s.status === 'MOVED' && <Badge tone="warn">{t('Déplacée', 'منقولة')}</Badge>}
          {done && <Badge tone="ok">{t('Présences faites', 'تم تسجيل الحضور')}</Badge>}
        </div>
        <p className="truncate font-semibold text-brand-800">{cls?.name}</p>
        <p className="truncate text-xs text-brand-400">{cls?.course ? pick(cls.course.titleFr, cls.course.titleAr) : ''}</p>
        <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-brand-500">
          {cls?.teacher && (
            <span className="inline-flex items-center gap-1">
              <UserRound className="size-3.5" /> {`${cls.teacher.firstName} ${cls.teacher.lastName}`.trim()}
            </span>
          )}
          {(s.room || cls?.room) && (
            <span className="inline-flex items-center gap-1">
              <DoorOpen className="size-3.5" /> {pick((s.room || cls.room).name, (s.room || cls.room).nameAr)}
            </span>
          )}
          <span className="sr-only">{date(s.date)}</span>
        </div>
      </div>
    </Card>
  );
}
