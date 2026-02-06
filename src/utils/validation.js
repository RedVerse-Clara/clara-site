/**
 * Validation des données d'article
 */

/**
 * Valider qu'une URL est sûre (http/https uniquement)
 * @param {string} url - URL à valider
 * @returns {boolean} - true si l'URL est sûre
 */
export function isValidURL(url) {
    if (!url) return false;

    try {
        const parsed = new URL(url);
        return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
        return false;
    }
}

/**
 * Valider les données d'un article avant sauvegarde
 * @param {Object} article - Données de l'article à valider
 * @returns {Array<string>} - Liste des erreurs (vide si valide)
 */
export function validateArticle(article) {
    const errors = [];

    // Titre
    if (!article.title || article.title.trim().length === 0) {
        errors.push("Le titre est requis");
    }
    if (article.title && article.title.length > 200) {
        errors.push("Le titre est trop long (max 200 caractères)");
    }

    // Catégorie
    const validCategories = ['MODE', 'GEEK', 'ACTIVEWEAR', 'BEAUTE'];
    if (!article.category || !validCategories.includes(article.category)) {
        errors.push("La catégorie est invalide");
    }

    // Excerpt
    if (!article.excerpt || article.excerpt.trim().length === 0) {
        errors.push("L'extrait est requis");
    }
    if (article.excerpt && article.excerpt.length > 500) {
        errors.push("L'extrait est trop long (max 500 caractères)");
    }

    // Contenu
    if (!article.content || article.content.trim().length === 0) {
        errors.push("Le contenu est requis");
    }
    if (article.content && article.content.length > 100000) {
        errors.push("Le contenu est trop long (max 100000 caractères)");
    }

    // URL d'image
    if (!article.imageUrl || article.imageUrl.trim().length === 0) {
        errors.push("L'URL de l'image est requise");
    }
    if (article.imageUrl && !isValidURL(article.imageUrl)) {
        errors.push("L'URL de l'image est invalide (doit commencer par http:// ou https://)");
    }

    // Alt text de l'image
    if (!article.imageAlt || article.imageAlt.trim().length === 0) {
        errors.push("Le texte alternatif de l'image est requis (accessibilité)");
    }
    if (article.imageAlt && article.imageAlt.length > 200) {
        errors.push("Le texte alternatif est trop long (max 200 caractères)");
    }

    // Lien d'affiliation
    if (article.affiliateLink && !isValidURL(article.affiliateLink)) {
        errors.push("Le lien d'affiliation est invalide (doit commencer par http:// ou https://)");
    }

    // Type d'affiliation
    const validAffiliateTypes = ['AMAZON', 'AUTRE', 'AUCUN'];
    if (article.affiliateType && !validAffiliateTypes.includes(article.affiliateType)) {
        errors.push("Le type d'affiliation est invalide");
    }

    return errors;
}

/**
 * Nettoyer les données d'un article (trim whitespace, etc.)
 * @param {Object} article - Données de l'article
 * @returns {Object} - Article nettoyé
 */
export function sanitizeArticleData(article) {
    return {
        ...article,
        title: article.title?.trim() || '',
        excerpt: article.excerpt?.trim() || '',
        content: article.content?.trim() || '',
        imageUrl: article.imageUrl?.trim() || '',
        imageAlt: article.imageAlt?.trim() || '',
        affiliateLink: article.affiliateLink?.trim() || '',
    };
}
