import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { PageHero, Section } from '@/components/site/blocks';
import { isLocale, trFor } from '@/lib/locale';
import { RegisterForm } from './register-form';

export const metadata: Metadata = { title: 'Pré-inscription · التسجيل المسبق' };

export default async function RegisterPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = trFor(locale);
  return (
    <>
      <PageHero
        title={t('Pré-inscription', 'التسجيل المسبق')}
        text={t('Trois étapes rapides. Nous vous recontactons pour confirmer la place.', 'ثلاث خطوات سريعة. سنتصل بكم لتأكيد المقعد.')}
      />
      <Section className="!pt-10">
        <RegisterForm />
      </Section>
    </>
  );
}
