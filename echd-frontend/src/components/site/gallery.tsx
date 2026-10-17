//echd-frontend/src/components/site/gallery.tsx
import { Section, SectionHead } from '@/components/site/blocks';
import { Locale, trFor } from '@/lib/locale';

/** « La vie à l'école » : les illustrations de la page d'accueil (fichiers dans /public/images). */
export function Gallery({ locale }: { locale: Locale }) {
  const t = trFor(locale);

  const items = [
    {
      src: '/images/cour-ecole-matin.svg',
      title: t('Bienvenue à l’école', 'مرحباً بكم في المدرسة'),
      text: t('Une école ouverte aux enfants dès 6 ans et aux adultes.', 'مدرسة مفتوحة للأطفال من سن 6 سنوات وللكبار.'),
      alt: t('Illustration : la cour de l’école au lever du soleil', 'رسم توضيحي: ساحة المدرسة عند شروق الشمس'),
    },
    {
      src: '/images/lecture-coran.svg',
      title: t('Lire le Coran', 'قراءة القرآن'),
      text: t('Apprendre à lire pas à pas, avec un suivi individuel.', 'تعلّم القراءة خطوة بخطوة مع متابعة فردية.'),
      alt: t('Illustration : un livre ouvert sur un pupitre en bois', 'رسم توضيحي: كتاب مفتوح على حامل خشبي'),
    },
    {
      src: '/images/planche-apprentissage.svg',
      title: t('Écrire et mémoriser', 'الكتابة والحفظ'),
      text: t('La planche d’écriture, le calame et l’encrier : l’apprentissage comme on l’a toujours fait.', 'اللوح والقلم والدواة: التعلّم كما جرت العادة.'),
      alt: t('Illustration : une planche d’écriture, un calame et un encrier', 'رسم توضيحي: لوح للكتابة وقلم ودواة'),
    },
    {
      src: '/images/salle-de-cours.svg',
      title: t('Un cadre calme, en petits groupes', 'أجواء هادئة وفي مجموعات صغيرة'),
      text: t('Des pupitres de lecture installés dans une salle lumineuse.', 'حوامل للقراءة في قاعة مضيئة.'),
      alt: t('Illustration : une salle de cours lumineuse avec des pupitres de lecture', 'رسم توضيحي: قاعة دروس مضيئة فيها حوامل للقراءة'),
    },
  ];

  return (
    <Section tone="white">
      <SectionHead
        title={t('La vie à l’école', 'الحياة في المدرسة')}
        text={t('Un aperçu de l’ambiance : lecture, écriture et apprentissage.', 'لمحة عن الأجواء: القراءة والكتابة والتعلّم.')}
      />
      <div className="grid gap-5 sm:grid-cols-2">
        {items.map((it) => (
          <figure key={it.src} className="group overflow-hidden rounded-[1.25rem] bg-white shadow-card transition hover:-translate-y-0.5 hover:shadow-lift">
            <div className="relative overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={it.src}
                alt={it.alt}
                width={1200}
                height={800}
                loading="lazy"
                decoding="async"
                className="aspect-[3/2] w-full object-cover transition duration-500 group-hover:scale-[1.03]"
              />
              <span className="absolute start-3 top-3 rounded-full bg-white/85 px-2.5 py-0.5 text-xs font-semibold text-brand-700 shadow-card backdrop-blur">
                {t('Illustration', 'رسم توضيحي')}
              </span>
            </div>
            <figcaption className="p-4 sm:p-5">
              <p className="font-serif text-lg font-bold leading-snug text-brand-800">{it.title}</p>
              <p className="mt-1 text-sm leading-relaxed text-brand-500">{it.text}</p>
            </figcaption>
          </figure>
        ))}
      </div>
    </Section>
  );
}
