import { cn } from '@/lib/utils';

/** Étoile à huit branches (khatam) : motif géométrique de l'école, utilisé comme repère de marque. */
export function StarMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 72 72" className={className} aria-hidden fill="none">
      <path
        d="M36 4l8 13.6L59.5 13l-4.5 15.7L68 36l-13 7.3 4.5 15.7L44 54.4 36 68l-8-13.6L12.5 59 17 43.3 4 36l13-7.3L12.5 13 28 17.6z"
        fill="currentColor"
      />
      <circle cx="36" cy="36" r="9" fill="var(--color-brand-600)" />
      <circle cx="36" cy="36" r="4" fill="currentColor" />
    </svg>
  );
}

/** Logo : l'image configurée dans l'administration, sinon l'étoile. */
export function Logo({ src, size = 44, className, tone = 'dark' }: { src?: string | null; size?: number; className?: string; tone?: 'dark' | 'light' }) {
  if (src)
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={src} alt="" width={size} height={size} style={{ width: size, height: size }} className={cn('shrink-0 rounded-xl object-contain', className)} />
    );
  return (
    <span
      style={{ width: size, height: size }}
      className={cn(
        'grid shrink-0 place-items-center rounded-xl',
        tone === 'dark' ? 'bg-brand-600 text-gold-500' : 'bg-white/10 text-gold-400',
        className,
      )}
      aria-hidden
    >
      <StarMark className="size-[68%]" />
    </span>
  );
}
