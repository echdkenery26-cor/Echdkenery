'use client';

import { BookOpen, Eye, EyeOff, Pencil, Plus, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { COURSE_ICONS, CourseIcon } from '@/components/course-icon';
import { audiencePlural } from '@/components/app/labels';
import { Button, IconButton } from '@/components/ui/button';
import { Badge, Card, PageHeader } from '@/components/ui/display';
import { EmptyState, ErrorState, Modal, Notice, SkeletonCards, useConfirm, useToast } from '@/components/ui/feedback';
import { Chips, Field, SelectField, Switch, TextField, TextareaField } from '@/components/ui/form';
import { api, del } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { invalidate, messageOf, useApi } from '@/lib/hooks';
import { useLocale } from '@/lib/i18n';
import { useLookups } from '@/lib/lookups';
import { cn } from '@/lib/utils';

export default function CoursesPage() {
  const { t, pick } = useLocale();
  const { isAdmin } = useAuth();
  const { data, error, loading, reload } = useApi<any[]>('/courses');
  const [form, setForm] = useState<{ open: boolean; course: any | null }>({ open: false, course: null });
  const toast = useToast();
  const confirm = useConfirm();

  async function remove(c: any) {
    if (!(await confirm({ title: t('Supprimer ce cours ?', 'حذف هذا الدرس؟'), message: t('Impossible si des classes y sont rattachées : masquez-le plutôt.', 'غير ممكن إذا كانت هناك أقسام مرتبطة: أخفِه بدلاً من ذلك.'), danger: true, confirmLabel: t('Supprimer', 'حذف') }))) return;
    try {
      await del(`/courses/${c.id}`);
      await invalidate('/courses', '/lookups', '/public');
      toast.ok(t('Cours supprimé', 'تم حذف الدرس'));
    } catch (e) {
      toast.error(messageOf(e));
    }
  }

  return (
    <div>
      <PageHeader
        title={t('Cours', 'الدروس')}
        subtitle={t('Ce que l’école propose. Les cours visibles apparaissent sur le site public.', 'ما تقدّمه المدرسة. الدروس الظاهرة تعرض في الموقع العام.')}
        actions={isAdmin && <Button variant="primary" icon={<Plus className="size-4" />} onClick={() => setForm({ open: true, course: null })}>{t('Nouveau cours', 'درس جديد')}</Button>}
      />
      {error ? (
        <ErrorState message={error.message} onRetry={reload} />
      ) : loading || !data ? (
        <SkeletonCards n={4} />
      ) : data.length === 0 ? (
        <EmptyState icon={<BookOpen className="size-6" />} title={t('Aucun cours', 'لا توجد دروس')} />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {data.map((c) => (
            <Card key={c.id} className={cn(!c.active && 'opacity-60')}>
              <div className="flex items-start gap-3.5">
                <span className="grid size-12 shrink-0 place-items-center rounded-2xl text-white" style={{ background: c.color || '#1F4A3A' }}><CourseIcon name={c.icon} className="size-6" /></span>
                <div className="min-w-0 flex-1">
                  <p className="font-serif text-lg font-bold leading-tight text-brand-800">{pick(c.titleFr, c.titleAr)}</p>
                  <p dir={pick('ltr', 'rtl')} className="truncate text-sm text-brand-400">{pick(c.titleAr, c.titleFr)}</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <Badge tone="info">{audiencePlural(c.audience, t)}</Badge>
                    {c.level && <Badge tone="gold">{pick(c.level.labelFr, c.level.labelAr)}</Badge>}
                    {c.minAge != null && c.minAge > 0 && <Badge>{c.minAge}+ {t('ans', 'سنة')}</Badge>}
                    <Badge tone={c.visible ? 'ok' : 'neutral'}>{c.visible ? <><Eye className="me-1 inline size-3" />{t('Sur le site', 'ظاهر')}</> : <><EyeOff className="me-1 inline size-3" />{t('Masqué', 'مخفي')}</>}</Badge>
                    {!c.active && <Badge tone="warn">{t('Inactif', 'غير نشط')}</Badge>}
                  </div>
                  <p className="mt-2 text-xs text-brand-400">{t(`${c._count.classes} classe(s)`, `${c._count.classes} قسم`)}</p>
                </div>
                {isAdmin && (
                  <div className="flex flex-col gap-1">
                    <IconButton label={t('Modifier', 'تعديل')} className="!size-9" onClick={() => setForm({ open: true, course: c })}><Pencil className="size-4" /></IconButton>
                    <IconButton label={t('Supprimer', 'حذف')} className="!size-9" onClick={() => remove(c)}><Trash2 className="size-4" /></IconButton>
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
      <CourseForm open={form.open} course={form.course} onClose={() => setForm({ open: false, course: null })} />
    </div>
  );
}

const COLORS = ['#1F4A3A', '#2F6B52', '#B8943A', '#7A5C1E', '#2B5C8A', '#7B3F61', '#8A3B2B', '#4A4A4A'];

function CourseForm({ open, course, onClose }: { open: boolean; course: any | null; onClose: () => void }) {
  const { t, pick } = useLocale();
  const toast = useToast();
  const { lk } = useLookups();
  const [f, setF] = useState<any>({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setErr(null);
    setF({
      titleFr: course?.titleFr || '',
      titleAr: course?.titleAr || '',
      audience: course?.audience || 'CHILD',
      category: course?.category || '',
      levelId: course?.levelId || '',
      minAge: course?.minAge != null ? String(course.minAge) : '',
      descriptionFr: course?.descriptionFr || '',
      descriptionAr: course?.descriptionAr || '',
      keyPointsFr: (course?.keyPointsFr || []).join('\n'),
      keyPointsAr: (course?.keyPointsAr || []).join('\n'),
      icon: course?.icon || 'book-open',
      color: course?.color || '#1F4A3A',
      visible: course?.visible ?? true,
      active: course?.active ?? true,
    });
  }, [open, course]);

  const lines = (s: string) => s.split('\n').map((x) => x.trim()).filter(Boolean);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const body = {
        titleFr: f.titleFr.trim(),
        titleAr: f.titleAr.trim(),
        audience: f.audience,
        category: f.category.trim() || undefined,
        levelId: f.levelId || undefined,
        minAge: f.minAge !== '' ? Number(f.minAge) : undefined,
        descriptionFr: f.descriptionFr,
        descriptionAr: f.descriptionAr,
        keyPointsFr: lines(f.keyPointsFr),
        keyPointsAr: lines(f.keyPointsAr),
        icon: f.icon,
        color: f.color,
        visible: f.visible,
        active: f.active,
      };
      if (course) await api(`/courses/${course.id}`, { method: 'PATCH', body });
      else await api('/courses', { method: 'POST', body });
      await invalidate('/courses', '/lookups', '/public');
      toast.ok(t('Cours enregistré', 'تم حفظ الدرس'));
      onClose();
    } catch (e) {
      setErr(messageOf(e));
    } finally {
      setBusy(false);
    }
  }
  const set = (k: string, v: any) => setF((p: any) => ({ ...p, [k]: v }));

  return (
    <Modal open={open} onClose={onClose} size="lg" title={course ? t('Modifier le cours', 'تعديل الدرس') : t('Nouveau cours', 'درس جديد')}>
      <form onSubmit={save} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label={t('Titre (français)', 'العنوان (فرنسي)')} required value={f.titleFr || ''} onChange={(e) => set('titleFr', e.target.value)} />
          <TextField label={t('Titre (arabe)', 'العنوان (عربي)')} dir="rtl" value={f.titleAr || ''} onChange={(e) => set('titleAr', e.target.value)} />
        </div>
        <Field label={t('Public', 'الفئة')}>
          <Chips value={f.audience || 'CHILD'} onChange={(v) => set('audience', v)} options={[{ value: 'CHILD', label: t('Enfants', 'الأطفال') }, { value: 'ADULT', label: t('Adultes', 'الكبار') }]} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-3">
          <TextField label={t('Catégorie', 'الفئة الدراسية')} hint={t('Ex. Coran, Arabe', 'مثال: قرآن، عربية')} value={f.category || ''} onChange={(e) => set('category', e.target.value)} />
          <SelectField label={t('Niveau visé', 'المستوى المستهدف')} value={f.levelId || ''} onChange={(e) => set('levelId', e.target.value)}>
            <option value="">—</option>
            {lk?.levels.map((l) => <option key={l.id} value={l.id}>{pick(l.labelFr, l.labelAr)}</option>)}
          </SelectField>
          <TextField label={t('Âge minimum', 'الحد الأدنى للعمر')} type="number" min={0} max={99} dir="ltr" value={f.minAge ?? ''} onChange={(e) => set('minAge', e.target.value)} className="[&_input]:text-start" />
        </div>
        <TextareaField label={t('Description (français)', 'الوصف (فرنسي)')} rows={3} value={f.descriptionFr || ''} onChange={(e) => set('descriptionFr', e.target.value)} />
        <TextareaField label={t('Description (arabe)', 'الوصف (عربي)')} rows={3} dir="rtl" value={f.descriptionAr || ''} onChange={(e) => set('descriptionAr', e.target.value)} />
        <div className="grid gap-4 sm:grid-cols-2">
          <TextareaField label={t('Points clés (FR)', 'النقاط الرئيسية (فرنسي)')} hint={t('Un point par ligne', 'نقطة في كل سطر')} rows={4} value={f.keyPointsFr || ''} onChange={(e) => set('keyPointsFr', e.target.value)} />
          <TextareaField label={t('Points clés (AR)', 'النقاط الرئيسية (عربي)')} rows={4} dir="rtl" value={f.keyPointsAr || ''} onChange={(e) => set('keyPointsAr', e.target.value)} />
        </div>
        <Field label={t('Icône', 'الأيقونة')}>
          <div className="flex flex-wrap gap-2">
            {Object.keys(COURSE_ICONS).map((k) => (
              <button key={k} type="button" aria-label={k} aria-pressed={f.icon === k} onClick={() => set('icon', k)} className={cn('tap grid size-11 place-items-center rounded-xl transition', f.icon === k ? 'bg-brand-600 text-white shadow-lift' : 'bg-sand-100 text-brand-600 hover:bg-brand-50')}>
                <CourseIcon name={k} className="size-5" />
              </button>
            ))}
          </div>
        </Field>
        <Field label={t('Couleur', 'اللون')}>
          <div className="flex flex-wrap gap-2">
            {COLORS.map((c) => (
              <button key={c} type="button" aria-label={c} aria-pressed={f.color === c} onClick={() => set('color', c)} style={{ background: c }} className={cn('size-9 rounded-full ring-offset-2 transition', f.color === c ? 'ring-2 ring-brand-700' : 'hover:scale-110')} />
            ))}
          </div>
        </Field>
        <div className="space-y-3">
          <Switch checked={!!f.visible} onChange={(v) => set('visible', v)} label={t('Visible sur le site public', 'ظاهر في الموقع العام')} />
          <Switch checked={!!f.active} onChange={(v) => set('active', v)} label={t('Cours actif', 'درس نشط')} hint={t('Un cours inactif ne peut plus recevoir de nouvelles classes.', 'لا يمكن إضافة أقسام جديدة لدرس غير نشط.')} />
        </div>
        {err && <Notice tone="bad">{err}</Notice>}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>{t('Annuler', 'إلغاء')}</Button>
          <Button type="submit" variant="primary" loading={busy}>{t('Enregistrer', 'حفظ')}</Button>
        </div>
      </form>
    </Modal>
  );
}
