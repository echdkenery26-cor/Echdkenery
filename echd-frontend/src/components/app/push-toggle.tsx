//echd-frontend/src/components/app/push-toggle.tsx
'use client';

import { Bell, BellOff, Send } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardTitle } from '@/components/ui/display';
import { useToast } from '@/components/ui/feedback';
import { api } from '@/lib/api';
import { messageOf } from '@/lib/hooks';
import { useLocale } from '@/lib/i18n';

type PushStatus = { enabled: boolean; publicKey: string | null; devices: number };

function urlBase64ToBytes(b64: string) {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

/** Notifications sur l'appareil : relances, absences répétées… même application fermée. */
export function PushToggle() {
  const { t } = useLocale();
  const toast = useToast();
  const [status, setStatus] = useState<PushStatus | null>(null);
  const [supported, setSupported] = useState(true);
  const [subscribed, setSubscribed] = useState(false);
  const [perm, setPerm] = useState<NotificationPermission>('default');
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    try {
      setStatus(await api<PushStatus>('/push/status'));
    } catch {
      setStatus(null);
    }
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
      setSupported(false);
      return;
    }
    setPerm(Notification.permission);
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      setSubscribed(!!(await reg?.pushManager.getSubscription()));
    } catch {
      setSubscribed(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function enable() {
    if (!status?.publicKey) return;
    setBusy(true);
    try {
      const p = await Notification.requestPermission();
      setPerm(p);
      if (p !== 'granted') {
        toast.error(t('Notifications refusées dans le navigateur.', 'تم رفض الإشعارات في المتصفح.'));
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const sub =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToBytes(status.publicKey) }));
      await api('/push/subscribe', { method: 'POST', body: sub.toJSON() });
      toast.ok(t('Notifications activées sur cet appareil', 'تم تفعيل الإشعارات على هذا الجهاز'));
      await refresh();
    } catch (e) {
      toast.error(messageOf(e));
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await api('/push/unsubscribe', { method: 'POST', body: { endpoint: sub.endpoint } });
        await sub.unsubscribe();
      }
      toast.ok(t('Notifications désactivées sur cet appareil', 'تم إيقاف الإشعارات على هذا الجهاز'));
      await refresh();
    } catch (e) {
      toast.error(messageOf(e));
    } finally {
      setBusy(false);
    }
  }

  async function test() {
    setBusy(true);
    try {
      const r = await api<{ sent: number }>('/push/test', { method: 'POST' });
      if (r.sent > 0) toast.ok(t('Notification envoyée', 'تم إرسال الإشعار'));
      else toast.error(t('Aucun appareil n’a reçu la notification.', 'لم يستلم أي جهاز الإشعار.'));
    } catch (e) {
      toast.error(messageOf(e));
    } finally {
      setBusy(false);
    }
  }

  // Serveur sans clés VAPID : la fonction reste invisible plutôt que de proposer un bouton qui échoue.
  if (!status?.enabled) return null;

  return (
    <Card>
      <CardTitle icon={<Bell className="size-4" />}>{t('Notifications sur cet appareil', 'الإشعارات على هذا الجهاز')}</CardTitle>
      {!supported ? (
        <p className="text-sm text-brand-500">
          {t(
            'Ce navigateur ne gère pas les notifications. Sur iPhone, ajoutez d’abord l’application à l’écran d’accueil.',
            'هذا المتصفح لا يدعم الإشعارات. على آيفون، أضف التطبيق أولاً إلى الشاشة الرئيسية.',
          )}
        </p>
      ) : (
        <>
          <p className="mb-3 text-sm text-brand-500">
            {t('Recevez les alertes (retards de paiement, absences, préinscriptions) même quand l’application est fermée.', 'استقبل التنبيهات (تأخر السداد، الغياب، التسجيلات المسبقة) حتى عندما يكون التطبيق مغلقاً.')}
          </p>
          {perm === 'denied' && (
            <p className="mb-3 text-sm font-medium text-bad">{t('Les notifications sont bloquées : autorisez-les dans les réglages du navigateur.', 'الإشعارات محظورة: اسمح بها من إعدادات المتصفح.')}</p>
          )}
          <div className="flex flex-wrap gap-2">
            {subscribed ? (
              <>
                <Button variant="outline" loading={busy} onClick={disable} icon={<BellOff className="size-4" />}>{t('Désactiver', 'إيقاف')}</Button>
                <Button variant="soft" loading={busy} onClick={test} icon={<Send className="size-4" />}>{t('Envoyer un test', 'إرسال تجربة')}</Button>
              </>
            ) : (
              <Button variant="primary" loading={busy} disabled={perm === 'denied'} onClick={enable} icon={<Bell className="size-4" />}>{t('Activer', 'تفعيل')}</Button>
            )}
          </div>
        </>
      )}
    </Card>
  );
}
