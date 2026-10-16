import { AuthProvider } from '@/lib/auth';
import { LangSwitch } from '@/components/site/lang-switch';
import { StarMark } from '@/components/brand';
import { getSettings } from '@/lib/server-api';
import { Logo } from '@/components/brand';
import { pickFor } from '@/lib/locale';

export default async function AuthLayout({ children, params }: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  const locale = (raw === 'ar' ? 'ar' : 'fr') as 'fr' | 'ar';
  const s = await getSettings();
  const name = pickFor(locale)(s['institute.name'].fr, s['institute.name'].ar);
  return (
    <AuthProvider>
      <div className="pattern-star relative flex min-h-dvh flex-col bg-brand-800">
        <div className="flex items-center justify-between px-4 py-4 sm:px-8">
          <span className="flex items-center gap-2.5 text-white">
            <Logo src={s['institute.logoUrl']} size={36} tone="light" />
            <span className="hidden font-serif text-sm font-bold sm:block">{name}</span>
          </span>
          <LangSwitch tone="dark" />
        </div>
        <div className="flex flex-1 items-center justify-center px-4 pb-12 pt-2">
          <div className="w-full max-w-md">{children}</div>
        </div>
        <StarMark className="pointer-events-none absolute -bottom-24 -end-24 size-72 text-gold-500/10" />
      </div>
    </AuthProvider>
  );
}
