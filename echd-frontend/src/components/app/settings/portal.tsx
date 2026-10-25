//echd-frontend/src/components/app/settings/portal.tsx
'use client';

import { ShieldOff } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useConfirm, useToast } from '@/components/ui/feedback';
import { post } from '@/lib/api';
import { messageOf } from '@/lib/hooks';
import { useLocale } from '@/lib/i18n';

/** Invalide d'un coup tous les liens « suivi parents » déjà envoyés (par exemple si l'un d'eux a fuité). */
export function RevokePortalLinks() {
  const { t } = useLocale();
  const toast = useToast();
  const confirm = useConfirm();
  const [busy, setBusy] = useState(false);

  async function run() {
    const ok = await confirm({
      title: t('Révoquer tous les liens parents ?', 'إلغاء جميع روابط أولياء الأمور؟'),
      message: t('Tous les liens déjà envoyés cesseront de fonctionner. Vous pourrez en générer de nouveaux depuis la fiche de chaque élève.', 'ستتوقف جميع الروابط المرسلة عن العمل. يمكنك إنشاء روابط جديدة من بطاقة كل طالب.'),
      danger: true,
      confirmLabel: t('Révoquer', 'إلغاء الروابط'),
    });
    if (!ok) return;
    setBusy(true);
    try {
      await post('/portal/revoke-all');
      toast.ok(t('Tous les liens ont été révoqués', 'تم إلغاء جميع الروابط'));
    } catch (e) {
      toast.error(messageOf(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-sand-100 p-3">
      <p className="min-w-0 flex-1 text-sm text-brand-600">{t('Un lien a été partagé par erreur ? Révoquez-les tous.', 'تمت مشاركة رابط بالخطأ؟ ألغِ جميع الروابط.')}</p>
      <Button variant="outline" size="sm" loading={busy} icon={<ShieldOff className="size-4" />} onClick={run}>
        {t('Révoquer tous les liens', 'إلغاء جميع الروابط')}
      </Button>
    </div>
  );
}
