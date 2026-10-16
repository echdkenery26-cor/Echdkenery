'use client';

import { Loader2 } from 'lucide-react';
import NextLink from 'next/link';
import { forwardRef } from 'react';
import { useLocale } from '@/lib/i18n';
import { cn } from '@/lib/utils';

export type Variant = 'primary' | 'dark' | 'outline' | 'soft' | 'ghost' | 'danger';
export type Size = 'sm' | 'md' | 'lg';

const base =
  'tap inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition select-none disabled:opacity-50 disabled:pointer-events-none active:scale-[0.98]';

const variants: Record<Variant, string> = {
  // Un seul bouton « primary » (or) par écran : l'action principale
  primary: 'bg-gold-500 text-brand-800 shadow-[0_6px_16px_-8px_rgb(176_143_58/0.9)] hover:bg-gold-400',
  dark: 'bg-brand-600 text-white shadow-[0_6px_16px_-8px_rgb(18_43_35/0.8)] hover:bg-brand-500',
  outline: 'bg-white text-brand-700 ring-1 ring-inset ring-brand-200 hover:bg-brand-50',
  soft: 'bg-brand-50 text-brand-700 hover:bg-brand-100',
  ghost: 'text-brand-700 hover:bg-brand-50',
  danger: 'bg-bad-soft text-bad hover:bg-[#f6d3ce]',
};
const sizes: Record<Size, string> = {
  sm: 'px-3 py-1.5 text-sm min-h-9',
  md: 'px-4 py-2.5 text-[0.95rem]',
  lg: 'px-6 py-3 text-base',
};

export const buttonClass = (v: Variant = 'dark', s: Size = 'md', extra?: string) => cn(base, variants[v], sizes[s], extra);

interface BtnProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: React.ReactNode;
  full?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, BtnProps>(function Button(
  { variant = 'dark', size = 'md', loading, icon, full, className, children, disabled, type = 'button', ...rest },
  ref,
) {
  return (
    <button ref={ref} type={type} disabled={disabled || loading} className={cn(buttonClass(variant, size), full && 'w-full', className)} {...rest}>
      {loading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : icon}
      {children}
    </button>
  );
});

export const IconButton = forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement> & { label: string; variant?: Variant }>(
  function IconButton({ label, variant = 'ghost', className, children, type = 'button', ...rest }, ref) {
    return (
      <button ref={ref} type={type} aria-label={label} title={label} className={cn(base, variants[variant], 'size-11 p-0', className)} {...rest}>
        {children}
      </button>
    );
  },
);

/** Lien interne (ajoute automatiquement la langue) */
export function Link({ href, ...rest }: React.ComponentProps<typeof NextLink>) {
  const { href: h } = useLocale();
  const target = typeof href === 'string' ? h(href) : href;
  return <NextLink href={target} {...rest} />;
}

export function LinkButton({
  href,
  variant = 'dark',
  size = 'md',
  icon,
  full,
  className,
  children,
  ...rest
}: Omit<React.ComponentProps<typeof NextLink>, 'href'> & { href: string; variant?: Variant; size?: Size; icon?: React.ReactNode; full?: boolean }) {
  return (
    <Link href={href} className={cn(buttonClass(variant, size), full && 'w-full', className)} {...rest}>
      {icon}
      {children}
    </Link>
  );
}
