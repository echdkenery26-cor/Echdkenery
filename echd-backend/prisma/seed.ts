//echd-backend/prisma/seed.ts
/**
 * Données de départ ECHD — idempotent : on peut le relancer sans créer de doublons
 * et sans écraser ce que l'administrateur a modifié (on ne crée que ce qui manque).
 *
 *   npx prisma db seed
 */
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { Audience, PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

const d = (s: string) => new Date(`${s}T00:00:00.000Z`);

async function main() {
  /* ── Niveaux ── */
  const levelDefs = [
    { code: 'N0', labelFr: 'Niveau 0', labelAr: 'المستوى صفر', order: 0 },
    { code: 'BEGINNER', labelFr: 'Débutant', labelAr: 'مبتدئ', order: 1 },
    { code: 'INTERMEDIATE', labelFr: 'Intermédiaire', labelAr: 'متوسط', order: 2 },
    { code: 'ADVANCED', labelFr: 'Confirmé', labelAr: 'متقدم', order: 3 },
  ];
  const level: Record<string, string> = {};
  for (const l of levelDefs) {
    const row = await prisma.level.upsert({ where: { code: l.code }, update: {}, create: l });
    level[l.code] = row.id;
  }

  /* ── Année scolaire (hypothèse : septembre → juin, modifiable dans l'admin) ── */
  let year = await prisma.schoolYear.findFirst({ where: { isCurrent: true } });
  if (!year) {
    year = await prisma.schoolYear.upsert({
      where: { name: '2026-2027' },
      update: {},
      create: { name: '2026-2027', startDate: d('2026-09-01'), endDate: d('2027-06-30'), isCurrent: true },
    });
  }

  /* ── Cours (cahier des charges §13) ── */
  type CourseDef = {
    key: string;
    titleFr: string;
    titleAr: string;
    category: string;
    audience: Audience;
    level: string;
    minAge?: number;
    descriptionFr: string;
    descriptionAr: string;
    keyPointsFr: string[];
    keyPointsAr: string[];
    icon: string;
    color: string;
  };
  const courseDefs: CourseDef[] = [
    {
      key: 'kids',
      titleFr: 'Arabe & Coran — Enfants',
      titleAr: 'العربية والقرآن — الأطفال',
      category: 'quran',
      audience: 'CHILD',
      level: 'N0',
      minAge: 6,
      descriptionFr: "Apprentissage de la lecture de l'arabe et du Coran, dès 6 ans, en partant du niveau 0.",
      descriptionAr: 'تعلّم قراءة العربية والقرآن الكريم ابتداءً من سن 6 سنوات، بدءاً من المستوى صفر.',
      keyPointsFr: ['Dès 6 ans', 'Niveau 0 accepté', 'Petits groupes', 'Suivi individuel'],
      keyPointsAr: ['من سن 6 سنوات', 'يُقبل المستوى صفر', 'مجموعات صغيرة', 'متابعة فردية'],
      icon: 'book-open',
      color: '#1F4A3A',
    },
    {
      key: 'adults',
      titleFr: 'Arabe & Coran — Adultes',
      titleAr: 'العربية والقرآن — الكبار',
      category: 'quran',
      audience: 'ADULT',
      level: 'BEGINNER',
      descriptionFr: "Cours d'arabe et de Coran pour adultes, du niveau débutant au niveau confirmé.",
      descriptionAr: 'دروس في العربية والقرآن للكبار، من المبتدئ إلى المتقدم.',
      keyPointsFr: ['Tous niveaux', 'Horaires adaptés', 'Progression personnalisée'],
      keyPointsAr: ['جميع المستويات', 'مواعيد مناسبة', 'تقدّم مخصّص'],
      icon: 'users',
      color: '#2E6B55',
    },
    {
      key: 'qaida',
      titleFr: 'Qaida Nouraniya',
      titleAr: 'القاعدة النورانية',
      category: 'tajwid',
      audience: 'ADULT',
      level: 'N0',
      descriptionFr: "Méthode progressive pour apprendre à lire le Coran correctement, lettre après lettre, pour les adultes débutants.",
      descriptionAr: 'طريقة متدرجة لتعلّم قراءة القرآن قراءة صحيحة حرفاً حرفاً، للكبار المبتدئين.',
      keyPointsFr: ['Adultes débutants', 'Lecture correcte', 'Rythme progressif'],
      keyPointsAr: ['للكبار المبتدئين', 'قراءة صحيحة', 'وتيرة تدريجية'],
      icon: 'type',
      color: '#CFAE55',
    },
    {
      key: 'bardadiyya',
      titleFr: 'Méthode Bardadiyya / Juz Amma',
      titleAr: 'طريقة البرداديّة / جزء عمّ',
      category: 'quran',
      audience: 'CHILD',
      level: 'BEGINNER',
      descriptionFr: "Mémorisation et lecture guidée de Juz Amma avec la méthode Bardadiyya.",
      descriptionAr: 'حفظ وقراءة موجّهة لجزء عمّ بطريقة البرداديّة.',
      keyPointsFr: ['Juz Amma', 'Mémorisation guidée', 'Révisions régulières'],
      keyPointsAr: ['جزء عمّ', 'حفظ موجّه', 'مراجعة منتظمة'],
      icon: 'bookmark',
      color: '#5CC57F',
    },
  ];
  const course: Record<string, string> = {};
  for (const [i, c] of courseDefs.entries()) {
    const existing = await prisma.course.findFirst({ where: { titleFr: c.titleFr } });
    const row =
      existing ??
      (await prisma.course.create({
        data: {
          titleFr: c.titleFr,
          titleAr: c.titleAr,
          category: c.category,
          audience: c.audience,
          levelId: level[c.level],
          minAge: c.minAge,
          descriptionFr: c.descriptionFr,
          descriptionAr: c.descriptionAr,
          keyPointsFr: c.keyPointsFr,
          keyPointsAr: c.keyPointsAr,
          icon: c.icon,
          color: c.color,
          order: i,
        },
      }));
    course[c.key] = row.id;
  }

  /* ── Classes + créneaux du samedi (la capacité et la salle se règlent dans l'admin) ── */
  const classDefs = [
    { name: 'Enfants — matin', course: 'kids', start: '10:00', end: '12:30' },
    { name: 'Adultes — matin', course: 'adults', start: '10:00', end: '12:30' },
    { name: 'Enfants — après-midi', course: 'kids', start: '12:45', end: '15:15' },
    { name: 'Adultes débutants — Nouraniya', course: 'qaida', start: '13:00', end: '15:30' },
  ];
  for (const c of classDefs) {
    const exists = await prisma.schoolClass.findFirst({ where: { name: c.name, schoolYearId: year.id } });
    if (exists) continue;
    await prisma.schoolClass.create({
      data: {
        name: c.name,
        courseId: course[c.course],
        schoolYearId: year.id,
        capacity: 20,
        slots: { create: [{ weekday: 6, startTime: c.start, endTime: c.end }] },
      },
    });
  }

  /* ── Enseignants (non affectés : à rattacher aux classes depuis l'admin) ── */
  const teachers = [
    { firstName: 'Hassanat', audiences: ['CHILD'] as Audience[] },
    { firstName: 'Sihem', audiences: ['CHILD'] as Audience[] },
    { firstName: 'Souleymane', audiences: ['ADULT'] as Audience[] },
    { firstName: 'Chamseddine', audiences: ['ADULT'] as Audience[] },
  ];
  for (const t of teachers) {
    const exists = await prisma.teacher.findFirst({ where: { firstName: t.firstName } });
    if (!exists) await prisma.teacher.create({ data: t });
  }

  /* ── Équipe affichée sur le site ── */
  const staff = [
    { name: 'Souleymane SYLLA', roleFr: 'Directeur', roleAr: 'المدير' },
    { name: 'Assa SARAMBOUNOU', roleFr: 'Responsable administrative', roleAr: 'المسؤولة الإدارية' },
    { name: 'Fatou TRAORÉ', roleFr: 'Comptabilité', roleAr: 'المحاسبة' },
  ];
  for (const [i, s] of staff.entries()) {
    const exists = await prisma.staffMember.findFirst({ where: { name: s.name } });
    if (!exists) await prisma.staffMember.create({ data: { ...s, order: i } });
  }

  /* ── Frais d'inscription : 10 € une seule fois par élève et par année ──
     (les tarifs mensuels sont « à confirmer » dans le cahier des charges : à créer dans l'admin) */
  const regFee = await prisma.feeSchedule.findFirst({ where: { kind: 'REGISTRATION' } });
  if (!regFee) {
    await prisma.feeSchedule.create({
      data: { titleFr: "Frais d'inscription", titleAr: 'رسوم التسجيل', kind: 'REGISTRATION', amountCents: 1000, period: 'ONCE' },
    });
  }

  /* ── Parcours de progression (étapes modifiables dans l'admin) ── */
  const pathDefs = [
    {
      course: 'kids',
      titleFr: 'Arabe & Coran — Enfants',
      titleAr: 'العربية والقرآن — الأطفال',
      steps: [
        ['Alphabet et sons', 'الحروف وأصواتها'],
        ['Voyelles courtes', 'الحركات القصيرة'],
        ['Lettres liées et lecture de mots', 'وصل الحروف وقراءة الكلمات'],
        ['Lecture de courtes sourates', 'قراءة السور القصيرة'],
        ['Lecture fluide du Coran', 'القراءة المتقنة للقرآن'],
      ],
    },
    {
      course: 'adults',
      titleFr: 'Arabe & Coran — Adultes',
      titleAr: 'العربية والقرآن — الكبار',
      steps: [
        ['Alphabet et prononciation', 'الحروف والنطق'],
        ['Lecture des mots et des phrases', 'قراءة الكلمات والجمل'],
        ['Règles de base du tajwid', 'قواعد التجويد الأساسية'],
        ['Lecture fluide du Coran', 'القراءة المتقنة للقرآن'],
        ['Mémorisation et révision', 'الحفظ والمراجعة'],
      ],
    },
    {
      course: 'qaida',
      titleFr: 'Qaida Nouraniya',
      titleAr: 'القاعدة النورانية',
      steps: [
        ['Lettres isolées', 'الحروف المفردة'],
        ['Lettres liées', 'الحروف المركبة'],
        ['Voyelles et tanwin', 'الحركات والتنوين'],
        ['Madd et soukoun', 'المدّ والسكون'],
        ['Chadda et règles de lecture', 'الشدّة وأحكام القراءة'],
        ['Lecture complète de la Qaida', 'ختم القاعدة'],
      ],
    },
    {
      course: 'bardadiyya',
      titleFr: 'Bardadiyya / Juz Amma',
      titleAr: 'البرداديّة / جزء عمّ',
      steps: [
        ['Lecture guidée de Juz Amma', 'القراءة الموجّهة لجزء عمّ'],
        ['Mémorisation des sourates courtes', 'حفظ السور القصيرة'],
        ['Mémorisation de la première moitié de Juz Amma', 'حفظ النصف الأول من جزء عمّ'],
        ['Mémorisation complète de Juz Amma', 'حفظ جزء عمّ كاملاً'],
        ['Révision et récitation devant le groupe', 'المراجعة والتلاوة أمام المجموعة'],
      ],
    },
  ];
  for (const [i, p] of pathDefs.entries()) {
    const exists = await prisma.pathway.findFirst({ where: { titleFr: p.titleFr } });
    if (exists) continue;
    await prisma.pathway.create({
      data: {
        titleFr: p.titleFr,
        titleAr: p.titleAr,
        courseId: course[p.course],
        order: i,
        steps: { create: p.steps.map(([fr, ar], k) => ({ order: k, titleFr: fr, titleAr: ar })) },
      },
    });
  }

  /* ── Premier administrateur ── */
  const adminCount = await prisma.user.count({ where: { role: 'ADMIN' } });
  if (adminCount === 0) {
    const username = (process.env.SEED_ADMIN_USERNAME || 'admin').toLowerCase();
    const email = process.env.SEED_ADMIN_EMAIL || null;
    const password = process.env.SEED_ADMIN_PASSWORD || randomBytes(9).toString('base64url');
    await prisma.user.create({
      data: {
        username,
        email,
        passwordHash: await bcrypt.hash(password, 11),
        firstName: process.env.SEED_ADMIN_FIRSTNAME || 'Administrateur',
        lastName: '',
        role: 'ADMIN',
        // SEED_ADMIN_MUST_CHANGE=false : pratique pour une base de test (mot de passe fixe, pas d'écran de changement)
        mustChangePassword: process.env.SEED_ADMIN_MUST_CHANGE !== 'false',
      },
    });
    console.log('\n──────────────────────────────────────────────');
    console.log(' Compte administrateur créé');
    console.log(`   Identifiant   : ${username}`);
    console.log(`   Mot de passe  : ${password}`);
    if (process.env.SEED_ADMIN_MUST_CHANGE !== 'false') console.log(' Il vous sera demandé de le changer à la première connexion.');
    console.log(' (Noté une seule fois : conservez-le maintenant.)');
    console.log('──────────────────────────────────────────────\n');
  } else {
    console.log('Un administrateur existe déjà : aucun compte créé.');
  }

  console.log('Seed terminé.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());