# Changelog

## 2026-04-16

- **Générateur de hub thématique + épinglage home**
  - Nouveau prompt markdown `prompts/hub-generator.md` : template à copier-coller dans Claude Desktop pour générer des pages hub d'occasion (Fête des Mères, Noël, Saint-Valentin…) en voix de Clara. Produit deux blocs (métadonnées + HTML) prêts à coller dans l'admin.
  - Nouvelle catégorie `DOSSIER` dans le select admin (optgroup "Dossiers / Hubs thématiques") — exclue des filtres MODE et GEEK, apparaît uniquement en home.
  - Champ `pinned: boolean` ajouté au modèle article : toggle "Épingler en page d'accueil" dans le formulaire admin, badge "À la une" dans la liste admin.
  - Nouvelle section hero "À la une" en page d'accueil (uniquement quand filtre = ALL) : image large + titre + excerpt + CTA bordeaux. Si plusieurs articles épinglés, seul le plus récent est affiché ; les autres restent dans la grille "Derniers tests".
  - L'article épinglé est exclu de la grille "Derniers tests" pour éviter la duplication.
  - Aucune modification du prerender/sitemap : le hub reste un article standard `/article/{slug}`.

## 2026-04-08

- **SEO : fix "Bloquée par robots.txt" + "Explorée, non indexée" dans Google Search Console**
  - Cause : les règles `Disallow: /*?a=`, `/*?p=`, `/*?cat=` dans `robots.txt` empêchaient Google de crawler les anciennes URLs legacy pour découvrir les redirections JS vers les URLs propres (`/article/slug`)
  - Fix : suppression des 3 règles Disallow — le script de redirection (déjà en place dans `index.html`) gère correctement ces URLs : injection `noindex`, mise à jour du canonical, et redirection `location.replace()`
  - Impact : 8 pages "Explorée, non indexée" + 1 page "Bloquée par robots.txt" devraient se résoudre progressivement

## 2026-04-07

- **Boutons d'affiliation personnalisables**
  - Remplacement du système binaire Amazon / Instant Gaming par des liens d'affiliation libres
  - Titre de bouton entièrement personnalisable (texte libre)
  - Support de plusieurs liens d'affiliation par article
  - Formulaire admin dynamique : ajout/suppression de liens à volonté
  - Rétrocompatibilité avec les anciens articles (migration automatique à l'édition)

## 2026-04-02

- **SEO : fix "Page avec redirection" dans Google Search Console**
  - Cause : le prerender générait `path/index.html` → GitHub Pages faisait un 301 `/path` → `/path/`
  - Fix : génération de `path.html` au lieu de `path/index.html` dans `scripts/prerender.js`
  - Concerne toutes les pages statiques (`/le-dressing`, `/le-coin-geek`, `/about`, etc.) et les articles
  - GitHub Pages sert désormais les pages directement sans redirect

## 2026-03-27

- **BUGFIX CRITIQUE : boucle de redirection infinie sur toutes les sous-pages**
  - Symptôme : écran noir et navigateur qui mouline indéfiniment sur `/about`, `/article/*`, etc. (mobile + desktop + navigation privée)
  - Cause : le script JS de redirection trailing slash (`/path/` → `/path`) entrait en conflit avec le 301 forcé par GitHub Pages (`/path` → `/path/`), créant une boucle infinie
  - Fix : suppression du script de redirection dans `scripts/prerender.js`
  - Le SEO anti-doublons reste assuré par les balises `<link rel="canonical">` (sans trailing slash) déjà en place dans les pages pré-rendues
  - Mise à jour de la ligne changelog du 2026-03-26 pour refléter que cette approche a été abandonnée

## 2026-03-26

- Création du fichier CHANGELOG.md
- **SEO : corrections Google Search Console**
  - robots.txt : ajout Disallow pour `/admin` et query params legacy (`?a=`, `?p=`, `?cat=`)
  - Sitemap : ajout des pages `/privacy`, `/legal`, `/affiliation` (prerender.js + generate_sitemap.py)
  - App.jsx : redirection `/article` (sans slug) vers l'accueil au lieu de 404
  - Prerender : ajout script de redirection trailing slash pour éviter les doublons (`/legal/` → `/legal`) — **RETIRÉ le 2026-03-27** (causait une boucle infinie avec GitHub Pages)
