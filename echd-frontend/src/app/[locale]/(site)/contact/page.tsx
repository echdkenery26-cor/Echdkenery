import { Clock, Mail, MapPin, MessageCircle, Phone } from 'lucide-react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { PageHero, Section } from '@/components/site/blocks';
import { LinkButton } from '@/components/ui/button';
import { isLocale, pickFor, trFor } from '@/lib/locale';
import { getSettings } from '@/lib/server-api';
import { telLink, waLink } from '@/lib/utils';

export const metadata: Metadata = { title: 'Contact · اتصل بنا' };

export default async function ContactPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = trFor(locale);
  const pick = pickFor(locale);
  const s = await getSettings();
  const address = pick(s['institute.address'].fr, s['institute.address'].ar);
  const hours = pick(s['institute.hours'].fr, s['institute.hours'].ar);
  const items = [
    s['institute.whatsapp'] && {
      key: 'wa',
      icon: <MessageCircle className="size-6" />,
      title: 'WhatsApp',
      text: t('Le moyen le plus rapide de nous joindre.', 'أسرع وسيلة للتواصل معنا.'),
      action: (
        <a href={waLink(s['institute.whatsapp'])} target="_blank" rel="noreferrer" className="tap mt-4 inline-flex items-center justify-center rounded-xl bg-gold-500 px-5 py-2.5 font-semibold text-brand-800">
          {t('Écrire un message', 'إرسال رسالة')}
        </a>
      ),
    },
    s['institute.phone'] && {
      key: 'tel',
      icon: <Phone className="size-6" />,
      title: t('Téléphone', 'الهاتف'),
      text: <span dir="ltr" style={{ unicodeBidi: 'plaintext' }}>{s['institute.phone']}</span>,
      action: (
        <a href={telLink(s['institute.phone'])} className="tap mt-4 inline-flex items-center justify-center rounded-xl bg-brand-600 px-5 py-2.5 font-semibold text-white">
          {t('Appeler', 'اتصال')}
        </a>
      ),
    },
    s['institute.email'] && {
      key: 'mail',
      icon: <Mail className="size-6" />,
      title: t('E-mail', 'البريد الإلكتروني'),
      text: s['institute.email'],
      action: (
        <a href={`mailto:${s['institute.email']}`} className="tap mt-4 inline-flex items-center justify-center rounded-xl bg-white px-5 py-2.5 font-semibold text-brand-700 ring-1 ring-inset ring-brand-200">
          {t('Envoyer un e-mail', 'إرسال بريد')}
        </a>
      ),
    },
    address && { key: 'addr', icon: <MapPin className="size-6" />, title: t('Adresse', 'العنوان'), text: address },
    hours && { key: 'hours', icon: <Clock className="size-6" />, title: t('Jours de cours', 'أيام الدراسة'), text: hours },
  ].filter(Boolean) as Array<{ key: string; icon: React.ReactNode; title: string; text: React.ReactNode; action?: React.ReactNode }>;

  return (
    <>
      <PageHero title={t('Nous contacter', 'اتصل بنا')} text={t('Une question avant de vous inscrire ? Écrivez-nous ou appelez-nous.', 'هل لديكم سؤال قبل التسجيل؟ راسلونا أو اتصلوا بنا.')} />
      <Section>
        {items.length ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((x) => (
              <article key={x.key} className="flex flex-col items-start rounded-[1.25rem] bg-white p-6 shadow-card">
                <span className="mb-4 grid size-12 place-items-center rounded-2xl bg-brand-50 text-brand-600">{x.icon}</span>
                <h2 className="font-serif text-lg font-bold text-brand-800">{x.title}</h2>
                <p className="mt-1 text-brand-500">{x.text}</p>
                {x.action}
              </article>
            ))}
          </div>
        ) : (
          <p className="rounded-2xl bg-white p-6 text-brand-500 shadow-card">{t('Les coordonnées seront bientôt publiées.', 'سيتم نشر بيانات الاتصال قريباً.')}</p>
        )}
        {s['site.registrationOpen'] && (
          <div className="mt-10 rounded-[1.25rem] bg-brand-800 p-6 text-white sm:flex sm:items-center sm:justify-between sm:gap-6 sm:p-8">
            <p className="font-serif text-xl font-bold">{t('Prêt à commencer ?', 'هل أنتم مستعدون للبدء؟')}</p>
            <LinkButton href="/register" variant="primary" size="lg" className="mt-4 sm:mt-0">
              {t('Pré-inscription', 'التسجيل المسبق')}
            </LinkButton>
          </div>
        )}
      </Section>
    </>
  );
}
