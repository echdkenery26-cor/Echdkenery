// Génère les icônes de l'application (PWA) : node scripts/make-icons.mjs
// Motif : étoile à huit branches (Rub el Hizb) dorée sur fond vert.
import sharp from 'sharp';
import { mkdirSync } from 'node:fs';

const out = new URL('../public/icons/', import.meta.url).pathname;
mkdirSync(out, { recursive: true });

const GREEN = '#1F4A3A';
const DARK = '#122B23';
const GOLD = '#CFAE55';

function svg(size, { maskable = false } = {}) {
  const c = size / 2;
  const r = size * (maskable ? 0.27 : 0.32); // zone sûre plus petite pour les icônes « maskable »
  const sq = (rot) => `<rect x="${c - r}" y="${c - r}" width="${r * 2}" height="${r * 2}" rx="${r * 0.06}" transform="rotate(${rot} ${c} ${c})"/>`;
  const radius = maskable ? 0 : size * 0.22;
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${GREEN}"/><stop offset="1" stop-color="${DARK}"/></linearGradient></defs>
  <rect width="${size}" height="${size}" rx="${radius}" fill="url(#g)"/>
  <g fill="${GOLD}">${sq(0)}${sq(45)}</g>
  <circle cx="${c}" cy="${c}" r="${r * 0.46}" fill="${GREEN}"/>
  <circle cx="${c}" cy="${c}" r="${r * 0.2}" fill="${GOLD}"/>
</svg>`);
}

const jobs = [
  ['icon-192.png', 192, false],
  ['icon-512.png', 512, false],
  ['icon-maskable-512.png', 512, true],
  ['apple-touch-icon.png', 180, true],
];
for (const [name, size, maskable] of jobs) {
  await sharp(svg(size, { maskable })).png().toFile(out + name);
  console.log('✓', name);
}
