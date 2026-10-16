'use client';

import { BookOpen, Check, CircleDashed, Loader, Plus, Printer, Sparkles, Star, Trash2, TrendingUp } from 'lucide-react';
import { useState } from 'react';
import { Button, IconButton } from '@/components/ui/button';
import { Badge, Card, CardTitle, ProgressBar } from '@/components/ui/display';
import { EmptyState, ErrorState, Modal, Notice, SkeletonCards, useConfirm, useToast } from '@/components/ui/feedback';
import { Chips, Field, SelectField, TextField, TextareaField } from '@/components/ui/form';
import { api, del, openDocument, post, put } from '@/lib/api';
import { invalidate, messageOf, useApi } from '@/lib/hooks';
import { useLocale } from '@/lib/i18n';
import { todayISO } from '@/lib/locale';
import { cn } from '@/lib/utils';

const APPR = ['TO_REVIEW', 'GOOD', 'VERY_GOOD', 'EXCELLENT'] as const;
export const apprLabel = (a: string, t: (fr: string, ar: string) => string) =>
  ({ TO_REVIEW: t('À revoir', 'يحتاج مراجعة'), GOOD: t('Bien', 'جيد'), VERY_GOOD: t('Très bien', 'جيد جداً'), EXCELLENT: t('Excellent', 'ممتاز') }[a] || a);
const apprTone = (a: string) => ({ TO_REVIEW: 'warn', GOOD: 'info', VERY_GOOD: 'ok', EXCELLENT: 'gold' }[a] || 'neutral') as any;

const refresh = (id: string) => invalidate(`/students/${id}/progress`, '/classes', '/dashboard');

/** Suivi pédagogique d'un élève : niveau, parcours, mémorisation, évaluations. `staff` ajoute l'affectation de parcours. */
export function StudentProgress({ studentId, staff }: { studentId: string; staff?: boolean }) {
  const { t, pick, isAr } = useLocale();
  const toast = useToast();
  const { data, error, loading, reload } = useApi<any>(`/students/${studentId}/progress`);
  const [memo, setMemo] = useState<any | null | false>(false);
  const [evalOpen, setEvalOpen] = useState(false);
  const [assign, setAssign] = useState(false);
  const [commentFor, setCommentFor] = useState<any | null>(null);
  const confirm = useConfirm();

  if (error) return <ErrorState message={error.message} onRetry={reload} />;
  if (loading || !data) return <SkeletonCards n={3} />;

  async function setStatus(stepId: string, status: string, comment?: string) {
    try {
      await put(`/students/${studentId}/progress`, { updates: [{ stepId, status, comment }] });
      await refresh(studentId);
    } catch (e) {
      toast.error(messageOf(e));
    }
  }

  async function promote() {
    const lv = data.levelUp?.nextLevel;
    if (!lv) return;
    const ok = await confirm({
      title: t('Passer au niveau suivant ?', 'الانتقال إلى المستوى التالي؟'),
      message: t(`${data.student?.firstName || 'L’élève'} passera au niveau « ${lv.labelFr} ».`, `سينتقل إلى مستوى «${lv.labelAr}».`),
      confirmLabel: t('Confirmer le passage', 'تأكيد الانتقال'),
    });
    if (!ok) return;
    try {
      await post(`/students/${studentId}/promote-level`, { levelId: lv.id });
      await invalidate(`/students/${studentId}`);
      toast.ok(t('Niveau mis à jour', 'تم تحديث المستوى'));
    } catch (e) {
      toast.error(messageOf(e));
    }
  }

  const lu = data.levelUp;

  return (
    <div className="space-y-5">
      {/* Niveau et avancement global */}
      <Card className="flex flex-wrap items-center gap-5">
        <Ring percent={data.percent} />
        <div className="min-w-0 flex-1">
          <p className="text-sm text-brand-500">{t('Niveau actuel', 'المستوى الحالي')}</p>
          <p className="font-serif text-xl font-bold text-brand-800">{data.level?.current ? pick(data.level.current.labelFr, data.level.current.labelAr) : t('Non défini', 'غير محدد')}</p>
          <p className="text-sm text-brand-500">{t(`Avancement global : ${data.percent} %`, `التقدّم العام: ${data.percent}٪`)}</p>
        </div>
        <Button variant="outline" size="sm" icon={<Printer className="size-4" />} onClick={() => openDocument('bulletin', studentId, isAr ? 'ar' : 'fr', 1).catch((e) => toast.error(messageOf(e)))}>
          {t('Bulletin', 'كشف النقاط')}
        </Button>
      </Card>

      {lu?.proposed && (
        <Card className="flex flex-wrap items-center gap-3 !bg-gold-100 ring-1 ring-gold-300">
          <Sparkles className="size-6 text-gold-700" />
          <div className="min-w-0 flex-1">
            <p className="font-serif font-bold text-brand-800">{t('Parcours terminé !', 'اكتمل المسار!')}</p>
            <p className="text-sm text-brand-600">{t(`Passage proposé : ${lu.nextLevel.labelFr}`, `الانتقال المقترح: ${lu.nextLevel.labelAr}`)}</p>
          </div>
          <Button variant="primary" size="sm" onClick={promote}>{t('Valider le passage', 'تأكيد الانتقال')}</Button>
        </Card>
      )}

      {/* Parcours */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-serif text-lg font-bold text-brand-800">{t('Parcours', 'المسارات')}</h3>
          {staff && (
            <Button variant="soft" size="sm" icon={<Plus className="size-4" />} onClick={() => setAssign(true)}>
              {t('Affecter', 'إسناد')}
            </Button>
          )}
        </div>
        {data.pathways.length === 0 ? (
          <EmptyState icon={<TrendingUp className="size-6" />} title={t('Aucun parcours', 'لا توجد مسارات')} text={t('Les parcours sont affectés automatiquement selon les cours suivis.', 'تُسند المسارات تلقائياً حسب الدروس المتّبعة.')} />
        ) : (
          data.pathways.map((p: any) => (
            <Card key={p.pathway.id}>
              <div className="mb-3 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-serif font-bold text-brand-800">{pick(p.pathway.titleFr, p.pathway.titleAr)}</p>
                  <p className="num text-xs text-brand-400">{p.doneCount}/{p.total}</p>
                </div>
                <div className="flex items-center gap-2">
                  {p.completedAt && <Badge tone="ok">{t('Terminé', 'مكتمل')}</Badge>}
                  {staff && (
                    <IconButton
                      label={t('Retirer ce parcours', 'إزالة المسار')}
                      className="!size-9"
                      onClick={async () => {
                        if (!(await confirm({ title: t('Retirer ce parcours ?', 'إزالة هذا المسار؟'), message: t('La progression enregistrée sera conservée dans l’historique.', 'يبقى التقدّم المسجّل في السجل.'), danger: true, confirmLabel: t('Retirer', 'إزالة') }))) return;
                        await del(`/students/${studentId}/pathways/${p.pathway.id}`).catch((e) => toast.error(messageOf(e)));
                        refresh(studentId);
                      }}
                    >
                      <Trash2 className="size-4" />
                    </IconButton>
                  )}
                </div>
              </div>
              <ProgressBar value={p.percent} tone={p.percent === 100 ? 'ok' : 'gold'} />
              <ul className="mt-4 space-y-1.5">
                {p.steps.map((s: any) => (
                  <li key={s.id} className="flex items-center gap-3 rounded-xl bg-sand-100 px-3 py-2">
                    <StepToggle status={s.status} onChange={(st) => setStatus(s.id, st, s.comment || undefined)} />
                    <button type="button" onClick={() => setCommentFor(s)} className="min-w-0 flex-1 text-start">
                      <span className={cn('block text-sm font-medium', s.status === 'DONE' ? 'text-brand-400 line-through' : 'text-brand-800')}>{pick(s.titleFr, s.titleAr)}</span>
                      {s.comment && <span className="block truncate text-xs text-brand-400">{s.comment}</span>}
                    </button>
                  </li>
                ))}
              </ul>
            </Card>
          ))
        )}
      </section>

      {/* Mémorisation */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-serif text-lg font-bold text-brand-800">
            {t('Mémorisation du Coran', 'حفظ القرآن')}
            <span className="ms-2 text-sm font-normal text-brand-400">{t(`${data.memorizationSummary.validated} validée(s)`, `${data.memorizationSummary.validated} مثبّتة`)}</span>
          </h3>
          <Button variant="soft" size="sm" icon={<Plus className="size-4" />} onClick={() => setMemo(null)}>
            {t('Ajouter', 'إضافة')}
          </Button>
        </div>
        {data.memorization.length === 0 ? (
          <EmptyState icon={<BookOpen className="size-6" />} title={t('Aucune sourate suivie', 'لا توجد سور مسجّلة')} />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {data.memorization.map((m: any) => (
              <Card key={m.surah} onClick={() => setMemo(m)}>
                <div className="flex items-center justify-between gap-2">
                  <p className="min-w-0 truncate font-semibold text-brand-800">
                    <span className="num me-1.5 text-brand-400">{m.surah}.</span>
                    {isAr ? m.nameAr : m.nameLatin}
                  </p>
                  <Badge tone={m.status === 'VALIDATED' ? 'ok' : 'info'}>{m.status === 'VALIDATED' ? t('Validée', 'مثبّتة') : t('En cours', 'جارية')}</Badge>
                </div>
                <p className="num mb-2 text-xs text-brand-400">{m.verse}/{m.verses} {t('versets', 'آية')}</p>
                <ProgressBar value={m.progressPercent} tone={m.status === 'VALIDATED' ? 'ok' : 'gold'} />
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* Évaluations */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-serif text-lg font-bold text-brand-800">{t('Évaluations', 'التقييمات')}</h3>
          <Button variant="soft" size="sm" icon={<Plus className="size-4" />} onClick={() => setEvalOpen(true)}>{t('Ajouter', 'إضافة')}</Button>
        </div>
        {data.evaluations.length === 0 ? (
          <EmptyState icon={<Star className="size-6" />} title={t('Pas encore d’évaluation', 'لا توجد تقييمات بعد')} />
        ) : (
          <ul className="space-y-2.5">
            {data.evaluations.map((e: any) => (
              <EvalRow key={e.id} e={e} onDelete={async () => {
                if (!(await confirm({ title: t('Supprimer cette évaluation ?', 'حذف هذا التقييم؟'), danger: true, confirmLabel: t('Supprimer', 'حذف') }))) return;
                await del(`/evaluations/${e.id}`).catch((er) => toast.error(messageOf(er)));
                refresh(studentId);
              }} />
            ))}
          </ul>
        )}
      </section>

      {data.curve?.length > 1 && (
        <Card>
          <CardTitle icon={<TrendingUp className="size-4" />}>{t('Évolution', 'التطور')}</CardTitle>
          <Curve points={data.curve} />
        </Card>
      )}

      <MemoModal studentId={studentId} item={memo} onClose={() => setMemo(false)} />
      <EvalModal studentId={studentId} open={evalOpen} onClose={() => setEvalOpen(false)} />
      <AssignModal studentId={studentId} open={assign} assigned={data.pathways.map((p: any) => p.pathway.id)} onClose={() => setAssign(false)} />
      <CommentModal step={commentFor} onClose={() => setCommentFor(null)} onSave={(c) => setStatus(commentFor.id, commentFor.status, c)} />
    </div>
  );
}

/* ─────────── Pièces ─────────── */

function Ring({ percent }: { percent: number }) {
  const r = 30;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative size-[76px] shrink-0">
      <svg viewBox="0 0 72 72" className="size-full -rotate-90">
        <circle cx="36" cy="36" r={r} fill="none" strokeWidth="8" className="stroke-sand-200" />
        <circle cx="36" cy="36" r={r} fill="none" strokeWidth="8" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - percent / 100)} className="stroke-gold-500 transition-all duration-700" />
      </svg>
      <span className="num absolute inset-0 grid place-items-center font-serif text-lg font-bold text-brand-800">{percent}%</span>
    </div>
  );
}

/** Trois états : à faire → en cours → acquis (un seul bouton, facile au doigt) */
function StepToggle({ status, onChange }: { status: string; onChange: (s: string) => void }) {
  const { t } = useLocale();
  const next = status === 'TODO' ? 'IN_PROGRESS' : status === 'IN_PROGRESS' ? 'DONE' : 'TODO';
  const cfg = {
    TODO: { icon: <CircleDashed className="size-5" />, cls: 'bg-white text-brand-300', label: t('À faire', 'للإنجاز') },
    IN_PROGRESS: { icon: <Loader className="size-5" />, cls: 'bg-warn-soft text-warn', label: t('En cours', 'جارٍ') },
    DONE: { icon: <Check className="size-5" strokeWidth={3} />, cls: 'bg-ok text-white', label: t('Acquis', 'مكتسب') },
  }[status as 'TODO'];
  return (
    <button type="button" onClick={() => onChange(next)} aria-label={`${cfg.label} → ${next}`} title={cfg.label} className={cn('tap grid size-10 shrink-0 place-items-center rounded-xl shadow-card transition active:scale-95', cfg.cls)}>
      {cfg.icon}
    </button>
  );
}

function EvalRow({ e, onDelete }: { e: any; onDelete: () => void }) {
  const { t, date, num } = useLocale();
  return (
    <li>
      <Card className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={apprTone(e.appreciation)}>{apprLabel(e.appreciation, t)}</Badge>
            {e.score != null && <span className="num font-serif font-bold text-brand-800">{num(e.score)}/100</span>}
            <span className="text-xs text-brand-400">{date(e.date)}</span>
          </div>
          {e.comment && <p className="mt-1.5 text-sm text-brand-600">{e.comment}</p>}
        </div>
        <IconButton label={t('Supprimer', 'حذف')} className="!size-9" onClick={onDelete}><Trash2 className="size-4" /></IconButton>
      </Card>
    </li>
  );
}

function Curve({ points }: { points: Array<{ date: string; percent: number }> }) {
  const w = 300, h = 90, pad = 6;
  const xs = (i: number) => pad + (i * (w - 2 * pad)) / Math.max(points.length - 1, 1);
  const ys = (p: number) => h - pad - (p / 100) * (h - 2 * pad);
  const d = points.map((p, i) => `${i ? 'L' : 'M'}${xs(i).toFixed(1)},${ys(p.percent).toFixed(1)}`).join(' ');
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-24 w-full" role="img" aria-label="Évolution">
      <path d={`${d} L${xs(points.length - 1)},${h - pad} L${xs(0)},${h - pad} Z`} className="fill-gold-200/60" />
      <path d={d} fill="none" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="stroke-gold-600" />
    </svg>
  );
}

/* ─────────── Fenêtres ─────────── */

function MemoModal({ studentId, item, onClose }: { studentId: string; item: any | null | false; onClose: () => void }) {
  const { t, isAr, num } = useLocale();
  const toast = useToast();
  const surahs = useApi<any[]>('/reference/surahs', undefined, { revalidateOnFocus: false });
  const open = item !== false;
  const editing = !!item;
  const [surah, setSurah] = useState('');
  const [verse, setVerse] = useState('');
  const [status, setStatus] = useState<'auto' | 'IN_PROGRESS' | 'VALIDATED'>('auto');
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [seed, setSeed] = useState<any>(undefined);
  if (open && seed !== item) {
    setSeed(item);
    setSurah(item ? String(item.surah) : '');
    setVerse(item ? String(item.verse) : '');
    setStatus('auto');
    setComment(item?.comment || '');
    setErr(null);
  }
  if (!open && seed !== undefined) setSeed(undefined);
  const info = surahs.data?.find((s) => String(s.number) === surah);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await put(`/students/${studentId}/memorization`, { surah: Number(surah), verse: Number(verse || 0), status: status === 'auto' ? undefined : status, comment: comment.trim() || undefined });
      await refresh(studentId);
      toast.ok(t('Mémorisation enregistrée', 'تم حفظ التقدّم'));
      onClose();
    } catch (er) {
      setErr(messageOf(er));
    } finally {
      setBusy(false);
    }
  }
  async function remove() {
    setBusy(true);
    try {
      await del(`/students/${studentId}/memorization/${surah}`);
      await refresh(studentId);
      onClose();
    } catch (er) {
      setErr(messageOf(er));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal open={open} onClose={onClose} title={editing ? t('Mettre à jour la sourate', 'تحديث السورة') : t('Ajouter une sourate', 'إضافة سورة')}>
      <form onSubmit={save} className="space-y-4">
        <SelectField label={t('Sourate', 'السورة')} required value={surah} disabled={editing} onChange={(e) => setSurah(e.target.value)}>
          <option value="">—</option>
          {surahs.data?.map((s) => (
            <option key={s.number} value={s.number}>{num(s.number)}. {isAr ? s.nameAr : s.nameLatin} ({num(s.verses)})</option>
          ))}
        </SelectField>
        <TextField label={info ? t(`Dernier verset atteint (sur ${info.verses})`, `آخر آية وصل إليها (من ${info.verses})`) : t('Dernier verset atteint', 'آخر آية وصل إليها')} type="number" min={0} max={info?.verses} inputMode="numeric" dir="ltr" value={verse} onChange={(e) => setVerse(e.target.value)} className="[&_input]:text-start" />
        <Field label={t('État', 'الحالة')}>
          <Chips value={status} onChange={setStatus} options={[{ value: 'auto', label: t('Automatique', 'تلقائي') }, { value: 'IN_PROGRESS', label: t('En cours', 'جارية') }, { value: 'VALIDATED', label: t('Validée', 'مثبّتة') }]} />
        </Field>
        <TextareaField label={t('Commentaire', 'تعليق')} rows={2} value={comment} onChange={(e) => setComment(e.target.value)} />
        {err && <Notice tone="bad">{err}</Notice>}
        <div className="flex justify-between gap-2">
          {editing ? <Button variant="ghost" className="text-bad" onClick={remove} icon={<Trash2 className="size-4" />}>{t('Retirer', 'إزالة')}</Button> : <span />}
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose}>{t('Annuler', 'إلغاء')}</Button>
            <Button type="submit" variant="primary" loading={busy}>{t('Enregistrer', 'حفظ')}</Button>
          </div>
        </div>
      </form>
    </Modal>
  );
}

function EvalModal({ studentId, open, onClose }: { studentId: string; open: boolean; onClose: () => void }) {
  const { t } = useLocale();
  const toast = useToast();
  const [appr, setAppr] = useState<string>('GOOD');
  const [score, setScore] = useState('');
  const [comment, setComment] = useState('');
  const [date, setDate] = useState(todayISO());
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [was, setWas] = useState(false);
  if (open && !was) {
    setWas(true);
    setAppr('GOOD');
    setScore('');
    setComment('');
    setDate(todayISO());
    setErr(null);
  }
  if (!open && was) setWas(false);
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await post(`/students/${studentId}/evaluations`, { appreciation: appr, score: score ? Number(score.replace(',', '.')) : undefined, comment: comment.trim() || undefined, date });
      await refresh(studentId);
      toast.ok(t('Évaluation ajoutée', 'تمت إضافة التقييم'));
      onClose();
    } catch (er) {
      setErr(messageOf(er));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal open={open} onClose={onClose} title={t('Nouvelle évaluation', 'تقييم جديد')}>
      <form onSubmit={save} className="space-y-4">
        <Field label={t('Appréciation', 'التقدير')}>
          <Chips value={appr} onChange={setAppr} options={APPR.map((a) => ({ value: a, label: apprLabel(a, t) }))} />
        </Field>
        <TextField label={t('Note sur 100', 'العلامة من 100')} hint={t('Facultatif', 'اختياري')} inputMode="decimal" dir="ltr" value={score} onChange={(e) => setScore(e.target.value)} className="[&_input]:text-start" />
        <TextField label={t('Date', 'التاريخ')} type="date" dir="ltr" value={date} onChange={(e) => setDate(e.target.value)} className="[&_input]:text-start" />
        <TextareaField label={t('Commentaire', 'تعليق')} rows={3} value={comment} onChange={(e) => setComment(e.target.value)} />
        {err && <Notice tone="bad">{err}</Notice>}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>{t('Annuler', 'إلغاء')}</Button>
          <Button type="submit" variant="primary" loading={busy}>{t('Enregistrer', 'حفظ')}</Button>
        </div>
      </form>
    </Modal>
  );
}

function AssignModal({ studentId, open, assigned, onClose }: { studentId: string; open: boolean; assigned: string[]; onClose: () => void }) {
  const { t, pick } = useLocale();
  const toast = useToast();
  const { data } = useApi<any[]>(open ? '/pathways' : null);
  const list = (data || []).filter((p) => !assigned.includes(p.id));
  async function add(id: string) {
    try {
      await post(`/students/${studentId}/pathways`, { pathwayId: id });
      await refresh(studentId);
      onClose();
    } catch (e) {
      toast.error(messageOf(e));
    }
  }
  return (
    <Modal open={open} onClose={onClose} title={t('Affecter un parcours', 'إسناد مسار')}>
      {list.length === 0 ? (
        <p className="text-sm text-brand-500">{t('Tous les parcours disponibles sont déjà affectés.', 'كل المسارات المتاحة مُسندة مسبقاً.')}</p>
      ) : (
        <ul className="space-y-2">
          {list.map((p) => (
            <li key={p.id}>
              <button type="button" onClick={() => add(p.id)} className="tap flex w-full items-center justify-between rounded-2xl bg-sand-100 px-4 py-3 text-start hover:bg-brand-50">
                <span className="font-semibold text-brand-800">{pick(p.titleFr, p.titleAr)}</span>
                <Badge>{p.steps.length}</Badge>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}

function CommentModal({ step, onClose, onSave }: { step: any | null; onClose: () => void; onSave: (c: string) => Promise<void> | void }) {
  const { t, pick } = useLocale();
  const [text, setText] = useState('');
  const [seed, setSeed] = useState<any>(null);
  if (step && seed !== step) {
    setSeed(step);
    setText(step.comment || '');
  }
  if (!step && seed) setSeed(null);
  return (
    <Modal open={!!step} onClose={onClose} title={step ? pick(step.titleFr, step.titleAr) : ''}>
      <div className="space-y-4">
        <TextareaField label={t('Commentaire sur cette étape', 'تعليق على هذه المرحلة')} rows={3} value={text} onChange={(e) => setText(e.target.value)} />
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>{t('Annuler', 'إلغاء')}</Button>
          <Button variant="primary" onClick={async () => { await onSave(text); onClose(); }}>{t('Enregistrer', 'حفظ')}</Button>
        </div>
      </div>
    </Modal>
  );
}
