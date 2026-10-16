import type { NextConfig } from 'next';

// Adresse de l'API (côté serveur uniquement). Le navigateur parle toujours à ce site :
// /api/* est relayé vers l'API, ce qui évite tout souci de CORS et de cookies entre domaines.
const API_URL = (process.env.API_URL || 'http://localhost:4000').replace(/\/$/, '');

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
        ],
      },
      { source: '/sw.js', headers: [{ key: 'Cache-Control', value: 'no-cache' }] },
    ];
  },
  images: { unoptimized: true },
};

export default nextConfig;
