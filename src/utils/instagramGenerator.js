/**
 * Instagram post generator utilities
 * - Prompt builder for clipboard mode
 * - Article selection logic with cycle management
 * - Angle rotation
 */

export const ANGLES = [
    { id: 'review', label: 'Avis produit', description: 'Focus sur le produit, le verdict honnête de Clara' },
    { id: 'lifestyle', label: 'Lifestyle', description: 'Comment ce produit s\'intègre au quotidien de Clara' },
    { id: 'tip', label: 'Conseil / Astuce', description: 'Un conseil ou astuce lié à la catégorie du produit' },
    { id: 'behind-scenes', label: 'Coulisses', description: 'Les coulisses du test ou du shooting photo' },
    { id: 'question', label: 'Question', description: 'Question engageante posée à la communauté' },
];

export const CATEGORY_LABELS = {
    ACTIVEWEAR: 'Activewear / Sport',
    LOUNGEWEAR: 'Loungewear / Cocooning',
    BEACHWEAR: 'Beachwear / Plage',
    JEUX_VIDEO: 'Jeux Vidéo',
    TECH: 'Tech',
    COSPLAY: 'Cosplay',
};

/**
 * Build the prompt to copy into Claude.ai for caption generation.
 */
export function buildInstagramPrompt(article, angle, previousCaptions = []) {
    const angleObj = ANGLES.find(a => a.id === angle) || ANGLES[0];
    const categoryLabel = CATEGORY_LABELS[article.category] || article.category;

    let prompt = `Tu es le community manager Instagram de LeChoixDeClara.fr, un site de tests produits lifestyle par Clara.

Crée un post Instagram optimisé 2026 pour cette photo :
- Produit : ${article.title}
- Catégorie : ${categoryLabel}
- Description : ${article.excerpt}
- Photo : ${article.imageAlt || article.title}
- Angle demandé : ${angleObj.label} — ${angleObj.description}
- URL article : lechoixdeclara.fr/article/${article.slug}

Règles Instagram 2026 :
- Hook percutant en 1ère ligne (question, affirmation forte, ou emoji accrocheur)
- 2-3 phrases authentiques, ton Clara (féminin, enthousiaste, honnête)
- CTA clair : "Lien en bio 🔗" ou "Mon avis complet sur lechoixdeclara.fr"
- 3 à 5 hashtags maximum, ultra-ciblés (niche > populaires), séparés du texte
- Emojis stratégiques (pas trop, 3-5 max)
- Max 2200 caractères total (légende + hashtags)
- Sauts de ligne pour aérer le texte
- En 2026, moins de hashtags = mieux. 3-5 hashtags niche et pertinents battent 20 hashtags génériques`;

    if (previousCaptions.length > 0) {
        prompt += `\n\n⚠️ IMPORTANT : cet article a déjà été posté avec ces légendes. Fais quelque chose de COMPLÈTEMENT DIFFÉRENT (autre hook, autre angle narratif, autres hashtags) :\n`;
        previousCaptions.forEach((cap, i) => {
            prompt += `\n--- Post précédent ${i + 1} ---\n${cap}\n`;
        });
    }

    prompt += `\n\nRéponds EXACTEMENT dans ce format (sans rien d'autre) :

LEGENDE:
[ta légende ici, avec sauts de ligne]

HASHTAGS:
[tes 15-20 hashtags ici]`;

    return prompt;
}

/**
 * Pick the next article to use, avoiding those already used in the current cycle.
 * Returns null if all articles have been used (caller should increment cycle).
 */
export function getNextArticle(articles, usedInCurrentCycle = []) {
    const unused = articles.filter(a => !usedInCurrentCycle.includes(a.id));
    if (unused.length === 0) return null;
    return unused[Math.floor(Math.random() * unused.length)];
}

/**
 * Suggest the next angle for a given article based on post history.
 * Returns the first angle not yet used for this article, or the first angle if all used.
 */
export function getNextAngle(articleId, postHistory = []) {
    const usedAngles = postHistory
        .filter(p => p.articleId === articleId)
        .map(p => p.angle);

    const nextAngle = ANGLES.find(a => !usedAngles.includes(a.id));
    return nextAngle ? nextAngle.id : ANGLES[0].id;
}

/**
 * Get previous captions for a specific article (for anti-repetition).
 */
export function getPreviousCaptions(articleId, postHistory = []) {
    return postHistory
        .filter(p => p.articleId === articleId && p.caption)
        .map(p => p.caption);
}

/**
 * Extract all images from an article (hero + images embedded in HTML content).
 * Returns an array of { url, alt, isHero } objects.
 */
export function extractArticleImages(article) {
    const images = [];

    // Hero image
    if (article.imageUrl) {
        images.push({
            url: article.imageUrl,
            alt: article.imageAlt || article.title,
            isHero: true,
        });
    }

    // Images from article HTML content
    if (article.content) {
        const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*(?:alt=["']([^"']*)["'])?[^>]*>/gi;
        let match;
        while ((match = imgRegex.exec(article.content)) !== null) {
            const url = match[1];
            const alt = match[2] || '';
            // Avoid duplicating the hero image
            if (url !== article.imageUrl) {
                images.push({ url, alt, isHero: false });
            }
        }
        // Also catch alt before src (order can vary in HTML)
        const imgRegex2 = /<img[^>]+alt=["']([^"']*)["'][^>]*src=["']([^"']+)["'][^>]*>/gi;
        while ((match = imgRegex2.exec(article.content)) !== null) {
            const url = match[2];
            const alt = match[1] || '';
            if (url !== article.imageUrl && !images.some(img => img.url === url)) {
                images.push({ url, alt, isHero: false });
            }
        }
    }

    return images;
}

/**
 * Parse Claude's response to extract caption and hashtags.
 * Expects the format: LEGENDE:\n...\n\nHASHTAGS:\n...
 */
export function parseClaudeResponse(text) {
    const legendeMatch = text.match(/LEGENDE:\s*\n([\s\S]*?)(?=\nHASHTAGS:|\n*$)/i);
    const hashtagsMatch = text.match(/HASHTAGS:\s*\n([\s\S]*?)$/i);

    return {
        caption: legendeMatch ? legendeMatch[1].trim() : text.trim(),
        hashtags: hashtagsMatch ? hashtagsMatch[1].trim() : '',
    };
}
