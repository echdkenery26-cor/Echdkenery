'use client';

import { Plus, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button, IconButton } from '@/components/ui/button';
import { Modal, Notice, useToast } from '@/components/ui/feedback';
import { Chips, Field, SelectField, TextField } from '@/components/ui/form';
import { api } from '@/lib/api';
import { invalidate, messageOf } from '@/lib/hooks';
import { useLocale } from '@/lib/i18n';
import { useLookups } from '@/lib/lookups';
import { cn } from '@/lib/utils';

export interface SlotDraft {
  id?: string;
  weekday: number;
  startTime: string;
  endTime: string;
  roomId: string;
}

/** Jours dans l'ordre de la semaine locale (samedi en premier : école coranique du week-end) */
export const WEEK_ORDER = [6, 7, 1, 2, 3, 4, 5];

export function WeekdayChips({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const { weekday } = useLocale();
  return (
    <Chips value={String(value)} onChange={(v) => onChange(Number(v))} options={WEEK_ORDER.map((d) => ({ value: String(d), label: weekday(d, 'short') }))} />
  );
}

/** Éditeur de créneaux hebdomadaires (utilisé à la création d'une classe) */
export function SlotsEditor({ slots, onChange }: { slots: SlotDraft[]; onChange: (s: SlotDraft[]) => void }) {
  const { t, pick } = useLocale();
  const { lk } = useLookups();
  const up = (i: number, p: Partial<SlotDraft>) => onChange(slots.map((s, j) => (j === i ? { ...s, ...p } : s)));
  return (
    <div className="space-y-3">
      {slots.map((s, i) => (
        <div key={i} className="space-y-3 rounded-2xl bg-sand-100 p-3.5">
          <WeekdayChips value={s.weekday} onChange={(v) => up(i, { weekday: v })} />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-[1fr_1fr_1.4fr_auto] sm:items-end">
            <TextField label={t('Début', 'البداية')} type="time" dir="ltr" value={s.startTime} onChange={(e) => up(i, { startTime: e.target.value })} className="[&_input]:text-start" />
            <TextField label={t('Fin', 'النهاية')} type="time" dir="ltr" value={s.endTime} onChange={(e) => up(i, { endTime: e.target.value })} className="[&_input]:text-start" />
            <SelectField label={t('Salle', 'القاعة')} value={s.roomId} onChange={(e) => up(i, { roomId: e.target.value })} className="col-span-2 sm:col-span-1">
              <option value="">{t('Salle de la classe', 'قاعة القسم')}</option>
              {lk?.rooms.filter((r) => r.active !== false).map((r) => <option key={r.id} value={r.id}>{pick(r.name, r.nameAr || r.name)}</option>)}
            </SelectField>
            <IconButton label={t('Retirer le créneau', 'إزالة الموعد')} onClick={() => onChange(slots.filter((_, j) => j !== i))} className="col-span-2 justify-self-end sm:col-span-1"><Trash2 className="size-4" /></IconButton>
          </div>
        </div>
      ))}
      <Button variant="soft" size="sm" icon={<Plus className="size-4" />} onClick={() => onChange([...slots, { weekday: 6, startTime: '10:00', endTime: '12:00', roomId: '' }])}>
        {t('Ajouter un créneau', 'إضافة موعد')}
      </Button>
    </div>
  );
}

/** Création / modification d'une classe */
export function ClassFormModal({ open, onClose, cls, onSaved }: { open: boolean; onClose: () => void; cls?: any; onSaved?: (c: any) => void }) {
  const { t, pick } = useLocale();
  const toast = useToast();
  const { lk } = useLookups();
  const editing = !!cls;
  const [f, setF] = useState({ name: '', courseId: '', teacherId: '', capacity: '15', roomId: '', active: true });
  const [slots, setSlots] = useState<SlotDraft[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setErr(null);
    setF({ name: cls?.name || '', courseId: cls?.courseId || '', teacherId: cls?.teacherId || '', capacity: String(cls?.capacity ?? 15), roomId: cls?.roomId || '', active: cls?.active ?? true });
    setSlots(cls ? [] : [{ weekday: 6, startTime: '10:00', endTime: '12:30', roomId: '' }]);
  }, [open, cls]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const body: any = { name: f.name.trim(), courseId: f.courseId, capacity: Number(f.capacity), teacherId: f.teacherId || (editing ? null : undefined), roomId: f.roomId || (editing ? null : undefined), active: f.active };
      if (!editing) body.slots = slots.map((s) => ({ weekday: s.weekday, startTime: s.startTime, endTime: s.endTime, roomId: s.roomId || undefined }));
      const r = editing ? await api(`/classes/${cls.id}`, { method: 'PATCH', body }) : await api('/classes', { method: 'POST', body });
      await Promise.all([invalidate('/classes', '/lookups', '/timetable', '/dashboard')]);
      toast.ok(editing ? t('Classe enregistrée', 'تم حفظ القسم') : t('Classe créée', 'تم إنشاء القسم'));
      onSaved?.(r);
      onClose();
    } catch (e) {
      setErr(messageOf(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} size="lg" title={editing ? t('Modifier la classe', 'تعديل القسم') : t('Nouvelle classe', 'قسم جديد')}>
      <form onSubmit={save} className="space-y-4">
        <TextField label={t('Nom de la classe', 'اسم القسم')} required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder={t('Ex. Enfants — matin', 'مثال: الأطفال — صباحاً')} />
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField label={t('Cours', 'الدرس')} required value={f.courseId} onChange={(e) => setF({ ...f, courseId: e.target.value })}>
            <option value="">—</option>
            {lk?.courses.filter((c) => c.active).map((c) => <option key={c.id} value={c.id}>{pick(c.titleFr, c.titleAr)}</option>)}
          </SelectField>
          <SelectField label={t('Enseignant', 'المعلّم')} value={f.teacherId} onChange={(e) => setF({ ...f, teacherId: e.target.value })}>
            <option value="">{t('— Non attribué —', '— غير مُسند —')}</option>
            {lk?.teachers.filter((x) => x.active).map((x) => <option key={x.id} value={x.id}>{x.firstName} {x.lastName}</option>)}
          </SelectField>
          <TextField label={t('Capacité (places)', 'السعة (مقاعد)')} required type="number" min={1} max={500} inputMode="numeric" dir="ltr" value={f.capacity} onChange={(e) => setF({ ...f, capacity: e.target.value })} className="[&_input]:text-start" />
          <SelectField label={t('Salle habituelle', 'القاعة المعتادة')} value={f.roomId} onChange={(e) => setF({ ...f, roomId: e.target.value })}>
            <option value="">—</option>
            {lk?.rooms.filter((r) => r.active !== false).map((r) => <option key={r.id} value={r.id}>{pick(r.name, r.nameAr || r.name)}</option>)}
          </SelectField>
        </div>
        {!editing && (
          <Field label={t('Horaires hebdomadaires', 'المواعيد الأسبوعية')}>
            <SlotsEditor slots={slots} onChange={setSlots} />
          </Field>
        )}
        {err && <Notice tone="bad">{err}</Notice>}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>{t('Annuler', 'إلغاء')}</Button>
          <Button type="submit" variant="primary" loading={busy}>{editing ? t('Enregistrer', 'حفظ') : t('Créer la classe', 'إنشاء القسم')}</Button>
        </div>
      </form>
    </Modal>
  );
}

/** Ajout / modification d'un créneau d'une classe existante */
export function SlotModal({ open, classId, slot, onClose }: { open: boolean; classId: string; slot?: any | null; onClose: () => void }) {
  const { t } = useLocale();
  const toast = useToast();
  const [d, setD] = useState<SlotDraft>({ weekday: 6, startTime: '10:00', endTime: '12:00', roomId: '' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    if (open) {
      setErr(null);
      setD(slot ? { weekday: slot.weekday, startTime: slot.startTime, endTime: slot.endTime, roomId: slot.roomId || '' } : { weekday: 6, startTime: '10:00', endTime: '12:00', roomId: '' });
    }
  }, [open, slot]);
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const body = { weekday: d.weekday, startTime: d.startTime, endTime: d.endTime, roomId: d.roomId || undefined };
      if (slot) await api(`/slots/${slot.id}`, { method: 'PATCH', body });
      else await api(`/classes/${classId}/slots`, { method: 'POST', body });
      await invalidate('/classes', '/timetable', '/dashboard');
      toast.ok(t('Créneau enregistré', 'تم حفظ الموعد'));
      onClose();
    } catch (e) {
      setErr(messageOf(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal open={open} onClose={onClose} title={slot ? t('Modifier le créneau', 'تعديل الموعد') : t('Ajouter un créneau', 'إضافة موعد')}>
      <form onSubmit={save} className="space-y-4">
        <SlotsEditorOne d={d} onChange={setD} />
        {err && <Notice tone="bad">{err}</Notice>}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>{t('Annuler', 'إلغاء')}</Button>
          <Button type="submit" variant="primary" loading={busy}>{t('Enregistrer', 'حفظ')}</Button>
        </div>
      </form>
    </Modal>
  );
}

function SlotsEditorOne({ d, onChange }: { d: SlotDraft; onChange: (d: SlotDraft) => void }) {
  const { t, pick } = useLocale();
  const { lk } = useLookups();
  return (
    <div className="space-y-3">
      <WeekdayChips value={d.weekday} onChange={(v) => onChange({ ...d, weekday: v })} />
      <div className="grid grid-cols-2 gap-3">
        <TextField label={t('Début', 'البداية')} type="time" dir="ltr" value={d.startTime} onChange={(e) => onChange({ ...d, startTime: e.target.value })} className="[&_input]:text-start" />
        <TextField label={t('Fin', 'النهاية')} type="time" dir="ltr" value={d.endTime} onChange={(e) => onChange({ ...d, endTime: e.target.value })} className="[&_input]:text-start" />
      </div>
      <SelectField label={t('Salle', 'القاعة')} value={d.roomId} onChange={(e) => onChange({ ...d, roomId: e.target.value })}>
        <option value="">{t('Salle de la classe', 'قاعة القسم')}</option>
        {lk?.rooms.filter((r) => r.active !== false).map((r) => <option key={r.id} value={r.id}>{pick(r.name, r.nameAr || r.name)}</option>)}
      </SelectField>
    </div>
  );
}

/** Annulation ou déplacement ponctuel d'une séance */
export function ExceptionModal({ open, slot, onClose }: { open: boolean; slot: any | null; onClose: () => void }) {
  const { t, pick, weekday } = useLocale();
  const toast = useToast();
  const { lk } = useLookups();
  const [type, setType] = useState<'CANCELLED' | 'MOVED'>('CANCELLED');
  const [date, setDate] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [room, setRoom] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    if (open && slot) {
      setType('CANCELLED');
      setDate('');
      setStart(slot.startTime);
      setEnd(slot.endTime);
      setRoom('');
      setReason('');
      setErr(null);
    }
  }, [open, slot]);
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await api(`/slots/${slot.id}/exceptions`, {
        method: 'POST',
        body: { date, type, reason: reason.trim() || undefined, ...(type === 'MOVED' ? { newStartTime: start, newEndTime: end, newRoomId: room || undefined } : {}) },
      });
      await invalidate('/classes', '/timetable', '/dashboard');
      toast.ok(t('Séance mise à jour', 'تم تحديث الحصة'));
      onClose();
    } catch (e) {
      setErr(messageOf(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal open={open} onClose={onClose} title={t('Annuler ou déplacer une séance', 'إلغاء أو نقل حصة')}>
      {slot && (
        <form onSubmit={save} className="space-y-4">
          <p className="text-sm text-brand-500">{weekday(slot.weekday)} <span dir="ltr" className="num">{slot.startTime}–{slot.endTime}</span></p>
          <Chips value={type} onChange={setType} options={[{ value: 'CANCELLED', label: t('Annuler', 'إلغاء') }, { value: 'MOVED', label: t('Déplacer', 'نقل') }]} />
          <TextField label={t('Date de la séance', 'تاريخ الحصة')} type="date" required dir="ltr" value={date} onChange={(e) => setDate(e.target.value)} className="[&_input]:text-start" hint={t(`Doit tomber un ${weekday(slot.weekday).toLowerCase()}.`, `يجب أن يصادف ${weekday(slot.weekday)}.`)} />
          {type === 'MOVED' && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <TextField label={t('Nouveau début', 'بداية جديدة')} type="time" dir="ltr" value={start} onChange={(e) => setStart(e.target.value)} className="[&_input]:text-start" />
                <TextField label={t('Nouvelle fin', 'نهاية جديدة')} type="time" dir="ltr" value={end} onChange={(e) => setEnd(e.target.value)} className="[&_input]:text-start" />
              </div>
              <SelectField label={t('Autre salle', 'قاعة أخرى')} value={room} onChange={(e) => setRoom(e.target.value)}>
                <option value="">{t('— Inchangée —', '— دون تغيير —')}</option>
                {lk?.rooms.map((r) => <option key={r.id} value={r.id}>{pick(r.name, r.nameAr || r.name)}</option>)}
              </SelectField>
            </>
          )}
          <TextField label={t('Motif', 'السبب')} hint={t('Facultatif', 'اختياري')} value={reason} onChange={(e) => setReason(e.target.value)} />
          {err && <Notice tone="bad">{err}</Notice>}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={onClose}>{t('Retour', 'رجوع')}</Button>
            <Button type="submit" variant={type === 'CANCELLED' ? 'danger' : 'primary'} loading={busy}>{type === 'CANCELLED' ? t('Annuler la séance', 'إلغاء الحصة') : t('Déplacer la séance', 'نقل الحصة')}</Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
