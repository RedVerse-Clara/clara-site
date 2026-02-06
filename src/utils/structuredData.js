/**
 * Hook pour ajouter des données structurées Schema.org au document
 * Améliore le SEO en aidant Google à comprendre le contenu
 */
import { useEffect } from 'react';

export function useStructuredData(data) {
    useEffect(() => {
        if (!data) return;

        // Créer le script JSON-LD
        const script = document.createElement('script');
        script.type = 'application/ld+json';
        script.textContent = JSON.stringify(data);
        script.id = 'structured-data';

        // Supprimer l'ancien script s'il existe
        const existingScript = document.getElementById('structured-data');
        if (existingScript) {
            existingScript.remove();
        }

        // Ajouter le nouveau script
        document.head.appendChild(script);

        // Cleanup au démontage
        return () => {
            const scriptToRemove = document.getElementById('structured-data');
            if (scriptToRemove) {
                scriptToRemove.remove();
            }
        };
    }, [data]);
}

/**
 * Génère les données structurées pour un article (Review)
 */
export function generateArticleStructuredData(article) {
    return {
        "@context": "https://schema.org",
        "@type": "Review",
        "itemReviewed": {
            "@type": "Product",
            "name": article.title,
            "image": article.imageUrl ? `https://lechoixdeclara.fr/${article.imageUrl}` : undefined,
            "description": article.excerpt
        },
        "author": {
            "@type": "Person",
            "name": "Clara",
            "description": "Experte en cadeaux et tests produits"
        },
        "publisher": {
            "@type": "Organization",
            "name": "Le Choix de Clara",
            "url": "https://lechoixdeclara.fr"
        },
        "reviewBody": article.excerpt,
        "datePublished": article.createdAt ? new Date(article.createdAt).toISOString() : undefined
    };
}

/**
 * Génère les données structurées pour la page d'accueil (WebSite + Person)
 */
export function generateHomeStructuredData() {
    return {
        "@context": "https://schema.org",
        "@graph": [
            {
                "@type": "WebSite",
                "name": "Le Choix de Clara",
                "url": "https://lechoixdeclara.fr",
                "description": "Clara, 28 ans, 1m78. Je guide les hommes attentionnés dans leur choix de cadeaux pour leur chérie avec des tests sans concession.",
                "publisher": {
                    "@type": "Person",
                    "name": "Clara"
                }
            },
            {
                "@type": "Person",
                "name": "Clara",
                "description": "Experte en cadeaux et tests produits",
                "jobTitle": "Experte cadeaux",
                "url": "https://lechoixdeclara.fr"
            }
        ]
    };
}
