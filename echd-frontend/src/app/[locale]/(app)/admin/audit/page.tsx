'use client';

import { ChevronDown, ScrollText } from 'lucide-react';
import { useState } from 'react';
import { actionLabel, actionTone, entityLabel } from '@/components/app/audit-labels';
import { Badge, Card, PageHeader, Pagination } from '@/components/ui/display';
import { EmptyState, ErrorState, SkeletonCards } from '@/components/ui/feedback';
import { Chips, SearchBox, SelectField } from '@/components/ui/form';
import { useApi } from '@/lib/hooks';
import { useLocale } from '@/lib/i18n';
import { useUrlState } from '@/lib/url-state';
import { cn } from '@/lib/utils';

const PAGE = 25;
const SKIP = new Set(['id', 'createdAt', 'updatedAt', 'passwordHash', 'password']);

export default function AuditPage() {
  const { t, dateTime, num } = useLocale();
  const [f, set] = useUrlState({ entity: '', action: '', q: '', entityId: '', page: '1' });
  const { data, error, loading, reload } = useApi<any>('/audit-logs', { entity: f.entity || undefined, action: f.action || undefined, q: f.q || undefined, entityId: f.entityId || undefined, page: Number(f.page), pageSize: PAGE });
  const [open, setOpen] = useState<string | null>(null);

  return (
    <div>
      <PageHeader title={t('Journal d’activité', 'سجل النشاط')} subtitle={data ? t(`${num(data.total)} action(s) enregistrée(s)`, `${num(data.total)} إجراء مسجّل`) : t('Qui a fait quoi, et quand.', 'من فعل ماذا ومتى.')} />
      <div className="mb-4 grid gap-3 md:grid-cols-2">
        <SearchBox value={f.q} onChange={(v) => set({ q: v })} placeholder={t('Nom de l’auteur…', 'اسم صاحب الإجراء…')} />
        <SelectField label="" aria-label={t('Type d’objet', 'نوع العنصر')} value={f.entity} onChange={(e) => set({ entity: e.target.value })}>
          <option value="">{t('Tous les types', 'كل الأنواع')}</option>
          {data?.entities.map((e: string) => <option key={e} value={e}>{entityLabel(e, t)}</option>)}
        </SelectField>
      </div>
      <div className="mb-4">
        <Chips
          value={f.action}
          onChange={(v) => set({ action: v })}
          options={[
            { value: '', label: t('Toutes', 'الكل') },
            { value: 'CREATE', label: actionLabel('CREATE', t) },
            { value: 'UPDATE', label: actionLabel('UPDATE', t) },
            { value: 'DELETE', label: actionLabel('DELETE', t) },
            { value: 'PAYMENT', label: actionLabel('PAYMENT', t) },
            { value: 'PAYMENT_CANCEL', label: actionLabel('PAYMENT_CANCEL', t) },
            { value: 'LOGIN_FAILED', label: actionLabel('LOGIN_FAILED', t) },
          ]}
        />
      </div>

      {error ? (
        <ErrorState message={error.message} onRetry={reload} />
      ) : loading || !data ? (
        <SkeletonCards n={5} />
      ) : data.items.length === 0 ? (
        <EmptyState icon={<ScrollText className="size-6" />} title={t('Aucune action', 'لا توجد إجراءات')} />
      ) : (
        <>
          <div className="space-y-2.5">
            {data.items.map((l: any) => {
              const diff = changes(l.before, l.after);
              const expandable = diff.length > 0;
              const isOpen = open === l.id;
              return (
                <Card key={l.id} padded={false}>
                  <button type="button" disabled={!expandable} onClick={() => setOpen(isOpen ? null : l.id)} className="flex w-full items-start gap-3 p-4 text-start disabled:cursor-default">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Badge tone={actionTone(l.action)}>{actionLabel(l.action, t)}</Badge>
                        <span className="text-sm font-semibold text-brand-700">{entityLabel(l.entity, t)}</span>
                      </div>
                      <p className="mt-1.5 text-sm text-brand-600">{l.userLabel}</p>
                      <p className="text-xs text-brand-400">
                        {dateTime(l.createdAt)}{l.ip && <> · <span dir="ltr" className="num">{l.ip}</span></>}
                      </p>
                    </div>
                    {expandable && <ChevronDown className={cn('mt-1 size-4 shrink-0 text-brand-400 transition', isOpen && 'rotate-180')} />}
                  </button>
                  {isOpen && (
                    <dl className="space-y-1.5 border-t border-sand-200 bg-sand-100/60 px-4 py-3 text-sm">
                      {diff.map((d) => (
                        <div key={d.key} className="grid gap-0.5 sm:grid-cols-[10rem_1fr] sm:gap-3">
                          <dt className="truncate font-semibold text-brand-500">{d.key}</dt>
                          <dd className="min-w-0 break-words text-brand-700">
                            {d.before !== undefined && <span className="text-brand-400 line-through">{d.before}</span>}
                            {d.before !== undefined && d.after !== undefined && <span className="mx-1.5 text-brand-300">→</span>}
                            {d.after !== undefined && <span className="font-medium">{d.after}</span>}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  )}
                </Card>
              );
            })}
          </div>
          <Pagination page={Number(f.page)} pageSize={PAGE} total={data.total} onChange={(p) => set({ page: String(p) }, false)} />
        </>
      )}
    </div>
  );
}

const show = (v: any): string => (v === null || v === undefined ? '—' : typeof v === 'object' ? JSON.stringify(v) : String(v)).slice(0, 200);

/** Liste des champs modifiés (avant → après) */
function changes(before: any, after: any): Array<{ key: string; before?: string; after?: string }> {
  const b = before && typeof before === 'object' ? before : {};
  const a = after && typeof after === 'object' ? after : {};
  const keys = [...new Set([...Object.keys(b), ...Object.keys(a)])].filter((k) => !SKIP.has(k));
  const out: Array<{ key: string; before?: string; after?: string }> = [];
  for (const k of keys) {
    const hasB = k in b;
    const hasA = k in a;
    if (hasB && hasA) {
      if (JSON.stringify(b[k]) !== JSON.stringify(a[k])) out.push({ key: k, before: show(b[k]), after: show(a[k]) });
    } else if (hasA) out.push({ key: k, after: show(a[k]) });
    else out.push({ key: k, before: show(b[k]) });
  }
  return out.slice(0, 30);
}
