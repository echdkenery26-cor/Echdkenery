'use client';

import { AlertTriangle, CheckCircle2, Info, Loader2, X, XCircle } from 'lucide-react';
import { createContext, useCallback, useContext, useEffect, useId, useRef, useState } from 'react';
import { useLocale } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { Button, IconButton } from './button';

/* ───────── Fenêtre (feuille en bas sur mobile, boîte centrée sur grand écran) ───────── */

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  size = 'md',
}: {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
}) {
  const { t } = useLocale();
  const id = useId();
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    const opener = document.activeElement as HTMLElement | null;
    panel.current?.focus();
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
      opener?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;
  const width = size === 'sm' ? 'md:max-w-md' : size === 'lg' ? 'md:max-w-3xl' : 'md:max-w-xl';
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center md:p-6" role="presentation">
      <div className="anim-fade absolute inset-0 bg-brand-900/50 backdrop-blur-[2px]" onClick={onClose} />
      <div
        ref={panel}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby={id}
        className={cn(
          'anim-sheet relative flex max-h-[92dvh] w-full flex-col rounded-t-3xl bg-paper shadow-lift outline-none md:rounded-3xl',
          width,
        )}
      >
        <div className="flex items-center justify-between gap-3 px-5 pt-4 pb-2">
          <h2 id={id} className="font-serif text-lg font-bold text-brand-800">
            {title}
          </h2>
          <IconButton label={t('Fermer', 'إغلاق')} onClick={onClose} className="-me-2">
            <X className="size-5" />
          </IconButton>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-3">{children}</div>
        {footer && <div className="safe-bottom flex flex-wrap items-center justify-end gap-2 border-t border-sand-200 px-5 pt-3 pb-3">{footer}</div>}
      </div>
    </div>
  );
}

/* ───────── Confirmation ───────── */

interface ConfirmOpts {
  title: string;
  message?: React.ReactNode;
  confirmLabel?: string;
  danger?: boolean;
}
type ConfirmFn = (o: ConfirmOpts) => Promise<boolean>;
const ConfirmCtx = createContext<ConfirmFn>(async () => false);
export const useConfirm = () => useContext(ConfirmCtx);

/* ───────── Messages (toasts) ───────── */

type ToastKind = 'ok' | 'error' | 'info';
interface ToastItem {
  id: number;
  kind: ToastKind;
  text: string;
}
interface ToastApi {
  ok: (text: string) => void;
  error: (text: string) => void;
  info: (text: string) => void;
}
const ToastCtx = createContext<ToastApi>({ ok() {}, error() {}, info() {} });
export const useToast = () => useContext(ToastCtx);

export function FeedbackProvider({ children }: { children: React.ReactNode }) {
  const { t } = useLocale();
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [dialog, setDialog] = useState<(ConfirmOpts & { resolve: (v: boolean) => void }) | null>(null);
  const seq = useRef(0);

  const push = useCallback((kind: ToastKind, text: string) => {
    const id = ++seq.current;
    setToasts((l) => [...l, { id, kind, text }]);
    setTimeout(() => setToasts((l) => l.filter((x) => x.id !== id)), kind === 'error' ? 6000 : 3500);
  }, []);
  const api = useRef<ToastApi>({
    ok: (x) => push('ok', x),
    error: (x) => push('error', x),
    info: (x) => push('info', x),
  }).current;

  const confirm = useCallback<ConfirmFn>((o) => new Promise((resolve) => setDialog({ ...o, resolve })), []);
  const close = (v: boolean) => {
    dialog?.resolve(v);
    setDialog(null);
  };

  return (
    <ToastCtx.Provider value={api}>
      <ConfirmCtx.Provider value={confirm}>
        {children}
        <Modal
          open={!!dialog}
          onClose={() => close(false)}
          title={dialog?.title}
          size="sm"
          footer={
            <>
              <Button variant="outline" onClick={() => close(false)}>
                {t('Annuler', 'إلغاء')}
              </Button>
              <Button variant={dialog?.danger ? 'danger' : 'dark'} onClick={() => close(true)}>
                {dialog?.confirmLabel || t('Confirmer', 'تأكيد')}
              </Button>
            </>
          }
        >
          {dialog?.message && <div className="text-sm text-brand-700">{dialog.message}</div>}
        </Modal>
        <div className="pointer-events-none fixed inset-x-0 bottom-24 z-[60] flex flex-col items-center gap-2 px-4 md:bottom-6" aria-live="polite">
          {toasts.map((x) => (
            <div
              key={x.id}
              role="status"
              className={cn(
                'anim-pop pointer-events-auto flex max-w-md items-start gap-2.5 rounded-2xl px-4 py-3 text-sm font-medium shadow-lift',
                x.kind === 'ok' && 'bg-brand-700 text-white',
                x.kind === 'error' && 'bg-bad text-white',
                x.kind === 'info' && 'bg-brand-800 text-white',
              )}
            >
              {x.kind === 'ok' ? <CheckCircle2 className="mt-0.5 size-4 shrink-0" /> : x.kind === 'error' ? <XCircle className="mt-0.5 size-4 shrink-0" /> : <Info className="mt-0.5 size-4 shrink-0" />}
              <span>{x.text}</span>
            </div>
          ))}
        </div>
      </ConfirmCtx.Provider>
    </ToastCtx.Provider>
  );
}

/* ───────── États ───────── */

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn('size-5 animate-spin text-brand-500', className)} aria-label="Chargement" />;
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-xl bg-sand-200/80', className)} />;
}

export function SkeletonCards({ n = 4 }: { n?: number }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: n }).map((_, i) => (
        <Skeleton key={i} className="h-28 rounded-3xl" />
      ))}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  text,
  action,
}: {
  icon?: React.ReactNode;
  title: string;
  text?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center rounded-3xl bg-white/70 px-6 py-12 text-center shadow-card">
      {icon && <div className="mb-3 grid size-14 place-items-center rounded-2xl bg-sand-200 text-brand-600">{icon}</div>}
      <p className="font-serif text-lg font-bold text-brand-800">{title}</p>
      {text && <p className="mt-1 max-w-sm text-sm text-brand-500">{text}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message?: string; onRetry?: () => void }) {
  const { t } = useLocale();
  return (
    <div className="flex flex-col items-center rounded-3xl bg-bad-soft px-6 py-10 text-center">
      <AlertTriangle className="mb-2 size-8 text-bad" />
      <p className="font-semibold text-bad">{t('Impossible de charger les données', 'تعذّر تحميل البيانات')}</p>
      {message && <p className="mt-1 text-sm text-bad/80">{message}</p>}
      {onRetry && (
        <Button className="mt-4" variant="outline" onClick={onRetry}>
          {t('Réessayer', 'إعادة المحاولة')}
        </Button>
      )}
    </div>
  );
}

export function Notice({ tone = 'info', children, className }: { tone?: 'info' | 'warn' | 'bad' | 'ok'; children: React.ReactNode; className?: string }) {
  const tones = {
    info: 'bg-info-soft text-info',
    warn: 'bg-warn-soft text-warn',
    bad: 'bg-bad-soft text-bad',
    ok: 'bg-ok-soft text-ok',
  };
  const Icon = tone === 'ok' ? CheckCircle2 : tone === 'info' ? Info : AlertTriangle;
  return (
    <div className={cn('flex items-start gap-2.5 rounded-2xl px-4 py-3 text-sm', tones[tone], className)} role={tone === 'bad' ? 'alert' : undefined}>
      <Icon className="mt-0.5 size-4 shrink-0" />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
