import { AppShell } from '@/components/app/shell';
import { AuthProvider } from '@/lib/auth';
import { pickFor } from '@/lib/locale';
import { getSettings } from '@/lib/server-api';

export default async function AppLayout({ children, params }: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const s = await getSettings();
  return (
    <AuthProvider>
      <AppShell name={pickFor(locale === 'ar' ? 'ar' : 'fr')(s['institute.name'].fr, s['institute.name'].ar)} logoUrl={s['institute.logoUrl']}>
        {children}
      </AppShell>
    </AuthProvider>
  );
}
