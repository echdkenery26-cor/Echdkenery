'use client';

import { Check, ChevronLeft, ChevronRight, Clock, MessageSquare, Save, ShieldCheck, Users, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Button, IconButton } from '@/components/ui/button';
import { Avatar, Badge, Card } from '@/components/ui/display';
import { EmptyState, Modal, Notice, Spinner, useToast } from '@/components/ui/feedback';
import { Select, TextField } from '@/components/ui/form';
import { api } from '@/lib/api';
import { invalidate, messageOf, useApi } from '@/lib/hooks';
import { useLocale } from '@/lib/i18n';
import { addDaysISO, todayISO } from '@/lib/locale';
import { useUrlState } from '@/lib/url-state';
import { cn } from '@/lib/utils';

type St = 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED';
const OPTIONS: Array<{ v: St; icon: React.ReactNode; on: string }> = [
  { v: 'PRESENT', icon: <Check className="size-5" strokeWidth={3} />, on: 'bg-ok text-white' },
  { v: 'ABSENT', icon: <X className="size-5" strokeWidth={3} />, on: 'bg-bad text-white' },
  { v: 'LATE', icon: <Clock className="size-5" />, on: 'bg-warn text-white' },
  { v: 'EXCUSED', icon: <ShieldCheck className="size-5" />, on: 'bg-info text-white' },
];

/** Feuille d'appel : une carte par élève, quatre gros boutons. Utilisée par l'administration et les enseignants. */
export function AttendanceSheet() {
  const { t, date, num, weekday } = useLocale();
  const toast = useToast();
  const [f, set] = useUrlState({ classId: '', date: '' });
  const day = f.date || todayISO();
  const classes = useApi<any[]>('/classes', { active: 'true' });
  const classId = f.classId || (classes.data && classes.data.length === 1 ? classes.data[0].id : '');
  const sheet = useApi<any>(classId ? '/attendance/sheet' : null, { classId, date: day });

  const [marks, setMarks] = useState<Record<string, { status: St | null; remark: string }>>({});
  const [remarkFor, setRemarkFor] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (!sheet.data) return;
    const m: typeof marks = {};
    for (const s of sheet.data.students) m[s.id] = { status: s.status, remark: s.remark || '' };
    setMarks(m);
    setDirty(false);
  }, [sheet.data]);

  const students: any[] = sheet.data?.students || [];
  const counts = useMemo(() => {
    const c = { PRESENT: 0, ABSENT: 0, LATE: 0, EXCUSED: 0, none: 0 };
    for (const s of students) {
      const st = marks[s.id]?.status;
      if (st) c[st]++;
      else c.none++;
    }
    return c;
  }, [students, marks]);

  const setStatus = (id: string, status: St) => {
    setMarks((m) => ({ ...m, [id]: { ...m[id], status: m[id]?.status === status ? null : status } }));
    setDirty(true);
  };
  const allPresent = () => {
    setMarks((m) => Object.fromEntries(students.map((s) => [s.id, { status: m[s.id]?.status || 'PRESENT', remark: m[s.id]?.remark || '' }])));
    setDirty(true);
  };

  async function save() {
    const records = students.filter((s) => marks[s.id]?.status).map((s) => ({ studentId: s.id, status: marks[s.id].status, remark: marks[s.id].remark.trim() || undefined }));
    if (!records.length) return toast.error(t('Marquez au moins un élève.', 'حدّد طالباً واحداً على الأقل.'));
    setBusy(true);
    try {
      await api('/attendance/sheet', { method: 'PUT', body: { classId, date: day, records } });
      await Promise.all([sheet.reload(), invalidate('/dashboard', '/students', '/classes')]);
      toast.ok(t('Appel enregistré', 'تم حفظ الحضور'));
      setDirty(false);
    } catch (e) {
      toast.error(messageOf(e));
    } finally {
      setBusy(false);
    }
  }

  const sd = sheet.data;
  const isToday = day === todayISO();
  const future = day > todayISO();

  return (
    <div className="pb-24">
      <div className="mb-5 space-y-3">
        <Select value={classId} onChange={(e) => set({ classId: e.target.value })} aria-label={t('Classe', 'القسم')}>
          <option value="">{t('Choisir une classe…', 'اختر قسماً…')}</option>
          {classes.data?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </Select>
        <div className="flex items-center gap-2">
          <IconButton label={t('Jour précédent', 'اليوم السابق')} variant="outline" onClick={() => set({ date: addDaysISO(day, -1) }, false)}><ChevronLeft className="size-5 rtl:rotate-180" /></IconButton>
          <div className="min-w-0 flex-1">
            <TextField label="" aria-label={t('Date', 'التاريخ')} type="date" dir="ltr" value={day} max={todayISO()} onChange={(e) => set({ date: e.target.value }, false)} className="[&_input]:text-center" />
          </div>
          <IconButton label={t('Jour suivant', 'اليوم التالي')} variant="outline" disabled={day >= todayISO()} onClick={() => set({ date: addDaysISO(day, 1) }, false)}><ChevronRight className="size-5 rtl:rotate-180" /></IconButton>
          {!isToday && <Button variant="soft" size="sm" onClick={() => set({ date: '' }, false)}>{t('Aujourd’hui', 'اليوم')}</Button>}
        </div>
      </div>

      {!classId ? (
        <EmptyState icon={<Users className="size-6" />} title={t('Choisissez une classe', 'اختر قسماً')} text={t('Puis la date de la séance pour faire l’appel.', 'ثم تاريخ الحصة لتسجيل الحضور.')} />
      ) : !sd ? (
        <div className="grid place-items-center py-16"><Spinner /></div>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <p className="font-serif text-lg font-bold text-brand-800">{date(day, 'long')}</p>
            <div className="flex flex-wrap gap-1.5">
              {sd.session ? <Badge tone={sd.session.status === 'NORMAL' ? 'ok' : 'warn'}><span dir="ltr" className="num">{sd.session.startTime}–{sd.session.endTime}</span></Badge> : <Badge tone="warn">{t('Pas de séance prévue ce jour', 'لا توجد حصة مقرّرة')}</Badge>}
              {sd.recorded && <Badge tone="info">{t('Appel déjà fait', 'تم تسجيل الحضور')}</Badge>}
            </div>
          </div>
          {sd.session?.status === 'CANCELLED' && <Notice tone="warn" className="mb-4">{t('Cette séance est annulée.', 'هذه الحصة ملغاة.')}</Notice>}
          {sd.session?.status === 'CLOSED' && <Notice tone="warn" className="mb-4">{t('École fermée ce jour-là.', 'المدرسة مغلقة في هذا اليوم.')}</Notice>}
          {future && <Notice tone="warn" className="mb-4">{t('Date à venir : l’appel n’est pas possible.', 'تاريخ مستقبلي: لا يمكن تسجيل الحضور.')}</Notice>}

          {students.length === 0 ? (
            <EmptyState icon={<Users className="size-6" />} title={t('Aucun élève inscrit dans cette classe', 'لا يوجد طلاب مسجّلون في هذا القسم')} />
          ) : (
            <>
              <div className="mb-3 flex justify-end"><Button variant="soft" size="sm" icon={<Check className="size-4" />} onClick={allPresent} disabled={future}>{t('Tous présents', 'الكل حاضر')}</Button></div>
              <ul className="space-y-2.5">
                {students.map((s) => {
                  const m = marks[s.id];
                  return (
                    <li key={s.id}>
                      <Card className="!p-3">
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-2.5 sm:flex-nowrap">
                          <Avatar src={s.photoUrl} first={s.firstName} last={s.lastName} size={44} />
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-semibold text-brand-800">{s.firstName} {s.lastName}</p>
                            {m?.remark && <p className="truncate text-xs text-brand-400">{m.remark}</p>}
                          </div>
                          <div className="flex w-full justify-between gap-1.5 sm:w-auto sm:justify-start" role="group" aria-label={`${s.firstName} ${s.lastName}`}>
                            {OPTIONS.map((o) => (
                              <button
                                key={o.v}
                                type="button"
                                disabled={future}
                                aria-pressed={m?.status === o.v}
                                aria-label={o.v}
                                onClick={() => setStatus(s.id, o.v)}
                                className={cn('tap grid size-11 place-items-center rounded-xl transition active:scale-95 disabled:opacity-40', m?.status === o.v ? o.on + ' shadow-lift' : 'bg-sand-100 text-brand-300 hover:bg-sand-200')}
                              >
                                {o.icon}
                              </button>
                            ))}
                            <IconButton label={t('Remarque', 'ملاحظة')} className={cn('!size-11', m?.remark && 'text-gold-700')} onClick={() => setRemarkFor(s.id)}><MessageSquare className="size-4" /></IconButton>
                          </div>
                        </div>
                      </Card>
                    </li>
                  );
                })}
              </ul>
            </>
          )}

          {students.length > 0 && !future && (
            <div className="safe-bottom fixed inset-x-0 bottom-[4.5rem] z-20 px-4 lg:bottom-4 lg:start-64 lg:px-8">
              <div className="mx-auto flex max-w-3xl items-center gap-3 rounded-2xl bg-white p-3 shadow-float ring-1 ring-sand-200">
                <div className="num flex flex-1 flex-wrap items-center gap-x-3 gap-y-0.5 text-sm font-semibold">
                  <span className="text-ok">{num(counts.PRESENT)} {t('prés.', 'حاضر')}</span>
                  <span className="text-bad">{num(counts.ABSENT)} {t('abs.', 'غائب')}</span>
                  {counts.LATE > 0 && <span className="text-warn">{num(counts.LATE)} {t('ret.', 'متأخر')}</span>}
                  {counts.none > 0 && <span className="text-brand-400">{num(counts.none)} {t('à faire', 'متبقٍ')}</span>}
                </div>
                <Button variant="primary" loading={busy} disabled={!dirty && sd.recorded} onClick={save} icon={<Save className="size-4" />}>{t('Enregistrer', 'حفظ')}</Button>
              </div>
            </div>
          )}
        </>
      )}

      <Modal open={!!remarkFor} onClose={() => setRemarkFor(null)} title={t('Remarque', 'ملاحظة')} size="sm">
        {remarkFor && (
          <div className="space-y-4">
            <TextField label={students.find((s) => s.id === remarkFor)?.firstName || ''} value={marks[remarkFor]?.remark || ''} onChange={(e) => { setMarks((m) => ({ ...m, [remarkFor]: { ...m[remarkFor], remark: e.target.value } })); setDirty(true); }} placeholder={t('Ex. malade, prévenu par les parents…', 'مثال: مريض، أبلغ الأهل…')} autoFocus />
            <div className="flex justify-end"><Button variant="dark" onClick={() => setRemarkFor(null)}>{t('OK', 'حسناً')}</Button></div>
          </div>
        )}
      </Modal>
    </div>
  );
}
