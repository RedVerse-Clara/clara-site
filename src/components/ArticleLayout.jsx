import { useEffect } from 'react';
import Icon from './Icon';
import { useStructuredData, generateArticleStructuredData } from '../utils/structuredData';

/**
 * Composant pour afficher un article complet
 */
export default function ArticleLayout({ article, onBack, allArticles, onNavigate }) {
    // Mise à jour des métadonnées pour le SEO et partage social
    useEffect(() => {
        const oldTitle = document.title;
        const oldDesc = document.querySelector('meta[name="description"]').content;
        const oldOgTitle = document.querySelector('meta[property="og:title"]').content;
        const oldOgDesc = document.querySelector('meta[property="og:description"]').content;
        const oldOgImage = document.querySelector('meta[property="og:image"]').content;
        const oldOgUrl = document.querySelector('meta[property="og:url"]').content;
        const oldTwitterTitle = document.querySelector('meta[name="twitter:title"]').content;
        const oldTwitterDesc = document.querySelector('meta[name="twitter:description"]').content;
        const oldTwitterImage = document.querySelector('meta[name="twitter:image"]').content;
        const oldTwitterUrl = document.querySelector('meta[name="twitter:url"]').content;

        // Mise à jour des meta tags
        const newTitle = `${article.title} | Avis de Clara`;
        const newDesc = article.excerpt;
        const newImage = article.imageUrl ? `https://lechoixdeclara.fr/${article.imageUrl}` : 'https://lechoixdeclara.fr/clara-experte-avis-activewear-lechoixdeclara.webp';
        const newUrl = `https://lechoixdeclara.fr/?a=${article.id}`;

        document.title = newTitle;
        document.querySelector('meta[name="description"]').content = newDesc;

        // Open Graph (Facebook, LinkedIn)
        document.querySelector('meta[property="og:title"]').content = newTitle;
        document.querySelector('meta[property="og:description"]').content = newDesc;
        document.querySelector('meta[property="og:image"]').content = newImage;
        document.querySelector('meta[property="og:url"]').content = newUrl;

        // Twitter Card
        document.querySelector('meta[name="twitter:title"]').content = newTitle;
        document.querySelector('meta[name="twitter:description"]').content = newDesc;
        document.querySelector('meta[name="twitter:image"]').content = newImage;
        document.querySelector('meta[name="twitter:url"]').content = newUrl;

        return () => {
            document.title = oldTitle;
            document.querySelector('meta[name="description"]').content = oldDesc;
            document.querySelector('meta[property="og:title"]').content = oldOgTitle;
            document.querySelector('meta[property="og:description"]').content = oldOgDesc;
            document.querySelector('meta[property="og:image"]').content = oldOgImage;
            document.querySelector('meta[property="og:url"]').content = oldOgUrl;
            document.querySelector('meta[name="twitter:title"]').content = oldTwitterTitle;
            document.querySelector('meta[name="twitter:description"]').content = oldTwitterDesc;
            document.querySelector('meta[name="twitter:image"]').content = oldTwitterImage;
            document.querySelector('meta[name="twitter:url"]').content = oldTwitterUrl;
        };
    }, [article]);

    // Données structurées Schema.org pour le SEO
    useStructuredData(generateArticleStructuredData(article));

    const isInstantGaming = article.affiliateType === 'INSTANT_GAMING';

    // Articles similaires (même catégorie)
    const relatedArticles = allArticles
        .filter(a => a.category === article.category && a.id !== article.id)
        .slice(0, 3);

    // Bouton d'affiliation réutilisable
    const AffiliateButton = ({ className = "" }) => (
        <a
            href={article.affiliateLink}
            target="_blank"
            rel="noopener noreferrer"
            className={`${isInstantGaming ? 'bg-[#FF6600]' : 'bg-clara-burgundy'} text-white px-8 py-4 rounded-xl font-bold inline-block shadow-lg btn-hover hover:scale-105 transition text-sm tracking-wide text-center ${className}`}
        >
            {isInstantGaming ? 'Vérifier la promo sur Instant Gaming' : 'Vérifier le prix sur Amazon'}
        </a>
    );

    return (
        <div className="max-w-4xl mx-auto px-6 py-12 fade-in">
            <button
                onClick={onBack}
                className="text-clara-green font-bold mb-10 flex items-center gap-2 hover:text-clara-burgundy transition uppercase text-xs tracking-widest"
            >
                <Icon name="ChevronLeft" size={20} /> Retour
            </button>

            <article>
                <header>
                    <span className="text-clara-burgundy font-bold uppercase tracking-widest text-[10px] mb-4 block">
                        {article.category}
                    </span>
                    <h1 className="text-4xl md:text-6xl font-serif mb-8 text-clara-green leading-tight">
                        {article.title}
                    </h1>
                    <p className="text-xl italic border-l-4 border-clara-burgundy pl-6 mb-8 bg-white py-8 rounded-r-2xl shadow-sm text-gray-700">
                        "{article.excerpt}"
                    </p>

                    {/* Bouton haut de page */}
                    <div className="mb-10">
                        <AffiliateButton />
                    </div>
                </header>

                {article.imageUrl && (
                    <img
                        src={article.imageUrl}
                        alt={article.imageAlt || article.title}
                        className="w-full rounded-3xl mb-12 shadow-2xl border-8 border-white"
                        loading="lazy"
                    />
                )}

                <div
                    className="html-content text-lg"
                    dangerouslySetInnerHTML={{ __html: article.content || "" }}
                />

                <footer className="bg-white p-12 rounded-3xl shadow-xl text-center border border-gray-50 my-20">
                    <p className="mb-6 font-bold text-gray-400 uppercase tracking-widest text-[10px]">
                        Sélection officielle Clara • Partenaire {isInstantGaming ? 'Instant Gaming' : 'Amazon'}
                    </p>
                    {/* Bouton bas de page */}
                    <AffiliateButton className="px-12 py-6 text-lg" />
                </footer>
            </article>

            {/* Articles similaires */}
            {relatedArticles.length > 0 && (
                <section className="mt-20 pt-20 border-t border-clara-green/10">
                    <h3 className="font-serif text-3xl text-clara-green mb-10">
                        D'autres pépites {article.category.toLowerCase()} ?
                    </h3>
                    <div className="grid md:grid-cols-3 gap-8">
                        {relatedArticles.map(rel => (
                            <div
                                key={rel.id}
                                onClick={() => onNavigate('article', rel)}
                                className="group cursor-pointer bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition border border-gray-100"
                            >
                                <div className="aspect-square bg-gray-100 overflow-hidden">
                                    <img
                                        src={rel.imageUrl}
                                        alt={rel.title}
                                        className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
                                        loading="lazy"
                                    />
                                </div>
                                <div className="p-4">
                                    <h4 className="font-bold text-sm text-clara-green line-clamp-1 mb-2">
                                        {rel.title}
                                    </h4>
                                    <div className="flex items-center justify-between text-clara-burgundy font-bold text-[10px] uppercase">
                                        <span>Voir le test</span>
                                        <Icon name="ChevronRight" size={14} />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
            )}
        </div>
    );
}
