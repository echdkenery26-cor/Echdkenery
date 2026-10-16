'use client';

import { CalendarDays, DoorOpen, UserRound } from 'lucide-react';
import { WEEK_ORDER } from '@/components/app/class-parts';
import { Badge, Card, PageHeader } from '@/components/ui/display';
import { EmptyState, ErrorState, SkeletonCards } from '@/components/ui/feedback';
import { Chips, Select } from '@/components/ui/form';
import { useApi } from '@/lib/hooks';
import { useLocale } from '@/lib/i18n';
import { useLookups } from '@/lib/lookups';
import { useUrlState } from '@/lib/url-state';
import { Link } from '@/components/ui/button';

/** Emploi du temps : semaine type (par jour) et prochaines séances avec annulations / déplacements */
export default function TimetablePage() {
  const { t, pick, num, weekday, time, date } = useLocale();
  const { lk } = useLookups();
  const [f, set] = useUrlState({ view: 'week', teacherId: '', roomId: '' });
  const { data, error, loading, reload } = useApi<any>('/timetable', { teacherId: f.teacherId || undefined, roomId: f.roomId || undefined });

  const slots: any[] = data?.slots || [];
  const byDay = WEEK_ORDER.map((d) => ({ d, items: slots.filter((s) => s.weekday === d).sort((a, b) => a.startTime.localeCompare(b.startTime)) })).filter((x) => x.items.length);
  const classOf = new Map(slots.map((s) => [s.id, s]));

  return (
    <div>
      <PageHeader title={t('Emploi du temps', 'الجدول الزمني')} subtitle={data ? t(`Du ${date(data.from)} au ${date(data.to)}`, `من ${date(data.from)} إلى ${date(data.to)}`) : undefined} />
      <div className="mb-4 space-y-3">
        <Chips value={f.view} onChange={(v) => set({ view: v })} options={[{ value: 'week', label: t('Semaine type', 'الأسبوع النموذجي') }, { value: 'next', label: t('Prochaines séances', 'الحصص القادمة') }]} />
        <div className="grid gap-3 sm:grid-cols-2">
          <Select value={f.teacherId} onChange={(e) => set({ teacherId: e.target.value })} aria-label={t('Enseignant', 'المعلّم')}>
            <option value="">{t('Tous les enseignants', 'كل المعلّمين')}</option>
            {lk?.teachers.filter((x) => x.active).map((x) => <option key={x.id} value={x.id}>{x.firstName} {x.lastName}</option>)}
          </Select>
          <Select value={f.roomId} onChange={(e) => set({ roomId: e.target.value })} aria-label={t('Salle', 'القاعة')}>
            <option value="">{t('Toutes les salles', 'كل القاعات')}</option>
            {lk?.rooms.map((r) => <option key={r.id} value={r.id}>{pick(r.name, r.nameAr || r.name)}</option>)}
          </Select>
        </div>
      </div>

      {error ? (
        <ErrorState message={error.message} onRetry={reload} />
      ) : loading || !data ? (
        <SkeletonCards n={4} />
      ) : slots.length === 0 ? (
        <EmptyState icon={<CalendarDays className="size-6" />} title={t('Aucun créneau', 'لا توجد مواعيد')} text={t('Ajoutez des horaires dans les classes.', 'أضف مواعيد في الأقسام.')} />
      ) : f.view === 'week' ? (
        <div className="space-y-6">
          {byDay.map(({ d, items }) => (
            <section key={d}>
              <h3 className="mb-3 font-serif text-lg font-bold text-brand-800">{weekday(d)}</h3>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {items.map((s) => <SlotCard key={s.id} s={s} />)}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(
            (data.occurrences as any[]).reduce<Record<string, any[]>>((acc, o) => ((acc[o.date] ||= []).push(o), acc), {}),
          ).map(([day, occ]) => (
            <section key={day}>
              <h3 className="mb-3 font-serif text-lg font-bold text-brand-800">{date(day, 'long')}</h3>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {occ.map((o) => {
                  const s = classOf.get(o.slotId);
                  if (!s) return null;
                  const off = o.status === 'CANCELLED' || o.status === 'CLOSED';
                  return (
                    <Card key={`${o.slotId}-${o.date}`} href={`/admin/classes/${s.classId}`} className={off ? 'opacity-60' : ''}>
                      <div className="flex items-center justify-between gap-2">
                        <p dir="ltr" className={`num font-serif font-bold text-brand-700 ${off ? 'line-through' : ''}`}>{time(o.startTime)}–{time(o.endTime)}</p>
                        {o.status === 'CANCELLED' && <Badge tone="bad">{t('Annulée', 'ملغاة')}</Badge>}
                        {o.status === 'MOVED' && <Badge tone="warn">{t('Déplacée', 'منقولة')}</Badge>}
                        {o.status === 'CLOSED' && <Badge tone="neutral">{pick(o.closureLabelFr, o.closureLabelAr)}</Badge>}
                      </div>
                      <p className="font-semibold text-brand-800">{s.className}</p>
                      <p className="text-xs text-brand-400">{pick(s.course.titleFr, s.course.titleAr)}</p>
                    </Card>
                  );
                })}
              </div>
            </section>
          ))}
          {data.occurrences.length === 0 && <EmptyState icon={<CalendarDays className="size-6" />} title={t('Aucune séance dans les 4 prochaines semaines', 'لا توجد حصص في الأسابيع الأربعة القادمة')} />}
        </div>
      )}
    </div>
  );

  function SlotCard({ s }: { s: any }) {
    return (
      <Card href={`/admin/classes/${s.classId}`}>
        <p dir="ltr" className="num font-serif text-lg font-bold text-brand-700">{time(s.startTime)} – {time(s.endTime)}</p>
        <p className="font-semibold text-brand-800">{s.className}</p>
        <p className="text-xs text-brand-400">{pick(s.course.titleFr, s.course.titleAr)}</p>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-brand-500">
          {s.teacher && <span className="inline-flex items-center gap-1"><UserRound className="size-3.5" /> {s.teacher.firstName} {s.teacher.lastName}</span>}
          {s.room && <span className="inline-flex items-center gap-1"><DoorOpen className="size-3.5" /> {pick(s.room.name, s.room.nameAr || s.room.name)}</span>}
        </div>
      </Card>
    );
  }
}
