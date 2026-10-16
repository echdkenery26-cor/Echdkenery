'use client';

import { CalendarDays, CalendarPlus, Copy, DoorOpen, Download, Layers, Pencil, Plus, Star, Trash2, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button, IconButton } from '@/components/ui/button';
import { Badge, Card, CardTitle } from '@/components/ui/display';
import { EmptyState, ErrorState, Modal, Notice, SkeletonCards, useConfirm, useToast } from '@/components/ui/feedback';
import { SelectField, Switch, TextField } from '@/components/ui/form';
import { api, del, download, post } from '@/lib/api';
import { invalidate, messageOf, useApi } from '@/lib/hooks';
import { useLocale } from '@/lib/i18n';
import { addDaysISO } from '@/lib/locale';

const refresh = () => invalidate('/school-years', '/lookups', '/classes', '/rooms', '/levels', '/timetable');

/* ═════════════ Années scolaires ═════════════ */

export function SchoolYears() {
  const { t, date, num } = useLocale();
  const toast = useToast();
  const confirm = useConfirm();
  const { data, error, loading, reload } = useApi<any[]>('/school-years');
  const [form, setForm] = useState<{ open: boolean; y: any | null }>({ open: false, y: null });
  const [dup, setDup] = useState<any | null>(null);
  const [closure, setClosure] = useState<any | null>(null);

  async function setCurrent(y: any) {
    try {
      await post(`/school-years/${y.id}/set-current`);
      await refresh();
      toast.ok(t('Année courante modifiée', 'تم تغيير السنة الحالية'));
    } catch (e) {
      toast.error(messageOf(e));
    }
  }
  async function remove(y: any) {
    if (!(await confirm({ title: t(`Supprimer ${y.name} ?`, `حذف ${y.name}؟`), danger: true, confirmLabel: t('Supprimer', 'حذف') }))) return;
    try {
      await del(`/school-years/${y.id}`);
      await refresh();
    } catch (e) {
      toast.error(messageOf(e));
    }
  }
  async function removeClosure(c: any) {
    try {
      await del(`/closures/${c.id}`);
      await refresh();
    } catch (e) {
      toast.error(messageOf(e));
    }
  }

  if (error) return <ErrorState message={error.message} onRetry={reload} />;
  if (loading || !data) return <SkeletonCards n={2} />;

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Button variant="primary" icon={<Plus className="size-4" />} onClick={() => setForm({ open: true, y: null })}>{t('Nouvelle année', 'سنة جديدة')}</Button>
      </div>
      {data.length === 0 ? (
        <EmptyState icon={<CalendarDays className="size-6" />} title={t('Aucune année scolaire', 'لا توجد سنوات دراسية')} />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {data.map((y) => (
            <Card key={y.id} className={y.isCurrent ? 'ring-2 ring-gold-500/60' : ''}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-serif text-lg font-bold text-brand-800">{y.name}</p>
                  <p className="text-xs text-brand-400">{date(y.startDate)} → {date(y.endDate)}</p>
                </div>
                <div className="flex items-center gap-1">
                  {y.isCurrent && <Badge tone="gold"><Star className="size-3" /> {t('Année en cours', 'السنة الحالية')}</Badge>}
                  <IconButton label={t('Modifier', 'تعديل')} className="!size-9" onClick={() => setForm({ open: true, y })}><Pencil className="size-4" /></IconButton>
                </div>
              </div>
              <p className="mt-2 text-sm text-brand-500">{t(`${num(y._count.classes)} classe(s)`, `${num(y._count.classes)} قسم`)}</p>

              <div className="mt-3">
                <p className="mb-1.5 text-sm font-semibold text-brand-700">{t('Vacances et jours fermés', 'العطل والأيام المغلقة')}</p>
                {y.closures.length === 0 ? (
                  <p className="text-sm text-brand-400">{t('Aucune période enregistrée.', 'لا توجد فترات مسجّلة.')}</p>
                ) : (
                  <ul className="space-y-1.5">
                    {y.closures.map((c: any) => (
                      <ClosureRow key={c.id} c={c} onRemove={() => removeClosure(c)} />
                    ))}
                  </ul>
                )}
                <Button className="mt-2" size="sm" variant="soft" icon={<CalendarPlus className="size-4" />} onClick={() => setClosure({ yearId: y.id })}>{t('Ajouter une période', 'إضافة فترة')}</Button>
              </div>

              <div className="mt-4 flex flex-wrap gap-1.5 border-t border-sand-200 pt-3">
                {!y.isCurrent && <Button size="sm" variant="dark" onClick={() => setCurrent(y)}>{t('Définir comme année en cours', 'تعيينها سنة حالية')}</Button>}
                <Button size="sm" variant="outline" icon={<Copy className="size-4" />} onClick={() => setDup(y)}>{t('Préparer la rentrée', 'التحضير للدخول')}</Button>
                {!y.isCurrent && y._count.classes === 0 && <Button size="sm" variant="ghost" className="text-bad" icon={<Trash2 className="size-4" />} onClick={() => remove(y)}>{t('Supprimer', 'حذف')}</Button>}
              </div>
            </Card>
          ))}
        </div>
      )}
      <YearForm open={form.open} y={form.y} onClose={() => setForm({ open: false, y: null })} />
      <DuplicateForm y={dup} onClose={() => setDup(null)} />
      <ClosureForm target={closure} onClose={() => setClosure(null)} />
    </div>
  );
}

function ClosureRow({ c, onRemove }: { c: any; onRemove: () => void }) {
  const { t, pick, date } = useLocale();
  const same = c.startDate.slice(0, 10) === c.endDate.slice(0, 10);
  return (
    <li className="flex items-center gap-2 rounded-xl bg-sand-100 px-3 py-2">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-brand-700">{pick(c.labelFr, c.labelAr || c.labelFr)}</p>
        <p className="text-xs text-brand-400">{same ? date(c.startDate) : `${date(c.startDate)} → ${date(c.endDate)}`}</p>
      </div>
      <Badge tone={c.type === 'HOLIDAY' ? 'info' : 'warn'}>{c.type === 'HOLIDAY' ? t('Vacances', 'عطلة') : t('Fermé', 'مغلق')}</Badge>
      <button type="button" aria-label={t('Retirer', 'إزالة')} className="grid size-8 place-items-center rounded-lg text-brand-400 hover:bg-white" onClick={onRemove}><X className="size-4" /></button>
    </li>
  );
}

function YearForm({ open, y, onClose }: { open: boolean; y: any | null; onClose: () => void }) {
  const { t } = useLocale();
  const toast = useToast();
  const [f, setF] = useState<any>({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    if (!open) return;
    setErr(null);
    setF({ name: y?.name || '', startDate: y?.startDate?.slice(0, 10) || '', endDate: y?.endDate?.slice(0, 10) || '', isCurrent: false });
  }, [open, y]);
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (y) await api(`/school-years/${y.id}`, { method: 'PATCH', body: { name: f.name.trim(), startDate: f.startDate, endDate: f.endDate } });
      else await api('/school-years', { method: 'POST', body: { name: f.name.trim(), startDate: f.startDate, endDate: f.endDate, isCurrent: f.isCurrent } });
      await refresh();
      toast.ok(t('Année enregistrée', 'تم حفظ السنة'));
      onClose();
    } catch (e) {
      setErr(messageOf(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal open={open} onClose={onClose} title={y ? t('Modifier l’année', 'تعديل السنة') : t('Nouvelle année scolaire', 'سنة دراسية جديدة')}>
      <form onSubmit={save} className="space-y-4">
        <TextField label={t('Nom', 'الاسم')} required placeholder="2026-2027" value={f.name || ''} onChange={(e) => setF({ ...f, name: e.target.value })} />
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label={t('Début', 'البداية')} type="date" required dir="ltr" value={f.startDate || ''} onChange={(e) => setF({ ...f, startDate: e.target.value })} className="[&_input]:text-start" />
          <TextField label={t('Fin', 'النهاية')} type="date" required dir="ltr" value={f.endDate || ''} onChange={(e) => setF({ ...f, endDate: e.target.value })} className="[&_input]:text-start" />
        </div>
        {!y && <Switch checked={!!f.isCurrent} onChange={(v) => setF({ ...f, isCurrent: v })} label={t('Définir comme année en cours', 'تعيينها سنة حالية')} />}
        {err && <Notice tone="bad">{err}</Notice>}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>{t('Annuler', 'إلغاء')}</Button>
          <Button type="submit" variant="primary" loading={busy}>{t('Enregistrer', 'حفظ')}</Button>
        </div>
      </form>
    </Modal>
  );
}

function DuplicateForm({ y, onClose }: { y: any | null; onClose: () => void }) {
  const { t, num } = useLocale();
  const toast = useToast();
  const [f, setF] = useState<any>({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    if (!y) return;
    setErr(null);
    const [a, b] = String(y.name).match(/\d{4}/g)?.map(Number) || [];
    setF({
      name: a && b ? `${a + 1}-${b + 1}` : `${y.name} (2)`,
      startDate: addDaysISO(y.startDate.slice(0, 10), 365),
      endDate: addDaysISO(y.endDate.slice(0, 10), 365),
      copyClasses: true,
      makeCurrent: false,
    });
  }, [y]);
  async function go(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await post(`/school-years/${y.id}/duplicate`, { name: f.name.trim(), startDate: f.startDate, endDate: f.endDate, copyClasses: f.copyClasses, makeCurrent: f.makeCurrent });
      await refresh();
      toast.ok(t(`Année créée : ${num(r.classes)} classe(s) copiée(s)`, `تم إنشاء السنة: نُسخ ${num(r.classes)} قسم`));
      onClose();
    } catch (e) {
      setErr(messageOf(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal open={!!y} onClose={onClose} title={t('Préparer la rentrée', 'التحضير للدخول المدرسي')}>
      <form onSubmit={go} className="space-y-4">
        <Notice>{t(`Crée une nouvelle année à partir de « ${y?.name} ». Les élèves ne sont pas copiés : il faudra les réinscrire.`, `تُنشئ سنة جديدة انطلاقاً من «${y?.name}». لا يُنسخ الطلاب: يجب إعادة تسجيلهم.`)}</Notice>
        <TextField label={t('Nom de la nouvelle année', 'اسم السنة الجديدة')} required value={f.name || ''} onChange={(e) => setF({ ...f, name: e.target.value })} />
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label={t('Début', 'البداية')} type="date" required dir="ltr" value={f.startDate || ''} onChange={(e) => setF({ ...f, startDate: e.target.value })} className="[&_input]:text-start" />
          <TextField label={t('Fin', 'النهاية')} type="date" required dir="ltr" value={f.endDate || ''} onChange={(e) => setF({ ...f, endDate: e.target.value })} className="[&_input]:text-start" />
        </div>
        <Switch checked={!!f.copyClasses} onChange={(v) => setF({ ...f, copyClasses: v })} label={t('Copier les classes et leurs créneaux', 'نسخ الأقسام وحصصها')} hint={t('Enseignant, salle, capacité et horaires.', 'المعلّم والقاعة والسعة والمواعيد.')} />
        <Switch checked={!!f.makeCurrent} onChange={(v) => setF({ ...f, makeCurrent: v })} label={t('Définir comme année en cours', 'تعيينها سنة حالية')} />
        {err && <Notice tone="bad">{err}</Notice>}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>{t('Annuler', 'إلغاء')}</Button>
          <Button type="submit" variant="primary" loading={busy}>{t('Créer l’année', 'إنشاء السنة')}</Button>
        </div>
      </form>
    </Modal>
  );
}

function ClosureForm({ target, onClose }: { target: { yearId: string } | null; onClose: () => void }) {
  const { t } = useLocale();
  const toast = useToast();
  const [f, setF] = useState<any>({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    if (target) {
      setErr(null);
      setF({ type: 'HOLIDAY', labelFr: '', labelAr: '', startDate: '', endDate: '' });
    }
  }, [target]);
  async function go(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await post(`/school-years/${target!.yearId}/closures`, { type: f.type, labelFr: f.labelFr.trim(), labelAr: f.labelAr.trim() || undefined, startDate: f.startDate, endDate: f.endDate || f.startDate });
      await refresh();
      toast.ok(t('Période ajoutée', 'تمت إضافة الفترة'));
      onClose();
    } catch (e) {
      setErr(messageOf(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal open={!!target} onClose={onClose} title={t('Vacances ou jour fermé', 'عطلة أو يوم مغلق')}>
      <form onSubmit={go} className="space-y-4">
        <SelectField label={t('Type', 'النوع')} value={f.type || 'HOLIDAY'} onChange={(e) => setF({ ...f, type: e.target.value })}>
          <option value="HOLIDAY">{t('Vacances', 'عطلة')}</option>
          <option value="CLOSED">{t('Fermeture exceptionnelle', 'إغلاق استثنائي')}</option>
        </SelectField>
        <TextField label={t('Intitulé (français)', 'العنوان (فرنسي)')} required placeholder={t('Vacances de Noël', 'عطلة الشتاء')} value={f.labelFr || ''} onChange={(e) => setF({ ...f, labelFr: e.target.value })} />
        <TextField label={t('Intitulé (arabe)', 'العنوان (عربي)')} dir="rtl" value={f.labelAr || ''} onChange={(e) => setF({ ...f, labelAr: e.target.value })} />
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label={t('Du', 'من')} type="date" required dir="ltr" value={f.startDate || ''} onChange={(e) => setF({ ...f, startDate: e.target.value })} className="[&_input]:text-start" />
          <TextField label={t('Au', 'إلى')} type="date" dir="ltr" hint={t('Vide : un seul jour.', 'فارغ: يوم واحد.')} value={f.endDate || ''} onChange={(e) => setF({ ...f, endDate: e.target.value })} className="[&_input]:text-start" />
        </div>
        <Notice>{t('Aucune séance n’est attendue pendant ces dates : les appels et alertes les ignorent.', 'لا تُنتظر حصص في هذه التواريخ، وتتجاهلها قوائم الحضور والتنبيهات.')}</Notice>
        {err && <Notice tone="bad">{err}</Notice>}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>{t('Annuler', 'إلغاء')}</Button>
          <Button type="submit" variant="primary" loading={busy}>{t('Ajouter', 'إضافة')}</Button>
        </div>
      </form>
    </Modal>
  );
}

/* ═════════════ Salles & niveaux ═════════════ */

export function RoomsAndLevels() {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Rooms />
      <Levels />
    </div>
  );
}

function Rooms() {
  const { t, pick, num } = useLocale();
  const toast = useToast();
  const confirm = useConfirm();
  const { data, error, loading, reload } = useApi<any[]>('/rooms');
  const [form, setForm] = useState<{ open: boolean; r: any | null }>({ open: false, r: null });

  async function remove(r: any) {
    if (!(await confirm({ title: t('Supprimer cette salle ?', 'حذف هذه القاعة؟'), message: r.name, danger: true, confirmLabel: t('Supprimer', 'حذف') }))) return;
    try {
      await del(`/rooms/${r.id}`);
      await refresh();
    } catch (e) {
      toast.error(messageOf(e));
    }
  }
  return (
    <Card>
      <CardTitle icon={<DoorOpen className="size-4" />} action={<Button size="sm" variant="soft" icon={<Plus className="size-4" />} onClick={() => setForm({ open: true, r: null })}>{t('Salle', 'قاعة')}</Button>}>
        {t('Salles', 'القاعات')}
      </CardTitle>
      {error ? (
        <ErrorState message={error.message} onRetry={reload} />
      ) : loading || !data ? (
        <SkeletonCards n={2} />
      ) : data.length === 0 ? (
        <p className="py-4 text-sm text-brand-400">{t('Aucune salle.', 'لا توجد قاعات.')}</p>
      ) : (
        <ul className="space-y-2">
          {data.map((r) => (
            <li key={r.id} className={`flex items-center gap-2 rounded-2xl bg-sand-100 px-3.5 py-2.5 ${r.active ? '' : 'opacity-60'}`}>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-brand-800">{pick(r.name, r.nameAr || r.name)}</p>
                <p className="text-xs text-brand-400">{r.capacity ? t(`${num(r.capacity)} places`, `${num(r.capacity)} مقعداً`) : t('Capacité non précisée', 'السعة غير محدّدة')}{!r.active && ` · ${t('inactive', 'غير نشطة')}`}</p>
              </div>
              <IconButton label={t('Modifier', 'تعديل')} className="!size-9" onClick={() => setForm({ open: true, r })}><Pencil className="size-4" /></IconButton>
              <IconButton label={t('Supprimer', 'حذف')} className="!size-9" onClick={() => remove(r)}><Trash2 className="size-4" /></IconButton>
            </li>
          ))}
        </ul>
      )}
      <RoomForm open={form.open} r={form.r} onClose={() => setForm({ open: false, r: null })} />
    </Card>
  );
}

function RoomForm({ open, r, onClose }: { open: boolean; r: any | null; onClose: () => void }) {
  const { t } = useLocale();
  const [f, setF] = useState<any>({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    if (!open) return;
    setErr(null);
    setF({ name: r?.name || '', nameAr: r?.nameAr || '', capacity: r?.capacity ?? '', active: r?.active ?? true });
  }, [open, r]);
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const body: any = { name: f.name.trim(), nameAr: f.nameAr.trim() || undefined, capacity: f.capacity === '' ? undefined : Number(f.capacity), active: f.active };
      if (r) await api(`/rooms/${r.id}`, { method: 'PATCH', body });
      else await api('/rooms', { method: 'POST', body });
      await refresh();
      onClose();
    } catch (e) {
      setErr(messageOf(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal open={open} onClose={onClose} title={r ? t('Modifier la salle', 'تعديل القاعة') : t('Nouvelle salle', 'قاعة جديدة')}>
      <form onSubmit={save} className="space-y-4">
        <TextField label={t('Nom', 'الاسم')} required value={f.name || ''} onChange={(e) => setF({ ...f, name: e.target.value })} />
        <TextField label={t('Nom (arabe)', 'الاسم (عربي)')} dir="rtl" value={f.nameAr || ''} onChange={(e) => setF({ ...f, nameAr: e.target.value })} />
        <TextField label={t('Capacité', 'السعة')} type="number" min={1} dir="ltr" value={f.capacity ?? ''} onChange={(e) => setF({ ...f, capacity: e.target.value })} className="[&_input]:text-start" />
        <Switch checked={!!f.active} onChange={(v) => setF({ ...f, active: v })} label={t('Salle utilisable', 'قاعة قابلة للاستعمال')} />
        {err && <Notice tone="bad">{err}</Notice>}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>{t('Annuler', 'إلغاء')}</Button>
          <Button type="submit" variant="primary" loading={busy}>{t('Enregistrer', 'حفظ')}</Button>
        </div>
      </form>
    </Modal>
  );
}

function Levels() {
  const { t, pick } = useLocale();
  const toast = useToast();
  const confirm = useConfirm();
  const { data, error, loading, reload } = useApi<any[]>('/levels');
  const [form, setForm] = useState<{ open: boolean; l: any | null }>({ open: false, l: null });

  async function remove(l: any) {
    if (!(await confirm({ title: t('Supprimer ce niveau ?', 'حذف هذا المستوى؟'), message: pick(l.labelFr, l.labelAr || l.labelFr), danger: true, confirmLabel: t('Supprimer', 'حذف') }))) return;
    try {
      await del(`/levels/${l.id}`);
      await refresh();
    } catch (e) {
      toast.error(messageOf(e));
    }
  }
  return (
    <Card>
      <CardTitle icon={<Layers className="size-4" />} action={<Button size="sm" variant="soft" icon={<Plus className="size-4" />} onClick={() => setForm({ open: true, l: null })}>{t('Niveau', 'مستوى')}</Button>}>
        {t('Niveaux', 'المستويات')}
      </CardTitle>
      {error ? (
        <ErrorState message={error.message} onRetry={reload} />
      ) : loading || !data ? (
        <SkeletonCards n={2} />
      ) : data.length === 0 ? (
        <p className="py-4 text-sm text-brand-400">{t('Aucun niveau.', 'لا توجد مستويات.')}</p>
      ) : (
        <ul className="space-y-2">
          {data.map((l) => (
            <li key={l.id} className={`flex items-center gap-2 rounded-2xl bg-sand-100 px-3.5 py-2.5 ${l.active ? '' : 'opacity-60'}`}>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-brand-800">{pick(l.labelFr, l.labelAr || l.labelFr)}</p>
                <p dir="ltr" className="text-start text-xs text-brand-400">{l.code}{!l.active && ` · ${t('inactif', 'غير نشط')}`}</p>
              </div>
              <IconButton label={t('Modifier', 'تعديل')} className="!size-9" onClick={() => setForm({ open: true, l })}><Pencil className="size-4" /></IconButton>
              <IconButton label={t('Supprimer', 'حذف')} className="!size-9" onClick={() => remove(l)}><Trash2 className="size-4" /></IconButton>
            </li>
          ))}
        </ul>
      )}
      <LevelForm open={form.open} l={form.l} onClose={() => setForm({ open: false, l: null })} />
    </Card>
  );
}

function LevelForm({ open, l, onClose }: { open: boolean; l: any | null; onClose: () => void }) {
  const { t } = useLocale();
  const [f, setF] = useState<any>({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    if (!open) return;
    setErr(null);
    setF({ code: l?.code || '', labelFr: l?.labelFr || '', labelAr: l?.labelAr || '', order: l?.order ?? '', active: l?.active ?? true });
  }, [open, l]);
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const base: any = { labelFr: f.labelFr.trim(), labelAr: f.labelAr.trim() || undefined, order: f.order === '' ? undefined : Number(f.order), active: f.active };
      if (l) await api(`/levels/${l.id}`, { method: 'PATCH', body: base });
      else await api('/levels', { method: 'POST', body: { ...base, code: f.code.trim() } });
      await refresh();
      onClose();
    } catch (e) {
      setErr(messageOf(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal open={open} onClose={onClose} title={l ? t('Modifier le niveau', 'تعديل المستوى') : t('Nouveau niveau', 'مستوى جديد')}>
      <form onSubmit={save} className="space-y-4">
        {!l && <TextField label={t('Code', 'الرمز')} required hint={t('Lettres, chiffres, - ou _ (ex. debutant).', 'حروف وأرقام و - أو _ (مثل debutant).')} dir="ltr" value={f.code || ''} onChange={(e) => setF({ ...f, code: e.target.value })} className="[&_input]:text-start" />}
        <TextField label={t('Libellé (français)', 'التسمية (فرنسي)')} required value={f.labelFr || ''} onChange={(e) => setF({ ...f, labelFr: e.target.value })} />
        <TextField label={t('Libellé (arabe)', 'التسمية (عربي)')} dir="rtl" value={f.labelAr || ''} onChange={(e) => setF({ ...f, labelAr: e.target.value })} />
        <TextField label={t('Ordre d’affichage', 'ترتيب العرض')} type="number" dir="ltr" value={f.order ?? ''} onChange={(e) => setF({ ...f, order: e.target.value })} className="[&_input]:text-start" />
        <Switch checked={!!f.active} onChange={(v) => setF({ ...f, active: v })} label={t('Niveau actif', 'مستوى نشط')} />
        {err && <Notice tone="bad">{err}</Notice>}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>{t('Annuler', 'إلغاء')}</Button>
          <Button type="submit" variant="primary" loading={busy}>{t('Enregistrer', 'حفظ')}</Button>
        </div>
      </form>
    </Modal>
  );
}

/* ═════════════ Sauvegarde ═════════════ */

export function BackupCard() {
  const { t } = useLocale();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  async function go() {
    setBusy(true);
    try {
      await download('/exports/backup', undefined, 'echd-sauvegarde.json');
    } catch (e) {
      toast.error(messageOf(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Card>
      <CardTitle icon={<Download className="size-4" />}>{t('Sauvegarde des données', 'نسخة احتياطية للبيانات')}</CardTitle>
      <p className="text-sm text-brand-500">{t('Télécharge un fichier contenant tous les élèves, classes, paiements et paramètres (sans les mots de passe). À conserver en lieu sûr : il contient des données personnelles.', 'يُنزّل ملفاً يضم كل الطلاب والأقسام والدفعات والإعدادات (دون كلمات المرور). احتفظ به في مكان آمن لأنه يحوي بيانات شخصية.')}</p>
      <Button className="mt-4" variant="dark" loading={busy} icon={<Download className="size-4" />} onClick={go}>{t('Télécharger la sauvegarde', 'تنزيل النسخة الاحتياطية')}</Button>
    </Card>
  );
}
