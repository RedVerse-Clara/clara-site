import DOMPurify from 'dompurify';

/**
 * Sanitize HTML content to prevent XSS attacks
 * @param {string} dirty - Untrusted HTML content
 * @returns {string} - Sanitized HTML safe for rendering
 */
export function sanitizeHTML(dirty) {
    if (!dirty) return '';

    return DOMPurify.sanitize(dirty, {
        // Tags autorisés (liste blanche)
        ALLOWED_TAGS: [
            'p', 'br', 'strong', 'em', 'u', 'i', 'b',
            'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
            'ul', 'ol', 'li',
            'a', 'img',
            'blockquote', 'code', 'pre',
            'span', 'div'
        ],

        // Attributs autorisés
        ALLOWED_ATTR: [
            'href', 'src', 'alt', 'title', 'target', 'rel',
            'class', 'id'
        ],

        // Interdire les attributs data-*
        ALLOW_DATA_ATTR: false,

        // Forcer les liens externes à s'ouvrir dans un nouvel onglet
        ADD_ATTR: ['target'],

        // Nettoyer les URIs
        SANITIZE_DOM: true,

        // Retourner une string (pas un DOM node)
        RETURN_DOM: false,
        RETURN_DOM_FRAGMENT: false
    });
}

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
