/**
 * Script de pre-rendering pour le SEO
 * Génère des fichiers HTML statiques avec les bonnes meta tags pour chaque page.
 * Exécuté après le build Vite (npm run build).
 *
 * Chaque page générée contient :
 * - Le bon <title> et <meta description>
 * - La bonne balise <link rel="canonical">
 * - Les bons Open Graph / Twitter Card meta tags
 * - Les données structurées Schema.org (JSON-LD)
 * - Le même shell HTML que index.html (pour le rendu initial)
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DIST_DIR = join(__dirname, '..', 'dist');
const BASE_URL = 'https://lechoixdeclara.fr';
const PROJECT_ID = 'le-choix-de-clara';
const COLLECTION_PATH = 'artifacts/le-choix-de-clara/public/data/articles';

// Slugify identique à src/utils/slugify.js
function slugify(text) {
    return text
        .toString()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9\s-]/g, '')
        .trim()
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-');
}

// Fetch articles depuis Firebase REST API (pas besoin de credentials pour les données publiques)
async function fetchArticles() {
    const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/${COLLECTION_PATH}`;
    try {
        const response = await fetch(url);
        if (!response.ok) {
            console.warn(`Firebase API returned ${response.status}. Continuing with static pages only.`);
            return [];
        }
        const data = await response.json();
        const documents = data.documents || [];

        return documents.map(doc => {
            const fields = doc.fields || {};
            const id = doc.name.split('/').pop();
            return {
                id,
                title: fields.title?.stringValue || '',
                excerpt: fields.excerpt?.stringValue || '',
                category: fields.category?.stringValue || '',
                imageUrl: fields.imageUrl?.stringValue || '',
                imageAlt: fields.imageAlt?.stringValue || '',
                slug: fields.slug?.stringValue || slugify(fields.title?.stringValue || ''),
                createdAt: fields.createdAt?.integerValue || null,
                affiliateLink: fields.affiliateLink?.stringValue || '',
                content: fields.content?.stringValue || ''
            };
        });
    } catch (err) {
        console.warn('Could not fetch articles from Firebase:', err.message);
        return [];
    }
}

// Lit le template HTML (index.html compilé par Vite)
function readTemplate() {
    return readFileSync(join(DIST_DIR, 'index.html'), 'utf-8');
}

// Escape HTML pour les attributs
function escapeAttr(str) {
    return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Génère un fichier HTML avec les bonnes meta tags
function generatePage(template, { title, description, canonical, ogTitle, ogDescription, ogImage, ogType, structuredData }) {
    let html = template;

    // Remplacer le title
    html = html.replace(
        /<title>[^<]*<\/title>/,
        `<title>${escapeAttr(title)}</title>`
    );

    // Remplacer meta description
    html = html.replace(
        /<meta name="description"\s+content="[^"]*">/,
        `<meta name="description" content="${escapeAttr(description)}">`
    );

    // Remplacer canonical
    html = html.replace(
        /<link rel="canonical" href="[^"]*">/,
        `<link rel="canonical" href="${escapeAttr(canonical)}">`
    );

    // Remplacer Open Graph
    html = html.replace(
        /<meta property="og:type" content="[^"]*">/,
        `<meta property="og:type" content="${escapeAttr(ogType || 'website')}">`
    );
    html = html.replace(
        /<meta property="og:url" content="[^"]*">/,
        `<meta property="og:url" content="${escapeAttr(canonical)}">`
    );
    html = html.replace(
        /<meta property="og:title" content="[^"]*">/,
        `<meta property="og:title" content="${escapeAttr(ogTitle || title)}">`
    );
    html = html.replace(
        /<meta property="og:description" content="[^"]*">/,
        `<meta property="og:description" content="${escapeAttr(ogDescription || description)}">`
    );
    if (ogImage) {
        html = html.replace(
            /<meta property="og:image" content="[^"]*">/,
            `<meta property="og:image" content="${escapeAttr(ogImage)}">`
        );
    }

    // Remplacer Twitter Card
    html = html.replace(
        /<meta name="twitter:url" content="[^"]*">/,
        `<meta name="twitter:url" content="${escapeAttr(canonical)}">`
    );
    html = html.replace(
        /<meta name="twitter:title" content="[^"]*">/,
        `<meta name="twitter:title" content="${escapeAttr(ogTitle || title)}">`
    );
    html = html.replace(
        /<meta name="twitter:description" content="[^"]*">/,
        `<meta name="twitter:description" content="${escapeAttr(ogDescription || description)}">`
    );
    if (ogImage) {
        html = html.replace(
            /<meta name="twitter:image" content="[^"]*">/,
            `<meta name="twitter:image" content="${escapeAttr(ogImage)}">`
        );
    }

    // Ajouter les données structurées JSON-LD avant </head>
    if (structuredData) {
        const jsonLd = `<script type="application/ld+json">${JSON.stringify(structuredData)}</script>`;
        html = html.replace('</head>', `${jsonLd}\n</head>`);
    }

    return html;
}

// Écrit un fichier HTML dans le bon dossier de dist
function writePage(relativePath, html) {
    const filePath = join(DIST_DIR, relativePath, 'index.html');
    const dir = dirname(filePath);
    if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
    }
    writeFileSync(filePath, html, 'utf-8');
    console.log(`  ✓ ${relativePath}/index.html`);
}

// Génère le sitemap.xml avec les nouvelles URLs
function generateSitemap(articles) {
    const today = new Date().toISOString().split('T')[0];

    const staticPages = [
        { loc: '/', priority: '1.0' },
        { loc: '/about', priority: '0.8' },
        { loc: '/le-dressing', priority: '0.7' },
        { loc: '/le-coin-geek', priority: '0.7' },
    ];

    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';

    for (const page of staticPages) {
        xml += `  <url>\n    <loc>${BASE_URL}${page.loc}</loc>\n    <lastmod>${today}</lastmod>\n    <priority>${page.priority}</priority>\n  </url>\n`;
    }

    for (const art of articles) {
        const slug = art.slug || slugify(art.title);
        xml += `  <url>\n    <loc>${BASE_URL}/article/${slug}</loc>\n    <lastmod>${today}</lastmod>\n    <priority>0.6</priority>\n  </url>\n`;
    }

    xml += '</urlset>';
    return xml;
}

// --- MAIN ---
async function main() {
    console.log('🔍 Pre-rendering : génération des pages statiques SEO...\n');

    const template = readTemplate();
    const articles = await fetchArticles();
    console.log(`📦 ${articles.length} articles récupérés depuis Firebase.\n`);

    const defaultImage = `${BASE_URL}/clara-experte-avis-activewear-lechoixdeclara.webp`;

    // 1. Pages statiques
    const staticPages = [
        {
            path: 'about',
            title: 'À Propos de Clara | LeChoixDeClara.fr',
            description: 'Découvrez Clara, 28 ans, 1m78, passionnée de mode et de tech. Je teste et donne mon avis sincère pour vous aider à choisir le cadeau parfait.',
            ogType: 'profile'
        },
        {
            path: 'le-dressing',
            title: 'Le Dressing de Clara - Mode et Activewear | LeChoixDeClara.fr',
            description: 'Découvrez ma sélection mode, activewear et tenues de sport. Mes avis sincères et détaillés pour des cadeaux réussis.',
        },
        {
            path: 'le-coin-geek',
            title: 'Le Coin Geek de Clara - Tech et Gaming | LeChoixDeClara.fr',
            description: 'Ma sélection Tech, Gaming et Pop Culture. Des idées cadeaux originales pour les geeks et les passionnés.',
        },
        {
            path: 'privacy',
            title: 'Politique de confidentialité | LeChoixDeClara.fr',
            description: 'Politique de confidentialité du site LeChoixDeClara.fr. Informations sur la collecte et l\'utilisation des données.',
        },
        {
            path: 'legal',
            title: 'Mentions légales | LeChoixDeClara.fr',
            description: 'Mentions légales du site LeChoixDeClara.fr.',
        },
        {
            path: 'affiliation',
            title: 'Affiliation | LeChoixDeClara.fr',
            description: 'Informations sur les liens d\'affiliation utilisés sur LeChoixDeClara.fr.',
        },
    ];

    console.log('📄 Pages statiques :');
    for (const page of staticPages) {
        const html = generatePage(template, {
            title: page.title,
            description: page.description,
            canonical: `${BASE_URL}/${page.path}`,
            ogType: page.ogType || 'website',
            ogImage: defaultImage,
        });
        writePage(page.path, html);
    }

    // 2. Pages articles
    console.log('\n📝 Pages articles :');
    for (const article of articles) {
        const slug = article.slug || slugify(article.title);
        const articleTitle = `${article.title} | LeChoixDeClara.fr`;
        const articleImage = article.imageUrl
            ? (article.imageUrl.startsWith('http') ? article.imageUrl : `${BASE_URL}/${article.imageUrl}`)
            : defaultImage;

        const structuredData = {
            "@context": "https://schema.org",
            "@type": "Review",
            "itemReviewed": {
                "@type": "Product",
                "name": article.title,
                "image": articleImage,
                "description": article.excerpt,
                "url": `${BASE_URL}/article/${slug}`
            },
            "author": {
                "@type": "Person",
                "name": "Clara",
                "description": "Experte en cadeaux et tests produits"
            },
            "publisher": {
                "@type": "Organization",
                "name": "Le Choix de Clara",
                "url": BASE_URL
            },
            "reviewBody": article.excerpt,
            "url": `${BASE_URL}/article/${slug}`
        };

        if (article.createdAt) {
            structuredData.datePublished = new Date(parseInt(article.createdAt)).toISOString();
        }

        const html = generatePage(template, {
            title: articleTitle,
            description: article.excerpt,
            canonical: `${BASE_URL}/article/${slug}`,
            ogTitle: articleTitle,
            ogDescription: article.excerpt,
            ogImage: articleImage,
            ogType: 'article',
            structuredData,
        });
        writePage(`article/${slug}`, html);
    }

    // 3. Injecter le script de redirection des anciennes URLs dans index.html
    console.log('\n🔀 Redirection des anciennes URLs :');
    const articleIdToSlug = {};
    for (const article of articles) {
        const slug = article.slug || slugify(article.title);
        articleIdToSlug[article.id] = slug;
    }

    // Script de redirection amélioré :
    // 1. Détecte TOUT query param legacy (?a=, ?p=, ?cat=)
    // 2. Injecte immédiatement <meta name="robots" content="noindex"> pour empêcher l'indexation
    // 3. Met à jour le canonical vers l'URL propre
    // 4. Redirige vers la bonne page (ou homepage si ID inconnu)
    const redirectScript = `<script>(function(){var s=window.location.search;if(!s)return;var p=new URLSearchParams(s);var a=p.get("a");var pg=p.get("p");var cat=p.get("cat");if(!a&&!pg&&!cat)return;var ni=document.createElement("meta");ni.name="robots";ni.content="noindex, nofollow";document.head.appendChild(ni);var r={about:"/about",privacy:"/privacy",affiliation:"/affiliation",legal:"/legal",admin:"/admin"};var cm={MODE:"/le-dressing",GEEK:"/le-coin-geek"};var m=${JSON.stringify(articleIdToSlug)};var dest="/";if(pg&&r[pg]){dest=r[pg];}else if(a&&m[a]){dest="/article/"+m[a];}else if(cat&&cm[cat]){dest=cm[cat];}var c=document.querySelector('link[rel="canonical"]');if(c)c.href="https://lechoixdeclara.fr"+dest;window.location.replace(dest);})();</script>`;

    const indexPath = join(DIST_DIR, 'index.html');
    let indexHtml = readFileSync(indexPath, 'utf-8');
    // Injecter juste après le canonical pour que ce soit exécuté le plus tôt possible
    indexHtml = indexHtml.replace(
        '<link rel="canonical" href="https://lechoixdeclara.fr/">',
        `<link rel="canonical" href="https://lechoixdeclara.fr/">\n${redirectScript}`
    );
    writeFileSync(indexPath, indexHtml, 'utf-8');
    console.log(`  ✓ Script de redirection injecté (${Object.keys(articleIdToSlug).length} articles mappés)`);

    // 4. Générer sitemap.xml
    console.log('\n🗺️  Sitemap :');
    const sitemap = generateSitemap(articles);
    writeFileSync(join(DIST_DIR, 'sitemap.xml'), sitemap, 'utf-8');
    console.log('  ✓ sitemap.xml');

    // Aussi mettre à jour dans public/ pour le repo
    writeFileSync(join(__dirname, '..', 'public', 'sitemap.xml'), sitemap, 'utf-8');
    console.log('  ✓ public/sitemap.xml (source)');

    // 5. Copier index.html vers 404.html (GitHub Pages SPA fallback) avec noindex
    let notFoundHtml = readFileSync(indexPath, 'utf-8');
    notFoundHtml = notFoundHtml.replace('</head>', '<meta name="robots" content="noindex">\n</head>');
    writeFileSync(join(DIST_DIR, '404.html'), notFoundHtml, 'utf-8');
    console.log('\n🔄 404.html créé (fallback SPA + noindex pour éviter les doublons)');

    console.log('\n✅ Pre-rendering terminé avec succès !');
}

main().catch(err => {
    console.error('Erreur lors du pre-rendering:', err);
    process.exit(1);
});
