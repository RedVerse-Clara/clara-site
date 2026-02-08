import { useEffect } from 'react';

export default function SEO({ title, description, imageUrl, urlSuffix = '', type = 'website' }) {
    useEffect(() => {
        // Sauvegarder les anciennes valeurs
        const oldTitle = document.title;
        const metaDesc = document.querySelector('meta[name="description"]');
        const oldDesc = metaDesc ? metaDesc.getAttribute('content') : '';

        // Canonical
        let linkCanonical = document.querySelector('link[rel="canonical"]');
        if (!linkCanonical) {
            linkCanonical = document.createElement('link');
            linkCanonical.setAttribute('rel', 'canonical');
            document.head.appendChild(linkCanonical);
        }
        const oldCanonical = linkCanonical.getAttribute('href');

        // Construire les nouvelles valeurs
        const baseUrl = 'https://lechoixdeclara.fr/';
        const fullUrl = `${baseUrl}${urlSuffix}`;
        const finalTitle = title.includes('|') ? title : `${title} | LeChoixDeClara.fr`;
        const finalImage = imageUrl || 'https://lechoixdeclara.fr/clara-experte-avis-activewear-lechoixdeclara.webp';

        // Mettre à jour le DOM
        document.title = finalTitle;
        if (metaDesc) metaDesc.setAttribute('content', description);
        linkCanonical.setAttribute('href', fullUrl);

        // Open Graph
        const updateMeta = (selector, value) => {
            let el = document.querySelector(selector);
            if (!el) {
                // Créer si n'existe pas (au cas où)
                el = document.createElement('meta');

                if (selector.startsWith('meta[property=')) {
                    el.setAttribute('property', selector.replace("meta[property='", "").replace("']", ""));
                } else if (selector.startsWith('meta[name=')) {
                    el.setAttribute('name', selector.replace("meta[name='", "").replace("']", ""));
                }

                document.head.appendChild(el);
            }
            if (el) el.setAttribute('content', value);
        };

        updateMeta("meta[property='og:title']", finalTitle);
        updateMeta("meta[property='og:description']", description);
        updateMeta("meta[property='og:image']", finalImage);
        updateMeta("meta[property='og:url']", fullUrl);
        updateMeta("meta[property='og:type']", type);

        // Twitter
        updateMeta("meta[name='twitter:title']", finalTitle);
        updateMeta("meta[name='twitter:description']", description);
        updateMeta("meta[name='twitter:image']", finalImage);
        updateMeta("meta[name='twitter:url']", fullUrl);

        return () => {
            // Restaurer (cleanup)
            document.title = oldTitle;
            if (metaDesc) metaDesc.setAttribute('content', oldDesc);
            if (linkCanonical) linkCanonical.setAttribute('href', oldCanonical || baseUrl); // Retour à la home par défaut
        };
    }, [title, description, imageUrl, urlSuffix, type]);

    return null;
}
