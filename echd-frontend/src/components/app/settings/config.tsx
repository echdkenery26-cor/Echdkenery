//echd-frontend/src/components/app/settings/config.tsx
'use client';

import { Check, ImagePlus, Plus, Save, Trash2, X } from 'lucide-react';
import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Button, IconButton } from '@/components/ui/button';
import { Card, CardTitle } from '@/components/ui/display';
import { ErrorState, Notice, SkeletonCards, useToast } from '@/components/ui/feedback';
import { Field, SelectField, Switch, TextField, TextareaField } from '@/components/ui/form';
import { api, del } from '@/lib/api';
import { invalidate, messageOf, useApi } from '@/lib/hooks';
import { useLocale } from '@/lib/i18n';
import { centsToEuro, euroToCents } from '@/lib/utils';

/* ─────────── Formulaire de paramètres : ne renvoie que ce qui a changé ─────────── */

interface Ctx {
  v: Record<string, any>;
  set: (k: string, val: any) => void;
  setBi: (k: string, lang: 'fr' | 'ar', val: any) => void;
  logoUrl: string | null;
}
const SettingsCtx = createContext<Ctx>({ v: {}, set() {}, setBi() {}, logoUrl: null });
const useS = () => useContext(SettingsCtx);

export function SettingsForm({ keys, children, extra }: { keys: string[]; children: React.ReactNode; extra?: React.ReactNode }) {
  const { t } = useLocale();
  const toast = useToast();
  const { data, error, loading, reload } = useApi<Record<string, any>>('/settings');
  const [v, setV] = useState<Record<string, any>>({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const base = useRef<Record<string, any>>({});

  useEffect(() => {
    if (!data) return;
    const next: Record<string, any> = {};
    for (const k of keys) next[k] = JSON.parse(JSON.stringify(data[k] ?? null));
    base.current = JSON.parse(JSON.stringify(next));
    setV(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  const changed = useMemo(() => keys.filter((k) => JSON.stringify(v[k]) !== JSON.stringify(base.current[k])), [v, keys]);

  const ctx: Ctx = {
    v,
    set: (k, val) => setV((s) => ({ ...s, [k]: val })),
    setBi: (k, lang, val) => setV((s) => ({ ...s, [k]: { ...(s[k] || { fr: '', ar: '' }), [lang]: val } })),
    logoUrl: data?.['institute.logoUrl'] ?? null,
  };

  async function save() {
    setBusy(true);
    setErr(null);
    try {
      const values: Record<string, any> = {};
      for (const k of changed) values[k] = v[k];
      await api('/settings', { method: 'PUT', body: { values } });
      await Promise.all([reload(), invalidate('/lookups', '/public')]);
      toast.ok(t('Paramètres enregistrés', 'تم حفظ الإعدادات'));
    } catch (e) {
      setErr(messageOf(e));
    } finally {
      setBusy(false);
    }
  }

  if (error) return <ErrorState message={error.message} onRetry={reload} />;
  if (loading || !data || !Object.keys(v).length) return <SkeletonCards n={3} />;

  return (
    <SettingsCtx.Provider value={ctx}>
      <div className="space-y-4 pb-24">
        {children}
        {extra}
      </div>
      <div className="fixed inset-x-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-30 px-4 md:bottom-4 md:start-auto md:ms-auto md:pe-6 lg:pe-8">
        <div className="mx-auto flex max-w-xl items-center gap-3 rounded-2xl bg-white p-2.5 shadow-float ring-1 ring-sand-200 md:ms-auto md:me-0 md:max-w-sm">
          <p className="min-w-0 flex-1 ps-2 text-sm text-brand-500">
            {err ? <span className="text-bad">{err}</span> : changed.length ? t(`${changed.length} modification(s) à enregistrer`, `${changed.length} تعديل بانتظار الحفظ`) : t('Tout est enregistré', 'كل شيء محفوظ')}
          </p>
          <Button variant="primary" loading={busy} disabled={!changed.length} icon={changed.length ? <Save className="size-4" /> : <Check className="size-4" />} onClick={save}>
            {t('Enregistrer', 'حفظ')}
          </Button>
        </div>
      </div>
    </SettingsCtx.Provider>
  );
}

/* ─────────── Champs liés aux paramètres ─────────── */

export function SText({ k, label, hint, ...rest }: { k: string; label: string; hint?: string } & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'>) {
  const { v, set } = useS();
  return <TextField label={label} hint={hint} value={v[k] ?? ''} onChange={(e) => set(k, e.target.value)} {...rest} />;
}

export function SNumber({ k, label, hint, min, max, suffix }: { k: string; label: string; hint?: string; min?: number; max?: number; suffix?: string }) {
  const { v, set } = useS();
  return (
    <TextField
      label={label}
      hint={hint}
      type="number"
      inputMode="numeric"
      dir="ltr"
      min={min}
      max={max}
      value={v[k] ?? ''}
      onChange={(e) => set(k, e.target.value === '' ? '' : Number(e.target.value))}
      className="[&_input]:text-start"
      placeholder={suffix}
    />
  );
}

/** Montant stocké en centimes dans les paramètres, saisi et affiché dans la devise de l'école. */
export function SMoney({ k, label, hint }: { k: string; label: string; hint?: string }) {
  const { v, set } = useS();
  const { currency } = useLocale();
  const [text, setText] = useState<string | null>(null);
  const cents = Number(v[k] ?? 0) || 0;
  return (
    <TextField
      label={`${label} (${currency})`}
      hint={hint}
      inputMode="decimal"
      dir="ltr"
      value={text ?? centsToEuro(cents)}
      onChange={(e) => {
        setText(e.target.value);
        const c = e.target.value.trim() === '' ? 0 : euroToCents(e.target.value);
        if (Number.isFinite(c)) set(k, c);
      }}
      onBlur={() => setText(null)}
      className="[&_input]:text-start"
    />
  );
}

export function SSwitch({ k, label, hint }: { k: string; label: string; hint?: string }) {
  const { v, set } = useS();
  return <Switch checked={!!v[k]} onChange={(x) => set(k, x)} label={label} hint={hint} />;
}

export function SSelect({ k, label, hint, options }: { k: string; label: string; hint?: string; options: Array<[string, string]> }) {
  const { v, set } = useS();
  return (
    <SelectField label={label} hint={hint} value={v[k] ?? ''} onChange={(e) => set(k, e.target.value)}>
      {options.map(([val, text]) => <option key={val} value={val}>{text}</option>)}
    </SelectField>
  );
}

/** Texte bilingue : deux champs côte à côte (français / arabe) */
export function SBi({ k, label, hint, area, rows = 3 }: { k: string; label: string; hint?: string; area?: boolean; rows?: number }) {
  const { t } = useLocale();
  const { v, setBi } = useS();
  const val = v[k] || { fr: '', ar: '' };
  return (
    <Field label={label} hint={hint}>
      <div className="grid gap-3 md:grid-cols-2">
        {area ? (
          <>
            <TextareaField label={<span className="text-xs text-brand-400">{t('Français', 'الفرنسية')}</span>} rows={rows} value={val.fr ?? ''} onChange={(e) => setBi(k, 'fr', e.target.value)} />
            <TextareaField label={<span className="text-xs text-brand-400">{t('Arabe', 'العربية')}</span>} dir="rtl" rows={rows} value={val.ar ?? ''} onChange={(e) => setBi(k, 'ar', e.target.value)} />
          </>
        ) : (
          <>
            <TextField label={<span className="text-xs text-brand-400">{t('Français', 'الفرنسية')}</span>} value={val.fr ?? ''} onChange={(e) => setBi(k, 'fr', e.target.value)} />
            <TextField label={<span className="text-xs text-brand-400">{t('Arabe', 'العربية')}</span>} dir="rtl" value={val.ar ?? ''} onChange={(e) => setBi(k, 'ar', e.target.value)} />
          </>
        )}
      </div>
    </Field>
  );
}

export function Section({ title, icon, children, text }: { title: string; icon?: React.ReactNode; children: React.ReactNode; text?: string }) {
  return (
    <Card>
      <CardTitle icon={icon}>{title}</CardTitle>
      {text && <p className="-mt-1 mb-4 text-sm text-brand-500">{text}</p>}
      <div className="space-y-4">{children}</div>
    </Card>
  );
}

/* ─────────── Logo ─────────── */

export function LogoField() {
  const { t } = useLocale();
  const toast = useToast();
  const { logoUrl } = useS();
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function upload(file: File) {
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      await api('/settings/logo', { method: 'POST', body: fd });
      await invalidate('/settings', '/lookups', '/public');
      toast.ok(t('Logo mis à jour', 'تم تحديث الشعار'));
    } catch (e) {
      toast.error(messageOf(e));
    } finally {
      setBusy(false);
    }
  }
  async function remove() {
    try {
      await del('/settings/logo');
      await invalidate('/settings', '/lookups', '/public');
    } catch (e) {
      toast.error(messageOf(e));
    }
  }
  return (
    <Field label={t('Logo', 'الشعار')} hint={t('Affiché sur le site, les reçus et les documents.', 'يظهر في الموقع والإيصالات والوثائق.')}>
      <div className="flex items-center gap-4">
        <div className="grid size-20 place-items-center overflow-hidden rounded-2xl bg-sand-100 ring-1 ring-sand-200">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {logoUrl ? <img src={logoUrl} alt="" className="size-full object-contain p-1.5" /> : <ImagePlus className="size-6 text-brand-300" />}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="soft" size="sm" loading={busy} onClick={() => ref.current?.click()}>{logoUrl ? t('Remplacer', 'استبدال') : t('Ajouter un logo', 'إضافة شعار')}</Button>
          {logoUrl && <Button variant="ghost" size="sm" onClick={remove}>{t('Retirer', 'إزالة')}</Button>}
        </div>
        <input ref={ref} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ''; }} />
      </div>
    </Field>
  );
}

/* ─────────── Liste de textes (étapes d'inscription) ─────────── */

export function StepsField({ k, label }: { k: string; label: string }) {
  const { t } = useLocale();
  const { v, set } = useS();
  const val: { fr: string[]; ar: string[] } = v[k] || { fr: [], ar: [] };
  const n = Math.max(val.fr.length, val.ar.length);
  const upd = (lang: 'fr' | 'ar', i: number, text: string) => {
    const next = { fr: [...val.fr], ar: [...val.ar] };
    while (next.fr.length < n) next.fr.push('');
    while (next.ar.length < n) next.ar.push('');
    next[lang][i] = text;
    set(k, next);
  };
  const add = () => set(k, { fr: [...val.fr, ''], ar: [...val.ar, ''] });
  const rm = (i: number) => set(k, { fr: val.fr.filter((_, j) => j !== i), ar: val.ar.filter((_, j) => j !== i) });
  return (
    <Field label={label}>
      <div className="space-y-2">
        {Array.from({ length: n }).map((_, i) => (
          <div key={i} className="flex items-start gap-2 rounded-2xl bg-sand-100 p-2.5">
            <span className="num mt-3 grid size-6 shrink-0 place-items-center rounded-full bg-white text-xs font-bold text-brand-500">{i + 1}</span>
            <div className="grid min-w-0 flex-1 gap-2 md:grid-cols-2">
              <TextField label="" aria-label="FR" value={val.fr[i] ?? ''} onChange={(e) => upd('fr', i, e.target.value)} />
              <TextField label="" aria-label="AR" dir="rtl" value={val.ar[i] ?? ''} onChange={(e) => upd('ar', i, e.target.value)} />
            </div>
            <IconButton label={t('Retirer', 'إزالة')} className="!size-9" onClick={() => rm(i)}><Trash2 className="size-4" /></IconButton>
          </div>
        ))}
        <Button variant="soft" size="sm" icon={<Plus className="size-4" />} onClick={add}>{t('Ajouter une étape', 'إضافة خطوة')}</Button>
      </div>
    </Field>
  );
}

/* ─────────── Catégories { code, fr, ar } ─────────── */

export function CategoriesField({ k, label, hint }: { k: string; label: string; hint?: string }) {
  const { t } = useLocale();
  const { v, set } = useS();
  const list: Array<{ code: string; fr: string; ar: string }> = v[k] || [];
  const upd = (i: number, p: Partial<{ code: string; fr: string; ar: string }>) => set(k, list.map((c, j) => (j === i ? { ...c, ...p } : c)));
  const slug = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 40);
  return (
    <Field label={label} hint={hint}>
      <div className="space-y-2">
        {list.map((c, i) => (
          <div key={i} className="flex items-start gap-2 rounded-2xl bg-sand-100 p-2.5">
            <div className="grid min-w-0 flex-1 gap-2 md:grid-cols-2">
              <TextField label="" aria-label="FR" placeholder="Français" value={c.fr} onChange={(e) => upd(i, { fr: e.target.value, code: c.code && !c.code.startsWith('new_') ? c.code : slug(e.target.value) || c.code })} />
              <TextField label="" aria-label="AR" placeholder="العربية" dir="rtl" value={c.ar} onChange={(e) => upd(i, { ar: e.target.value })} />
            </div>
            <IconButton label={t('Retirer', 'إزالة')} className="!size-9" onClick={() => set(k, list.filter((_, j) => j !== i))}><X className="size-4" /></IconButton>
          </div>
        ))}
        <Button variant="soft" size="sm" icon={<Plus className="size-4" />} onClick={() => set(k, [...list, { code: `new_${Date.now().toString(36)}`, fr: '', ar: '' }])}>{t('Ajouter une catégorie', 'إضافة فئة')}</Button>
      </div>
    </Field>
  );
}

/* ─────────── Trimestres personnalisés ─────────── */

export function TermsField() {
  const { t } = useLocale();
  const { v, set } = useS();
  const val: Array<{ start: string; end: string }> | null = v['terms.dates'];
  const custom = Array.isArray(val);
  return (
    <div>
      <Switch
        checked={custom}
        onChange={(on) => set('terms.dates', on ? [{ start: '', end: '' }] : null)}
        label={t('Trimestres personnalisés', 'فصول مخصّصة')}
        hint={t('Désactivé : l’année est découpée automatiquement en 3 périodes égales (bulletins).', 'عند التعطيل تُقسَّم السنة تلقائياً إلى 3 فترات متساوية (للكشوف).')}
      />
      {custom && (
        <div className="mt-2 space-y-2">
          {val!.map((p, i) => (
            <div key={i} className="flex items-end gap-2 rounded-2xl bg-sand-100 p-2.5">
              <TextField label={t(`Début ${i + 1}`, `بداية ${i + 1}`)} type="date" dir="ltr" value={p.start} onChange={(e) => set('terms.dates', val!.map((x, j) => (j === i ? { ...x, start: e.target.value } : x)))} className="flex-1 [&_input]:text-start" />
              <TextField label={t('Fin', 'نهاية')} type="date" dir="ltr" value={p.end} onChange={(e) => set('terms.dates', val!.map((x, j) => (j === i ? { ...x, end: e.target.value } : x)))} className="flex-1 [&_input]:text-start" />
              <IconButton label={t('Retirer', 'إزالة')} className="!size-11" onClick={() => set('terms.dates', val!.filter((_, j) => j !== i))}><Trash2 className="size-4" /></IconButton>
            </div>
          ))}
          <Button variant="soft" size="sm" icon={<Plus className="size-4" />} onClick={() => set('terms.dates', [...val!, { start: '', end: '' }])}>{t('Ajouter un trimestre', 'إضافة فصل')}</Button>
          {val!.some((p) => !p.start || !p.end) && <Notice tone="warn">{t('Renseignez le début et la fin de chaque trimestre.', 'أدخل بداية ونهاية كل فصل.')}</Notice>}
        </div>
      )}
    </div>
  );
}
