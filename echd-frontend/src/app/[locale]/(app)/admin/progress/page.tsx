'use client';

import { ArrowDown, ArrowUp, ListChecks, Pencil, Plus, Trash2, TrendingUp } from 'lucide-react';
import { useEffect, useState } from 'react';
import { ClassOverview } from '@/components/app/class-overview';
import { Button, IconButton } from '@/components/ui/button';
import { Badge, Card, PageHeader, Tabs } from '@/components/ui/display';
import { EmptyState, ErrorState, Modal, Notice, SkeletonCards, useConfirm, useToast } from '@/components/ui/feedback';
import { Field, Select, SelectField, Switch, TextField, TextareaField } from '@/components/ui/form';
import { api, del } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { invalidate, messageOf, useApi } from '@/lib/hooks';
import { useLocale } from '@/lib/i18n';
import { useLookups } from '@/lib/lookups';
import { useUrlState } from '@/lib/url-state';

export default function ProgressPage() {
  const { t } = useLocale();
  const [f, set] = useUrlState({ tab: 'class', classId: '' });
  return (
    <div>
      <PageHeader title={t('Progression', 'التقدّم')} subtitle={t('Suivi pédagogique des élèves et parcours d’apprentissage.', 'المتابعة التربوية للطلاب ومسارات التعلّم.')} />
      <Tabs value={f.tab as 'class' | 'pathways'} onChange={(v) => set({ tab: v })} tabs={[{ value: 'class', label: t('Par classe', 'حسب القسم') }, { value: 'pathways', label: t('Parcours', 'المسارات') }]} />
      {f.tab === 'pathways' ? <Pathways /> : <ByClass classId={f.classId} onPick={(id) => set({ classId: id })} />}
    </div>
  );
}

function ByClass({ classId, onPick }: { classId: string; onPick: (id: string) => void }) {
  const { t } = useLocale();
  const classes = useApi<any[]>('/classes', { active: 'true' });
  return (
    <div className="space-y-4">
      <Select value={classId} onChange={(e) => onPick(e.target.value)} aria-label={t('Classe', 'القسم')}>
        <option value="">{t('Choisir une classe…', 'اختر قسماً…')}</option>
        {classes.data?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
      </Select>
      {classId ? <ClassOverview classId={classId} studentBase="/admin/students" /> : <EmptyState icon={<TrendingUp className="size-6" />} title={t('Choisissez une classe', 'اختر قسماً')} text={t('Vous verrez l’avancement de chaque élève.', 'ستظهر لك نسبة تقدّم كل طالب.')} />}
    </div>
  );
}

function Pathways() {
  const { t, pick, num } = useLocale();
  const { isAdmin } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const { data, error, loading, reload } = useApi<any[]>('/pathways', { all: 'true' });
  const [form, setForm] = useState<{ open: boolean; p: any | null }>({ open: false, p: null });

  async function remove(p: any) {
    if (!(await confirm({ title: t('Supprimer ce parcours ?', 'حذف هذا المسار؟'), message: t('La progression des élèves sur ce parcours sera perdue. Désactivez-le plutôt si vous voulez le garder.', 'سيضيع تقدّم الطلاب في هذا المسار. عطّله إن أردت الاحتفاظ به.'), danger: true, confirmLabel: t('Supprimer', 'حذف') }))) return;
    try {
      await del(`/pathways/${p.id}`);
      await invalidate('/pathways');
    } catch (e) {
      toast.error(messageOf(e));
    }
  }

  return (
    <div>
      {isAdmin && <div className="mb-4 flex justify-end"><Button variant="primary" icon={<Plus className="size-4" />} onClick={() => setForm({ open: true, p: null })}>{t('Nouveau parcours', 'مسار جديد')}</Button></div>}
      {error ? (
        <ErrorState message={error.message} onRetry={reload} />
      ) : loading || !data ? (
        <SkeletonCards n={3} />
      ) : data.length === 0 ? (
        <EmptyState icon={<ListChecks className="size-6" />} title={t('Aucun parcours', 'لا توجد مسارات')} />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {data.map((p) => (
            <Card key={p.id} className={p.active ? '' : 'opacity-60'}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-serif font-bold text-brand-800">{pick(p.titleFr, p.titleAr)}</p>
                  {p.course && pick(p.course.titleFr, p.course.titleAr) !== pick(p.titleFr, p.titleAr) && <p className="text-xs text-brand-400">{pick(p.course.titleFr, p.course.titleAr)}</p>}
                </div>
                {isAdmin && (
                  <div className="flex gap-1">
                    <IconButton label={t('Modifier', 'تعديل')} className="!size-9" onClick={() => setForm({ open: true, p })}><Pencil className="size-4" /></IconButton>
                    <IconButton label={t('Supprimer', 'حذف')} className="!size-9" onClick={() => remove(p)}><Trash2 className="size-4" /></IconButton>
                  </div>
                )}
              </div>
              <ol className="mt-3 space-y-1">
                {p.steps.map((s: any, i: number) => (
                  <li key={s.id} className="flex items-center gap-2.5 text-sm text-brand-600"><span className="num grid size-5 shrink-0 place-items-center rounded-full bg-brand-50 text-xs font-bold text-brand-500">{i + 1}</span> {pick(s.titleFr, s.titleAr || s.titleFr)}</li>
                ))}
              </ol>
              <div className="mt-3 flex gap-1.5">
                <Badge tone="info">{t(`${num(p.steps.length)} étapes`, `${num(p.steps.length)} مراحل`)}</Badge>
                <Badge>{t(`${num(p._count.students)} élève(s)`, `${num(p._count.students)} طالب`)}</Badge>
                {!p.active && <Badge tone="warn">{t('Inactif', 'غير نشط')}</Badge>}
              </div>
            </Card>
          ))}
        </div>
      )}
      <PathwayForm open={form.open} pathway={form.p} onClose={() => setForm({ open: false, p: null })} />
    </div>
  );
}

interface StepRow { id?: string; titleFr: string; titleAr: string }

function PathwayForm({ open, pathway, onClose }: { open: boolean; pathway: any | null; onClose: () => void }) {
  const { t, pick } = useLocale();
  const toast = useToast();
  const { lk } = useLookups();
  const [f, setF] = useState<any>({});
  const [steps, setSteps] = useState<StepRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    if (!open) return;
    setErr(null);
    setF({ titleFr: pathway?.titleFr || '', titleAr: pathway?.titleAr || '', descriptionFr: pathway?.descriptionFr || '', courseId: pathway?.courseId || '', active: pathway?.active ?? true });
    setSteps(pathway ? pathway.steps.map((s: any) => ({ id: s.id, titleFr: s.titleFr, titleAr: s.titleAr || '' })) : [{ titleFr: '', titleAr: '' }]);
  }, [open, pathway]);

  const move = (i: number, d: number) => setSteps((s) => { const a = [...s]; const j = i + d; if (j < 0 || j >= a.length) return a; [a[i], a[j]] = [a[j], a[i]]; return a; });

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const body: any = { titleFr: f.titleFr.trim(), titleAr: f.titleAr.trim(), descriptionFr: f.descriptionFr, courseId: f.courseId || (pathway ? null : undefined), active: f.active, steps: steps.filter((s) => s.titleFr.trim()).map((s) => ({ id: s.id, titleFr: s.titleFr.trim(), titleAr: s.titleAr.trim() })) };
      if (pathway) await api(`/pathways/${pathway.id}`, { method: 'PATCH', body });
      else await api('/pathways', { method: 'POST', body });
      await invalidate('/pathways', '/students');
      toast.ok(t('Parcours enregistré', 'تم حفظ المسار'));
      onClose();
    } catch (e) {
      setErr(messageOf(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} size="lg" title={pathway ? t('Modifier le parcours', 'تعديل المسار') : t('Nouveau parcours', 'مسار جديد')}>
      <form onSubmit={save} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label={t('Titre (français)', 'العنوان (فرنسي)')} required value={f.titleFr || ''} onChange={(e) => setF({ ...f, titleFr: e.target.value })} />
          <TextField label={t('Titre (arabe)', 'العنوان (عربي)')} dir="rtl" value={f.titleAr || ''} onChange={(e) => setF({ ...f, titleAr: e.target.value })} />
        </div>
        <SelectField label={t('Rattaché au cours', 'مرتبط بالدرس')} hint={t('Les élèves inscrits à ce cours reçoivent automatiquement ce parcours.', 'يُسند هذا المسار تلقائياً للطلاب المسجّلين في هذا الدرس.')} value={f.courseId || ''} onChange={(e) => setF({ ...f, courseId: e.target.value })}>
          <option value="">{t('— Aucun (affectation manuelle) —', '— لا شيء (إسناد يدوي) —')}</option>
          {lk?.courses.map((c) => <option key={c.id} value={c.id}>{pick(c.titleFr, c.titleAr)}</option>)}
        </SelectField>
        <Field label={t('Étapes (dans l’ordre)', 'المراحل (بالترتيب)')}>
          <div className="space-y-2">
            {steps.map((s, i) => (
              <div key={i} className="flex items-start gap-2 rounded-2xl bg-sand-100 p-2.5">
                <span className="num mt-3 grid size-6 shrink-0 place-items-center rounded-full bg-white text-xs font-bold text-brand-500">{i + 1}</span>
                <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-2">
                  <TextField label="" aria-label="FR" placeholder="Français" value={s.titleFr} onChange={(e) => setSteps((a) => a.map((x, j) => (j === i ? { ...x, titleFr: e.target.value } : x)))} />
                  <TextField label="" aria-label="AR" placeholder="العربية" dir="rtl" value={s.titleAr} onChange={(e) => setSteps((a) => a.map((x, j) => (j === i ? { ...x, titleAr: e.target.value } : x)))} />
                </div>
                <div className="flex flex-col">
                  <IconButton label="↑" className="!size-8" onClick={() => move(i, -1)} disabled={i === 0}><ArrowUp className="size-4" /></IconButton>
                  <IconButton label="↓" className="!size-8" onClick={() => move(i, 1)} disabled={i === steps.length - 1}><ArrowDown className="size-4" /></IconButton>
                </div>
                <IconButton label={t('Retirer', 'إزالة')} className="!size-8" onClick={() => setSteps((a) => a.filter((_, j) => j !== i))}><Trash2 className="size-4" /></IconButton>
              </div>
            ))}
            <Button variant="soft" size="sm" icon={<Plus className="size-4" />} onClick={() => setSteps((a) => [...a, { titleFr: '', titleAr: '' }])}>{t('Ajouter une étape', 'إضافة مرحلة')}</Button>
          </div>
          {pathway && <p className="mt-2 text-xs text-warn">{t('Retirer une étape efface la progression enregistrée sur cette étape.', 'إزالة مرحلة تمحو التقدّم المسجّل عليها.')}</p>}
        </Field>
        <Switch checked={!!f.active} onChange={(v) => setF({ ...f, active: v })} label={t('Parcours actif', 'مسار نشط')} />
        {err && <Notice tone="bad">{err}</Notice>}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>{t('Annuler', 'إلغاء')}</Button>
          <Button type="submit" variant="primary" loading={busy}>{t('Enregistrer', 'حفظ')}</Button>
        </div>
      </form>
    </Modal>
  );
}
