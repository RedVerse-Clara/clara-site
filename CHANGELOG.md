# Changelog

## 2026-03-26

- Création du fichier CHANGELOG.md
- **SEO : corrections Google Search Console**
  - robots.txt : ajout Disallow pour `/admin` et query params legacy (`?a=`, `?p=`, `?cat=`)
  - Sitemap : ajout des pages `/privacy`, `/legal`, `/affiliation` (prerender.js + generate_sitemap.py)
  - App.jsx : redirection `/article` (sans slug) vers l'accueil au lieu de 404
  - Prerender : ajout script de redirection trailing slash pour éviter les doublons (`/legal/` → `/legal`)
