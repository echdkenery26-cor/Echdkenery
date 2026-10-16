import type { MetadataRoute } from 'next';
import { getSettings } from '@/lib/server-api';

export const dynamic = 'force-dynamic';

/** Manifeste de l'application installable : le nom vient des paramètres de l'école. */
export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const s = await getSettings();
  const name = s['institute.name'].fr;
  return {
    name,
    short_name: s['institute.shortName'] || 'ECHD',
    description: s['institute.presentation'].fr,
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#FDFCF7',
    theme_color: '#1F4A3A',
    lang: s['site.defaultLanguage'] === 'ar' ? 'ar' : 'fr',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
