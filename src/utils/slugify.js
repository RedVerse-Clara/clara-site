/**
 * Génère un slug SEO-friendly à partir d'un titre
 * @param {string} text - Le texte à convertir en slug
 * @returns {string} Le slug généré
 */
export function slugify(text) {
    return text
        .toString()
        .toLowerCase()
        .normalize('NFD') // Décompose les caractères accentués
        .replace(/[\u0300-\u036f]/g, '') // Supprime les accents
        .replace(/[^a-z0-9\s-]/g, '') // Supprime les caractères spéciaux
        .trim()
        .replace(/\s+/g, '-') // Remplace les espaces par des tirets
        .replace(/-+/g, '-'); // Supprime les tirets multiples
}

/**
 * Génère un slug unique pour un article
 * @param {string} title - Le titre de l'article
 * @param {string} category - La catégorie de l'article
 * @returns {string} Le slug complet avec catégorie
 */
export function generateArticleSlug(title, category) {
    const titleSlug = slugify(title);
    const categorySlug = slugify(category);
    return `${categorySlug}/${titleSlug}`;
}
