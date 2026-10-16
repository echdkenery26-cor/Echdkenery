import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { PageHero, Section } from '@/components/site/blocks';
import { isLocale, pickFor, trFor } from '@/lib/locale';
import { getSettings } from '@/lib/server-api';

export const metadata: Metadata = { title: 'Confidentialité · الخصوصية' };

export default async function PrivacyPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = trFor(locale);
  const pick = pickFor(locale);
  const s = await getSettings();
  const custom = pick(s['site.privacyPolicy'].fr, s['site.privacyPolicy'].ar);
  const fallback = [
    [t('Ce que nous collectons', 'ما نجمعه'), t('Les informations saisies dans le formulaire de pré-inscription : nom, date de naissance, coordonnées du responsable et, si vous le souhaitez, une photo.', 'المعلومات المدخلة في استمارة التسجيل المسبق: الاسم وتاريخ الميلاد وبيانات ولي الأمر وصورة إن رغبتم.')],
    [t('Pourquoi', 'لماذا'), t('Uniquement pour traiter la demande d’inscription, organiser les cours et vous contacter.', 'فقط لمعالجة طلب التسجيل وتنظيم الدروس والتواصل معكم.')],
    [t('Qui y accède', 'من يطّلع عليها'), t('Le personnel autorisé de l’école. Les données ne sont ni vendues ni transmises à des tiers.', 'العاملون المخوّلون في المدرسة. لا تُباع البيانات ولا تُنقل إلى أطراف أخرى.')],
    [t('Vos droits', 'حقوقكم'), t('Vous pouvez demander à consulter, corriger ou supprimer vos données en contactant l’école.', 'يمكنكم طلب الاطلاع على بياناتكم أو تصحيحها أو حذفها بالتواصل مع المدرسة.')],
  ];
  return (
    <>
      <PageHero title={t('Confidentialité', 'الخصوصية')} />
      <Section>
        <div className="mx-auto max-w-3xl">
          {custom ? (
            <div className="whitespace-pre-line text-lg leading-relaxed text-brand-700">{custom}</div>
          ) : (
            <div className="space-y-4">
              {fallback.map(([title, text]) => (
                <section key={title} className="rounded-[1.25rem] bg-white p-6 shadow-card">
                  <h2 className="font-serif text-lg font-bold text-brand-800">{title}</h2>
                  <p className="mt-1.5 leading-relaxed text-brand-600">{text}</p>
                </section>
              ))}
            </div>
          )}
        </div>
      </Section>
    </>
  );
}
