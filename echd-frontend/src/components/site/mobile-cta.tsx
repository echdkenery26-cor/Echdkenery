'use client';

import { usePathname } from 'next/navigation';
import { LinkButton } from '@/components/ui/button';
import { useLocale } from '@/lib/i18n';
import { stripLocale } from '@/lib/locale';

/** Bouton d'inscription collé en bas sur téléphone (caché sur le formulaire lui-même). */
export function MobileCta() {
  const { t } = useLocale();
  const path = stripLocale(usePathname() || '/');
  if (path.startsWith('/register')) return null;
  return (
    <div className="safe-bottom pointer-events-none fixed inset-x-0 bottom-0 z-30 px-4 sm:hidden">
      <LinkButton href="/register" variant="primary" size="lg" full className="pointer-events-auto shadow-lift">
        {t('Pré-inscription', 'التسجيل المسبق')}
      </LinkButton>
    </div>
  );
}
