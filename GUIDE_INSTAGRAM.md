# Guide complet : configurer Instagram pour la publication automatique

> Ce guide part de zero. A la fin, ton outil admin pourra poster directement sur Instagram.

---

## PARTIE 1 — Creer le compte Instagram (si pas deja fait)

### 1.1 Telecharger Instagram
- Sur ton telephone : App Store (iPhone) ou Google Play (Android)
- Chercher "Instagram", installer

### 1.2 Creer le compte
- Ouvrir Instagram > **S'inscrire**
- Utiliser une **adresse email dediee** (pas ton email perso — mieux pour separer pro/perso)
- Nom d'utilisateur : `lechoixdeclara` (ou `le.choix.de.clara` si pris)
- Mot de passe : robuste, unique, note-le quelque part de sur

### 1.3 Completer le profil (optimise 2026)

**Photo de profil :**
- Utiliser une photo de Clara (visage, souriante, fond neutre)
- 320x320px minimum, format carre
- Doit etre reconnaissable meme en petit (pas de texte)

**Nom affiche :**
```
Clara | Tests & Avis Mode, Gaming, Cosplay
```
> Le champ "Nom" est indexe par le moteur de recherche Instagram. Mets-y tes mots-cles.

**Bio (150 caracteres max) :**
```
Je teste. Je donne mon avis. Pas de filtre.
Mode · Gaming · Cosplay
Mes tests complets ici
```
> Structure en 3 lignes : (1) accroche unique, (2) piliers de contenu, (3) CTA

**Lien en bio :**
```
https://lechoixdeclara.fr
```

**Categorie :** "Blogueuse" ou "Creatrice de contenu digital"

---

## PARTIE 2 — Passer en compte Business

> **Pourquoi Business et pas Creator ?** L'API Instagram Graph supporte mieux les comptes Business pour la publication automatique. Certains outils tiers ne fonctionnent pas avec les comptes Creator.

### 2.1 Passer en professionnel
1. Instagram > **Parametres** (icone engrenage)
2. **Type de compte et outils** > **Passer a un compte professionnel**
3. Choisir **Entreprise** (pas Createur)
4. Categorie : **Blog personnel** ou **Site web de divertissement**
5. Valider

### 2.2 Ajouter les infos business
- Email de contact : ton email (sera visible publiquement, optionnel)
- Pas besoin d'adresse physique ni de telephone

---

## PARTIE 3 — Creer une Page Facebook

> La Page Facebook est **obligatoire** pour connecter l'API Instagram. Elle sert de pont entre ton compte Instagram et la plateforme Meta pour les developpeurs.

### 3.1 Creer la Page
1. Aller sur **facebook.com** (connecte-toi ou cree un compte si besoin)
2. Menu hamburger (en haut a gauche) > **Pages** > **Creer une Page**
3. Nom de la Page : **Le Choix de Clara**
4. Categorie : **Blog personnel** ou **Site web**
5. Bio courte : "Tests produits lifestyle, mode, gaming et cosplay par Clara"
6. Cliquer **Creer la Page**

### 3.2 Lier la Page a Instagram
1. Sur ta Page Facebook > **Parametres** (en bas a gauche)
2. **Comptes lies** > **Instagram**
3. Cliquer **Connecter un compte**
4. Se connecter avec les identifiants Instagram de l'etape 1
5. Autoriser la connexion

> **Verification :** Retourne sur Instagram > Parametres > Compte > Comptes lies. Tu dois voir ta Page Facebook listee.

---

## PARTIE 4 — Creer une application Meta (Facebook App)

C'est l'etape la plus technique. Suis chaque ecran.

### 4.1 S'inscrire comme developpeur Meta
1. Aller sur **developers.facebook.com**
2. Cliquer **Demarrer** (ou **Get Started** en haut a droite)
3. Accepter les conditions d'utilisation Meta Platform
4. Verifier ton adresse email (un code sera envoye)
5. Activer l'**authentification a deux facteurs (2FA)** si demande
   - Utiliser une app d'authentification (Google Authenticator, Authy, etc.)

### 4.2 Creer l'application
1. Aller dans **Mes applications** > **Creer une application**
2. **Cas d'usage :** selectionner **"Autre"** puis **"Business"**
3. **Nom de l'application :** `Clara Instagram Tool` (ou ce que tu veux)
4. **Email de contact :** ton email
5. Cliquer **Creer l'application**
6. Tu arrives sur le **Dashboard** de ton app

### 4.3 Ajouter le produit Instagram Graph API
1. Dans le menu gauche du dashboard, cliquer **Ajouter un produit**
2. Trouver **"Instagram Graph API"** dans la liste
3. Cliquer **Configurer**
4. C'est fait — le produit est ajoute

### 4.4 Noter les identifiants de l'app
1. Menu gauche > **Parametres** > **Base**
2. Note ces deux valeurs (tu en auras besoin) :
   - **Identifiant de l'application (App ID)** : `________________`
   - **Cle secrete de l'application (App Secret)** : cliquer "Afficher" > `________________`

> **IMPORTANT :** ne partage JAMAIS l'App Secret. C'est comme un mot de passe.

---

## PARTIE 5 — Obtenir les tokens d'acces

### 5.1 Generer un token court (1 heure)
1. Aller sur **developers.facebook.com/tools/explorer/**
2. En haut a droite, selectionner **ton application** dans le menu deroulant
3. Cliquer **"Generer un token d'acces"** (ou "Get User Access Token")
4. Dans la fenetre de permissions, cocher :
   - `instagram_basic`
   - `instagram_content_publish`
   - `pages_show_list`
   - `pages_read_engagement`
5. Cliquer **"Generer un token d'acces"**
6. Autoriser dans la popup Facebook
7. **Copie le token affiche** — c'est ton token COURT (expire dans 1h)

> **DIS-MOI STOP ICI.** Copie-moi le token court et l'App Secret. Je ferai les etapes 5.2 et 5.3 automatiquement avec des commandes curl.

### 5.2 Convertir en token longue duree (60 jours)

> Cette etape sera faite par moi automatiquement quand tu me donneras le token court.

Appel API :
```
GET https://graph.facebook.com/v21.0/oauth/access_token
  ?grant_type=fb_exchange_token
  &client_id=TON_APP_ID
  &client_secret=TON_APP_SECRET
  &fb_exchange_token=TON_TOKEN_COURT
```

La reponse contient un `access_token` valide 60 jours.

### 5.3 Recuperer l'Instagram User ID

> Egalement fait par moi automatiquement.

**Etape A** — Trouver l'ID de ta Page Facebook :
```
GET https://graph.facebook.com/v21.0/me/accounts?access_token=TOKEN_LONG
```

**Etape B** — Trouver l'ID Instagram Business :
```
GET https://graph.facebook.com/v21.0/PAGE_ID?fields=instagram_business_account&access_token=TOKEN_LONG
```

### 5.4 Configurer le projet

> Fait par moi automatiquement : j'ecris les valeurs dans ton `.env`.

```env
INSTAGRAM_ACCESS_TOKEN=le_token_longue_duree
INSTAGRAM_USER_ID=le_instagram_business_account_id
```

---

## PARTIE 6 — Tester

1. Lance `npm run dev` dans le projet clara-site-main
2. Va sur localhost:3000, connecte-toi admin (triple-clic sur le "o" du footer)
3. Clique sur le bouton **"Post Instagram"** (gradient violet/rose)
4. Selectionne une photo > genere un prompt > colle la legende
5. Clique **"Poster sur Instagram"**
6. Verifie sur ton compte Instagram que le post est la

---

## PARTIE 7 — Maintenance du token

Le token expire tous les **60 jours**. L'outil affiche un avertissement quand il reste moins de 7 jours.

**Pour renouveler :**
```
GET https://graph.facebook.com/v21.0/oauth/access_token
  ?grant_type=fb_exchange_token
  &client_id=TON_APP_ID
  &client_secret=TON_APP_SECRET
  &fb_exchange_token=TON_TOKEN_ACTUEL
```

> Le token peut etre renouvele a partir de 24h apres sa creation, et avant son expiration. Le nouveau token est valide 60 jours a partir du renouvellement.

---

## PARTIE 8 — Bonnes pratiques Instagram 2026

### Quand poster
- **Meilleurs jours :** Mardi, Mercredi, Jeudi
- **Meilleurs creneaux :** 11h-13h et 18h-20h (heure de ton audience)
- **Repondre aux commentaires** dans la premiere heure (boost algorithmique)

### Contenu qui performe
- **Hook en premiere ligne** : question, affirmation forte, emoji accrocheur
- **Authenticite > perfection** : le contenu "vrai" surpasse le contenu lisse
- **Video (Reels)** : le format le plus pousse par l'algorithme en 2026
- **Contenu original** : Instagram penalise le contenu recycle d'autres plateformes
- **Carousel** : excellent pour l'engagement (les gens swipent = plus de temps passe)

### Hashtags 2026
- **15-20 hashtags** par post (le max est 30, mais 15-20 est optimal)
- **Mix :** 5 populaires (500K+ posts) + 10 niche (10K-100K posts) + 5 ultra-niche (<10K)
- **Pas dans la legende** : les mettre dans un commentaire separe ou apres 5 sauts de ligne
- **Varier** : ne pas reutiliser le meme bloc de hashtags a chaque post (penalite algo)

### SEO Instagram
- **Nom d'utilisateur et nom affiche** : y mettre des mots-cles (mode, gaming, avis, test)
- **Legendes** : ecrire des legendes descriptives avec des mots-cles naturels
- **Alt text** : Instagram permet d'ajouter un texte alternatif aux images (SEO + accessibilite)
- Instagram est devenu un **moteur de recherche** — les gens cherchent par mots-cles, plus seulement par hashtags

### Ce que l'algorithme favorise en 2026
1. **Temps passe** sur le post (legendes longues + carousels)
2. **Partages en DM** (le signal #1 en 2026)
3. **Sauvegardes** (signal fort de contenu de valeur)
4. **Commentaires** (surtout les reponses longues)
5. **Contenu original** (pas de watermark TikTok, pas de repost)

---

## Checklist rapide

- [ ] Compte Instagram cree
- [ ] Profil optimise (photo, bio, lien, categorie)
- [ ] Compte passe en Business
- [ ] Page Facebook creee et liee a Instagram
- [ ] App Meta creee sur developers.facebook.com
- [ ] Instagram Graph API ajoute comme produit
- [ ] Token court genere via l'Explorateur API
- [ ] Token long obtenu (60 jours)
- [ ] Instagram User ID recupere
- [ ] `.env` configure
- [ ] Premier post de test reussi
