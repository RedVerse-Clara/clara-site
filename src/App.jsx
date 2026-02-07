import { useState, useEffect, useRef, useMemo } from 'react';
import { collection, onSnapshot, doc, addDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { onAuthStateChanged, signInWithEmailAndPassword, signInAnonymously, signOut } from 'firebase/auth';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import { db, auth, CLARA_APP_ID, ADMIN_UID, UMAMI_SHARE_URL } from './config/firebase';
import { slugify } from './utils/slugify';
import { useStructuredData, generateHomeStructuredData } from './utils/structuredData';
import { useFocusTrap } from './hooks/useFocusTrap';
import { useKeyboardShortcut } from './hooks/useKeyboardShortcut';
import Icon from './components/Icon';
import ArticleLayout from './components/ArticleLayout';
import Breadcrumb from './components/Breadcrumb';

function App() {
    // États principaux
    const [view, setView] = useState('home');
    const [categoryFilter, setCategoryFilter] = useState('ALL');
    const [subCategoryFilter, setSubCategoryFilter] = useState('ALL');
    const [articles, setArticles] = useState([]);
    const [selectedArticle, setSelectedArticle] = useState(null);

    // États Firebase
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    // États modals
    const [showStatsModal, setShowStatsModal] = useState(false);
    const [showImageModal, setShowImageModal] = useState(false);
    const [showLoginModal, setShowLoginModal] = useState(false);
    const [deletingId, setDeletingId] = useState(null);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    // États pagination
    const [homeDisplayCount, setHomeDisplayCount] = useState(3);
    const [galleryDisplayCount, setGalleryDisplayCount] = useState(3);

    // États admin
    const [secretClicks, setSecretClicks] = useState(0);
    const [isPreview, setIsPreview] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [previewData, setPreviewData] = useState({
        title: '', category: 'ACTIVEWEAR', excerpt: '', content: '',
        imageUrl: '', imageAlt: '', affiliateLink: '', affiliateType: 'AMAZON'
    });

    // États formulaire
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [authError, setAuthError] = useState('');
    const [modalImageUrl, setModalImageUrl] = useState('');
    const [modalImageAlt, setModalImageAlt] = useState('');

    // Refs
    const quillRef = useRef(null);
    const formRef = useRef(null);

    // Hooks d'accessibilité (DOIVENT être après tous les useState)
    const statsModalRef = useFocusTrap(showStatsModal);

    // Fermer les modals avec Escape
    useKeyboardShortcut('Escape', () => {
        if (showStatsModal) setShowStatsModal(false);
    }, showStatsModal);

    // Navigation avec gestion de l'historique
    const navigateTo = (newView, article = null, filter = 'ALL') => {
        setView(newView);
        setSelectedArticle(article);
        setCategoryFilter(filter);
        if (newView === 'category-gallery') setSubCategoryFilter('ALL');

        let newUrl = window.location.pathname;
        if (newView === 'article' && article) newUrl += `?a=${article.id}`;
        else if (newView === 'about') newUrl += `?p=about`;
        else if (newView === 'privacy') newUrl += `?p=privacy`;
        else if (newView === 'affiliation') newUrl += `?p=affiliation`;
        else if (newView === 'legal') newUrl += `?p=legal`;
        else if (newView === 'admin') newUrl += `?p=admin`;
        else if (newView === 'category-gallery') newUrl += `?cat=${filter}`;

        window.history.pushState({ view: newView, article, filter }, '', newUrl);
        window.scrollTo(0, 0);
    };

    // Gestion du bouton retour du navigateur
    useEffect(() => {
        const handlePopState = () => {
            const params = new URLSearchParams(window.location.search);
            const artId = params.get('a');
            const page = params.get('p');
            const cat = params.get('cat');

            if (artId && articles.length > 0) {
                const art = articles.find(a => a.id === artId);
                if (art) { setView('article'); setSelectedArticle(art); return; }
            }
            if (page === 'about') { setView('about'); return; }
            if (page === 'privacy') { setView('privacy'); return; }
            if (page === 'affiliation') { setView('affiliation'); return; }
            if (page === 'legal') { setView('legal'); return; }
            if (cat) { setView('category-gallery'); setCategoryFilter(cat); setSubCategoryFilter('ALL'); return; }

            setView('home');
            setCategoryFilter('ALL');
            setSubCategoryFilter('ALL');
            setSelectedArticle(null);
        };

        window.addEventListener('popstate', handlePopState);
        return () => window.removeEventListener('popstate', handlePopState);
    }, [articles]);

    // Authentification Firebase
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (u) => {
            setUser(u);
            setLoading(false);
            if (!u) signInAnonymously(auth).catch(console.error);
        });
        return () => unsubscribe();
    }, []);

    // Chargement des articles depuis Firestore
    useEffect(() => {
        if (!user) return;

        const articlesRef = collection(
            doc(collection(doc(db, 'artifacts', CLARA_APP_ID), 'public'), 'data'),
            'articles'
        );

        const unsub = onSnapshot(articlesRef, (snapshot) => {
            const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            const sorted = docs.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
            setArticles(sorted);

            // Gestion de l'URL initiale
            const params = new URLSearchParams(window.location.search);
            const artId = params.get('a');
            const page = params.get('p');
            const cat = params.get('cat');

            if (artId) {
                const art = sorted.find(a => a.id === artId);
                if (art) { setView('article'); setSelectedArticle(art); }
            } else if (page === 'about') { setView('about'); }
            else if (page === 'privacy') { setView('privacy'); }
            else if (page === 'affiliation') { setView('affiliation'); }
            else if (page === 'legal') { setView('legal'); }
            else if (page === 'admin') { setView('admin'); }
            else if (cat) { setView('category-gallery'); setCategoryFilter(cat); setSubCategoryFilter('ALL'); }
        }, (err) => console.error('Firestore error:', err));

        return () => unsub();
    }, [user]);

    // Données structurées Schema.org pour la page d'accueil
    useStructuredData(view === 'home' ? generateHomeStructuredData() : null);


    // Gestion du filtre de catégorie
    const changeCategory = (cat) => {
        navigateTo('home', null, cat);
        setTimeout(() => {
            const section = document.getElementById('latest');
            if (section) section.scrollIntoView({ behavior: 'smooth' });
        }, 100);
    };

    // Filtrage des articles
    const filteredArticles = articles.filter(art => {
        if (categoryFilter === 'ALL') return true;
        if (categoryFilter === 'MODE') return ['ACTIVEWEAR', 'LOUNGEWEAR', 'BEACHWEAR'].includes(art.category);
        if (categoryFilter === 'GEEK') return ['GEEK', 'TECH'].includes(art.category);
        return true;
    });

    // Gestion admin - triple clic secret
    const handleAdminTrigger = (e) => {
        e.stopPropagation();
        const n = secretClicks + 1;
        setSecretClicks(n);
        if (n >= 3) {
            if (user && user.uid === ADMIN_UID) navigateTo('admin');
            else setShowLoginModal(true);
            setSecretClicks(0);
        }
    };

    // Login admin
    const handleLogin = (e) => {
        e.preventDefault();
        setAuthError('');
        signInWithEmailAndPassword(auth, email, password)
            .then(() => { setShowLoginModal(false); navigateTo('admin'); })
            .catch(() => setAuthError('Accès refusé.'));
    };

    // Gestion de l'éditeur Quill
    const handleImageInsert = () => {
        if (modalImageUrl && quillRef.current) {
            const editor = quillRef.current.getEditor();
            const range = editor.getSelection(true);
            editor.insertEmbed(range.index, 'image', modalImageUrl);

            setTimeout(() => {
                const imgs = editor.root.querySelectorAll('img');
                const targetImg = Array.from(imgs).find(img => img.getAttribute('src') === modalImageUrl);
                if (targetImg) targetImg.setAttribute('alt', modalImageAlt || '');
            }, 50);

            setModalImageUrl('');
            setModalImageAlt('');
            setShowImageModal(false);
        }
    };

    // Prévisualisation
    const handleTogglePreview = () => {
        if (!isPreview) {
            const fd = new FormData(formRef.current);
            setPreviewData({
                title: fd.get('title'),
                category: fd.get('category'),
                excerpt: fd.get('excerpt'),
                content: quillRef.current ? quillRef.current.getEditor().root.innerHTML : '',
                imageUrl: fd.get('imageUrl'),
                imageAlt: fd.get('imageAlt'),
                affiliateLink: fd.get('affiliateLink'),
                affiliateType: fd.get('affiliateType')
            });
            setIsPreview(true);
            window.scrollTo(0, 0);
        } else {
            setIsPreview(false);
        }
    };

    // Édition d'un article
    const handleEditClick = (art) => {
        setEditingId(art.id);
        setPreviewData({ ...art });
        navigateTo('admin');
        window.scrollTo(0, 0);
    };

    // Annuler l'édition
    const handleCancelEdit = () => {
        setEditingId(null);
        setPreviewData({
            title: '', category: 'ACTIVEWEAR', excerpt: '', content: '',
            imageUrl: '', imageAlt: '', affiliateLink: '', affiliateType: 'AMAZON'
        });
    };

    // Ajouter ou mettre à jour un article
    const handleAddOrUpdateArticle = (e) => {
        e.preventDefault();

        const data = isPreview ? { ...previewData } : {
            title: new FormData(formRef.current).get('title'),
            category: new FormData(formRef.current).get('category'),
            excerpt: new FormData(formRef.current).get('excerpt'),
            content: quillRef.current.getEditor().root.innerHTML,
            imageUrl: new FormData(formRef.current).get('imageUrl'),
            imageAlt: new FormData(formRef.current).get('imageAlt'),
            affiliateLink: new FormData(formRef.current).get('affiliateLink'),
            affiliateType: new FormData(formRef.current).get('affiliateType')
        };

        // Ajouter le slug SEO-friendly
        data.slug = slugify(data.title);

        const articlesRef = collection(
            doc(collection(doc(db, 'artifacts', CLARA_APP_ID), 'public'), 'data'),
            'articles'
        );

        if (editingId) {
            updateDoc(doc(articlesRef, editingId), data).then(() => {
                handleCancelEdit();
                setIsPreview(false);
                navigateTo('home');
            });
        } else {
            addDoc(articlesRef, { ...data, createdAt: Date.now() }).then(() => {
                handleCancelEdit();
                setIsPreview(false);
                navigateTo('home');
            });
        }
    };

    // Configuration Quill (useMemo pour éviter les re-renders infinis)
    const quillModules = useMemo(() => ({
        toolbar: {
            container: [
                [{ 'header': [1, 2, false] }],
                ['bold', 'italic', 'underline', 'blockquote'],
                [{ 'list': 'ordered' }, { 'list': 'bullet' }],
                ['link', 'image', 'clean']
            ],
            handlers: {
                image: () => setShowImageModal(true)
            }
        }
    }), []);

    // Removed blocking loading screen - content renders immediately while Firebase initializes
    // This improves SEO (content visible to crawlers) and Core Web Vitals (faster FCP/LCP)


    return (
        <div className="min-h-screen flex flex-col">
            {/* Skip Link pour accessibilité */}
            <a href="#main-content" className="skip-link">
                Aller au contenu principal
            </a>

            {/* Navigation */}
            <nav className="bg-white border-b border-gray-100 px-6 py-4 flex justify-between items-center shadow-sm sticky top-0 z-50">
                <div
                    onClick={() => navigateTo('home')}
                    className="text-2xl md:text-3xl font-serif font-bold cursor-pointer text-clara-green"
                >
                    LeChoixDe<span className="text-clara-burgundy">Clara</span>.fr
                </div>

                {/* Desktop Navigation */}
                <div className="hidden md:flex items-center gap-6 md:gap-8">
                    <button
                        onClick={() => navigateTo('home')}
                        className={`nav-link ${view === 'home' && categoryFilter === 'ALL' ? 'active' : ''}`}
                        aria-label="Aller à la page d'accueil"
                        aria-current={view === 'home' && categoryFilter === 'ALL' ? 'page' : undefined}
                    >
                        Accueil
                    </button>
                    <button
                        onClick={() => navigateTo('category-gallery', null, 'MODE')}
                        className={`nav-link ${view === 'category-gallery' && categoryFilter === 'MODE' ? 'active' : ''}`}
                        aria-label="Voir Le Dressing de Clara"
                        aria-current={view === 'category-gallery' && categoryFilter === 'MODE' ? 'page' : undefined}
                    >
                        Le Dressing
                    </button>
                    <button
                        onClick={() => navigateTo('category-gallery', null, 'GEEK')}
                        className={`nav-link ${view === 'category-gallery' && categoryFilter === 'GEEK' ? 'active' : ''}`}
                        aria-label="Voir Le Coin Geek"
                        aria-current={view === 'category-gallery' && categoryFilter === 'GEEK' ? 'page' : undefined}
                    >
                        Le Coin Geek
                    </button>
                    <button
                        onClick={() => navigateTo('about')}
                        className={`nav-link ${view === 'about' ? 'active' : ''}`}
                        aria-label="Aller à la page À Propos"
                        aria-current={view === 'about' ? 'page' : undefined}
                    >
                        À Propos
                    </button>
                    {user && user.uid === ADMIN_UID && view !== 'admin' && (
                        <button
                            onClick={() => navigateTo('admin')}
                            className="bg-clara-green text-white px-4 py-2 rounded-full text-[10px] font-bold flex items-center gap-2 btn-hover tracking-widest uppercase transition"
                            aria-label="Accéder à l'interface d'administration"
                        >
                            <Icon name="Settings" size={14} /> Admin
                        </button>
                    )}
                </div>

                {/* Mobile Hamburger Button */}
                <button
                    onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                    className="md:hidden p-2 hover:bg-gray-100 rounded-lg transition"
                    aria-label="Ouvrir le menu de navigation"
                    aria-expanded={mobileMenuOpen}
                >
                    <Icon name={mobileMenuOpen ? "X" : "Menu"} size={24} />
                </button>
            </nav>

            {/* Mobile Menu Overlay */}
            {mobileMenuOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-40 md:hidden"
                    onClick={() => setMobileMenuOpen(false)}
                />
            )}

            {/* Mobile Menu */}
            <div className={`fixed top-[73px] right-0 bottom-0 w-64 bg-white shadow-2xl z-50 transform transition-transform duration-300 md:hidden ${mobileMenuOpen ? 'translate-x-0' : 'translate-x-full'}`}>
                <div className="flex flex-col p-6 gap-4">
                    <button
                        onClick={() => { navigateTo('home'); setMobileMenuOpen(false); }}
                        className={`nav-link text-left ${view === 'home' && categoryFilter === 'ALL' ? 'active' : ''}`}
                        aria-label="Aller à la page d'accueil"
                    >
                        Accueil
                    </button>
                    <button
                        onClick={() => { navigateTo('category-gallery', null, 'MODE'); setMobileMenuOpen(false); }}
                        className={`nav-link text-left ${view === 'category-gallery' && categoryFilter === 'MODE' ? 'active' : ''}`}
                        aria-label="Voir Le Dressing de Clara"
                    >
                        Le Dressing
                    </button>
                    <button
                        onClick={() => { navigateTo('category-gallery', null, 'GEEK'); setMobileMenuOpen(false); }}
                        className={`nav-link text-left ${view === 'category-gallery' && categoryFilter === 'GEEK' ? 'active' : ''}`}
                        aria-label="Voir Le Coin Geek"
                    >
                        Le Coin Geek
                    </button>
                    <button
                        onClick={() => { navigateTo('about'); setMobileMenuOpen(false); }}
                        className={`nav-link text-left ${view === 'about' ? 'active' : ''}`}
                        aria-label="Aller à la page À Propos"
                    >
                        À Propos
                    </button>
                    {user && user.uid === ADMIN_UID && view !== 'admin' && (
                        <button
                            onClick={() => { navigateTo('admin'); setMobileMenuOpen(false); }}
                            className="bg-clara-green text-white px-4 py-2 rounded-full text-[10px] font-bold flex items-center gap-2 btn-hover tracking-widest uppercase transition mt-4"
                            aria-label="Accéder à l'interface d'administration"
                        >
                            <Icon name="Settings" size={14} /> Admin
                        </button>
                    )}
                </div>
            </div>

            {/* Modal Statistiques */}
            {showStatsModal && (
                <div className="fixed inset-0 bg-black/80 z-[200] flex items-center justify-center p-4 md:p-8 backdrop-blur-md fade-in">
                    <div
                        ref={statsModalRef}
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="stats-modal-title"
                        className="bg-white rounded-3xl w-full h-full max-w-7xl flex flex-col shadow-2xl overflow-hidden scale-in"
                    >
                        <div className="p-6 border-b flex justify-between items-center bg-clara-green text-white">
                            <h3 id="stats-modal-title" className="font-bold flex items-center gap-3 text-xl">
                                <Icon name="BarChart3" /> Tableau de bord Umami
                            </h3>
                            <button
                                onClick={() => setShowStatsModal(false)}
                                className="p-2 hover:bg-white/10 rounded-full transition"
                                aria-label="Fermer le tableau de bord"
                            >
                                <Icon name="X" size={24} />
                            </button>
                        </div>
                        <div className="flex-grow bg-gray-50">
                            <iframe
                                src={`${UMAMI_SHARE_URL}?view=integrated`}
                                width="100%"
                                height="100%"
                                frameBorder="0"
                                className="w-full h-full"
                            />
                        </div>
                    </div>
                </div>
            )}

            {/* Modal Image */}
            {showImageModal && (
                <div className="fixed inset-0 bg-black/80 z-[200] flex items-center justify-center p-6 backdrop-blur-md">
                    <div className="bg-white p-8 rounded-3xl max-w-lg w-full shadow-2xl border border-clara-green/10 fade-in scale-in">
                        <h3 className="text-xl font-serif text-clara-green font-bold mb-6 flex items-center gap-3">
                            <Icon name="Image" className="text-clara-burgundy" /> Insérer une photo SEO
                        </h3>
                        <div className="space-y-5">
                            <div>
                                <label className="text-[10px] font-bold uppercase text-gray-600 tracking-widest block mb-1">
                                    URL du fichier
                                </label>
                                <input
                                    value={modalImageUrl}
                                    onChange={e => setModalImageUrl(e.target.value)}
                                    placeholder="images/image.webp"
                                    className="w-full p-4 border rounded-xl outline-none focus:ring-2 ring-emerald/20 bg-gray-50"
                                    autoFocus
                                />
                            </div>
                            <div>
                                <label className="text-[10px] font-bold uppercase text-gray-600 tracking-widest block mb-1">
                                    Description SEO (ALT)
                                </label>
                                <input
                                    value={modalImageAlt}
                                    onChange={e => setModalImageAlt(e.target.value)}
                                    placeholder="Clara porte..."
                                    className="w-full p-4 border rounded-xl outline-none focus:ring-2 ring-emerald/20 bg-gray-50"
                                />
                            </div>
                            <div className="flex gap-4 pt-4">
                                <button
                                    onClick={() => setShowImageModal(false)}
                                    className="flex-1 py-4 bg-gray-100 rounded-xl font-bold hover:bg-gray-200 transition"
                                >
                                    Annuler
                                </button>
                                <button
                                    onClick={handleImageInsert}
                                    className="flex-1 py-4 bg-clara-green text-white rounded-xl font-bold shadow-lg"
                                >
                                    Insérer
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal Login */}
            {showLoginModal && (
                <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-6 backdrop-blur-sm fade-in">
                    <div className="bg-white p-10 rounded-3xl max-w-md w-full shadow-2xl relative">
                        <button
                            onClick={() => setShowLoginModal(false)}
                            className="absolute top-6 right-6 text-gray-600 hover:text-black text-2xl font-bold"
                        >
                            &times;
                        </button>
                        <div className="text-center mb-8">
                            <Icon name="Lock" size={40} className="text-clara-burgundy mb-4 mx-auto" />
                            <h2 className="text-2xl font-serif text-clara-green">Admin</h2>
                        </div>
                        <form onSubmit={handleLogin} className="space-y-4">
                            <input
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                type="email"
                                placeholder="Email"
                                className="w-full p-4 border rounded-xl"
                                required
                            />
                            <input
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                type="password"
                                placeholder="Pass"
                                className="w-full p-4 border rounded-xl"
                                required
                            />
                            {authError && <p className="text-red-500 text-xs font-bold text-center">{authError}</p>}
                            <button className="w-full bg-clara-green text-white py-4 rounded-xl font-bold uppercase btn-hover">
                                S'identifier
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal Suppression */}
            {deletingId && (
                <div className="fixed inset-0 bg-black/60 z-[110] flex items-center justify-center p-4 backdrop-blur-md fade-in">
                    <div className="bg-white p-8 rounded-2xl max-w-sm w-full text-center shadow-2xl">
                        <Icon name="AlertTriangle" size={48} className="text-red-500 mx-auto mb-4" />
                        <h3 className="text-xl font-bold mb-2 text-clara-green">Supprimer ?</h3>
                        <div className="flex gap-3 mt-6">
                            <button
                                onClick={() => setDeletingId(null)}
                                className="flex-1 py-3 bg-gray-100 rounded-xl font-bold"
                            >
                                Non
                            </button>
                            <button
                                onClick={() => {
                                    const articlesRef = collection(
                                        doc(collection(doc(db, 'artifacts', CLARA_APP_ID), 'public'), 'data'),
                                        'articles'
                                    );
                                    deleteDoc(doc(articlesRef, deletingId));
                                    setDeletingId(null);
                                }}
                                className="flex-1 py-3 bg-red-500 text-white rounded-xl font-bold"
                            >
                                Oui
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Contenu Principal */}
            <main className="flex-grow">
                {/* Page d'accueil */}
                {view === 'home' && (
                    <div className="fade-in">
                        <section className="bg-white py-8 md:py-12 px-6 border-b border-gray-50">
                            <div className="container mx-auto grid md:grid-cols-2 gap-12 items-center">
                                <div>
                                    <span className="bg-clara-green text-white px-4 py-1 rounded-full text-[10px] font-bold mb-4 inline-block uppercase tracking-widest">
                                        28 ANS | 1M78 | EXPERTE CADEAUX
                                    </span>
                                    <h1 className="text-4xl md:text-6xl font-serif leading-tight mb-6 text-clara-green">
                                        L'arme secrète pour <span className="text-clara-burgundy italic">ses</span> cadeaux.
                                    </h1>
                                    <p className="text-base text-gray-600 mb-8 italic border-l-4 border-clara-burgundy pl-6 leading-relaxed max-w-lg">
                                        "Moi c'est Clara. Je guide les hommes attentionnés dans leur choix de cadeaux pour leur chérie."
                                    </p>
                                    <button
                                        onClick={() => document.getElementById('latest').scrollIntoView({ behavior: 'smooth' })}
                                        className="bg-clara-burgundy text-white px-10 py-4 rounded-xl font-bold shadow-xl btn-hover transition uppercase text-xs tracking-widest"
                                    >
                                        Voir mes tests
                                    </button>
                                </div>
                                <div className="hidden md:block max-w-sm ml-auto aspect-[4/5] bg-gray-50 rounded-3xl flex items-center justify-center border-8 border-white shadow-xl overflow-hidden relative group">
                                    <img
                                        src="clara-experte-avis-activewear-lechoixdeclara.webp"
                                        alt="Clara influenceuse IA"
                                        className="w-full h-full object-cover group-hover:scale-105 transition duration-1000"
                                        loading="eager"
                                    />
                                </div>
                            </div>
                        </section>

                        <section id="latest" className="py-12 md:py-16 px-6 container mx-auto">
                            <div className="flex flex-col md:flex-row justify-between items-baseline mb-12 gap-4">
                                <h2 className="text-4xl font-serif text-clara-green">
                                    {categoryFilter === 'ALL' ? 'Derniers tests de Clara' :
                                        categoryFilter === 'MODE' ? 'Le Dressing de Clara' : 'Le Coin Geek'}
                                </h2>
                                {categoryFilter !== 'ALL' && (
                                    <span className="bg-clara-cream border border-clara-green/20 text-clara-green text-[10px] px-4 py-1 rounded-full font-bold uppercase tracking-widest">
                                        Filtre : {categoryFilter === 'MODE' ? 'Le Dressing' : 'Le Coin Geek'}
                                    </span>
                                )}
                            </div>

                            <div className="grid md:grid-cols-3 gap-10">
                                {articles.length === 0 ? (
                                    // Skeleton loader - shows immediately while Firebase loads
                                    [...Array(6)].map((_, i) => (
                                        <div
                                            key={i}
                                            className="bg-white rounded-3xl overflow-hidden shadow-sm border border-gray-100 animate-pulse"
                                        >
                                            <div className="h-64 bg-gray-200"></div>
                                            <div className="p-8 space-y-4">
                                                <div className="h-6 bg-gray-200 rounded w-3/4"></div>
                                                <div className="h-4 bg-gray-200 rounded w-full"></div>
                                                <div className="h-4 bg-gray-200 rounded w-2/3"></div>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    // Real articles once loaded
                                    filteredArticles.slice(0, homeDisplayCount).map(article => (
                                        <div
                                            key={article.id}
                                            onClick={() => navigateTo('article', article)}
                                            className="bg-white rounded-3xl overflow-hidden shadow-sm hover:shadow-xl transition group cursor-pointer border border-gray-100 btn-hover"
                                        >
                                            <div className="h-64 bg-gray-100 relative overflow-hidden">
                                                <span className="absolute top-4 left-4 bg-clara-green text-white text-[10px] px-3 py-1 rounded font-bold z-10 uppercase tracking-widest shadow-md">
                                                    {article.category}
                                                </span>
                                                {article.imageUrl && (
                                                    <img
                                                        src={article.imageUrl}
                                                        alt={article.imageAlt || article.title}
                                                        className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
                                                        loading="lazy"
                                                    />
                                                )}
                                            </div>
                                            <div className="p-8">
                                                <h3 className="font-serif text-xl mb-4 leading-tight group-hover:text-clara-burgundy transition">
                                                    {article.title}
                                                </h3>
                                                <p className="text-gray-600 text-sm line-clamp-2 mb-6">
                                                    {article.excerpt}
                                                </p>
                                                <div className="flex justify-between items-center text-clara-green font-bold text-[10px] uppercase tracking-tighter">
                                                    <span>Lire le test complet</span>
                                                    <Icon name="ChevronRight" size={16} />
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>

                            {/* Bouton "Voir plus" */}
                            {homeDisplayCount < filteredArticles.length && (
                                <div className="text-center mt-12">
                                    <button
                                        onClick={() => setHomeDisplayCount(prev => prev + 3)}
                                        className="inline-flex items-center gap-2 px-8 py-4 border-2 border-clara-green text-clara-green rounded-full font-bold hover:bg-clara-green hover:text-white transition-all hover:scale-105"
                                    >
                                        <Icon name="Plus" size={20} />
                                        Voir 3 articles de plus
                                    </button>
                                </div>
                            )}

                            {filteredArticles.length === 0 && articles.length > 0 && (
                                <p className="text-center py-20 italic text-gray-600">
                                    Aucun test dans cette catégorie pour le moment.
                                </p>
                            )}
                        </section>

                        {/* Catégories Principales - Visible uniquement sur page d'accueil (ALL) */}
                        {categoryFilter === 'ALL' && articles.length > 0 && (
                            <section className="py-16 px-6 container mx-auto">
                                <h2 className="text-3xl md:text-4xl font-serif text-clara-green mb-12 text-center">
                                    Explorer par catégorie
                                </h2>
                                <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
                                    {/* Le Dressing */}
                                    {(() => {
                                        const latestMode = articles
                                            .filter(art => ['ACTIVEWEAR', 'LOUNGEWEAR', 'BEACHWEAR'].includes(art.category))
                                            .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))[0];
                                        return latestMode ? (
                                            <div
                                                onClick={() => navigateTo('category-gallery', null, 'MODE')}
                                                className="category-tile cursor-pointer"
                                                style={{ aspectRatio: '16/9' }}
                                                role="button"
                                                tabIndex="0"
                                                aria-label="Explorer Le Dressing de Clara"
                                            >
                                                <img
                                                    src={latestMode.imageUrl}
                                                    alt={latestMode.imageAlt || 'Le Dressing'}
                                                    className="w-full h-full object-cover"
                                                    loading="lazy"
                                                />
                                                <div className="category-tile-overlay">
                                                    <div>
                                                        <h3 className="category-tile-title">Le Dressing</h3>
                                                        <p className="text-white/90 text-sm mt-2">Mode et lifestyle</p>
                                                    </div>
                                                </div>
                                            </div>
                                        ) : null;
                                    })()}

                                    {/* Le Coin Geek */}
                                    {(() => {
                                        const latestGeek = articles
                                            .filter(art => ['JEUX_VIDEO', 'TECH', 'COSPLAY'].includes(art.category))
                                            .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))[0];
                                        return latestGeek ? (
                                            <div
                                                onClick={() => navigateTo('category-gallery', null, 'GEEK')}
                                                className="category-tile cursor-pointer"
                                                style={{ aspectRatio: '16/9' }}
                                                role="button"
                                                tabIndex="0"
                                                aria-label="Explorer Le Coin Geek"
                                            >
                                                <img
                                                    src={latestGeek.imageUrl}
                                                    alt={latestGeek.imageAlt || 'Le Coin Geek'}
                                                    className="w-full h-full object-cover"
                                                    loading="lazy"
                                                />
                                                <div className="category-tile-overlay">
                                                    <div>
                                                        <h3 className="category-tile-title">Le Coin Geek</h3>
                                                        <p className="text-white/90 text-sm mt-2">Gaming et Tech</p>
                                                    </div>
                                                </div>
                                            </div>
                                        ) : null;
                                    })()}
                                </div>
                            </section>
                        )}
                    </div>
                )
                }

                {/* Page Galerie de Catégories */}
                {view === 'category-gallery' && (
                    <div className="fade-in">
                        {/* Breadcrumb */}
                        <div className="container mx-auto px-6 pt-6">
                            <Breadcrumb
                                view={view}
                                categoryFilter={categoryFilter}
                                subCategoryFilter={subCategoryFilter}
                                article={null}
                                onNavigate={navigateTo}
                            />
                        </div>

                        {/* Header de la catégorie */}
                        <section className="bg-gradient-to-r from-clara-green to-clara-burgundy py-16 px-6 text-white">
                            <div className="container mx-auto text-center">
                                <h1 className="text-4xl md:text-5xl font-serif mb-4">
                                    {categoryFilter === 'MODE' ? 'Le Dressing de Clara' : 'Le Coin Geek'}
                                </h1>
                                <p className="text-lg opacity-90 max-w-2xl mx-auto">
                                    {categoryFilter === 'MODE'
                                        ? 'Mode et lifestyle : découvrez mes tests par univers'
                                        : 'Gaming et Tech : mes tests et découvertes'}
                                </p>
                            </div>
                        </section>

                        {/* Onglets de filtrage */}
                        <section className="bg-white border-b sticky top-[73px] z-40 shadow-sm">
                            <div className="container mx-auto px-6 py-4">
                                <div className="flex gap-2 overflow-x-auto no-scrollbar pr-12 md:pr-6">
                                    <button
                                        onClick={() => setSubCategoryFilter('ALL')}
                                        className={`tab-button ${subCategoryFilter === 'ALL' ? 'active' : ''}`}
                                        aria-label="Voir tous les articles de cette catégorie"
                                    >
                                        Tous
                                    </button>
                                    {categoryFilter === 'MODE' && (
                                        <>
                                            <button
                                                onClick={() => setSubCategoryFilter('ACTIVEWEAR')}
                                                className={`tab-button ${subCategoryFilter === 'ACTIVEWEAR' ? 'active' : ''}`}
                                                aria-label="Filtrer par Activewear"
                                            >
                                                Activewear
                                            </button>
                                            <button
                                                onClick={() => setSubCategoryFilter('LOUNGEWEAR')}
                                                className={`tab-button ${subCategoryFilter === 'LOUNGEWEAR' ? 'active' : ''}`}
                                                aria-label="Filtrer par Loungewear"
                                            >
                                                Loungewear
                                            </button>
                                            <button
                                                onClick={() => setSubCategoryFilter('BEACHWEAR')}
                                                className={`tab-button ${subCategoryFilter === 'BEACHWEAR' ? 'active' : ''}`}
                                                aria-label="Filtrer par Beachwear"
                                            >
                                                Beachwear
                                            </button>
                                        </>
                                    )}
                                    {categoryFilter === 'GEEK' && (
                                        <>
                                            <button
                                                onClick={() => setSubCategoryFilter('JEUX_VIDEO')}
                                                className={`tab-button ${subCategoryFilter === 'JEUX_VIDEO' ? 'active' : ''}`}
                                                aria-label="Filtrer par Jeux Vidéos"
                                            >
                                                Jeux Vidéos
                                            </button>
                                            <button
                                                onClick={() => setSubCategoryFilter('TECH')}
                                                className={`tab-button ${subCategoryFilter === 'TECH' ? 'active' : ''}`}
                                                aria-label="Filtrer par Tech"
                                            >
                                                Tech
                                            </button>
                                            <button
                                                onClick={() => setSubCategoryFilter('COSPLAY')}
                                                className={`tab-button ${subCategoryFilter === 'COSPLAY' ? 'active' : ''}`}
                                                aria-label="Filtrer par Cosplay"
                                            >
                                                Cosplay
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>
                        </section>

                        {/* Galerie de tuiles (visible uniquement si ALL) */}
                        {subCategoryFilter === 'ALL' && (
                            <section className="container mx-auto px-6 py-16">
                                <h2 className="text-3xl font-serif text-clara-green mb-8 text-center">
                                    Explorez par univers
                                </h2>
                                <div className="grid md:grid-cols-3 gap-8">
                                    {categoryFilter === 'MODE' && (
                                        <>
                                            {(() => {
                                                const latestActivewear = articles
                                                    .filter(art => art.category === 'ACTIVEWEAR')
                                                    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))[0];
                                                return latestActivewear ? (
                                                    <div
                                                        onClick={() => setSubCategoryFilter('ACTIVEWEAR')}
                                                        className="category-tile"
                                                        role="button"
                                                        tabIndex="0"
                                                        aria-label="Voir les articles Activewear"
                                                    >
                                                        <img
                                                            src={latestActivewear.imageUrl}
                                                            alt={latestActivewear.imageAlt || 'Activewear'}
                                                            className="w-full h-full object-cover"
                                                            loading="lazy"
                                                        />
                                                        <div className="category-tile-overlay">
                                                            <h3 className="category-tile-title">Activewear</h3>
                                                        </div>
                                                    </div>
                                                ) : null;
                                            })()}
                                            {(() => {
                                                const latestLoungewear = articles
                                                    .filter(art => art.category === 'LOUNGEWEAR')
                                                    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))[0];
                                                return latestLoungewear ? (
                                                    <div
                                                        onClick={() => setSubCategoryFilter('LOUNGEWEAR')}
                                                        className="category-tile"
                                                        role="button"
                                                        tabIndex="0"
                                                        aria-label="Voir les articles Loungewear"
                                                    >
                                                        <img
                                                            src={latestLoungewear.imageUrl}
                                                            alt={latestLoungewear.imageAlt || 'Loungewear'}
                                                            className="w-full h-full object-cover"
                                                            loading="lazy"
                                                        />
                                                        <div className="category-tile-overlay">
                                                            <h3 className="category-tile-title">Loungewear</h3>
                                                        </div>
                                                    </div>
                                                ) : null;
                                            })()}
                                            {(() => {
                                                const latestBeachwear = articles
                                                    .filter(art => art.category === 'BEACHWEAR')
                                                    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))[0];
                                                return latestBeachwear ? (
                                                    <div
                                                        onClick={() => setSubCategoryFilter('BEACHWEAR')}
                                                        className="category-tile"
                                                        role="button"
                                                        tabIndex="0"
                                                        aria-label="Voir les articles Beachwear"
                                                    >
                                                        <img
                                                            src={latestBeachwear.imageUrl}
                                                            alt={latestBeachwear.imageAlt || 'Beachwear'}
                                                            className="w-full h-full object-cover"
                                                            loading="lazy"
                                                        />
                                                        <div className="category-tile-overlay">
                                                            <h3 className="category-tile-title">Beachwear</h3>
                                                        </div>
                                                    </div>
                                                ) : null;
                                            })()}
                                        </>
                                    )}
                                    {categoryFilter === 'GEEK' && (
                                        <>
                                            {(() => {
                                                const latestJeuxVideo = articles
                                                    .filter(art => art.category === 'JEUX_VIDEO')
                                                    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))[0];
                                                return latestJeuxVideo ? (
                                                    <div
                                                        onClick={() => setSubCategoryFilter('JEUX_VIDEO')}
                                                        className="category-tile"
                                                        role="button"
                                                        tabIndex="0"
                                                        aria-label="Voir les articles Jeux Vidéos"
                                                    >
                                                        <img
                                                            src={latestJeuxVideo.imageUrl}
                                                            alt={latestJeuxVideo.imageAlt || 'Jeux Vidéos'}
                                                            className="w-full h-full object-cover"
                                                            loading="lazy"
                                                        />
                                                        <div className="category-tile-overlay">
                                                            <h3 className="category-tile-title">Jeux Vidéos</h3>
                                                        </div>
                                                    </div>
                                                ) : null;
                                            })()}
                                            {(() => {
                                                const latestTech = articles
                                                    .filter(art => art.category === 'TECH')
                                                    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))[0];
                                                return latestTech ? (
                                                    <div
                                                        onClick={() => setSubCategoryFilter('TECH')}
                                                        className="category-tile"
                                                        role="button"
                                                        tabIndex="0"
                                                        aria-label="Voir les articles Tech"
                                                    >
                                                        <img
                                                            src={latestTech.imageUrl}
                                                            alt={latestTech.imageAlt || 'Tech'}
                                                            className="w-full h-full object-cover"
                                                            loading="lazy"
                                                        />
                                                        <div className="category-tile-overlay">
                                                            <h3 className="category-tile-title">Tech</h3>
                                                        </div>
                                                    </div>
                                                ) : null;
                                            })()}
                                            {(() => {
                                                const latestCosplay = articles
                                                    .filter(art => art.category === 'COSPLAY')
                                                    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))[0];
                                                return latestCosplay ? (
                                                    <div
                                                        onClick={() => setSubCategoryFilter('COSPLAY')}
                                                        className="category-tile"
                                                        role="button"
                                                        tabIndex="0"
                                                        aria-label="Voir les articles Cosplay"
                                                    >
                                                        <img
                                                            src={latestCosplay.imageUrl}
                                                            alt={latestCosplay.imageAlt || 'Cosplay'}
                                                            className="w-full h-full object-cover"
                                                            loading="lazy"
                                                        />
                                                        <div className="category-tile-overlay">
                                                            <h3 className="category-tile-title">Cosplay</h3>
                                                        </div>
                                                    </div>
                                                ) : null;
                                            })()}
                                        </>
                                    )}
                                </div>
                            </section>
                        )}

                        {/* Liste des articles filtrés */}
                        <section className="container mx-auto px-6 py-16">
                            <h2 className="text-3xl font-serif text-clara-green mb-8">
                                {subCategoryFilter === 'ALL' ? 'Les derniers articles' :
                                    subCategoryFilter === 'JEUX_VIDEO' ? 'Tests de Jeux Vidéos' :
                                        subCategoryFilter === 'ACTIVEWEAR' ? 'Activewear' :
                                            subCategoryFilter === 'LOUNGEWEAR' ? 'Loungewear' :
                                                subCategoryFilter === 'BEACHWEAR' ? 'Beachwear' :
                                                    subCategoryFilter === 'TECH' ? 'Tests Tech' :
                                                        subCategoryFilter === 'COSPLAY' ? 'Cosplay' : ''}
                            </h2>
                            <div className="grid md:grid-cols-3 gap-10">
                                {(() => {
                                    const categoryArticles = articles.filter(art => {
                                        const inCategory = categoryFilter === 'MODE'
                                            ? ['ACTIVEWEAR', 'LOUNGEWEAR', 'BEACHWEAR'].includes(art.category)
                                            : ['JEUX_VIDEO', 'TECH', 'COSPLAY'].includes(art.category);

                                        if (subCategoryFilter === 'ALL') return inCategory;
                                        return art.category === subCategoryFilter;
                                    });

                                    if (categoryArticles.length === 0) {
                                        return (
                                            <p className="col-span-3 text-center py-20 italic text-gray-600">
                                                Aucun article dans cette catégorie pour le moment.
                                            </p>
                                        );
                                    }

                                    return categoryArticles.slice(0, galleryDisplayCount).map(article => (
                                        <div
                                            key={article.id}
                                            onClick={() => navigateTo('article', article)}
                                            className="bg-white rounded-3xl overflow-hidden shadow-sm hover:shadow-xl transition group cursor-pointer border border-gray-100 btn-hover"
                                        >
                                            <div className="h-64 bg-gray-100 relative overflow-hidden">
                                                <span className="absolute top-4 left-4 bg-clara-green text-white text-[10px] px-3 py-1 rounded font-bold z-10 uppercase tracking-widest shadow-md">
                                                    {article.category}
                                                </span>
                                                {article.imageUrl && (
                                                    <img
                                                        src={article.imageUrl}
                                                        alt={article.imageAlt || article.title}
                                                        className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
                                                        loading="lazy"
                                                    />
                                                )}
                                            </div>
                                            <div className="p-8">
                                                <h3 className="font-serif text-xl mb-4 leading-tight group-hover:text-clara-burgundy transition">
                                                    {article.title}
                                                </h3>
                                                <p className="text-gray-600 text-sm line-clamp-2 mb-6">
                                                    {article.excerpt}
                                                </p>
                                                <div className="flex justify-between items-center text-clara-green font-bold text-[10px] uppercase tracking-tighter">
                                                    <span>Lire le test complet</span>
                                                    <Icon name="ChevronRight" size={16} />
                                                </div>
                                            </div>
                                        </div>
                                    ));
                                })()}
                            </div>

                            {/* Bouton "Voir plus" pour les galeries */}
                            {(() => {
                                const categoryArticles = articles.filter(art => {
                                    const inCategory = categoryFilter === 'MODE'
                                        ? ['ACTIVEWEAR', 'LOUNGEWEAR', 'BEACHWEAR'].includes(art.category)
                                        : ['JEUX_VIDEO', 'TECH', 'COSPLAY'].includes(art.category);

                                    if (subCategoryFilter === 'ALL') return inCategory;
                                    return art.category === subCategoryFilter;
                                });

                                return galleryDisplayCount < categoryArticles.length && (
                                    <div className="text-center mt-12">
                                        <button
                                            onClick={() => setGalleryDisplayCount(prev => prev + 3)}
                                            className="inline-flex items-center gap-2 px-8 py-4 border-2 border-clara-green text-clara-green rounded-full font-bold hover:bg-clara-green hover:text-white transition-all hover:scale-105"
                                        >
                                            <Icon name="Plus" size={20} />
                                            Voir 3 articles de plus
                                        </button>
                                    </div>
                                );
                            })()}
                        </section>
                    </div>
                )}

                {/* Page Article */}
                {view === 'article' && selectedArticle && (
                    <ArticleLayout
                        article={selectedArticle}
                        onBack={() => window.history.back()}
                        allArticles={articles}
                        onNavigate={navigateTo}
                    />
                )}

                {/* Page À Propos */}
                {view === 'about' && (
                    <section className="max-w-4xl mx-auto px-6 py-20 fade-in">
                        <h1 className="text-4xl md:text-6xl font-serif text-clara-green mb-12">
                            À Propos : Qui est Clara ?
                        </h1>
                        <div className="grid md:grid-cols-2 gap-12 mb-16 items-center">
                            <img
                                src="clara-experte-avis-activewear-lechoixdeclara.webp"
                                className="rounded-3xl shadow-2xl border-8 border-white"
                                alt="Portrait de Clara"
                                loading="lazy"
                            />
                            <div className="space-y-6">
                                <p className="text-xl font-serif italic text-clara-burgundy">
                                    "Parce que trouver le cadeau parfait pour une femme ne devrait plus être une épreuve de force."
                                </p>
                                <p className="text-gray-600 leading-relaxed">
                                    Bienvenue sur mon site. Je m'appelle Clara. J'ai 28 ans, je mesure 1m78 et je possède une silhouette athlétique que j'entretiens avec passion.
                                </p>
                            </div>
                        </div>
                        <div className="html-content space-y-8">
                            <h2>Ma Mission : L'Arme Secrète des Hommes</h2>
                            <p>
                                Je teste tout ce qu'elle rêve de recevoir pour que vous ne puissiez plus jamais vous tromper.
                                Je porte, je lave, je plie, je connecte et j'éprouve chaque produit avant de vous donner mon verdict final.
                            </p>
                            <p className="font-bold text-clara-green">
                                Clara, experte en cadeaux (et en vérité).
                            </p>
                        </div>
                    </section>
                )}

                {/* Page Mentions Légales */}
                {view === 'legal' && (
                    <section className="max-w-4xl mx-auto px-6 py-20 fade-in">
                        <h1 className="text-4xl font-serif text-clara-green mb-12">Mentions Légales</h1>
                        <div className="html-content space-y-8">
                            <h2>Édition du site</h2>
                            <p>
                                Le site <strong>LeChoixDeClara.fr</strong> est édité par :<br />
                                Marc ASSI<br />
                                2 rue Georges Charpake<br />
                                92160 ANTONY, FRANCE<br />
                                Contact : <a href="mailto:nova.iris.kael@gmail.com" className="text-clara-burgundy font-bold">nova.iris.kael@gmail.com</a>
                            </p>
                            <h2>Hébergement</h2>
                            <p>
                                Le site est hébergé par GitHub Inc. (GitHub Pages)<br />
                                88 Colin P. Kelly Jr. Street<br />
                                San Francisco, CA 94107, USA
                            </p>
                            <h2>Propriété intellectuelle</h2>
                            <p>
                                L'ensemble des contenus (textes, logos, photographies générées par IA de Clara) est la propriété exclusive de l'éditeur.
                                Toute reproduction est interdite sans accord préalable.
                            </p>
                        </div>
                    </section>
                )}

                {/* Page Confidentialité */}
                {view === 'privacy' && (
                    <section className="max-w-4xl mx-auto px-6 py-20 fade-in">
                        <h1 className="text-4xl font-serif text-clara-green mb-12">Politique de Confidentialité</h1>
                        <div className="html-content space-y-8">
                            <h2>Collecte et Cookies</h2>
                            <p>
                                Le site <strong>LeChoixDeClara.fr</strong> respecte votre anonymat. Nous utilisons <strong>Umami Cloud</strong> pour nos statistiques,
                                un outil respectueux de la vie privée qui ne dépose aucun cookie traceur et ne collecte aucune donnée personnelle identifiable.
                            </p>
                            <h2>Données Techniques</h2>
                            <p>
                                Ce site utilise les services de Google Firebase pour la gestion du contenu.
                                Vos données de navigation restent anonymes et ne sont jamais revendues.
                            </p>
                        </div>
                    </section>
                )}

                {/* Page Affiliation */}
                {view === 'affiliation' && (
                    <section className="max-w-4xl mx-auto px-6 py-20 fade-in">
                        <h1 className="text-4xl font-serif text-clara-green mb-12">Divulgation d'Affiliation</h1>
                        <div className="html-content space-y-8">
                            <h2>Transparence Amazon & Instant Gaming</h2>
                            <p>
                                LeChoixDeClara.fr participe au Programme Partenaires d'Amazon EU et au programme d'affiliation d'Instant Gaming.
                                Ces programmes nous permettent de percevoir une commission sur les achats que vous effectuez via nos liens,
                                <strong> sans aucun surcoût pour vous</strong>.
                            </p>
                            <p>
                                En tant que Partenaire Amazon, je réalise un bénéfice sur les achats remplissant les conditions requises.
                                Clara sélectionne les produits en toute indépendance selon ses tests personnels.
                            </p>
                        </div>
                    </section>
                )}

                {/* Page Admin */}
                {view === 'admin' && user && user.uid === ADMIN_UID && (
                    <div className="max-w-6xl mx-auto px-6 py-12 fade-in">
                        <div className="flex justify-between items-center mb-12 border-b pb-8">
                            <h2 className="text-3xl font-serif text-clara-green font-bold">Atelier de Rédaction</h2>
                            <button
                                onClick={() => {
                                    handleCancelEdit();
                                    signOut(auth);
                                    navigateTo('home');
                                }}
                                className="text-gray-600 hover:text-clara-burgundy flex items-center gap-2 font-bold transition"
                            >
                                <Icon name="LogOut" size={18} /> Quitter
                            </button>
                        </div>

                        <div className="mb-12 flex gap-4">
                            <button
                                onClick={() => setShowStatsModal(true)}
                                className="bg-white p-6 rounded-3xl shadow-sm border border-clara-green/20 flex items-center gap-4 hover:border-clara-green transition flex-1"
                            >
                                <div className="bg-clara-green/10 p-4 rounded-2xl text-clara-green">
                                    <Icon name="BarChart3" size={32} />
                                </div>
                                <div>
                                    <h3 className="font-bold text-clara-green text-lg">Statistiques de Visites</h3>
                                    <p className="text-sm text-gray-600">Ouvrir le tableau de bord complet Umami</p>
                                </div>
                            </button>
                        </div>

                        <div className="grid lg:grid-cols-2 gap-12 items-start">
                            <div className="bg-white p-8 rounded-3xl shadow-lg border border-gray-100">
                                <div className="flex justify-between items-center mb-8">
                                    <h3 className="font-bold flex items-center gap-2 text-xl text-clara-green">
                                        <Icon name={editingId ? "Edit3" : "Plus"} /> {editingId ? "Edition" : "Nouveau Test"}
                                    </h3>
                                    {editingId && (
                                        <button
                                            onClick={handleCancelEdit}
                                            className="text-xs text-gray-600 font-bold hover:text-red-500 uppercase tracking-widest transition"
                                        >
                                            Annuler
                                        </button>
                                    )}
                                </div>
                                <form ref={formRef} onSubmit={handleAddOrUpdateArticle} className="space-y-6">
                                    <div className="grid grid-cols-2 gap-4">
                                        <input
                                            name="title"
                                            value={previewData.title || ''}
                                            onChange={(e) => setPreviewData({ ...previewData, title: e.target.value })}
                                            placeholder="Nom produit"
                                            className="p-4 border rounded-xl outline-none"
                                            required
                                        />
                                        <select
                                            name="category"
                                            value={previewData.category || 'ACTIVEWEAR'}
                                            onChange={(e) => setPreviewData({ ...previewData, category: e.target.value })}
                                            className="p-4 border rounded-xl outline-none bg-gray-50"
                                        >
                                            <optgroup label="Mode - Le Dressing">
                                                <option>ACTIVEWEAR</option>
                                                <option>LOUNGEWEAR</option>
                                                <option>BEACHWEAR</option>
                                            </optgroup>
                                            <optgroup label="Geek - Le Coin Geek">
                                                <option>JEUX_VIDEO</option>
                                                <option>TECH</option>
                                                <option>COSPLAY</option>
                                            </optgroup>
                                        </select>
                                    </div>
                                    <input
                                        name="excerpt"
                                        value={previewData.excerpt || ''}
                                        onChange={(e) => setPreviewData({ ...previewData, excerpt: e.target.value })}
                                        placeholder="Accroche SEO"
                                        className="w-full p-4 border rounded-xl outline-none"
                                        required
                                    />
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-bold uppercase text-gray-600 tracking-widest block mb-1">
                                            Récit du test
                                        </label>
                                        <ReactQuill
                                            key={editingId || 'new'}
                                            ref={quillRef}
                                            theme="snow"
                                            modules={quillModules}
                                            placeholder="Racontez votre expérience produit ici..."
                                            style={{ height: '400px', marginBottom: '60px' }}
                                            defaultValue={previewData.content || ''}
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <input
                                            name="imageUrl"
                                            value={previewData.imageUrl || ''}
                                            onChange={(e) => setPreviewData({ ...previewData, imageUrl: e.target.value })}
                                            placeholder="images/image.webp"
                                            className="p-4 border rounded-xl outline-none bg-gray-50"
                                            required
                                        />
                                        <input
                                            name="imageAlt"
                                            value={previewData.imageAlt || ''}
                                            onChange={(e) => setPreviewData({ ...previewData, imageAlt: e.target.value })}
                                            placeholder="ALT SEO"
                                            className="p-4 border rounded-xl outline-none bg-gray-50"
                                        />
                                    </div>
                                    <div className="bg-emerald/5 p-6 rounded-2xl border border-emerald/10 space-y-4">
                                        <div className="flex gap-4">
                                            <label className="flex-1 flex items-center gap-2 cursor-pointer p-3 bg-white border rounded-xl hover:border-emerald/40 transition">
                                                <input
                                                    type="radio"
                                                    name="affiliateType"
                                                    value="AMAZON"
                                                    checked={previewData.affiliateType !== 'INSTANT_GAMING'}
                                                    onChange={(e) => setPreviewData({ ...previewData, affiliateType: e.target.value })}
                                                    className="accent-emerald"
                                                />
                                                <span className="text-xs font-bold uppercase">Amazon</span>
                                            </label>
                                            <label className="flex-1 flex items-center gap-2 cursor-pointer p-3 bg-white border rounded-xl hover:border-orange-400 transition">
                                                <input
                                                    type="radio"
                                                    name="affiliateType"
                                                    value="INSTANT_GAMING"
                                                    checked={previewData.affiliateType === 'INSTANT_GAMING'}
                                                    onChange={(e) => setPreviewData({ ...previewData, affiliateType: e.target.value })}
                                                    className="accent-[#FF6600]"
                                                />
                                                <span className="text-xs font-bold uppercase">Instant Gaming</span>
                                            </label>
                                        </div>
                                        <input
                                            name="affiliateLink"
                                            value={previewData.affiliateLink || ''}
                                            onChange={(e) => setPreviewData({ ...previewData, affiliateLink: e.target.value })}
                                            placeholder="Lien d'affiliation"
                                            className="w-full p-4 border rounded-xl outline-none"
                                            required
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4 pt-4">
                                        <button
                                            type="button"
                                            onClick={handleTogglePreview}
                                            className="bg-clara-green text-white py-5 rounded-2xl font-bold shadow-lg flex items-center justify-center gap-2 transition hover:scale-[1.02] tracking-widest uppercase text-xs"
                                        >
                                            <Icon name="Eye" /> Prévisualiser
                                        </button>
                                        <button
                                            className="bg-clara-burgundy text-white py-5 rounded-2xl font-bold shadow-lg transition hover:scale-[1.02] tracking-widest uppercase text-xs"
                                        >
                                            {editingId ? "Mettre à jour" : "Publier"}
                                        </button>
                                    </div>
                                </form>
                            </div>

                            <div className="space-y-4">
                                <h3 className="font-bold mb-8 text-clara-green flex items-center justify-between">
                                    <span>Articles en ligne</span>
                                    <span className="bg-clara-green/10 text-clara-green px-3 py-1 rounded-full text-xs font-mono">
                                        {articles.length}
                                    </span>
                                </h3>
                                <div className="grid gap-4 max-h-[1100px] overflow-y-auto pr-1">
                                    {articles.map(art => (
                                        <div
                                            key={art.id}
                                            className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm transition duration-300"
                                        >
                                            <div className="mb-6">
                                                <p className="font-bold text-base text-clara-green">{art.title}</p>
                                                <div className="flex gap-3 mt-2">
                                                    <span className="text-[10px] bg-clara-green text-white px-2 py-0.5 rounded font-bold uppercase tracking-wider">
                                                        {art.category}
                                                    </span>
                                                    <span className={`text-[10px] font-black uppercase tracking-tighter ${art.affiliateType === 'INSTANT_GAMING' ? 'text-orange-500' : 'text-blue-500'}`}>
                                                        {art.affiliateType || 'AMAZON'}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="flex gap-4">
                                                <button
                                                    onClick={() => handleEditClick(art)}
                                                    className="flex-1 bg-clara-green hover:bg-[#003d33] text-white py-3 rounded-xl shadow-md border border-[#003d33] flex items-center justify-center gap-2 transition-all"
                                                    title="Modifier"
                                                >
                                                    <Icon name="Edit3" size={18} />
                                                    <span className="text-xs font-bold uppercase">Modifier</span>
                                                </button>
                                                <button
                                                    onClick={() => setDeletingId(art.id)}
                                                    className="flex-1 bg-red-600 hover:bg-red-700 text-white py-3 rounded-xl shadow-md border border-red-800 flex items-center justify-center gap-2 transition-all"
                                                    title="Supprimer"
                                                >
                                                    <Icon name="Trash2" size={18} />
                                                    <span className="text-xs font-bold uppercase">Supprimer</span>
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Prévisualisation */}
                {isPreview && (
                    <div className="fixed inset-0 z-[150] bg-clara-cream overflow-y-auto pt-24 fade-in">
                        <div className="max-w-4xl mx-auto px-6 mb-12">
                            <div className="flex justify-between items-center bg-clara-green text-white p-6 rounded-2xl shadow-2xl sticky top-4 z-[160]">
                                <div className="flex items-center gap-3">
                                    <Icon name="Eye" />
                                    <p className="font-bold">Prévisualisation</p>
                                </div>
                                <div className="flex gap-4">
                                    <button
                                        onClick={handleTogglePreview}
                                        className="bg-white/10 px-6 py-3 rounded-xl font-bold transition"
                                    >
                                        Retour
                                    </button>
                                    <button
                                        onClick={handleAddOrUpdateArticle}
                                        className="bg-white text-clara-green px-8 py-3 rounded-xl font-bold shadow-xl transition"
                                    >
                                        {editingId ? "Sauvegarder" : "Publier"}
                                    </button>
                                </div>
                            </div>
                        </div>
                        <div className="bg-white rounded-t-[3rem] shadow-sm border-t overflow-hidden">
                            <ArticleLayout
                                article={previewData}
                                onBack={handleTogglePreview}
                                allArticles={articles}
                                onNavigate={navigateTo}
                            />
                        </div>
                    </div>
                )}
            </main>

            {/* Footer */}
            <footer className="bg-[#1A1A1A] text-white py-20 px-6 border-t border-white/5 mt-auto">
                <div className="container mx-auto grid md:grid-cols-3 gap-16">
                    <div>
                        <div className="text-3xl font-serif font-bold mb-8 cursor-default select-none text-white">
                            LeCh<span onClick={handleAdminTrigger} className="cursor-default hover:text-clara-burgundy transition-colors duration-200">o</span>ixDeClara
                        </div>
                        <p className="text-gray-600 text-sm italic leading-relaxed max-w-xs">
                            "Moi c'est Clara. Je guide les hommes attentionnés dans leur choix de cadeaux pour leur chérie."
                        </p>
                    </div>
                    <div className="text-gray-600 text-[10px] space-y-4 uppercase tracking-widest font-bold">
                        <div onClick={() => navigateTo('home')} className="hover:text-white transition cursor-pointer">
                            Accueil
                        </div>
                        <div onClick={() => navigateTo('about')} className="hover:text-white transition cursor-pointer">
                            Qui est Clara ?
                        </div>
                        <div onClick={() => navigateTo('legal')} className="hover:text-white transition cursor-pointer">
                            Mentions Légales
                        </div>
                        <div onClick={() => navigateTo('privacy')} className="hover:text-white transition cursor-pointer">
                            Confidentialité
                        </div>
                        <div onClick={() => navigateTo('affiliation')} className="hover:text-white transition cursor-pointer">
                            Affiliation
                        </div>
                    </div>
                    <div className="text-gray-600 text-sm">
                        <p className="font-bold text-white mb-4 uppercase tracking-widest text-[10px]">Contact</p>
                        <p className="italic text-gray-600 mb-8 text-xs">nova.iris.kael@gmail.com</p>
                        <p className="text-gray-600 text-[10px] mt-4 font-mono">Je guide les hommes attentionnés.</p>
                    </div>
                </div>
                <div className="container mx-auto mt-20 pt-8 border-t border-white/5 text-[10px] text-gray-700 font-mono text-center">
                    © 2026 LECHOIXDECLARA.FR
                </div>
            </footer>
        </div>
    );
}

export default App;
