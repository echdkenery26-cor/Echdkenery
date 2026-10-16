'use client';

import { AlertTriangle, Bell, BellOff, CalendarClock, CheckCheck, Info, UserPlus, Users, Wallet } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge, Card, PageHeader, Pagination } from '@/components/ui/display';
import { EmptyState, ErrorState, SkeletonCards } from '@/components/ui/feedback';
import { Chips } from '@/components/ui/form';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { invalidate, useApi } from '@/lib/hooks';
import { useLocale } from '@/lib/i18n';
import { cn } from '@/lib/utils';

const ICONS: Record<string, [React.ReactNode, string]> = {
  PREREG_NEW: [<UserPlus key="i" className="size-5" />, 'bg-gold-200 text-gold-700'],
  PREREG_PENDING: [<UserPlus key="i" className="size-5" />, 'bg-warn-soft text-warn'],
  DUE_LATE: [<Wallet key="i" className="size-5" />, 'bg-warn-soft text-warn'],
  DUE_CRITICAL: [<Wallet key="i" className="size-5" />, 'bg-bad-soft text-bad'],
  ABSENCES: [<AlertTriangle key="i" className="size-5" />, 'bg-warn-soft text-warn'],
  CLASS_FULL: [<Users key="i" className="size-5" />, 'bg-info-soft text-info'],
  SEAT_FREED: [<Users key="i" className="size-5" />, 'bg-ok-soft text-ok'],
  NO_CLASS: [<Users key="i" className="size-5" />, 'bg-warn-soft text-warn'],
  YEAR_END: [<CalendarClock key="i" className="size-5" />, 'bg-info-soft text-info'],
  INFO: [<Info key="i" className="size-5" />, 'bg-brand-50 text-brand-600'],
};

/** Lien de destination d'une notification selon l'objet concerné */
function target(n: any, isTeacher: boolean): string | null {
  if (isTeacher) return null;
  switch (n.entityType) {
    case 'PreRegistration':
      return `/admin/pre-registrations?open=${n.entityId}`;
    case 'Student':
      return `/admin/students/${n.entityId}`;
    case 'SchoolClass':
    case 'Class':
      return `/admin/classes/${n.entityId}`;
    default:
      break;
  }
  if (n.type === 'PREREG_NEW' || n.type === 'PREREG_PENDING') return '/admin/pre-registrations';
  if (n.type === 'DUE_LATE' || n.type === 'DUE_CRITICAL') return '/admin/finance?state=late';
  if (n.type === 'YEAR_END') return '/admin/settings';
  return null;
}

export default function NotificationsPage() {
  const { t, dateTime, num } = useLocale();
  const router = useRouter();
  const { href } = useLocale();
  const [page, setPage] = useState(1);
  const [only, setOnly] = useState<'all' | 'unread'>('all');
  const { data, error, loading, reload } = useApi<any>('/notifications', { page, pageSize: 20, unreadOnly: only === 'unread' ? 'true' : undefined });

  async function readAll() {
    await api('/notifications/read-all', { method: 'POST' });
    invalidate('/notifications');
  }
  async function open(n: any) {
    if (!n.read) {
      await api(`/notifications/${n.id}/read`, { method: 'POST' }).catch(() => null);
      invalidate('/notifications');
    }
    const to = target(n, false);
    if (to) router.push(href(to));
  }

  return (
    <div>
      <PageHeader
        title={t('Notifications', 'الإشعارات')}
        subtitle={data?.unread ? t(`${num(data.unread)} non lue(s)`, `${num(data.unread)} غير مقروءة`) : undefined}
        actions={
          data?.unread > 0 && (
            <Button variant="soft" onClick={readAll} icon={<CheckCheck className="size-4" />}>
              {t('Tout marquer comme lu', 'تعليم الكل كمقروء')}
            </Button>
          )
        }
      />
      <div className="mb-4">
        <Chips
          value={only}
          onChange={(v) => {
            setOnly(v);
            setPage(1);
          }}
          options={[
            { value: 'all', label: t('Toutes', 'الكل') },
            { value: 'unread', label: t('Non lues', 'غير مقروءة') },
          ]}
        />
      </div>

      {error ? (
        <ErrorState message={error.message} onRetry={reload} />
      ) : loading || !data ? (
        <SkeletonCards n={5} />
      ) : data.items.length === 0 ? (
        <EmptyState icon={<BellOff className="size-6" />} title={t('Aucune notification', 'لا توجد إشعارات')} text={t('Les alertes importantes apparaîtront ici.', 'ستظهر هنا التنبيهات المهمة.')} />
      ) : (
        <>
          <ul className="space-y-2.5">
            {data.items.map((n: any) => {
              const [icon, color] = ICONS[n.type] || ICONS.INFO;
              return (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => open(n)}
                    className={cn(
                      'flex w-full items-start gap-3.5 rounded-[1.25rem] p-4 text-start shadow-card transition hover:-translate-y-0.5 hover:shadow-lift',
                      n.read ? 'bg-white/70' : 'bg-white ring-1 ring-gold-300',
                    )}
                  >
                    <span className={cn('grid size-10 shrink-0 place-items-center rounded-xl', color)}>{icon}</span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-start justify-between gap-2">
                        <span className={cn('block text-brand-800', n.read ? 'font-medium' : 'font-bold')}>{n.title}</span>
                        {!n.read && <Badge tone="gold">{t('Nouveau', 'جديد')}</Badge>}
                      </span>
                      {n.body && <span className="mt-0.5 block text-sm text-brand-500">{n.body}</span>}
                      <span className="mt-1 block text-xs text-brand-400">{dateTime(n.createdAt)}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          <Pagination page={page} pageSize={20} total={data.total} onChange={setPage} />
        </>
      )}
    </div>
  );
}
