# PLANIF — version web app

Ceci est la version « vraie web app » de PLANIF : comptes utilisateurs,
sauvegarde automatique de vos lieux/groupes/thème, et clé API cachée en
sécurité sur un serveur (jamais visible dans le navigateur).

Ce guide suppose que vous n'avez jamais fait ça — suivez les étapes dans
l'ordre. Comptez 30-45 minutes la première fois.

## Ce dont vous aurez besoin (tous gratuits pour démarrer)

1. Un compte **GitHub** (github.com) — où le code va vivre
2. Un compte **Anthropic Console** (console.anthropic.com) — pour la clé IA
3. Un compte **Supabase** (supabase.com) — comptes utilisateurs + base de données
4. Un compte **Netlify** (netlify.com) — pour héberger le site

---

## Étape 1 — Clé API Anthropic

1. Allez sur console.anthropic.com, créez un compte
2. Menu **API Keys** → **Create Key** → donnez-lui un nom (ex. "planif-prod")
3. Copiez la clé (elle commence par `sk-ant-...`) — vous ne pourrez plus la
   revoir après, gardez-la de côté dans un endroit sûr
4. Sous **Billing**, ajoutez un moyen de paiement — c'est facturé à l'usage
   (habituellement quelques dollars par mois pour un usage comme le vôtre)

## Étape 2 — Base de données et comptes (Supabase)

1. Allez sur supabase.com → **New Project**
2. Donnez-lui un nom (ex. "planif") et un mot de passe de base de données
   (gardez-le de côté aussi)
3. Une fois le projet créé, allez dans **SQL Editor** (menu de gauche)
4. Ouvrez le fichier `supabase/schema.sql` de ce projet, copiez tout son
   contenu, collez-le dans l'éditeur SQL de Supabase, cliquez **Run**
5. Allez dans **Project Settings** (roue dentée) → **API**
6. Notez deux valeurs : **Project URL** et la clé **anon public**

## Étape 3 — Mettre le code sur GitHub

1. Allez sur github.com → **New repository** → nommez-le "planif-webapp"
   → **Create repository**
2. Sur la page du nouveau dépôt, cliquez **uploading an existing file**
3. Glissez-déposez TOUS les fichiers et dossiers de ce projet
   (gardez la structure des dossiers intacte : `app/`, `components/`, etc.)
4. **Commit changes**

## Étape 4 — Déployer sur Netlify

1. Allez sur netlify.com → connectez-vous avec votre compte GitHub
2. **Add new site** → **Import an existing project** → choisissez GitHub
   → sélectionnez votre dépôt "planif-webapp"
3. Netlify détecte Next.js automatiquement — laissez les réglages par défaut
4. **Avant de cliquer Deploy**, ouvrez **Add environment variables** et
   ajoutez ces trois variables (voir `.env.local.example` pour les noms
   exacts) :
   - `ANTHROPIC_API_KEY` → votre clé de l'étape 1
   - `NEXT_PUBLIC_SUPABASE_URL` → le Project URL de l'étape 2
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` → la clé anon de l'étape 2
5. Cliquez **Deploy**

Après quelques minutes, votre site est en ligne à une adresse comme
`https://planif-xxxxx.netlify.app`. Vous pourrez ensuite lui donner un nom
de domaine personnalisé dans les réglages Netlify si vous le souhaitez.

## Comment tester que tout fonctionne

1. Ouvrez votre site → vous devriez voir la page de connexion
2. Créez un compte avec votre courriel
3. Vérifiez votre courriel (Supabase envoie un lien de confirmation) et
   confirmez
4. Connectez-vous → vous devriez voir PLANIF au complet
5. Ajoutez un lieu, changez de page, revenez — le lieu doit toujours y être
6. Essayez « Générer des idées » — si ça échoue, vérifiez la variable
   `ANTHROPIC_API_KEY` dans Netlify

## Étape 5 — Mettre en place les abonnements payants (Stripe)

Cette étape est optionnelle — faites-la seulement quand vous êtes prête à
faire payer l'accès à PLANIF. Tant que ce n'est pas fait, personne ne peut
utiliser l'app même en créant un compte (l'accès est bloqué en attendant
un abonnement actif) — donc si vous n'êtes pas prête, dites-le et on peut
désactiver temporairement ce blocage.

1. Créez un compte sur **stripe.com** (gratuit, aucun frais tant qu'il n'y
   a pas de vraies transactions)
2. Dans le tableau de bord Stripe, cherchez **Developers → API keys** →
   copiez la clé qui commence par `sk_test_...` (mode test, pour essayer
   sans vrai argent d'abord)
3. Exécutez `supabase/schema_billing.sql` dans Supabase (SQL Editor →
   coller → Run) — comme vous l'avez fait pour le premier fichier SQL
4. Dans Supabase → Project Settings → API Keys, copiez aussi la clé
   **service_role** (différente de la clé publique utilisée jusqu'ici)
5. Dans Netlify → Environment variables, ajoutez :
   - `STRIPE_SECRET_KEY` → la clé de l'étape 2
   - `SUPABASE_SERVICE_ROLE_KEY` → la clé de l'étape 4
   - `STRIPE_MONTHLY_PRICE_CENTS` → prix mensuel en cents (ex. `999` pour 9,99 $)
   - `STRIPE_ANNUAL_PRICE_CENTS` → prix annuel en cents (ex. `8900` pour 89 $)
   - `SITE_URL` → l'adresse complète de votre site
6. Configurez le webhook Stripe (pour que les paiements se reflètent
   automatiquement) :
   - Dans Stripe → Developers → Webhooks → **Add endpoint**
   - URL : `https://VOTRE-SITE.netlify.app/api/stripe-webhook`
   - Événements à écouter : `checkout.session.completed`,
     `customer.subscription.updated`, `customer.subscription.deleted`
   - Une fois créé, copiez le **Signing secret** (commence par `whsec_...`)
   - Ajoutez-le dans Netlify comme `STRIPE_WEBHOOK_SECRET`
7. Redéployez (« Deploy project without cache »)

**Pour ajuster les prix plus tard** : changez seulement
`STRIPE_MONTHLY_PRICE_CENTS` et `STRIPE_ANNUAL_PRICE_CENTS` dans Netlify,
puis redéployez — aucune modification de code nécessaire.

**Mode test vs argent réel** : tant que vous utilisez une clé `sk_test_...`,
aucun vrai paiement n'est traité (utilisez le numéro de carte test
`4242 4242 4242 4242`, n'importe quelle date future, n'importe quel CVC).
Quand vous êtes prête à accepter de vrais paiements, remplacez la clé par
celle en mode Live dans Stripe (`sk_live_...`) et refaites le webhook
avec l'URL en mode Live.

## Ce qui est sauvegardé automatiquement (et ce qui ne l'est pas encore)

**Sauvegardé** : vos lieux, vos groupes, votre thème par défaut — liés à
votre compte, retrouvés à chaque connexion.

**Pas encore sauvegardé** (à faire en phase 2 si souhaité) : les idées
générées, l'horaire complet d'une journée précise, les fiches de
transition. Une table `saved_plans` existe déjà dans le schéma pour ça —
il reste à brancher un bouton « Sauvegarder cette planification ».

## Limites connues à garder en tête

- Les images de coloriage importées ne sont pas sauvegardées entre les
  sessions (elles vivent seulement en mémoire pendant que la page est ouverte)
- Un seul type de compte pour l'instant — pas de distinction
  administratrice/éducatrice si vous vouliez gérer plusieurs utilisatrices
  différemment plus tard
