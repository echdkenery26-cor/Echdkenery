'use client';

import { Phone, Wallet } from 'lucide-react';
import { Avatar, Badge, Card } from '@/components/ui/display';
import { useLocale } from '@/lib/i18n';
import { audienceLabel, studentStatus } from './labels';

/** Carte d'un élève (liste, recherche, fratrie) */
export function StudentCard({ s, href, showMoney = true }: { s: any; href: string; showMoney?: boolean }) {
  const { t, pick, num, money } = useLocale();
  const st = studentStatus(s.status, t);
  const classes: any[] = s.classes || [];
  return (
    <Card href={href} className="flex h-full gap-3.5">
      <Avatar src={s.photoUrl} first={s.firstName} last={s.lastName} size={52} />
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className="truncate font-serif text-base font-bold leading-snug text-brand-800">
            {s.firstName} {s.lastName}
          </p>
          {s.status !== 'ENROLLED' && <Badge tone={st.tone}>{st.label}</Badge>}
        </div>
        <p className="truncate text-xs text-brand-400">
          {audienceLabel(s.audience, t)}
          {s.age != null && ` · ${num(s.age)} ${t('ans', 'سنة')}`}
          {s.currentLevel && ` · ${pick(s.currentLevel.labelFr, s.currentLevel.labelAr)}`}
        </p>
        {classes.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {classes.slice(0, 2).map((c) => (
              <Badge key={c.enrollmentId} tone={c.status === 'WAITLIST' ? 'info' : 'neutral'}>
                {c.name}
              </Badge>
            ))}
            {classes.length > 2 && <Badge>+{num(classes.length - 2)}</Badge>}
          </div>
        ) : (
          s.status !== 'LEFT' && <p className="mt-2 text-xs font-medium text-warn">{t('Sans classe', 'بلا قسم')}</p>
        )}
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-brand-500">
          {s.phone && (
            <span dir="ltr" className="num inline-flex items-center gap-1">
              <Phone className="size-3.5" /> {s.phone}
            </span>
          )}
          {showMoney && s.lateCount > 0 && (
            <span className="inline-flex items-center gap-1 font-semibold text-bad">
              <Wallet className="size-3.5" /> {t('Retard', 'متأخر')} · {money(s.balanceCents)}
            </span>
          )}
        </div>
      </div>
    </Card>
  );
}
