import { Clock, Mail, MapPin, MessageCircle, Phone } from 'lucide-react';
import { Logo } from '@/components/brand';
import { Link } from '@/components/ui/button';
import { Locale, pickFor, trFor } from '@/lib/locale';
import { SiteSettings } from '@/lib/server-api';
import { telLink, waLink } from '@/lib/utils';

export function SiteFooter({ locale, s }: { locale: Locale; s: SiteSettings }) {
  const t = trFor(locale);
  const pick = pickFor(locale);
  const name = pick(s['institute.name'].fr, s['institute.name'].ar);
  const address = pick(s['institute.address'].fr, s['institute.address'].ar);
  const hours = pick(s['institute.hours'].fr, s['institute.hours'].ar);
  const phone = s['institute.phone'];
  const wa = s['institute.whatsapp'];
  const mail = s['institute.email'];

  const row = 'flex items-start gap-3 text-sm text-white/85';
  return (
    <footer className="bg-brand-800 pb-24 text-white sm:pb-0">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-[1.2fr_1fr_1fr]">
        <div>
          <div className="flex items-center gap-3">
            <Logo src={s['institute.logoUrl']} size={44} tone="light" />
            <p className="font-serif text-lg font-bold leading-snug">{name}</p>
          </div>
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-white/70">{pick(s['institute.presentation'].fr, s['institute.presentation'].ar)}</p>
        </div>

        <div className="space-y-3">
          <p className="font-serif font-bold text-gold-400">{t('Nous trouver', 'تجدوننا')}</p>
          {address && (
            <p className={row}>
              <MapPin className="mt-0.5 size-4 shrink-0 text-gold-400" /> {address}
            </p>
          )}
          {hours && (
            <p className={row}>
              <Clock className="mt-0.5 size-4 shrink-0 text-gold-400" /> {hours}
            </p>
          )}
          {phone && (
            <a href={telLink(phone)} className={row} dir="ltr" style={{ unicodeBidi: 'plaintext' }}>
              <Phone className="mt-0.5 size-4 shrink-0 text-gold-400" /> {phone}
            </a>
          )}
          {wa && (
            <a href={waLink(wa)} className={row} target="_blank" rel="noreferrer">
              <MessageCircle className="mt-0.5 size-4 shrink-0 text-gold-400" /> WhatsApp
            </a>
          )}
          {mail && (
            <a href={`mailto:${mail}`} className={row}>
              <Mail className="mt-0.5 size-4 shrink-0 text-gold-400" /> {mail}
            </a>
          )}
        </div>

        <div className="space-y-2.5 text-sm">
          <p className="font-serif font-bold text-gold-400">{t('Liens utiles', 'روابط مفيدة')}</p>
          {[
            ['/courses', t('Cours', 'الدروس')],
            ['/schedule', t('Horaires', 'المواعيد')],
            ['/register', t('Pré-inscription', 'التسجيل المسبق')],
            ['/privacy', t('Confidentialité', 'الخصوصية')],
            ['/login', t('Espace gestion', 'فضاء الإدارة')],
          ].map(([href, label]) => (
            <Link key={href} href={href} className="block py-1 text-white/85 hover:text-white">
              {label}
            </Link>
          ))}
        </div>
      </div>
      <div className="border-t border-white/10 py-4 text-center text-xs text-white/50">
        © {new Date().getFullYear()} {name}
      </div>
    </footer>
  );
}
