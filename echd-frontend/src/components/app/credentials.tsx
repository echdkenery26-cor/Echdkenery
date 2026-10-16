'use client';

import { Check, Copy, KeyRound, MessageCircle, Printer } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Modal, Notice } from '@/components/ui/feedback';
import { useLocale } from '@/lib/i18n';
import { waLink } from '@/lib/utils';

export interface Credentials {
  username: string;
  temporaryPassword: string;
}

/** Identifiants provisoires : affichés une seule fois (le mot de passe n'est pas conservé en clair). */
export function CredentialsModal({ creds, name, onClose }: { creds: Credentials | null; name?: string; onClose: () => void }) {
  const { t } = useLocale();
  const [copied, setCopied] = useState(false);
  const url = typeof window !== 'undefined' ? `${window.location.origin}/fr/login` : '';
  const text = creds
    ? t(
        `Bonjour${name ? ' ' + name : ''},\nVoici vos accès à l’espace de l’école :\n${url}\nIdentifiant : ${creds.username}\nMot de passe provisoire : ${creds.temporaryPassword}\nVous devrez le changer à votre première connexion.`,
        `السلام عليكم${name ? ' ' + name : ''}،\nهذه بيانات دخولكم إلى فضاء المدرسة:\n${url}\nاسم المستخدم: ${creds.username}\nكلمة المرور المؤقتة: ${creds.temporaryPassword}\nسيُطلب منكم تغييرها عند أول دخول.`,
      )
    : '';

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      /* ignoré */
    }
  }

  return (
    <Modal open={!!creds} onClose={onClose} title={t('Identifiants de connexion', 'بيانات الدخول')}>
      {creds && (
        <div className="space-y-4">
          <Notice tone="warn">{t('Notez-les maintenant : le mot de passe ne sera plus affichable ensuite. La personne devra le changer à sa première connexion.', 'دوّنها الآن: لن يمكن عرض كلمة المرور لاحقاً، وسيُطلب تغييرها عند أول دخول.')}</Notice>
          <div className="space-y-3 rounded-2xl bg-sand-100 p-4">
            <div>
              <p className="text-xs text-brand-400">{t('Identifiant', 'اسم المستخدم')}</p>
              <p dir="ltr" className="select-all text-start font-mono text-lg font-bold text-brand-800">{creds.username}</p>
            </div>
            <div>
              <p className="text-xs text-brand-400">{t('Mot de passe provisoire', 'كلمة المرور المؤقتة')}</p>
              <p dir="ltr" className="select-all text-start font-mono text-lg font-bold text-brand-800">{creds.temporaryPassword}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" onClick={copy} icon={copied ? <Check className="size-4" /> : <Copy className="size-4" />}>{copied ? t('Copié', 'تم النسخ') : t('Copier le message', 'نسخ الرسالة')}</Button>
            <a href={waLink('', text)} target="_blank" rel="noreferrer" className="tap inline-flex items-center gap-2 rounded-2xl bg-white px-4 text-sm font-semibold text-ok shadow-card"><MessageCircle className="size-4" /> WhatsApp</a>
            <Button variant="outline" icon={<Printer className="size-4" />} onClick={() => window.print()}>{t('Imprimer', 'طباعة')}</Button>
          </div>
        </div>
      )}
    </Modal>
  );
}

export const CredentialsIcon = KeyRound;
