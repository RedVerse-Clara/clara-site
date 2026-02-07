import Icon from './Icon';

/**
 * Composant Breadcrumb (Fil d'Ariane) pour la navigation
 */
export default function Breadcrumb({ view, categoryFilter, subCategoryFilter, article, onNavigate }) {
    const getCategoryLabel = (cat) => {
        if (cat === 'MODE') return 'Le Dressing';
        if (cat === 'GEEK') return 'Le Coin Geek';
        return cat;
    };

    const getSubCategoryLabel = (subCat) => {
        const labels = {
            'ACTIVEWEAR': 'Activewear',
            'LOUNGEWEAR': 'Loungewear',
            'BEACHWEAR': 'Beachwear',
            'JEUX_VIDEO': 'Jeux Vidéos',
            'TECH': 'Tech',
            'COSPLAY': 'Cosplay'
        };
        return labels[subCat] || subCat;
    };

    const getModeGeekCategory = (articleCategory) => {
        const modeCategories = ['ACTIVEWEAR', 'LOUNGEWEAR', 'BEACHWEAR'];
        return modeCategories.includes(articleCategory) ? 'MODE' : 'GEEK';
    };

    // Ne pas afficher sur la page d'accueil sans filtre
    if (view === 'home' && categoryFilter === 'ALL') return null;

    return (
        <nav className="breadcrumb-nav">
            <button
                onClick={() => onNavigate('home')}
                className="breadcrumb-link"
                aria-label="Retour à l'accueil"
            >
                <Icon name="Home" size={14} />
                <span>Accueil</span>
            </button>

            {categoryFilter !== 'ALL' && (
                <>
                    <span className="breadcrumb-separator">›</span>
                    {view === 'article' && article ? (
                        <button
                            onClick={() => onNavigate('category-gallery', null, getModeGeekCategory(article.category))}
                            className="breadcrumb-link"
                        >
                            {getCategoryLabel(getModeGeekCategory(article.category))}
                        </button>
                    ) : (
                        <span className="breadcrumb-current">{getCategoryLabel(categoryFilter)}</span>
                    )}
                </>
            )}

            {view === 'category-gallery' && subCategoryFilter !== 'ALL' && (
                <>
                    <span className="breadcrumb-separator">›</span>
                    <span className="breadcrumb-current">{getSubCategoryLabel(subCategoryFilter)}</span>
                </>
            )}

            {view === 'article' && article && (
                <>
                    <span className="breadcrumb-separator">›</span>
                    <span className="breadcrumb-current breadcrumb-article">{article.title}</span>
                </>
            )}
        </nav>
    );
}
