import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="grid min-h-dvh place-items-center bg-paper px-6 text-center">
      <div>
        <p className="font-serif text-6xl font-bold text-gold-500">404</p>
        <p className="mt-3 text-lg text-brand-700">Page introuvable · الصفحة غير موجودة</p>
        <Link href="/fr" className="tap mt-6 inline-flex items-center rounded-xl bg-brand-600 px-5 py-2.5 font-semibold text-white">
          Accueil · الرئيسية
        </Link>
      </div>
    </div>
  );
}
