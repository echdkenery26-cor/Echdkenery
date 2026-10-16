'use client';

import { Camera, ChevronDown, Search, X } from 'lucide-react';
import { forwardRef, useEffect, useId, useRef, useState } from 'react';
import { useLocale } from '@/lib/i18n';
import { cn } from '@/lib/utils';

const control =
  'w-full rounded-xl bg-white px-3.5 py-2.5 text-[0.95rem] text-brand-800 ring-1 ring-inset ring-sand-300 placeholder:text-brand-300 transition focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:bg-sand-100 disabled:text-brand-400 min-h-11';

export function Field({
  label,
  hint,
  error,
  required,
  children,
  className,
  htmlFor,
}: {
  label?: React.ReactNode;
  hint?: React.ReactNode;
  error?: string | null;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
  htmlFor?: string;
}) {
  return (
    <div className={cn('space-y-1.5', className)}>
      {label && (
        <label htmlFor={htmlFor} className="block text-sm font-semibold text-brand-700">
          {label}
          {required && <span className="ms-1 text-bad">*</span>}
        </label>
      )}
      {children}
      {hint && !error && <p className="text-xs text-brand-400">{hint}</p>}
      {error && (
        <p className="text-xs font-medium text-bad" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

type InputProps = React.InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean };
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input({ className, invalid, ...rest }, ref) {
  return <input ref={ref} className={cn(control, invalid && 'ring-2 ring-bad', className)} {...rest} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea(
  { className, rows = 3, ...rest },
  ref,
) {
  return <textarea ref={ref} rows={rows} className={cn(control, 'resize-y', className)} {...rest} />;
});

export const Select = forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(function Select(
  { className, children, ...rest },
  ref,
) {
  return (
    <div className="relative">
      <select ref={ref} className={cn(control, 'appearance-none pe-10', className)} {...rest}>
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute end-3 top-1/2 size-4 -translate-y-1/2 text-brand-400" />
    </div>
  );
});

/** Champ avec libellé intégré : le plus courant */
export function TextField({
  label,
  hint,
  error,
  required,
  className,
  ...rest
}: InputProps & { label: React.ReactNode; hint?: React.ReactNode; error?: string | null }) {
  const id = useId();
  return (
    <Field label={label} hint={hint} error={error} required={required} htmlFor={id} className={className}>
      <Input id={id} required={required} invalid={!!error} {...rest} />
    </Field>
  );
}

export function SelectField({
  label,
  hint,
  error,
  required,
  className,
  children,
  ...rest
}: React.SelectHTMLAttributes<HTMLSelectElement> & { label: React.ReactNode; hint?: React.ReactNode; error?: string | null }) {
  const id = useId();
  return (
    <Field label={label} hint={hint} error={error} required={required} htmlFor={id} className={className}>
      <Select id={id} required={required} {...rest}>
        {children}
      </Select>
    </Field>
  );
}

export function TextareaField({
  label,
  hint,
  error,
  className,
  ...rest
}: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label: React.ReactNode; hint?: React.ReactNode; error?: string | null }) {
  const id = useId();
  return (
    <Field label={label} hint={hint} error={error} htmlFor={id} className={className}>
      <Textarea id={id} {...rest} />
    </Field>
  );
}

/** Interrupteur accessible */
export function Switch({
  checked,
  onChange,
  label,
  hint,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: React.ReactNode;
  hint?: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="flex min-h-11 w-full items-center justify-between gap-4 rounded-xl py-1.5 text-start disabled:opacity-50"
    >
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-brand-700">{label}</span>
        {hint && <span className="block text-xs text-brand-400">{hint}</span>}
      </span>
      <span className={cn('relative h-7 w-12 shrink-0 rounded-full transition', checked ? 'bg-brand-600' : 'bg-sand-300')}>
        <span
          className={cn(
            'absolute top-0.5 size-6 rounded-full bg-white shadow transition-all',
            checked ? 'end-0.5' : 'start-0.5',
          )}
        />
      </span>
    </button>
  );
}

export function Checkbox({
  checked,
  onChange,
  children,
  error,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  children: React.ReactNode;
  error?: string | null;
}) {
  return (
    <div>
      <label className="flex min-h-11 cursor-pointer items-start gap-3 py-1.5 text-sm text-brand-700">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="mt-0.5 size-5 shrink-0 rounded-md accent-brand-600"
        />
        <span>{children}</span>
      </label>
      {error && <p className="text-xs font-medium text-bad">{error}</p>}
    </div>
  );
}

/** Barre de recherche avec délai (évite d'interroger l'API à chaque lettre) */
export function SearchBox({
  value,
  onChange,
  placeholder,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
}) {
  const { t } = useLocale();
  const [local, setLocal] = useState(value);
  const first = useRef(true);
  useEffect(() => setLocal(value), [value]);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const id = setTimeout(() => local !== value && onChange(local), 300);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [local]);
  return (
    <div className={cn('relative', className)}>
      <Search className="pointer-events-none absolute start-3.5 top-1/2 size-4 -translate-y-1/2 text-brand-400" />
      <input
        type="search"
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        placeholder={placeholder || t('Rechercher…', 'بحث…')}
        className={cn(control, 'ps-10 pe-10')}
      />
      {local && (
        <button
          type="button"
          onClick={() => {
            setLocal('');
            onChange('');
          }}
          aria-label={t('Effacer', 'مسح')}
          className="absolute end-1.5 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-lg text-brand-400 hover:bg-sand-200"
        >
          <X className="size-4" />
        </button>
      )}
    </div>
  );
}

/** Choix unique en puces défilantes (filtres) */
export function Chips<T extends string>({
  value,
  onChange,
  options,
  className,
}: {
  value: T;
  onChange: (v: T) => void;
  options: Array<{ value: T; label: string; count?: number }>;
  className?: string;
}) {
  return (
    <div className={cn('scroll-x -mx-4 flex gap-2 px-4 md:mx-0 md:flex-wrap md:px-0', className)} role="radiogroup">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.value)}
            className={cn(
              'tap shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition',
              on ? 'bg-brand-600 text-white shadow-[0_6px_14px_-8px_rgb(18_43_35/0.8)]' : 'bg-white text-brand-600 shadow-card hover:bg-brand-50',
            )}
          >
            {o.label}
            {o.count !== undefined && <span className={cn('ms-1.5 text-xs', on ? 'text-white/70' : 'text-brand-400')}>{o.count}</span>}
          </button>
        );
      })}
    </div>
  );
}

/** Photo : aperçu rond + bouton pour choisir (caméra ou galerie) */
export function PhotoPicker({
  src,
  onPick,
  size = 96,
  busy,
  label,
}: {
  src?: string | null;
  onPick: (f: File) => void;
  size?: number;
  busy?: boolean;
  label?: string;
}) {
  const { t } = useLocale();
  const ref = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  useEffect(() => () => void (preview && URL.revokeObjectURL(preview)), [preview]);
  const shown = preview || src;
  return (
    <div className="flex items-center gap-4">
      <button
        type="button"
        onClick={() => ref.current?.click()}
        style={{ width: size, height: size }}
        className="group relative shrink-0 overflow-hidden rounded-full bg-sand-200 ring-2 ring-white shadow-card"
        aria-label={label || t('Choisir une photo', 'اختيار صورة')}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {shown ? <img src={shown} alt="" className="size-full object-cover" /> : <Camera className="m-auto size-6 text-brand-400" />}
        <span className="absolute inset-0 grid place-items-center bg-brand-800/50 text-white opacity-0 transition group-hover:opacity-100 group-focus-visible:opacity-100">
          <Camera className="size-5" />
        </span>
      </button>
      <div className="text-sm text-brand-500">
        <button type="button" onClick={() => ref.current?.click()} disabled={busy} className="font-semibold text-brand-600 underline-offset-2 hover:underline">
          {busy ? t('Envoi…', 'جارٍ الإرسال…') : label || t('Choisir une photo', 'اختيار صورة')}
        </button>
        <p className="text-xs text-brand-400">{t('JPG, PNG ou WebP', 'JPG أو PNG أو WebP')}</p>
      </div>
      <input
        ref={ref}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) {
            setPreview(URL.createObjectURL(f));
            onPick(f);
          }
          e.target.value = '';
        }}
      />
    </div>
  );
}
