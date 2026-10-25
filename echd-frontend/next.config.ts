//echd-frontend/next.config.ts
import type { NextConfig } from 'next';

// Adresse de l'API (côté serveur uniquement). Le navigateur parle toujours à ce site :
// /api/* est relayé vers l'API, ce qui évite tout souci de CORS et de cookies entre domaines.
const API_URL = (process.env.API_URL || 'http://localhost:4000').replace(/\/$/, '');

const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://res.cloudinary.com",
  "font-src 'self' data:",
  "connect-src 'self' https://res.cloudinary.com",
  "frame-ancestors 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join('; ');

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  async redirects() {
    return [{ source: '/', destination: '/fr', permanent: false }];
  },
  async rewrites() {
    return [{ source: '/api/:path*', destination: `${API_URL}/api/:path*` }];
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
          // Mode « rapport seulement » : rien n'est bloqué, les violations s'affichent dans la console du navigateur.
          // Après une semaine sans alerte, remplacez la clé par « Content-Security-Policy » pour l'appliquer.
          { key: 'Content-Security-Policy-Report-Only', value: CSP },
        ],
      },
      { source: '/sw.js', headers: [{ key: 'Cache-Control', value: 'no-cache' }] },
    ];
  },
  images: { unoptimized: true },
};

export default nextConfig;
