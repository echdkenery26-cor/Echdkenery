# ECHD — Backend (API)

API de la plateforme de gestion de l'**École coranique Hamidou DIALLO (ECHD)** : site public, espace administration, espace enseignant.

**Stack** : NestJS 11 · TypeScript · Prisma 6 · PostgreSQL · JWT + cookie de rafraîchissement · Swagger.

Tout ce qui peut changer (horaires, tarifs, catégories, seuils d'alerte, textes des messages, niveaux, parcours…) est **en base de données** et modifiable depuis l'administration : rien n'est codé en dur.

---

## 1. Démarrage en local

Prérequis : Node 20+, PostgreSQL 14+.

```bash
npm install
cp .env.example .env          # puis renseigner DATABASE_URL et JWT_SECRET
```

Créer la base (exemple) : `createdb echd`

### Créer les tables (une seule fois)

```bash
npx prisma migrate dev --name init
```

Cette commande génère le dossier `prisma/migrations/` : **il faut le conserver et le versionner** (c'est lui que l'hébergeur rejouera en production avec `npm run prisma:deploy`). Pour les évolutions futures du schéma, relancer la même commande avec un autre nom (`--name ajout_xxx`).

### Données de départ + premier administrateur

```bash
# facultatif : choisir l'identifiant / le mot de passe de l'admin
#   SEED_ADMIN_USERNAME / SEED_ADMIN_PASSWORD dans .env
npm run seed
```

Le seed crée : les niveaux, l'année scolaire (2026-2027, à ajuster), les 4 cours du cahier des charges, 4 classes avec leurs créneaux du samedi, les 4 enseignants, l'équipe, les frais d'inscription (10 €), les parcours de progression, et **un compte administrateur** (mot de passe affiché une seule fois s'il n'est pas fourni ; changement obligatoire à la première connexion).
Il est **idempotent** : on peut le relancer sans créer de doublons.

### Lancer

```bash
npm run start:dev             # développement (rechargement automatique)
npm run build && npm run start:prod   # production
```

- API : `http://localhost:4000/api`
- Documentation interactive : `http://localhost:4000/api/docs` (désactivable avec `SWAGGER=false`)
- Sonde de santé : `GET /api/health`

### Test de bout en bout

Sur une base de **test** (il crée des données « Test ») :

```bash
API=http://localhost:4000/api ADMIN_PASSWORD='votre-mot-de-passe-admin' npm test
```

Il vérifie ~135 scénarios : connexion et verrouillage, droits par rôle, chevauchements d'horaires, liste d'attente, préinscription publique, paiements/reçus/annulations, absences et alertes, progression, documents, exports, sauvegarde.

---

## 2. Rôles et droits

| Rôle | Accès |
|---|---|
| **ADMIN** | Tout, y compris comptes utilisateurs, paramètres, journal d'audit, sauvegarde complète. |
| **MANAGER** (gestionnaire) | Élèves, préinscriptions, classes, cotisations, paiements, annonces, exports. Pas de comptes ni de paramètres sensibles. |
| **TEACHER** (enseignant) | Seulement **ses** classes et **ses** élèves : présences, progression, évaluations. **Aucune donnée financière.** |

- L'administrateur crée les comptes enseignants (`POST /api/teachers` avec `account`, ou `POST /api/teachers/:id/account`) : le **mot de passe temporaire est renvoyé une seule fois**, l'enseignant doit le changer à sa première connexion.
- Connexion par **identifiant ou e-mail**. Verrouillage 15 min après 5 échecs. Déconnexion automatique après inactivité (paramètre `security.inactivityMinutes`).
- Les routes sans rôle explicite sont réservées à ADMIN + MANAGER (sécurité par défaut).

---

## 3. Vue d'ensemble de l'API (préfixe `/api`)

| Domaine | Routes principales |
|---|---|
| Auth | `/auth/login` `/auth/refresh` `/auth/logout` `/auth/me` `/auth/change-password` `/auth/forgot-password` `/auth/reset-password` |
| Comptes | `/users` (ADMIN) |
| Paramètres | `/settings` `/settings/logo` `/lookups` `/levels` `/rooms` `/reference/surahs` |
| Équipe | `/teachers` `/staff` |
| Pédagogie | `/courses` `/school-years` (+ fermetures, duplication) `/classes` `/slots` `/slot-exceptions` `/timetable` |
| Élèves | `/students` (+ doublons, fratries, archives, RGPD) `/enrollments` |
| Progression | `/pathways` `/students/:id/progress` `/students/:id/memorization` `/students/:id/evaluations` `/classes/:id/progress-overview` |
| Présences | `/attendance/sheet` `/classes/:id/attendance` `/students/:id/attendance` |
| Finances | `/fees` `/fees/generate` `/dues` `/payments` `/finance/summary` `/reminders` |
| Préinscriptions | `/pre-registrations` (+ `/convert`) |
| Annonces | `/announcements` (+ publication, image) |
| Alertes | `/alerts/todo` `/notifications` `/dashboard` |
| Documents | `/documents/:type/:id` (reçu, fiche élève, emploi du temps, bulletin) `/documents/share` |
| Exports | `/exports/students` `/exports/dues` `/exports/payments` (`?format=xlsx` ou `csv`) · `/exports/backup` (JSON, ADMIN) |
| Public (sans connexion) | `/public/settings` `/public/courses` `/public/schedule` `/public/team` `/public/announcements` `/public/stats` `/public/uploads/photo` `/public/pre-registrations` |

Toutes les listes sont paginées (`?page=1&pageSize=20`) : réponse `{ items, total, page, pageSize }`.
Toutes les erreurs ont la même forme : `{ statusCode, message, code?, details? }`.

---

## 4. Comportements à connaître

- **Argent** : toujours en centimes (entiers). Les paiements ne sont **jamais supprimés** : on les **annule avec un motif**, ce qui rouvre l'échéance. Reçus numérotés `R-AAAA-00001`, sans trou.
- **Cotisations** : barèmes dans `/fees` (frais d'inscription une fois par élève et par année, mensualités, etc.). `POST /fees/generate` crée les échéances manquantes — **sans doublon** si on le relance. Statuts calculés : à venir, partiel, à jour, retard, critique (seuils réglables), exonéré. Remise fratrie en pourcentage (paramètre).
- **Horaires** : chevauchements refusés (même enseignant, même salle, ou même classe). Annulation/déplacement ponctuel d'une séance et jours de fermeture gérés.
- **Capacité** : classe pleine → l'élève passe en **liste d'attente** ; quand une place se libère, une notification est envoyée (promotion manuelle, pas automatique).
- **Doublons** : un élève de même nom avec le même téléphone ou la même date de naissance est signalé (409) ; on peut forcer (`force: true`).
- **Préinscription** : formulaire public protégé (champ piège anti-spam, limitation de débit, consentement RGPD obligatoire). La conversion crée les élèves (fratrie reliée) et copie les photos.
- **Alertes** : tâche quotidienne à 07:00 (fuseau `CRON_TZ`) — retards de paiement, préinscriptions en attente, élèves sans classe, fin d'année, e-mail récapitulatif (quotidien / hebdomadaire / aucun). Lancement manuel : `POST /alerts/run`. Aucune notification en double.
- **Photos** : converties en WebP, redimensionnées. Photos d'élèves **privées** (liens signés qui expirent), photos de l'équipe / logo / annonces publiques.
- **Documents** : générés en HTML prêt à imprimer (FR ou AR, écriture de droite à gauche, polices intégrées). Depuis le navigateur : *Imprimer → Enregistrer en PDF*. Un lien signé permet de partager un reçu sans connexion (`POST /documents/share`).
- **RGPD** : consentement horodaté, archivage, liste des dossiers dépassant la durée de conservation (`/students/retention/expired`), journal d'audit des actions sensibles, sauvegarde complète sans mots de passe.

---

## 5. Déploiement

Variables d'environnement : voir `.env.example` (toutes commentées).

Commandes typiques chez un hébergeur (Render, Railway, Fly, VPS…) :

| Étape | Commande |
|---|---|
| Installation + build | `npm install && npm run build` |
| Avant chaque démarrage | `npm run prisma:deploy` |
| Premier déploiement seulement | `npm run seed` |
| Démarrage | `npm run start:prod` |

À prévoir :

- **Images** : définir `CLOUDINARY_URL` (`cloudinary://clé:secret@nom_du_cloud`) pour les stocker sur Cloudinary — recommandé sur Render, Railway, etc. Sans cette variable, elles sont écrites dans `UPLOAD_DIR`, qui doit alors être un **volume persistant** (sinon les photos disparaissent à chaque déploiement). Les photos d'élèves restent privées : elles passent par l'API avec un lien signé et temporaire.
- `JWT_SECRET` long et aléatoire : `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`.
- `API_URL` = adresse publique de l'API (sert à fabriquer les liens de photos), `APP_URL` = adresse du site (liens de réinitialisation de mot de passe), `CORS_ORIGINS` = adresse(s) du site.
- **Site et API sur deux domaines différents** (ex. Vercel + Railway) : `COOKIE_SAMESITE=none` et `COOKIE_SECURE=true` (HTTPS obligatoire).
- **E-mails** : renseigner `BREVO_API_KEY` (API HTTPS, fonctionne sur Render Free où le SMTP sortant est bloqué) **ou** `SMTP_*` (Gmail, OVH…), plus `MAIL_FROM`. Sans rien, les e-mails sont seulement écrits dans les logs (pratique en développement).
- **Sauvegardes** : activer celles de PostgreSQL chez l'hébergeur, et télécharger régulièrement `GET /api/exports/backup`.

---

## 6. Arborescence

```
prisma/        schema.prisma · seed.ts
src/
  main.ts · app.module.ts · health.controller.ts
  common/      sécurité (guards, décorateurs), paramètres, fichiers, e-mails, audit, notifications
  modules/     auth · users · staff · settings · academic · students · finance · progress
               attendance · prereg · announcements · alerts · dashboard · documents · exports · public
test/smoke.ts  test de bout en bout
```
