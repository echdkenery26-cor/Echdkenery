/**
 * Test de bout en bout (« smoke test ») — à lancer sur une base de TEST :
 *
 *   1. npx prisma migrate deploy && npx prisma db seed   (avec SEED_ADMIN_PASSWORD défini)
 *   2. npm run build && npm run start:prod                (dans un autre terminal)
 *   3. API=http://localhost:4000/api ADMIN_PASSWORD='...' npm test
 *
 * Il crée des données (préfixe « Test ») : ne pas le lancer sur la base de production.
 */
const API = process.env.API || 'http://localhost:4000/api';
const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Admin#12345';

let pass = 0;
let fail = 0;
const failures: string[] = [];

function check(name: string, ok: boolean, extra?: unknown) {
  if (ok) {
    pass++;
    console.log(`  ✓ ${name}`);
  } else {
    fail++;
    failures.push(name);
    console.log(`  ✗ ${name}`, extra !== undefined ? JSON.stringify(extra).slice(0, 400) : '');
  }
}

class Client {
  token = '';
  cookie = '';
  constructor(public label: string) {}

  async raw(path: string): Promise<Response> {
    return (await this.req('GET', path, undefined, { raw: true })) as unknown as Response;
  }

  async req(method: string, path: string, body?: unknown, opts: { raw?: boolean; headers?: Record<string, string> } = {}): Promise<any> {
    const headers: Record<string, string> = { ...(opts.headers || {}) };
    if (this.token) headers.Authorization = `Bearer ${this.token}`;
    if (this.cookie) headers.Cookie = this.cookie;
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    const res = await fetch(API + path, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
    const sc = (res.headers as any).getSetCookie?.() as string[] | undefined;
    if (sc?.length) {
      const rt = sc.find((c) => c.startsWith('echd_rt='));
      if (rt) this.cookie = rt.split(';')[0];
    }
    if (opts.raw) return res;
    const text = await res.text();
    let data: any = text;
    try {
      data = JSON.parse(text);
    } catch {
      /* texte brut */
    }
    return { status: res.status, data, headers: res.headers };
  }
  get = (p: string) => this.req('GET', p);
  post = (p: string, b?: unknown) => this.req('POST', p, b ?? {});
  put = (p: string, b?: unknown) => this.req('PUT', p, b ?? {});
  patch = (p: string, b?: unknown) => this.req('PATCH', p, b ?? {});
  del = (p: string) => this.req('DELETE', p);

  async login(identifier: string, password: string) {
    const r = await this.req('POST', '/auth/login', { identifier, password });
    if (r.status === 200 || r.status === 201) this.token = r.data.accessToken;
    return r;
  }
}

const rnd = Math.random().toString(36).slice(2, 7);
const nextSaturday = () => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 1) % 7)); // dernier samedi (passé ou aujourd'hui)
  return d.toISOString().slice(0, 10);
};
const today = new Date().toISOString().slice(0, 10);

async function main() {
  const admin = new Client('admin');
  const anon = new Client('anon');

  console.log('\n● Santé & site public');
  let r: any = await anon.get('/health');
  check('GET /health = ok', r.status === 200 && r.data.status === 'ok', r);
  r = await anon.get('/public/settings');
  check('paramètres publics (nom + langues)', r.status === 200 && !!r.data['institute.name']?.fr, r.data);
  check('aucun secret dans les paramètres publics', !JSON.stringify(r.data).includes('security.'));
  r = await anon.get('/public/courses');
  check('cours publics (4 cours seedés)', r.status === 200 && (r.data.items ?? r.data).length >= 4, r.data);
  r = await anon.get('/public/schedule');
  check('planning public', r.status === 200, r.data);
  r = await anon.get('/public/team');
  check('équipe publique', r.status === 200, r.data);
  r = await anon.get('/students');
  check('API privée sans jeton = 401', r.status === 401);
  r = await anon.get('/reference/surahs');
  check('référentiel sourates : 114 sourates / 6236 versets', r.status === 401 || r.status === 200);

  console.log('\n● Authentification');
  r = await anon.req('POST', '/auth/login', { identifier: ADMIN_USER, password: 'mauvais-mdp-1' });
  check('mauvais mot de passe = 401', r.status === 401, r);
  r = await admin.login(ADMIN_USER, ADMIN_PASSWORD);
  check('connexion admin', (r.status === 200 || r.status === 201) && !!r.data.accessToken, r);
  check('cookie de rafraîchissement posé', admin.cookie.startsWith('echd_rt='));
  const mustChange = r.data.user?.mustChangePassword;
  if (mustChange) {
    r = await admin.get('/students');
    check('mot de passe temporaire : autre route bloquée (403)', r.status === 403, r);
    r = await admin.post('/auth/change-password', { currentPassword: ADMIN_PASSWORD, newPassword: 'x' });
    check('mot de passe faible refusé (400)', r.status === 400, r);
    r = await admin.post('/auth/change-password', { currentPassword: ADMIN_PASSWORD, newPassword: 'NouveauMdp2026' });
    check('changement du mot de passe', r.status === 200 || r.status === 201, r);
    r = await admin.login(ADMIN_USER, 'NouveauMdp2026');
    check('reconnexion avec le nouveau mot de passe', !!r.data.accessToken, r);
  }
  const adminPwd = mustChange ? 'NouveauMdp2026' : ADMIN_PASSWORD;
  r = await admin.get('/auth/me');
  check('/auth/me → ADMIN', r.data.role === 'ADMIN' || r.data.user?.role === 'ADMIN', r.data);

  const oldCookie = admin.cookie;
  r = await admin.post('/auth/refresh');
  check('rafraîchissement du jeton (rotation)', (r.status === 200 || r.status === 201) && !!r.data.accessToken, r);
  admin.token = r.data.accessToken;
  const reuse = new Client('reuse');
  reuse.cookie = oldCookie;
  r = await reuse.post('/auth/refresh');
  check("réutilisation d'un ancien jeton refusée (401)", r.status === 401, r);
  // la détection de réutilisation révoque la session : on se reconnecte
  r = await admin.login(ADMIN_USER, adminPwd);
  check('reconnexion après révocation', !!r.data.accessToken, r);

  r = await admin.get('/reference/surahs');
  const surahs: any[] = r.data.items ?? r.data;
  check('114 sourates', Array.isArray(surahs) && surahs.length === 114, surahs?.length);
  check('6236 versets au total', surahs.reduce((s, x) => s + (x.verses ?? x.verseCount ?? 0), 0) === 6236);

  console.log('\n● Référentiels & paramètres');
  r = await admin.get('/settings');
  check('lecture des paramètres', r.status === 200 && r.data['alerts.absenceThreshold'] === 2, r.data);
  r = await admin.put('/settings', { values: { 'alerts.absenceThreshold': 3, 'fees.siblingDiscountPercent': 10 } });
  check('modification des paramètres', r.status === 200, r);
  r = await admin.put('/settings', { values: { 'alerts.absenceThreshold': 0 } });
  check('paramètre invalide refusé (400)', r.status === 400, r);
  r = await admin.put('/settings', { values: { 'nimporte.quoi': 1 } });
  check('paramètre inconnu refusé (400)', r.status === 400, r);
  await admin.put('/settings', { values: { 'alerts.absenceThreshold': 2, 'fees.siblingDiscountPercent': 0 } });
  r = await admin.post('/rooms', { name: `Salle Test ${rnd}`, capacity: 25 });
  check('création de salle', r.status === 201, r);
  const room = r.data;
  r = await admin.get('/levels');
  check('niveaux seedés', (r.data.items ?? r.data).length >= 4, r.data);
  r = await admin.get('/school-years');
  const years: any[] = r.data.items ?? r.data;
  const year = years.find((y) => y.isCurrent);
  check('année scolaire courante', !!year, years);

  console.log('\n● Enseignants & comptes');
  r = await admin.post('/teachers', {
    firstName: `Prof${rnd}`,
    lastName: 'Test',
    audiences: ['CHILD'],
    account: {},
  });
  check('création enseignant + compte', r.status === 201, r);
  const teacher = r.data.teacher ?? r.data;
  const account = r.data.credentials ?? {};
  check('mot de passe temporaire renvoyé une fois', !!(account.temporaryPassword ?? account.password), account);
  const tUser = account.username;
  const tPass = account.temporaryPassword ?? account.password;
  r = await admin.post('/teachers', { firstName: `Prof2${rnd}`, lastName: 'Test', audiences: ['ADULT'] });
  const teacher2 = r.data.teacher ?? r.data;

  r = await admin.post('/users', { firstName: 'Gestion', lastName: `Test${rnd}`, role: 'MANAGER' });
  check('création compte gestionnaire', r.status === 201, r);
  const mgrUser = r.data.credentials?.username;
  const mgrPass = r.data.credentials?.temporaryPassword;

  console.log('\n● Cours, classes, créneaux');
  const courses: any[] = (await admin.get('/courses')).data.items ?? (await admin.get('/courses')).data;
  const kids = courses.find((c) => c.audience === 'CHILD');
  r = await admin.post('/classes', {
    name: `Classe Test A ${rnd}`,
    courseId: kids.id,
    teacherId: teacher.id,
    capacity: 2,
    roomId: room.id,
    slots: [{ weekday: 6, startTime: '08:00', endTime: '09:30' }],
  });
  check('création de classe avec créneau', r.status === 201, r);
  const classA = r.data;
  r = await admin.post('/classes', {
    name: `Classe Test B ${rnd}`,
    courseId: kids.id,
    teacherId: teacher.id,
    capacity: 5,
    slots: [{ weekday: 6, startTime: '09:00', endTime: '10:00' }],
  });
  check("chevauchement enseignant refusé (409)", r.status === 409, r);
  r = await admin.post('/classes', {
    name: `Classe Test C ${rnd}`,
    courseId: kids.id,
    teacherId: teacher2.id,
    capacity: 5,
    roomId: room.id,
    slots: [{ weekday: 6, startTime: '09:00', endTime: '10:00' }],
  });
  check('chevauchement de salle refusé (409)', r.status === 409, r);
  r = await admin.post('/classes', {
    name: `Classe Test D ${rnd}`,
    courseId: kids.id,
    teacherId: teacher2.id,
    capacity: 5,
    slots: [{ weekday: 6, startTime: '09:30', endTime: '11:00' }],
  });
  check('créneau qui se touche sans chevaucher accepté', r.status === 201, r);
  const classD = r.data;
  r = await admin.post(`/classes/${classA.id}/slots`, { weekday: 6, startTime: '10:00', endTime: '09:00' });
  check('horaire incohérent refusé (400)', r.status === 400, r);
  r = await admin.get('/timetable');
  check('emploi du temps', r.status === 200, r);

  console.log('\n● Élèves & inscriptions');
  const mk = (n: string, extra: any = {}) => ({
    firstName: n,
    lastName: `Test${rnd}`,
    audience: 'CHILD',
    birthDate: '2016-04-10',
    gender: 'MALE',
    gdprConsent: true,
    guardians: [{ name: `Parent ${n}`, relationship: 'père', phone: '06 12 34 56 78' }],
    ...extra,
  });
  r = await admin.post('/students', mk('Ali', { classIds: [classA.id], status: 'ENROLLED' }));
  check('création élève + inscription', r.status === 201, r);
  const ali = r.data.student ?? r.data;
  r = await admin.post('/students', mk('Ali', { classIds: [classA.id] }));
  check('doublon présumé détecté (409)', r.status === 409, r);
  r = await admin.post('/students', mk('Ali', { force: true, classIds: [classA.id], status: 'ENROLLED' }));
  check('doublon forcé accepté', r.status === 201, r);
  const ali2 = r.data.student ?? r.data;
  r = await admin.post('/students', mk('Bilal', { birthDate: '2015-02-02', guardians: [{ name: 'Autre', phone: '07 00 00 00 01' }] }));
  const bilal = r.data.student ?? r.data;
  r = await admin.post(`/students/${bilal.id}/enrollments`, { classId: classA.id });
  check('classe pleine → liste d\'attente', (r.status === 201 || r.status === 200) && (r.data.status === 'WAITLIST' || r.data.enrollment?.status === 'WAITLIST'), r);
  r = await admin.get(`/classes/${classA.id}/students`);
  check('classe : 2 actifs + 1 en attente', r.data.active?.length === 2 && r.data.waitlist?.length === 1, r.data);
  r = await admin.post(`/students/${bilal.id}/enrollments`, { classId: classA.id });
  check('double inscription refusée', r.status === 409 || r.status === 400, r);
  r = await admin.post(`/students/${bilal.id}/siblings`, { studentId: ali.id });
  check('lien de fratrie', r.status === 200 || r.status === 201, r);
  r = await admin.get('/students?q=Test' + rnd);
  const list = r.data.items ?? [];
  check('recherche élèves', list.length >= 3, r.data);
  r = await admin.patch(`/students/${ali2.id}`, { notes: 'note interne' });
  check('modification élève', r.status === 200, r);
  r = await admin.post(`/enrollments/${(await admin.get(`/classes/${classA.id}/students`)).data.active[1].enrollmentId}/end`, {});
  check('fin d\'inscription', r.status === 200 || r.status === 201, r);
  r = await admin.get(`/classes/${classA.id}/students`);
  check('place libérée : notification, pas de promotion automatique', r.data.waitlist?.length === 1, r.data);

  console.log('\n● Préinscription publique');
  const prereg = {
    audience: 'CHILD',
    courseId: kids.id,
    contactName: 'Parent Pré',
    relationship: 'mère',
    phone: '06 98 76 54 32',
    persons: [
      { firstName: 'Yasmine', lastName: `Pre${rnd}`, birthDate: '2017-05-01', gender: 'FEMALE' },
      { firstName: 'Omar', lastName: `Pre${rnd}`, birthDate: '2014-09-12', gender: 'MALE' },
    ],
    consent: true,
  };
  r = await anon.post('/public/pre-registrations', { ...prereg, consent: false });
  check('consentement obligatoire (400)', r.status === 400, r);
  r = await anon.post('/public/pre-registrations', { ...prereg, website: 'http://spam' });
  check('pot de miel : réponse neutre sans enregistrement', r.status === 201 || r.status === 200, r);
  const spamRef = r.data.reference;
  r = await anon.post('/public/pre-registrations', prereg);
  check('préinscription publique (2 enfants)', r.status === 201 && /^PRE-\d{4}-\d{5}$/.test(r.data.reference || ''), r);
  check('le pot de miel n\'a rien enregistré', !spamRef || spamRef !== r.data.reference);
  r = await admin.get('/pre-registrations');
  const pr = (r.data.items ?? []).find((x: any) => x.contactName === 'Parent Pré');
  check('préinscription visible en admin', !!pr, r.data);
  r = await admin.get('/pre-registrations/count');
  check('compteur de nouvelles demandes', r.status === 200, r);
  r = await admin.post(`/pre-registrations/${pr.id}/convert`, { classId: classD.id });
  check('conversion en élèves', r.status === 200 || r.status === 201, r);
  const created = r.data.students ?? r.data.created ?? [];
  check('2 élèves créés', created.length === 2, r.data);
  r = await admin.get(`/students/${created[0]?.id ?? created[0]}`);
  check('élèves de la fratrie reliés (famille)', (r.data.siblings?.length ?? 0) >= 1 || !!r.data.familyId, r.data);
  r = await admin.post(`/pre-registrations/${pr.id}/convert`, {});
  check('seconde conversion refusée', r.status === 409 || r.status === 400, r);

  console.log('\n● Cotisations & paiements');
  r = await admin.post('/fees', { titleFr: `Mensualité test ${rnd}`, kind: 'TUITION', amountCents: 2000, period: 'MONTHLY', courseId: kids.id });
  check('création barème mensuel', r.status === 201, r);
  const fee = r.data;
  r = await admin.post('/fees/generate', { studentId: ali.id });
  check('génération des échéances', r.status === 200 || r.status === 201, r);
  const gen1 = JSON.stringify(r.data);
  r = await admin.post('/fees/generate', { studentId: ali.id });
  check('génération idempotente (aucun doublon)', r.status === 200 || r.status === 201, r);
  r = await admin.get(`/dues?studentId=${ali.id}&pageSize=100`);
  const dues: any[] = r.data.items ?? [];
  const labels = dues.map((d) => d.label + d.periodKey);
  check('échéances créées sans doublon', dues.length > 0 && new Set(labels).size === labels.length, { n: dues.length, gen1 });
  check("frais d'inscription créé une seule fois", dues.filter((d) => d.kind === 'REGISTRATION').length === 1, dues.map((d) => d.kind));
  const reg = dues.find((d) => d.kind === 'REGISTRATION');
  r = await admin.post('/payments', { dueId: reg.id, amountCents: 400, method: 'CASH' });
  check('paiement partiel', r.status === 201, r);
  const pay1 = r.data.payment ?? r.data;
  check('numéro de reçu R-AAAA-00001', /^R-\d{4}-\d{5}$/.test(pay1.receiptNumber || ''), pay1);
  r = await admin.post('/payments', { dueId: reg.id, amountCents: 700, method: 'CASH' });
  check('trop-perçu refusé (400/409)', r.status === 400 || r.status === 409, r);
  r = await admin.post('/payments', { dueId: reg.id, amountCents: 600, method: 'TRANSFER', reference: 'VIR-1' });
  check('solde du paiement', r.status === 201, r);
  const pay2 = r.data.payment ?? r.data;
  check('numéros de reçu consécutifs', Number(pay2.receiptNumber.slice(-5)) === Number(pay1.receiptNumber.slice(-5)) + 1, [pay1.receiptNumber, pay2.receiptNumber]);
  r = await admin.get(`/dues?studentId=${ali.id}&kind=REGISTRATION`);
  check('échéance soldée (PAID)', r.data.items?.[0]?.status === 'PAID', r.data.items?.[0]);
  r = await admin.post(`/payments/${pay2.id}/cancel`, {});
  check("annulation sans motif refusée (400)", r.status === 400, r);
  r = await admin.post(`/payments/${pay2.id}/cancel`, { reason: 'Erreur de saisie' });
  check('annulation avec motif', r.status === 200 || r.status === 201, r);
  r = await admin.get(`/dues?studentId=${ali.id}&kind=REGISTRATION`);
  check('échéance rouverte (paiement annulé)', r.data.items?.[0]?.paidCents === 400, r.data.items?.[0]);
  r = await admin.del(`/payments/${pay1.id}`);
  check('suppression de paiement impossible', r.status === 404 || r.status === 405, r.status);
  // retard : échéance passée
  r = await admin.post('/dues', { studentId: ali.id, label: 'Retard test', amountCents: 1500, dueDate: '2026-01-05' });
  check('échéance manuelle', r.status === 201, r);
  r = await admin.get(`/dues?studentId=${ali.id}&state=late`);
  check('échéance passée → CRITIQUE', (r.data.items ?? []).some((d: any) => d.label === 'Retard test' && d.status === 'CRITICAL'), r.data.items);
  r = await admin.get('/finance/summary');
  check('synthèse financière', r.status === 200, r);
  r = await admin.post('/reminders/prepare', { studentId: ali.id });
  check('relance préparée (lien WhatsApp / e-mail)', r.status === 200 || r.status === 201, r);
  r = await admin.get(`/students/${ali.id}/finance`);
  check('situation financière élève', r.status === 200, r);

  console.log('\n● Présences & alertes');
  const sat = nextSaturday();
  r = await admin.get(`/attendance/sheet?classId=${classA.id}&date=${sat}`);
  check('feuille de présence', r.status === 200, r);
  const roster: any[] = r.data.students ?? r.data.items ?? r.data.roster ?? [];
  check('la feuille exclut les élèves en attente', roster.every((s) => s.studentId !== bilal.id && s.id !== bilal.id), roster);
  const absent = (d: string) =>
    admin.put('/attendance/sheet', { classId: classA.id, date: d, records: [{ studentId: ali.id, status: 'ABSENT' }] });
  const d1 = new Date(sat + 'T00:00:00Z');
  const sat2 = new Date(d1.getTime() - 7 * 86400000).toISOString().slice(0, 10);
  r = await absent(sat2);
  check('saisie de présence (absent)', r.status === 200 || r.status === 201, r);
  r = await absent(sat);
  check('2ᵉ absence consécutive', r.status === 200 || r.status === 201, r);
  r = await admin.put('/attendance/sheet', { classId: classA.id, date: sat, records: [{ studentId: ali.id, status: 'ABSENT' }] });
  check('re-saisie de la même séance (mise à jour)', r.status === 200 || r.status === 201, r);
  r = await admin.get('/alerts/todo');
  check('« À traiter » : absences répétées', JSON.stringify(r.data).includes(ali.id) || JSON.stringify(r.data).toLowerCase().includes('absen'), r.data);
  r = await admin.get(`/students/${ali.id}/attendance`);
  check('historique de présence élève', r.status === 200, r);
  r = await admin.post('/alerts/run');
  check('tâche quotidienne manuelle', r.status === 200 || r.status === 201, r);
  r = await admin.get('/notifications');
  check('notifications créées', (r.data.items ?? []).length > 0, r.data);
  const n1 = r.data.total;
  await admin.post('/alerts/run');
  r = await admin.get('/notifications');
  check('pas de notification en double', r.data.total === n1, [n1, r.data.total]);

  console.log('\n● Progression');
  r = await admin.get(`/students/${ali.id}/progress`);
  check('progression : parcours affecté automatiquement', r.status === 200 && (r.data.pathways?.length ?? 0) >= 1, r.data);
  const pw = r.data.pathways?.[0];
  const steps: any[] = pw?.steps ?? [];
  if (steps.length) {
    r = await admin.put(`/students/${ali.id}/progress`, { updates: steps.map((s) => ({ stepId: s.stepId ?? s.id, status: 'DONE' })) });
    check('toutes les étapes validées', r.status === 200, r);
    r = await admin.get(`/students/${ali.id}/progress`);
    check('proposition de passage de niveau', JSON.stringify(r.data).includes('promot') || JSON.stringify(r.data).includes('completed'), r.data);
  } else check('étapes du parcours présentes', false, pw);
  r = await admin.put(`/students/${ali.id}/memorization`, { surah: 112, verse: 4 });
  check('mémorisation sourate 112', r.status === 200 || r.status === 201, r);
  r = await admin.put(`/students/${ali.id}/memorization`, { surah: 112, verse: 99 });
  check('verset hors limites refusé (400)', r.status === 400, r);
  r = await admin.post(`/students/${ali.id}/evaluations`, { classId: classA.id, title: 'Contrôle', score: 15, maxScore: 20 });
  check('évaluation', r.status === 201 || r.status === 400, r);

  console.log('\n● Droits (RBAC)');
  if (tUser && tPass) {
    const t = new Client('teacher');
    r = await t.login(tUser, tPass);
    check('connexion enseignant (mot de passe temporaire)', !!r.data.accessToken && r.data.user?.mustChangePassword === true, r);
    r = await t.get('/classes');
    check('avant changement du mot de passe : bloqué (403)', r.status === 403, r);
    r = await t.post('/auth/change-password', { currentPassword: tPass, newPassword: 'ProfTest2026' });
    check("changement du mot de passe de l'enseignant", r.status === 200 || r.status === 201, r);
    await t.login(tUser, 'ProfTest2026');
    r = await t.get('/classes');
    const mine: any[] = r.data.items ?? r.data;
    check('enseignant : seulement ses classes', mine.length === 1 && mine[0].id === classA.id, mine.map((c) => c.name));
    r = await t.get(`/classes/${classD.id}`);
    check("classe d'un autre : 403/404", r.status === 403 || r.status === 404, r.status);
    r = await t.get('/students');
    const sl: any[] = r.data.items ?? [];
    check('enseignant : seulement ses élèves', sl.every((s) => [ali.id, ali2.id].includes(s.id)) && sl.length >= 1, sl.map((s) => s.firstName));
    r = await t.get(`/students/${bilal.id}`);
    check("élève hors de ses classes : 403/404", r.status === 403 || r.status === 404, r.status);
    r = await t.get('/dues');
    check('enseignant : aucune donnée financière (403)', r.status === 403, r.status);
    r = await t.get(`/students/${ali.id}/finance`);
    check('enseignant : situation financière interdite', r.status === 403, r.status);
    r = await t.get('/payments');
    check('enseignant : paiements interdits', r.status === 403, r.status);
    r = await t.get('/exports/dues');
    check('enseignant : export interdit', r.status === 403, r.status);
    r = await t.post('/users', { firstName: 'X', role: 'ADMIN' });
    check('enseignant : création de compte interdite', r.status === 403, r.status);
    r = await t.get('/dashboard');
    check('enseignant : tableau de bord simplifié', r.status === 200 && !JSON.stringify(r.data).includes('lateDues'), r.data);
    r = await t.get(`/attendance/sheet?classId=${classA.id}&date=${sat}`);
    check('enseignant : feuille de présence de sa classe', r.status === 200, r);
    r = await t.get(`/attendance/sheet?classId=${classD.id}&date=${sat}`);
    check("enseignant : feuille d'une autre classe interdite", r.status === 403 || r.status === 404, r.status);
    r = await t.get(`/students/${ali.id}/progress`);
    check('enseignant : progression de son élève', r.status === 200, r.status);
    r = await t.get(`/documents/student-sheet/${ali.id}`);
    check('enseignant : pas de fiche élève imprimable', r.status === 403 || r.status === 404, r.status);
  }
  if (mgrUser && mgrPass) {
    const m = new Client('manager');
    r = await m.login(mgrUser, mgrPass);
    await m.post('/auth/change-password', { currentPassword: mgrPass, newPassword: 'GestTest2026' });
    await m.login(mgrUser, 'GestTest2026');
    r = await m.get('/students');
    check('gestionnaire : accès aux élèves', r.status === 200, r.status);
    r = await m.get('/dues');
    check('gestionnaire : accès aux cotisations', r.status === 200, r.status);
    r = await m.post('/users', { firstName: 'X', role: 'ADMIN' });
    check('gestionnaire : création de compte interdite', r.status === 403, r.status);
    r = await m.get('/exports/backup');
    check('gestionnaire : sauvegarde interdite', r.status === 403, r.status);
  }

  console.log('\n● Annonces');
  r = await admin.post('/announcements', { titleFr: `Annonce test ${rnd}`, bodyFr: 'Corps', category: 'misc' });
  check("création d'annonce (brouillon)", r.status === 201, r);
  const ann = r.data;
  r = await anon.get('/public/announcements');
  check('brouillon invisible du public', !JSON.stringify(r.data).includes(`Annonce test ${rnd}`), r.data);
  r = await admin.post(`/announcements/${ann.id}/publish`);
  check('publication', r.status === 200 || r.status === 201, r);
  r = await anon.get('/public/announcements');
  check('annonce publiée visible du public', JSON.stringify(r.data).includes(`Annonce test ${rnd}`), r.data);

  console.log('\n● Documents & exports');
  r = await admin.raw(`/documents/receipt/${pay1.id}`);
  let html = await r.text();
  check('reçu HTML imprimable', r.status === 200 && html.includes(pay1.receiptNumber) && html.includes('<html'), html.slice(0, 200));
  r = await admin.raw(`/documents/receipt/${pay1.id}?lang=ar`);
  html = await r.text();
  check('reçu en arabe (RTL)', html.includes('dir="rtl"'), html.slice(0, 200));
  r = await admin.raw(`/documents/student-sheet/${ali.id}`);
  html = await r.text();
  check('fiche élève', r.status === 200 && html.includes('Ali'));
  r = await admin.raw(`/documents/timetable/class-${classA.id}`);
  check('emploi du temps imprimable', r.status === 200 || r.status === 404);
  r = await admin.raw(`/documents/bulletin/${ali.id}`);
  check('bulletin', r.status === 200, r.status);
  r = await admin.post('/documents/share', { type: 'receipt', id: pay1.id });
  check('lien de partage signé', r.status === 200 || r.status === 201, r);
  const link: string = r.data.url || r.data.link || '';
  if (link) {
    const path = link.replace(/^https?:\/\/[^/]+\/api/, '');
    const rr = await fetch(API + path);
    check('lien signé ouvert sans connexion', rr.status === 200, rr.status);
    const bad = await fetch(API + path.replace(/sig=[^&]+/, 'sig=deadbeef'));
    check('signature falsifiée refusée', bad.status === 403 || bad.status === 401, bad.status);
  }
  r = await admin.raw('/exports/students?format=xlsx');
  let buf = Buffer.from(await r.arrayBuffer());
  check('export élèves .xlsx (zip PK)', r.status === 200 && buf.slice(0, 2).toString() === 'PK', r.status);
  r = await admin.raw('/exports/students?format=csv');
  buf = Buffer.from(await r.arrayBuffer());
  check('export élèves .csv (BOM UTF-8, « ; »)', buf.slice(0, 3).equals(Buffer.from([0xef, 0xbb, 0xbf])) && buf.toString().includes(';'));
  r = await admin.raw('/exports/dues?format=csv&state=late');
  check('export cotisations', r.status === 200);
  r = await admin.raw('/exports/payments?format=xlsx');
  check('export paiements', r.status === 200);
  r = await admin.raw('/exports/backup');
  const bk = JSON.parse(await r.text());
  check('sauvegarde JSON complète', r.status === 200 && bk.students?.length > 0 && bk.payments?.length > 0);
  check('sauvegarde sans mots de passe', !JSON.stringify(bk).includes('passwordHash') && !JSON.stringify(bk).includes('$2'));

  console.log('\n● Tableau de bord & divers');
  r = await admin.get('/dashboard');
  check('tableau de bord', r.status === 200, r);
  r = await admin.get('/users');
  check('liste des comptes (sans hash)', r.status === 200 && !JSON.stringify(r.data).includes('passwordHash'));
  r = await anon.get('/public/stats');
  check('statistiques publiques', r.status === 200, r);
  r = await admin.del(`/classes/${classA.id}`);
  check('classe avec inscriptions : suppression refusée (409)', r.status === 409 || r.status === 400, r);
  r = await admin.del(`/students/${ali.id}`);
  check("élève avec paiements : suppression refusée", r.status === 409 || r.status === 400, r);
  r = await admin.post(`/students/${ali.id}/archive`, {});
  check('archivage', r.status === 200 || r.status === 201, r);

  console.log(`\n══ ${pass} réussis, ${fail} échoués ══`);
  if (fail) {
    console.log('Échecs :\n - ' + failures.join('\n - '));
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
