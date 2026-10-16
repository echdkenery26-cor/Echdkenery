'use client';

import { Eye, EyeOff, ImagePlus, Megaphone, Pencil, Pin, Plus, Trash2, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Button, IconButton } from '@/components/ui/button';
import { Badge, Card, PageHeader, Pagination, type Tone } from '@/components/ui/display';
import { EmptyState, ErrorState, Modal, Notice, SkeletonCards, useConfirm, useToast } from '@/components/ui/feedback';
import { Chips, Field, SearchBox, SelectField, Switch, TextField, TextareaField } from '@/components/ui/form';
import { api, del, post } from '@/lib/api';
import { invalidate, messageOf, useApi } from '@/lib/hooks';
import { useLocale } from '@/lib/i18n';
import { useLookups } from '@/lib/lookups';
import { useUrlState } from '@/lib/url-state';

const PAGE = 12;
const toInput = (iso?: string | null) => (iso ? new Date(new Date(iso).getTime() - new Date(iso).getTimezoneOffset() * 60000).toISOString().slice(0, 16) : '');
const fromInput = (v: string) => (v ? new Date(v).toISOString() : null);

const visibility = (v: string, t: (a: string, b: string) => string): { label: string; tone: Tone } =>
  ({
    draft: { label: t('Brouillon', 'مسودة'), tone: 'neutral' as Tone },
    scheduled: { label: t('Programmée', 'مجدولة'), tone: 'info' as Tone },
    live: { label: t('En ligne', 'منشورة'), tone: 'ok' as Tone },
    expired: { label: t('Expirée', 'منتهية'), tone: 'warn' as Tone },
  }[v] || { label: v, tone: 'neutral' as Tone });

export default function AnnouncementsPage() {
  const { t, pick, date, num } = useLocale();
  const toast = useToast();
  const confirm = useConfirm();
  const { lk } = useLookups();
  const [f, set] = useUrlState({ status: '', q: '', page: '1', open: '' });
  const { data, error, loading, reload } = useApi<any>('/announcements', { status: f.status || undefined, q: f.q || undefined, page: Number(f.page), pageSize: PAGE });
  const [form, setForm] = useState<{ open: boolean; a: any | null }>({ open: false, a: null });
  const cats: Array<{ code: string; fr: string; ar: string }> = lk?.settings?.['announcement.categories'] || [];
  const catLabel = (c: string) => {
    const x = cats.find((k) => k.code === c);
    return x ? pick(x.fr, x.ar || x.fr) : c;
  };

  // Lien direct depuis le tableau de bord : ?open=<id>
  useEffect(() => {
    if (!f.open || !data) return;
    const a = data.items.find((x: any) => x.id === f.open);
    if (a) setForm({ open: true, a });
    set({ open: '' }, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [f.open, data]);

  async function toggle(a: any) {
    try {
      await post(`/announcements/${a.id}/${a.status === 'PUBLISHED' ? 'unpublish' : 'publish'}`);
      await invalidate('/announcements', '/public', '/dashboard');
      toast.ok(a.status === 'PUBLISHED' ? t('Annonce retirée du site', 'سُحب الإعلان من الموقع') : t('Annonce publiée', 'تم نشر الإعلان'));
    } catch (e) {
      toast.error(messageOf(e));
    }
  }
  async function remove(a: any) {
    if (!(await confirm({ title: t('Supprimer cette annonce ?', 'حذف هذا الإعلان؟'), message: pick(a.titleFr, a.titleAr || a.titleFr), danger: true, confirmLabel: t('Supprimer', 'حذف') }))) return;
    try {
      await del(`/announcements/${a.id}`);
      await invalidate('/announcements', '/public', '/dashboard');
    } catch (e) {
      toast.error(messageOf(e));
    }
  }

  return (
    <div>
      <PageHeader
        title={t('Annonces', 'الإعلانات')}
        subtitle={data ? t(`${num(data.total)} annonce(s)`, `${num(data.total)} إعلان`) : undefined}
        actions={<Button variant="primary" icon={<Plus className="size-4" />} onClick={() => setForm({ open: true, a: null })}>{t('Nouvelle annonce', 'إعلان جديد')}</Button>}
      />
      <div className="mb-4 space-y-3">
        <SearchBox value={f.q} onChange={(v) => set({ q: v })} placeholder={t('Rechercher une annonce…', 'ابحث عن إعلان…')} />
        <Chips
          value={f.status}
          onChange={(v) => set({ status: v })}
          options={[
            { value: '', label: t('Toutes', 'الكل') },
            { value: 'PUBLISHED', label: t('Publiées', 'منشورة') },
            { value: 'DRAFT', label: t('Brouillons', 'مسودات') },
          ]}
        />
      </div>

      {error ? (
        <ErrorState message={error.message} onRetry={reload} />
      ) : loading || !data ? (
        <SkeletonCards n={4} />
      ) : data.items.length === 0 ? (
        <EmptyState
          icon={<Megaphone className="size-6" />}
          title={t('Aucune annonce', 'لا توجد إعلانات')}
          text={t('Publiez une information : elle apparaît sur la page d’accueil du site.', 'انشر معلومة لتظهر في الصفحة الرئيسية للموقع.')}
          action={<Button variant="primary" icon={<Plus className="size-4" />} onClick={() => setForm({ open: true, a: null })}>{t('Nouvelle annonce', 'إعلان جديد')}</Button>}
        />
      ) : (
        <>
          <div className="grid gap-3 md:grid-cols-2">
            {data.items.map((a: any) => {
              const v = visibility(a.visibility, t);
              return (
                <Card key={a.id} padded={false} className="overflow-hidden">
                  {a.imageUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={a.imageUrl} alt="" className="h-36 w-full object-cover" />
                  )}
                  <div className="p-4 sm:p-5">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge tone={v.tone}>{v.label}</Badge>
                      <Badge tone="gold">{catLabel(a.category)}</Badge>
                      {a.pinned && <Badge tone="info"><Pin className="size-3" /> {t('Épinglée', 'مثبّتة')}</Badge>}
                    </div>
                    <p className="mt-2.5 font-serif text-lg font-bold leading-snug text-brand-800">{pick(a.titleFr, a.titleAr || a.titleFr)}</p>
                    <p className="mt-1 line-clamp-2 text-sm text-brand-500">{pick(a.bodyFr, a.bodyAr || a.bodyFr)}</p>
                    <p className="mt-2 text-xs text-brand-400">
                      {a.publishAt && a.visibility === 'scheduled' ? t(`Publication le ${date(a.publishAt)}`, `النشر في ${date(a.publishAt)}`) : t(`Créée le ${date(a.createdAt)}`, `أُنشئ في ${date(a.createdAt)}`)}
                      {a.expiresAt && ` · ${t('expire le', 'ينتهي في')} ${date(a.expiresAt)}`}
                    </p>
                    <div className="mt-3 flex items-center gap-1.5">
                      <Button size="sm" variant={a.status === 'PUBLISHED' ? 'soft' : 'dark'} icon={a.status === 'PUBLISHED' ? <EyeOff className="size-4" /> : <Eye className="size-4" />} onClick={() => toggle(a)}>
                        {a.status === 'PUBLISHED' ? t('Retirer', 'سحب') : t('Publier', 'نشر')}
                      </Button>
                      <span className="flex-1" />
                      <IconButton label={t('Modifier', 'تعديل')} className="!size-9" onClick={() => setForm({ open: true, a })}><Pencil className="size-4" /></IconButton>
                      <IconButton label={t('Supprimer', 'حذف')} className="!size-9" onClick={() => remove(a)}><Trash2 className="size-4" /></IconButton>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
          <Pagination page={Number(f.page)} pageSize={PAGE} total={data.total} onChange={(p) => set({ page: String(p) }, false)} />
        </>
      )}
      <AnnouncementForm open={form.open} a={form.a} cats={cats} onClose={() => setForm({ open: false, a: null })} />
    </div>
  );
}

function AnnouncementForm({ open, a, cats, onClose }: { open: boolean; a: any | null; cats: Array<{ code: string; fr: string; ar: string }>; onClose: () => void }) {
  const { t, pick } = useLocale();
  const toast = useToast();
  const [f, setF] = useState<any>({});
  const [image, setImage] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [removeImage, setRemoveImage] = useState(false);
  const [busy, setBusy] = useState<'draft' | 'publish' | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setErr(null);
    setImage(null);
    setPreview(null);
    setRemoveImage(false);
    setF({
      titleFr: a?.titleFr || '',
      titleAr: a?.titleAr || '',
      bodyFr: a?.bodyFr || '',
      bodyAr: a?.bodyAr || '',
      category: a?.category || cats[cats.length - 1]?.code || 'misc',
      pinned: a?.pinned ?? false,
      showHijri: a?.showHijri ?? false,
      publishAt: toInput(a?.publishAt),
      expiresAt: toInput(a?.expiresAt),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, a]);
  useEffect(() => () => void (preview && URL.revokeObjectURL(preview)), [preview]);

  async function save(publish: boolean) {
    setErr(null);
    if (!f.titleFr.trim() || !f.bodyFr.trim()) return setErr(t('Le titre et le texte en français sont obligatoires.', 'العنوان والنص بالفرنسية إلزاميان.'));
    setBusy(publish ? 'publish' : 'draft');
    try {
      const body: any = {
        titleFr: f.titleFr.trim(),
        titleAr: f.titleAr.trim(),
        bodyFr: f.bodyFr.trim(),
        bodyAr: f.bodyAr.trim(),
        category: f.category,
        pinned: f.pinned,
        showHijri: f.showHijri,
        publishAt: fromInput(f.publishAt),
        expiresAt: fromInput(f.expiresAt),
        status: publish ? 'PUBLISHED' : a ? a.status : 'DRAFT',
      };
      const saved = a ? await api(`/announcements/${a.id}`, { method: 'PATCH', body }) : await api('/announcements', { method: 'POST', body });
      const id = saved.id || a?.id;
      if (removeImage && a?.imageUrl && !image) await del(`/announcements/${id}/image`).catch(() => {});
      if (image) {
        const fd = new FormData();
        fd.append('file', image);
        await api(`/announcements/${id}/image`, { method: 'POST', body: fd }).catch(() => toast.error(t('L’image n’a pas pu être envoyée.', 'تعذّر إرسال الصورة.')));
      }
      await invalidate('/announcements', '/public', '/dashboard');
      toast.ok(publish ? t('Annonce publiée', 'تم نشر الإعلان') : t('Annonce enregistrée', 'تم حفظ الإعلان'));
      onClose();
    } catch (e) {
      setErr(messageOf(e));
    } finally {
      setBusy(null);
    }
  }

  const shown = preview || (!removeImage ? a?.imageUrl : null);
  const live = a?.status === 'PUBLISHED';

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={a ? t('Modifier l’annonce', 'تعديل الإعلان') : t('Nouvelle annonce', 'إعلان جديد')}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>{t('Annuler', 'إلغاء')}</Button>
          {!live && <Button variant="outline" loading={busy === 'draft'} disabled={!!busy} onClick={() => save(false)}>{t('Enregistrer le brouillon', 'حفظ كمسودة')}</Button>}
          <Button variant="primary" loading={busy === 'publish'} disabled={!!busy} onClick={() => save(true)}>{live ? t('Enregistrer', 'حفظ') : t('Publier', 'نشر')}</Button>
        </>
      }
    >
      <div className="space-y-4">
        <TextField label={t('Titre (français)', 'العنوان (فرنسي)')} required value={f.titleFr || ''} onChange={(e) => setF({ ...f, titleFr: e.target.value })} />
        <TextareaField label={t('Texte (français)', 'النص (فرنسي)')} required rows={5} value={f.bodyFr || ''} onChange={(e) => setF({ ...f, bodyFr: e.target.value })} />
        <TextField label={t('Titre (arabe)', 'العنوان (عربي)')} dir="rtl" value={f.titleAr || ''} onChange={(e) => setF({ ...f, titleAr: e.target.value })} />
        <TextareaField label={t('Texte (arabe)', 'النص (عربي)')} dir="rtl" rows={5} hint={t('Facultatif : sans traduction, le texte français est affiché.', 'اختياري: دون ترجمة يُعرض النص الفرنسي.')} value={f.bodyAr || ''} onChange={(e) => setF({ ...f, bodyAr: e.target.value })} />
        <SelectField label={t('Catégorie', 'الفئة')} value={f.category || ''} onChange={(e) => setF({ ...f, category: e.target.value })}>
          {cats.map((c) => <option key={c.code} value={c.code}>{pick(c.fr, c.ar || c.fr)}</option>)}
        </SelectField>
        <Field label={t('Image', 'الصورة')} hint={t('Facultatif. JPG, PNG ou WebP.', 'اختياري. JPG أو PNG أو WebP.')}>
          {shown ? (
            <div className="relative overflow-hidden rounded-2xl">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={shown} alt="" className="h-40 w-full object-cover" />
              <button
                type="button"
                aria-label={t('Retirer l’image', 'إزالة الصورة')}
                onClick={() => { setImage(null); setPreview(null); setRemoveImage(true); }}
                className="absolute end-2 top-2 grid size-9 place-items-center rounded-full bg-white/90 text-brand-700 shadow-card hover:bg-white"
              >
                <X className="size-4" />
              </button>
            </div>
          ) : (
            <Button variant="soft" icon={<ImagePlus className="size-4" />} onClick={() => fileRef.current?.click()}>{t('Ajouter une image', 'إضافة صورة')}</Button>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                setImage(file);
                setPreview(URL.createObjectURL(file));
                setRemoveImage(false);
              }
              e.target.value = '';
            }}
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label={t('Publier à partir du', 'النشر ابتداءً من')} type="datetime-local" dir="ltr" hint={t('Vide : dès la publication.', 'فارغ: فور النشر.')} value={f.publishAt || ''} onChange={(e) => setF({ ...f, publishAt: e.target.value })} className="[&_input]:text-start" />
          <TextField label={t('Retirer automatiquement le', 'السحب تلقائياً في')} type="datetime-local" dir="ltr" hint={t('Vide : reste en ligne.', 'فارغ: تبقى منشورة.')} value={f.expiresAt || ''} onChange={(e) => setF({ ...f, expiresAt: e.target.value })} className="[&_input]:text-start" />
        </div>
        <div className="space-y-1">
          <Switch checked={!!f.pinned} onChange={(v) => setF({ ...f, pinned: v })} label={t('Épingler en haut', 'تثبيت في الأعلى')} />
          <Switch checked={!!f.showHijri} onChange={(v) => setF({ ...f, showHijri: v })} label={t('Afficher la date hégirienne', 'عرض التاريخ الهجري')} />
        </div>
        {err && <Notice tone="bad">{err}</Notice>}
      </div>
    </Modal>
  );
}
