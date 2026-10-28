//echd-frontend/src/components/ui/display.tsx
'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useLocale } from '@/lib/i18n';
import { initials } from '@/lib/locale';
import { cn } from '@/lib/utils';
import { AutoFit } from './auto-fit';
import { Link } from './button';

/* ───────── Carte : l'unité de base du back-office ───────── */

export function Card({
  children,
  className,
  href,
  onClick,
  padded = true,
  as: As = 'div',
}: {
  children: React.ReactNode;
  className?: string;
  href?: string;
  onClick?: () => void;
  padded?: boolean;
  as?: 'div' | 'section' | 'article' | 'li';
}) {
  const cls = cn(
    'rounded-[1.25rem] bg-white shadow-card',
    padded && 'p-4 sm:p-5',
    (href || onClick) && 'block w-full text-start transition hover:-translate-y-0.5 hover:shadow-lift active:translate-y-0',
    className,
  );
  if (href)
    return (
      <Link href={href} className={cls}>
        {children}
      </Link>
    );
  if (onClick)
    return (
      <button type="button" onClick={onClick} className={cls}>
        {children}
      </button>
    );
  return <As className={cls}>{children}</As>;
}

export function CardTitle({ children, action, icon }: { children: React.ReactNode; action?: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h3 className="flex items-center gap-2 font-serif text-base font-bold text-brand-800">
        {icon && <span className="grid size-8 place-items-center rounded-xl bg-brand-50 text-brand-600">{icon}</span>}
        {children}
      </h3>
      {action}
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  actions,
  back,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  back?: React.ReactNode;
}) {
  return (
    <header className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {back}
        <h1 className="font-serif text-2xl font-bold leading-tight text-brand-800 sm:text-[1.75rem]">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-brand-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2 whitespace-nowrap max-sm:[&>*]:flex-1 max-sm:[&>.relative>button]:w-full">{actions}</div>}
    </header>
  );
}

/* ───────── Pastilles d'état ───────── */

export type Tone = 'neutral' | 'ok' | 'warn' | 'bad' | 'info' | 'gold' | 'dark';
const tones: Record<Tone, string> = {
  neutral: 'bg-sand-200 text-brand-600',
  ok: 'bg-ok-soft text-ok',
  warn: 'bg-warn-soft text-warn',
  bad: 'bg-bad-soft text-bad',
  info: 'bg-info-soft text-info',
  gold: 'bg-gold-200 text-gold-700',
  dark: 'bg-brand-600 text-white',
};

export function Badge({ tone = 'neutral', children, className }: { tone?: Tone; children: React.ReactNode; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap', tones[tone], className)}>
      {children}
    </span>
  );
}

/* ───────── Avatar ───────── */

export function Avatar({
  src,
  first,
  last,
  size = 44,
  className,
}: {
  src?: string | null;
  first?: string | null;
  last?: string | null;
  size?: number;
  className?: string;
}) {
  const style = { width: size, height: size, fontSize: Math.max(12, size * 0.36) };
  if (src)
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={src} alt="" style={style} className={cn('shrink-0 rounded-full bg-sand-200 object-cover ring-2 ring-white', className)} />
    );
  return (
    <span
      style={style}
      className={cn('grid shrink-0 place-items-center rounded-full bg-brand-100 font-bold text-brand-600 ring-2 ring-white', className)}
      aria-hidden
    >
      {initials(first, last)}
    </span>
  );
}

/* ───────── Chiffres clés ───────── */

export function StatCard({
  label,
  value,
  icon,
  tone = 'neutral',
  href,
  hint,
}: {
  label: string;
  value: React.ReactNode;
  icon?: React.ReactNode;
  tone?: 'neutral' | 'ok' | 'warn' | 'bad' | 'gold';
  href?: string;
  hint?: React.ReactNode;
}) {
  const bubble = {
    neutral: 'bg-brand-50 text-brand-600',
    ok: 'bg-ok-soft text-ok',
    warn: 'bg-warn-soft text-warn',
    bad: 'bg-bad-soft text-bad',
    gold: 'bg-gold-200 text-gold-700',
  }[tone];
  return (
    <Card href={href} className="flex min-w-0 flex-col gap-2.5 !p-3.5 sm:!p-4">
      <div className="flex items-center gap-2">
        {icon && <span className={cn('grid size-9 shrink-0 place-items-center rounded-xl [&_svg]:size-[1.15rem]', bubble)}>{icon}</span>}
        <p className="line-clamp-2 min-w-0 break-words text-[0.78rem] font-semibold leading-snug text-brand-500">{label}</p>
      </div>
      {typeof value === 'string' || typeof value === 'number' ? (
        <AutoFit maxSize={24} minSize={14} className="num font-serif font-bold text-brand-800">
          {value}
        </AutoFit>
      ) : (
        <p className="num font-serif text-2xl font-bold leading-tight text-brand-800">{value}</p>
      )}
      {hint && <p className="-mt-1 min-w-0 break-words text-xs text-brand-400">{hint}</p>}
    </Card>
  );
}

export function ProgressBar({ value, max = 100, tone = 'ok', label }: { value: number; max?: number; tone?: 'ok' | 'gold' | 'bad'; label?: string }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  const color = tone === 'gold' ? 'bg-gold-500' : tone === 'bad' ? 'bg-bad' : 'bg-mint';
  return (
    <div
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
      className="h-2.5 w-full overflow-hidden rounded-full bg-sand-200"
    >
      <div className={cn('h-full rounded-full transition-all', color)} style={{ width: `${pct}%` }} />
    </div>
  );
}

/* ───────── Onglets ───────── */

export function Tabs<T extends string>({
  value,
  onChange,
  tabs,
}: {
  value: T;
  onChange: (v: T) => void;
  tabs: Array<{ value: T; label: string; badge?: number | string }>;
}) {
  return (
    <div className="scroll-x -mx-4 mb-5 px-4 md:mx-0 md:px-0" role="tablist">
      <div className="inline-flex min-w-full gap-1 rounded-2xl bg-sand-200/70 p-1 md:min-w-0">
        {tabs.map((tb) => {
          const on = tb.value === value;
          return (
            <button
              key={tb.value}
              role="tab"
              type="button"
              aria-selected={on}
              onClick={() => onChange(tb.value)}
              className={cn(
                'tap flex-1 shrink-0 rounded-xl px-2.5 py-2 text-sm font-semibold whitespace-nowrap transition sm:px-4',
                on ? 'bg-white text-brand-700 shadow-card' : 'text-brand-500 hover:text-brand-700',
              )}
            >
              {tb.label}
              {tb.badge !== undefined && tb.badge !== 0 && (
                <span className="ms-1.5 rounded-full bg-gold-500 px-1.5 py-0.5 text-[0.7rem] font-bold text-brand-800">{tb.badge}</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ───────── Pagination ───────── */

export function Pagination({ page, pageSize, total, onChange }: { page: number; pageSize: number; total: number; onChange: (p: number) => void }) {
  const { t, num, isAr } = useLocale();
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  const Prev = isAr ? ChevronRight : ChevronLeft;
  const Next = isAr ? ChevronLeft : ChevronRight;
  return (
    <nav className="mt-5 flex items-center justify-between gap-3" aria-label="Pagination">
      <button
        type="button"
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
        className="tap inline-flex items-center gap-1 rounded-xl bg-white px-3 text-sm font-semibold text-brand-700 shadow-card disabled:opacity-40"
      >
        <Prev className="size-4" /> {t('Précédent', 'السابق')}
      </button>
      <span className="num text-sm text-brand-500">
        {num(page)} / {num(pages)}
      </span>
      <button
        type="button"
        disabled={page >= pages}
        onClick={() => onChange(page + 1)}
        className="tap inline-flex items-center gap-1 rounded-xl bg-white px-3 text-sm font-semibold text-brand-700 shadow-card disabled:opacity-40"
      >
        {t('Suivant', 'التالي')} <Next className="size-4" />
      </button>
    </nav>
  );
}

/* ───────── Détail « libellé : valeur » ───────── */

export function KV({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-col gap-0.5 py-2 sm:flex-row sm:items-baseline sm:gap-4', className)}>
      <dt className="shrink-0 text-sm text-brand-400 sm:w-40">{label}</dt>
      <dd className="min-w-0 break-words text-sm font-medium text-brand-800">{children || <span className="text-brand-300">—</span>}</dd>
    </div>
  );
}

export function SectionTitle({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="mb-3 mt-7 flex items-center justify-between gap-3 first:mt-0">
      <h2 className="font-serif text-lg font-bold text-brand-800">{children}</h2>
      {action}
    </div>
  );
}

/** Grille de cartes adaptative */
export function CardGrid({ children, cols = 3 }: { children: React.ReactNode; cols?: 2 | 3 | 4 }) {
  return (
    <div className={cn('grid gap-3 sm:gap-4 sm:grid-cols-2', cols >= 3 && 'xl:grid-cols-3', cols === 4 && '2xl:grid-cols-4')}>{children}</div>
  );
}
