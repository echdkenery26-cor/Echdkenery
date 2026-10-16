# ECHD — Frontend

Site public + espace de gestion de l'**École coranique Hamidou DIALLO (ECHD)**.
**Next.js 16** (App Router) · React 19 · Tailwind CSS 4 · SWR · installable (PWA).

- **Site public** (sans connexion) : accueil, cours, horaires, équipe, actualités, préinscription, contact, confidentialité.
- **Espace administration** (ADMIN / MANAGER) : tableau de bord, élèves, préinscriptions, classes, emploi du temps, présences, progression et parcours, cours, cotisations (échéances, paiements, reçus, relances, barèmes), annonces, équipe, comptes, paramètres, journal d'activité.
- **Espace enseignant** (TEACHER) : ses classes, l'appel, la progression de ses élèves. Aucune donnée financière.
- Tout le contenu vient de l'API : rien n'est écrit en dur (horaires, tarifs, textes, catégories, niveaux…).
- **Français / arabe** (écriture de droite à gauche), mobile et ordinateur.

## Démarrage

Prérequis : Node 20+ et l'API ECHD démarrée.

```bash
npm install
cp .env.example .env.local     # API_URL = adresse de l'API (ex. http://localhost:4000)
npm run dev                    # http://localhost:3000
```

Production :

```bash
npm run build
npm start                      # port 3000
```

## Comment le site parle à l'API

Le navigateur n'appelle jamais l'API directement : `/api/*` est relayé par Next.js vers `API_URL`
(`next.config.ts`). Résultat : pas de CORS, et le cookie de session reste sur le même domaine.
Il suffit donc de définir `API_URL` sur le serveur qui héberge ce site.

Côté API, `APP_URL` doit pointer vers l'adresse publique de ce site (liens de réinitialisation de mot de passe).
Les deux peuvent être sur des domaines différents (Vercel + Railway, par exemple) sans réglage de cookies particulier.

## Connexion et sessions

- Jeton d'accès court gardé en mémoire + cookie de rafraîchissement sécurisé (HttpOnly) renouvelé automatiquement.
- Déconnexion automatique après inactivité (durée réglable dans *Paramètres → Alertes et règles*).
- Les menus et les pages sont filtrés selon le rôle ; l'API reste la vraie barrière de sécurité.

## Langues

L'adresse commence par `/fr` ou `/ar`. Chaque texte d'interface est écrit en deux langues à l'endroit où il est utilisé ;
les contenus saisis par l'école (cours, annonces, parcours…) ont un champ français et un champ arabe.
Si la version arabe d'un contenu est vide, la version française s'affiche.

## Application installable (PWA)

- `src/app/manifest.ts` : nom et couleurs (le nom vient des paramètres de l'école).
- `public/sw.js` : service worker minimal — page « hors connexion » claire, jamais de données périmées (l'API n'est pas mise en cache).
- Icônes : `npm run icons` (régénère `public/icons/*` — étoile à huit branches dorée sur vert).
  Pour utiliser le logo de l'école, remplacer simplement les PNG de `public/icons/` (192, 512, maskable 512, apple-touch 180).
- Le service worker n'est actif qu'en production.

## Structure

```
src/
  app/[locale]/(site)/    site public
  app/[locale]/(auth)/    connexion, mot de passe oublié / à changer
  app/[locale]/(app)/     espace connecté : admin/…, teacher/…, notifications, account
  components/ui/          kit visuel (cartes, boutons, formulaires, fenêtres, onglets…)
  components/app/         éléments métier (fiche élève, finances, présences, progression…)
  lib/                    API, authentification, langues, formats, filtres dans l'adresse
public/                   icônes, service worker, page hors ligne
scripts/make-icons.mjs    génération des icônes
```

## Conventions

- Espace de gestion en **cartes** (pas de tableaux) : lisible sur téléphone comme sur ordinateur.
- Les filtres et la pagination sont dans l'adresse : le bouton « retour » et le partage de lien fonctionnent.
- Montants en centimes côté API, affichés dans la devise des paramètres.
- `npm run typecheck` vérifie les types.
