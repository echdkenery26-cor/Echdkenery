//echd-backend/prisma/seed-admin.ts
/**
 * Crée (ou met à jour) UN SEUL compte administrateur, sans toucher au reste de la base.
 * Idempotent : on peut le relancer ; si l'e-mail existe déjà, le mot de passe est réinitialisé
 * et le verrouillage éventuel est levé.
 *
 * Variables lues dans .env :
 *   SEED_ADMIN_EMAIL       (obligatoire)
 *   SEED_ADMIN_PASSWORD    (obligatoire)
 *   SEED_ADMIN_USERNAME    (défaut : partie de l'e-mail avant @)
 *   SEED_ADMIN_FIRSTNAME   (défaut : Administrateur)
 *   SEED_ADMIN_MUST_CHANGE (défaut : true ; false = pas de changement imposé à la première connexion)
 *
 *   npx ts-node prisma/seed-admin.ts
 */
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

async function main() {
  const email = (process.env.SEED_ADMIN_EMAIL || '').trim().toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD || '';
  if (!email || !password) throw new Error('SEED_ADMIN_EMAIL et SEED_ADMIN_PASSWORD sont obligatoires dans le .env.');
  const username = (process.env.SEED_ADMIN_USERNAME || email.split('@')[0]).trim().toLowerCase();
  const firstName = process.env.SEED_ADMIN_FIRSTNAME || 'Administrateur';
  const mustChangePassword = process.env.SEED_ADMIN_MUST_CHANGE !== 'false';
  const passwordHash = await bcrypt.hash(password, 11);

  const host = (() => {
    try {
      return new URL(process.env.DATABASE_URL || '').host;
    } catch {
      return '(adresse illisible)';
    }
  })();
  console.log(`Base visée : ${host}`);

  const existing = await prisma.user.findFirst({ where: { OR: [{ email }, { username }] } });
  if (existing) {
    await prisma.user.update({
      where: { id: existing.id },
      data: { email, passwordHash, role: 'ADMIN', active: true, failedLogins: 0, lockedUntil: null, mustChangePassword },
    });
    console.log(`Compte existant mis à jour : ${existing.username} <${email}> (mot de passe réinitialisé).`);
  } else {
    await prisma.user.create({ data: { username, email, passwordHash, firstName, lastName: '', role: 'ADMIN', mustChangePassword } });
    console.log(`Compte administrateur créé : ${username} <${email}>.`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());